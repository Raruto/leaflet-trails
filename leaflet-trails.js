/**
 * leaflet-trails
 *
 * @author    Raruto
 * @license   GPL-3.0+
 * @link https://github.com/Raruto/leaflet-trails
 * @desc Leaflet plugin that allows easy integration with Lonvia's Waymarked Trails Site
 */
(function() {
	const LeafletMap = L.LeafletMap || L.Map;

	LeafletMap.addInitHook(function() {
		this._trails_api = new L.Class.WaymarkedTrails(this);
		this.on("layeradd", function(e) { if (e.layer.options.pointable) this._trails_api.addRouteTag(e.layer.options.id || e.layer.options.route_tag); });
		this.on("layerremove", function(e) { if (e.layer.options.pointable) this._trails_api.removeRouteTag(e.layer.options.id || e.layer.options.route_tag); });

		if (this.options.trailsControl) {

			let routes = {};
			const overlays = {};
			const controls = {};

			if (this.options.trailsControl === true) {
				routes = {
					"Hiking": {
						trails: 'hiking',
						autoToggle: false,
					},
					"Cycling": {
						trails: ['cycling', 'mtb'],
						autoToggle: false,
					},
					"Slopes": {
						trails: ['skating', 'slopes'],
						autoToggle: false,
					},
					"Riding": {
						trails: 'riding',
						autoToggle: false,
					},
				};
			} else if (typeof this.options.trailsControl === "object") {
				routes = this.options.trailsControl;
			}

			this.once('initHooks_called', function() {

				for (let id in routes) {

					if (typeof routes[id].trails === 'object') {
						overlays[id] = new L.FeatureGroup();
						for (let j = 0; j < routes[id].trails.length; j++) {
							overlays[id].addLayer(tileLayer(routes[id].trails[j], routes[id]));
						}
					} else if (typeof routes[id].trails === 'string') {
						overlays[id] = tileLayer(routes[id].trails, routes[id]);
					}

					if (overlays[id] && (typeof routes[id].autoToggle === "undefined" || routes[id].autoToggle)) {
						overlays[id].autoToggle(this, routes[id].minZoom, routes[id].maxZoom);
					}

					controls[id] = controlLayers(id, routes[id]);

					if (overlays[id]) {
						controls[id].addOverlay(overlays[id], (routes[id].label || id.charAt(0).toUpperCase() + id.slice(1)));
					}
					controls[id].addTo(this);

				}

				if (this.controls) this.controls.trails = controls;

				this.fire('trailsControl_loaded');

			}, this);

		}

	});

	function tileLayer(route_id, options) {
		const opts = Object.assign({}, {
			id: route_id,
			pointable: true,
			crossOrigin: true,
			attribution: '&copy; <a href="http://waymarkedtrails.org">Sarah Hoffmann</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)',
			maxZoom: 18,
		}, options);
		['trails', 'autoToggle', 'minZoom'].forEach(e => delete opts[e]);
		return new L.TileLayer('https://tile.waymarkedtrails.org/{id}/{z}/{x}/{y}.png', opts);
	}

	function controlLayers(route_id, options) {
		return new (L.LayersControl || L.Control.Layers)(null, null, {
			position: "bottomleft",
			collapsed: false,
			// inline: true,
			className: 'leaflet-trails-button ' + (options.className || route_id.toLowerCase()) + '-control',
		});
	}

	const waymarkedMethods = {
		_initializeWaymarkedTrails(map) {
			this.route_tags = [];
			this._map = map;
			this._map.on("pointable_mouseclick", this._onPointableMouseClick, this);
		},

		_onPointableMouseClick(e) {
			const pointed = [];
			this._map.eachLayer(layer => {
				if (layer.options.pointable && layer.isPointablePixel && layer.isPointablePixel()) {
					pointed.push(layer.options.id || layer.options.route_tag);
				}
			});
			const routes = [...new Set(pointed.length ? pointed : this.route_tags)];
			if (!routes.length) return;

			if (this._trailsRequest) this._trailsRequest.abort();
			const controller = this._trailsRequest = new AbortController();
			const zoom = this._map.getZoom();
			const query = this.buildQuery(e.latlng, zoom);
			const popup = new L.Popup().setLatLng(e.latlng).setContent('Loading trails...').openOn(this._map);
			const timeout = setTimeout(() => controller.abort(), 15000);

			this.getData(routes, query.bbox, controller.signal).then(async results => {
				let nearby = false;
				if (query.retryBbox && !controller.signal.aborted &&
					results.every(result => result.status === 'fulfilled' && !result.value.results.length)) {
					results = await this.getData(routes, query.retryBbox, controller.signal);
					nearby = true;
				}
				clearTimeout(timeout);
				if (this._trailsRequest !== controller) return;
				this._trailsRequest = null;
				if (!this._map.hasLayer(popup)) return;
				const content = this._toHTML(results, nearby);
				const mapsLink = document.createElement('div');
				mapsLink.innerHTML = this._googleMapsLink(e.latlng, zoom);
				content.appendChild(mapsLink.firstChild);
				popup.setContent(content);
				this._map.fire('trails_response', { latlng: e.latlng, results: results });
			});
		},

		buildQuery(latlng, zoom) {
			const radius = zoom >= 17 ? 5 : zoom >= 15 ? 10 : zoom >= 12 ? 50 : zoom <= 8 ? 5000 : 100;
			const point = (L.EPSG3857 || L.CRS.EPSG3857).project(latlng);
			const cosLat = Math.max(Math.cos(latlng.lat * Math.PI / 180), 0.01);
			const offset = radius / cosLat;
			const retryOffset = Math.min(500 / cosLat, 8 * 40075016.68557849 / (256 * Math.pow(2, zoom)));
			const bbox = distance => [point.x - distance, point.y - distance, point.x + distance, point.y + distance].join(',');
			return { bbox: bbox(offset), retryBbox: retryOffset > offset ? bbox(retryOffset) : null };
		},

		getData(routes, bbox, signal) {
			return Promise.allSettled(routes.map(async route => {
				if (!['hiking', 'cycling', 'mtb', 'skating', 'slopes', 'riding'].includes(route)) {
					throw new Error('Unsupported trail layer: ' + route);
				}
				const url = 'https://' + route + '.waymarkedtrails.org/api/v1/list/by_area?bbox=' + encodeURIComponent(bbox) + '&limit=100';
				const response = await fetch(url, { signal: signal });
				if (!response.ok) throw new Error(route + ': HTTP ' + response.status);
				const data = await response.json();
				if (!Array.isArray(data.results)) throw new Error(route + ': invalid response');
				return { route: route, results: data.results };
			}));
		},

		addRouteTag(route_tag) {
			this.route_tags.push(route_tag);
			return this.route_tags;
		},

		removeRouteTag(route_tag) {
			for (let i in this.route_tags) {
				if (this.route_tags[i] && this.route_tags[i] === route_tag) {
					this.route_tags.splice(i, 1);
				}
			}
			return this.route_tags;
		},

		_toHTML(results, nearby) {
			const content = document.createElement('div');
			const list = document.createElement('ul');
			list.className = 'leaflet-trails';
			const errors = [];
			for (const result of results) {
				if (result.status === 'rejected') {
					errors.push(result.reason);
					continue;
				}
				const route = result.value.route;
				for (const trail of result.value.results) {
					const link = document.createElement('a');
					link.href = 'https://' + route + '.waymarkedtrails.org/#route?id=' + encodeURIComponent(trail.id) + '&type=' + encodeURIComponent(trail.type || 'relation');
					link.target = '_blank';
					link.rel = 'noopener noreferrer';
					if (trail.symbol_id) {
						const img = document.createElement('img');
						img.src = 'https://' + route + '.waymarkedtrails.org/api/v1/symbols/id/' + encodeURIComponent(trail.symbol_id);
						img.alt = '';
						img.onerror = () => img.remove();
						link.appendChild(img);
					}
					link.appendChild(document.createTextNode(trail.name || (trail.itinerary && trail.itinerary.join(' - ')) || trail.ref || String(trail.id)));
					const li = document.createElement('li');
					li.appendChild(link);
					list.appendChild(li);
				}
			}
			if (list.children.length) {
				content.appendChild(list);
			}
			else if (!errors.length) content.appendChild(document.createTextNode('No trails found nearby.'));
			if (errors.length) {
				console.error('Waymarked Trails request failed:', errors);
				const message = document.createElement('p');
				message.textContent = 'Could not load all trails. Please try again.';
				content.appendChild(message);
			}
			return content;
		},

		_googleMapsLink(latlng, zoom) {
			const link = document.createElement('a');
			link.className = "google-maps-link";
			link.href = "https://maps.google.com/?q=loc:" + latlng.lat + "," + latlng.lng + "&t=h&z=" + zoom;
			link.target = "_blank";
			link.innerHTML = "View on Google Maps";
			return link.outerHTML;
		},

	};

	if (L.version.startsWith('1.')) {
		waymarkedMethods.initialize = waymarkedMethods._initializeWaymarkedTrails;
		waymarkedMethods.includes = L.Evented.prototype;
		L.Class.WaymarkedTrails = L.Class.extend(waymarkedMethods);
	} else {
		L.Class.WaymarkedTrails = class extends L.Evented {
			constructor(map) {
				super();
				this._initializeWaymarkedTrails(map);
			}
		};
		L.Class.WaymarkedTrails.include(waymarkedMethods);
	}

	L.Layer.include({
		autoToggle(map, minZoom, maxZoom) {
			this._autoToggle(map, minZoom, maxZoom);
			map.on('zoom', this._autoToggle.bind(this, map, minZoom, maxZoom));
		},
		_autoToggle(map, minZoom, maxZoom) {
			const zoom = map.getZoom();
			if (typeof maxZoom === "undefined") maxZoom = typeof this.options.maxZoom !== "undefined" ? this.options.maxZoom : map.getMaxZoom();
			if (typeof minZoom === "undefined") minZoom = typeof this.options.minZoom !== "undefined" ? this.options.minZoom : map.getMinZoom();
			const hasLayer = map.hasLayer(this);
			if (!hasLayer && (zoom >= minZoom && zoom <= maxZoom)) {
				this.addTo(map);
				this.bringToFront();
			} else if (hasLayer && (zoom < minZoom || zoom > maxZoom)) {
				this.removeFrom(map);
			}
		}
	});

})();
