/**
 * leaflet-trails
 *
 * @author    Raruto
 * @license   GPL-3.0+
 * @link https://github.com/Raruto/leaflet-trails
 * @desc Leaflet plugin that allows easy integration with Lonvia's Waymarked Trails Site
 */
(function() {

	L.Map.addInitHook(function() {
		this._trails_api = new L.Class.WaymarkedTrails(this);
		this.on("layeradd", function(e) {
			if (e.layer.options.pointable) {
				this._trails_api.addRouteTag(e.layer.options.id || e.layer.options.route_tag);
			}
		});
		this.on("layerremove", function(e) {
			if (e.layer.options.pointable) {
				this._trails_api.removeRouteTag(e.layer.options.id || e.layer.options.route_tag);
			}
		});
	});

	L.Class.WaymarkedTrails = L.Class.extend({

		includes: L.Evented ? L.Evented.prototype : L.Mixin.Events,

		initialize: function(map) {
			this.route_tags = [];
			this._map = map;
			this._map.on("pointable_mouseclick", this._onPointableMouseClick, this);
		},

		_onPointableMouseClick: function(e) {
			var query = this.buildQuery(e.latlng, this._map.getZoom());
			if (!query) return;

			this.getData(query, L.bind(this._onOverpassResponse, this, {
				latlng: e.latlng,
				query: query,
			}));
		},

		_onOverpassResponse: function(request, response) {
			this._map.fire('overpass_response', {
				request: request,
				response: response
			});

			var html = this._toHTML(response);
			if (!html) return;

			html += this._googleMapsLink(request.latlng, this._map.getZoom());

			this._map.openPopup(html, request.latlng);
		},

		buildQuery: function(latlng, zoom) {
			var i, route_tag, route_tags = "";
			var network_tags, network = "";

			var radius = 5000;
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

			var overpass_query = '[out:json];(relation["route"~"' + route_tags + '"]' + network + '(around:' + radius + ',' + latlng.lat + ',' + latlng.lng + '););out;>;';

			return overpass_query;
		},

		getData: function(queryString, action) {
			this._pendingRequest = true;
			// Construct the query URL to get data from the Overpass Turbo API Interpreter
			var url = 'https://overpass-api.de/api/interpreter?data=' + encodeURIComponent(queryString) + '&callback=?';
			this.ajax(url, function(xmlhttp) {
				this._pendingRequest = false;
				var json = JSON.parse(xmlhttp.responseText);
				action(json);
			});
		},

		ajax: function(xmldocpath, completecallback, errorcallback) {
			var xmlhttp = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject('Microsoft.XMLHTTP');
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

		addRouteTag: function(route_tag) {
			this.route_tags.push(route_tag);
			return this.route_tags;
		},

		removeRouteTag: function(route_tag) {
			for (var i in this.route_tags) {
				if (this.route_tags[i] && this.route_tags[i] === route_tag) {
					this.route_tags.splice(i, 1);
				}
			}
			return this.route_tags;
		},

		_toHTML: function(data) {
			var i, relation;
			var route_id, route_name, route_desc, route_ref, osmc_symbol;

			var link, html = "";
			var ul, li, img;

			var baseUrl, baseSymbol, baseRoute;

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

		_googleMapsLink: function(latlng, zoom) {
			var link = document.createElement('a');
			link.className = "google-maps-link";
			link.href = "https://maps.google.com/?q=loc:" + latlng.lat + "," + latlng.lng + "&t=h&z=" + zoom;
			link.target = "_blank";
			link.innerHTML = "View on Google Maps";
			return link.outerHTML;
		},

	});

	L.Layer.include({
		autoToggle: function(map, minZoom, maxZoom) {
			map.on('zoom', function(e) {
				var zoom = map.getZoom();
				if (typeof maxZoom === "undefined") maxZoom = typeof this.options.maxZoom !== "undefined" ? this.options.maxZoom : map.getMaxZoom();
				if (typeof minZoom === "undefined") maxZoom = typeof this.options.minZoom !== "undefined" ? this.options.minZoom : map.getMinZoom();
				var hasLayer = map.hasLayer(this);
				if (!hasLayer && (zoom >= minZoom && zoom < maxZoom)) {
					this.addTo(map);
					this.bringToFront();
				} else if (hasLayer && (zoom < minZoom || zoom >= maxZoom)) {
					this.removeFrom(map);
				}
			}, this);
		}
	});

})();
