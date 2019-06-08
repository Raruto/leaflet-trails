# leaflet-trails.js
A Leaflet plugin that allows easy integration with Lonvia's Waymarked Trails Site

_For a working example see [demo](https://raruto.github.io/examples/leaflet-trails/leaflet-trails.html)_

---

## How to use

1. **include CSS & JavaScript**
    ```html
    <head>
    ...
    <style> html, body, #map { height: 100%; width: 100%; padding: 0; margin: 0; } </style>
    <!-- Leaflet (JS/CSS) -->
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.3.4/dist/leaflet.css" />
    <script src="https://unpkg.com/leaflet@1.3.4/dist/leaflet.js"></script>
    <!-- Leaflet-Pointable -->
    <script src="https://unpkg.com/leaflet-pointable@0.0.2/leaflet-pointable.js"></script>
    <!-- Leaflet-Trails -->
    <script src="https://unpkg.com/leaflet-trails@0.0.1/leaflet-trails.js"></script>
    <link rel="stylesheet" href="https://unpkg.com/leaflet-trails@0.0.1/leaflet-trails.css">
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
    var map = L.map('map');
		map.setView(new L.LatLng(43.5978, 12.7059), 5);

		var control = L.control.layers(null, null, {
			collapsed: false
		}).addTo(map);

		var OpenTopoMap = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
			maxZoom: 17,
			attribution: 'Map data: &copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)',
			opacity: 0.90
		});

		var HikingTrails = L.tileLayer('https://tile.waymarkedtrails.org/{id}/{z}/{x}/{y}.png', {
			id: 'hiking',
			pointable: true,
			attribution: '&copy; <a href="http://waymarkedtrails.org">Sarah Hoffmann</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)',
		});
		var CyclingTrails = L.tileLayer('https://tile.waymarkedtrails.org/{id}/{z}/{x}/{y}.png', {
			id: 'cycling',
			pointable: true,
			attribution: '&copy; <a href="http://waymarkedtrails.org">Sarah Hoffmann</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)',
		});

		control.addOverlay(HikingTrails, "Hiking Routes");
		control.addOverlay(CyclingTrails, "Cycling Routes");

		OpenTopoMap.addTo(map);
    </script>
    ```

---

**Compatibile with:** leaflet@1.3.4, leaflet-pointable@0.0.2

---

**Contributors:** [Raruto](https://github.com/Raruto/leaflet-trails)
