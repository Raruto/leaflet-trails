# leaflet-trails.js

[![NPM version](https://img.shields.io/npm/v/leaflet-trails.svg?color=red)](https://www.npmjs.com/package/leaflet-trails)
[![License](https://img.shields.io/badge/license-GPL%203-blue.svg?style=flat)](LICENSE)

A Leaflet plugin that allows easy integration with Lonvia's Waymarked Trails Site

_For a working example see one of the following examples:_

- [simple](https://raruto.github.io/leaflet-trails/examples/leaflet-trails_simple.html)
- [minimal](https://raruto.github.io/leaflet-trails/examples/leaflet-trails.html)
- [grouped](https://raruto.github.io/leaflet-trails/examples/leaflet-trails_grouped.html)
- [leaflet-ui](https://raruto.github.io/leaflet-trails/examples/leaflet-trails_ui.html)
- [overlays](https://raruto.github.io/leaflet-trails/examples/leaflet-trails_overlays.html)
- [pane](https://raruto.github.io/leaflet-trails/examples/leaflet-trails_pane.html)

---

## How to use

1. **include CSS & JavaScript**
    ```html
    <head>
    ...
    <style> html, body, #map { height: 100%; width: 100%; padding: 0; margin: 0; } </style>
    <!-- Leaflet (JS/CSS) -->
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <!-- Leaflet-Pointable -->
    <script src="https://unpkg.com/leaflet-pointable@0.2.1/leaflet-pointable.js"></script>
    <!-- Leaflet-Trails -->
    <script src="https://unpkg.com/leaflet-trails@0.3.1/leaflet-trails.js"></script>
    <link rel="stylesheet" href="https://unpkg.com/leaflet-trails@0.3.1/leaflet-trails.css">
    ...
    </head>
    ```
2. **choose a div container used for the slippy map**
    ```html
    <body>
    ...
	  <div id="map"></div>
    ...
    </body>
    ```
3. **create your first simple “leaflet-trails slippy map**
    ```html
    <script>
    {
    const map = new (L.LeafletMap || L.Map)('map');
		map.setView(new L.LatLng(43.5978, 12.7059), 5);

		const control = new (L.LayersControl || L.Control.Layers)(null, null, {
			collapsed: false
		}).addTo(map);

		const OpenTopoMap = new L.TileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
			maxZoom: 17,
			attribution: 'Map data: &copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)',
			opacity: 0.90
		});

		const HikingTrails = new L.TileLayer('https://tile.waymarkedtrails.org/{id}/{z}/{x}/{y}.png', {
			id: 'hiking',
			pointable: true,
			attribution: '&copy; <a href="http://waymarkedtrails.org">Sarah Hoffmann</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)',
		});
		const CyclingTrails = new L.TileLayer('https://tile.waymarkedtrails.org/{id}/{z}/{x}/{y}.png', {
			id: 'cycling',
			pointable: true,
			attribution: '&copy; <a href="http://waymarkedtrails.org">Sarah Hoffmann</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)',
		});

		control.addOverlay(HikingTrails, "Hiking Routes");
		control.addOverlay(CyclingTrails, "Cycling Routes");

		OpenTopoMap.addTo(map);
    }
    </script>
    ```

---

**Compatible with:**
[![Leaflet 1.9.4](https://img.shields.io/badge/Leaflet-1.9.4-1EB300.svg?style=flat)](https://leafletjs.com/reference.html)
[![Leaflet 2.0.0-beta.3](https://img.shields.io/badge/Leaflet-2.0.0--beta.3-1EB300.svg?style=flat)](https://leafletjs.com/reference.html)
[![leaflet-pointable 0.2.1](https://img.shields.io/badge/leaflet--pointable-0.2.1-1EB300.svg?style=flat)](https://github.com/Raruto/leaflet-pointable)


---

**Contributors:** [Raruto](https://github.com/Raruto/leaflet-trails)