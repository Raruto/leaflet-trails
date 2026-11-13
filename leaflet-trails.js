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
			const query = this.buildQuery(e.latlng, this._map.getZoom());
			if (!query) return;

			this.getData(query, this._onOverpassResponse.bind(this, {
				latlng: e.latlng,
				query: query,
			}));
		},

		_onOverpassResponse(request, response) {
			this._map.fire('overpass_response', {
				request: request,
				response: response
			});

			let html = this._toHTML(response);
			if (!html) {
				console.warn("Overpass data not found for this location.");
				return;
			}

			html += this._googleMapsLink(request.latlng, this._map.getZoom());

			this._map.openPopup(html, request.latlng);
		},

		buildQuery(latlng, zoom) {
			let i, route_tag, route_tags = "";
			let network_tags, network = "";

			let radius = 5000;
			if (zoom >= 17) radius = 5;
			else if (zoom >= 15) radius = 10;
			else if (zoom >= 12) radius = 50;
			else if (zoom <= 8) radius = 5000;
			else radius = 100;

			// network_tags = '^iwn$';
			// if (zoom >= 8) network_tags += '|^nwn$';
			// if (zoom >= 9) network_tags += '|^rwn$';
			// if (zoom >= 10) network_tags = false;
			// network = network_tags ? '["network"~"' + network_tags + '"]' : '';

			for (i = 0; i < this.route_tags.length; i++) {
				switch (this.route_tags[i]) {
					case 'cycling':
						route_tag = 'bicycle';
						break;
					case 'riding':
						route_tag = 'horse';
						break;
					case 'skating':
						route_tag = 'inline_skates';
						break;
					default:
						route_tag = this.route_tags[i];
						break;
				}
				route_tags += "^" + route_tag + "$|";
			}

			route_tags = route_tags.replace(/\|$/, '');

			if (!route_tags) {
				return false;
			}

			const overpass_query = '[out:json];(relation["route"~"' + route_tags + '"]' + network + '(around:' + radius + ',' + latlng.lat + ',' + latlng.lng + '););out;>;';

			return overpass_query;
		},

		getData(queryString, action) {
			this._pendingRequest = true;
			// Construct the query URL to get data from the Overpass Turbo API Interpreter
			const url = 'https://overpass-api.de/api/interpreter?data=' + encodeURIComponent(queryString) + '&callback=?';
			this.ajax(url, function(xmlhttp) {
				this._pendingRequest = false;
				action(JSON.parse(xmlhttp.responseText));
			}.bind(this));
		},

		ajax(xmldocpath, completecallback, errorcallback) {
			const xmlhttp = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject('Microsoft.XMLHTTP');
			xmlhttp.onreadystatechange = function() {
				if (xmlhttp.readyState === 4) {
					if (xmlhttp.status === 200 && completecallback) {
						completecallback(xmlhttp);
					} else if (errorcallback) {
						errorcallback(xmldocpath);
					}
				}
			};
			try {
				xmlhttp.open('GET', xmldocpath, true);
				xmlhttp.send(null);
			} catch (error) {
				if (errorcallback) {
					errorcallback(xmldocpath);
				}
			}
			return xmlhttp;
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

		_toHTML(data) {
			let i, relation;
			let route_id, route_name, route_desc, route_ref, osmc_symbol;

			let link, html = "";
			let ul, li, img;

			let baseUrl, baseSymbol, baseRoute;

			ul = document.createElement('ul');
			ul.className = "leaflet-trails";

			for (i = 0; i < data.elements.length; i++) {
				relation = data.elements[i];
				route_id = relation.id;

				route_name = relation.tags.name ? relation.tags.name : route_id;
				route_desc = relation.tags.description ? relation.tags.description : false;
				route_ref = relation.tags.ref ? relation.tags.ref : false;

				route_name = (route_name == route_id && route_desc) ? route_desc : route_name;
				route_name = (route_name == route_id && route_ref) ? "relation " + route_ref : route_name;

				switch (relation.tags.route) {
					case 'bicycle':
						baseUrl = 'cycling';
						break;
					case 'horse':
						baseUrl = 'riding';
						break;
					case 'inline_skates':
						baseUrl = 'skating';
						break;
					default:
						baseUrl = relation.tags.route;
						break;
				}
				baseSymbol = "https://" + baseUrl + ".waymarkedtrails.org/api/symbols?osmc:symbol=";
				baseRoute = "https://" + baseUrl + ".waymarkedtrails.org/#route?id=";
				osmc_symbol = relation.tags["osmc:symbol"] ? relation.tags["osmc:symbol"] : false;
				osmc_symbol = (!osmc_symbol && route_ref) ? "red:white:white:" + route_ref + ":black" : osmc_symbol;

				img = document.createElement('img');

				if (osmc_symbol) {
					img.src = baseSymbol + encodeURIComponent(osmc_symbol);
				} else {
					img.src = baseSymbol + encodeURIComponent("red:white:white");
					img.style.filter = "hue-rotate(110deg)";
					img.style.borderRadius = "15px";
				}

				link = document.createElement('a');
				link.href = baseRoute + route_id;
				link.target = "_blank";
				link.innerHTML = img.outerHTML + route_name;

				li = document.createElement('li');
				li.appendChild(link);
				ul.appendChild(li);

			}

			if (ul.children.length == 0) {
				return false;
			}

			html += ul.outerHTML;

			return html;
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
