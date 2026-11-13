const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');
const { After, AfterAll, BeforeAll, Then, setDefaultTimeout } = require('@cucumber/cucumber');

setDefaultTimeout(30000);
let browser;
BeforeAll(async () => { browser = await chromium.launch(); });
After(async function () { if (this.page) await this.page.close(); });
AfterAll(async () => { if (browser) await browser.close(); });

Then('the {string} trails bundle works with Leaflet {string}', async function (bundle, version) {
  const page = this.page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('https://tiles.invalid/**', route => route.fulfill({ status: 204 }));
  await page.setContent('<div id="map" style="width:400px;height:300px"></div>');
  const dist = `https://unpkg.com/leaflet@${version}/dist`;
  await page.addStyleTag({ url: `${dist}/leaflet.css` });
  await page.addScriptTag({ url: `${dist}/${version === '1.9.4' ? 'leaflet.js' : 'leaflet-global.js'}` });
  await page.addScriptTag({ path: path.join(__dirname, '..', '..', `leaflet-trails${bundle === 'minified' ? '.min' : ''}.js`) });
  const result = await page.evaluate(() => {
    const map = new (L.LeafletMap || L.Map)('map', {
      center: [1, 2], zoom: 12,
      trailsControl: { Routes: { trails: ['cycling', 'hiking'], minZoom: 10, maxZoom: 14 } },
    });
    const layer = new L.TileLayer('https://tiles.invalid/{z}/{x}/{y}.png', { pointable: true, id: 'cycling' }).addTo(map);
    const query = map._trails_api.buildQuery({ lat: 1, lng: 2 }, map.getZoom());
    const tags = map._trails_api.route_tags.slice();
    let responseEvent = false;
    map.on('overpass_response', () => { responseEvent = true; });
    map._trails_api.getData = (query, callback) => callback({
      elements: [{ id: 123, tags: { route: 'bicycle', name: 'Cycle route' } }],
    });
    map.fire('pointable_mouseclick', { latlng: new L.LatLng(1, 2) });
    const popup = map.getContainer().querySelector('.leaflet-popup-content')?.textContent.includes('Cycle route');
    layer.remove();
    const remaining = map._trails_api.route_tags.slice();
    map.fire('initHooks_called');
    const activeRoutes = map._trails_api.route_tags.slice().sort();
    map.setZoom(9, { animate: false });
    const hiddenRoutes = map._trails_api.route_tags.slice();
    map.setZoom(12, { animate: false });
    const restoredRoutes = map._trails_api.route_tags.slice().sort();
    const actual = {
      version: L.version, query, tags, remaining, activeRoutes, hiddenRoutes, restoredRoutes,
      controls: map.getContainer().querySelectorAll('.leaflet-control-layers').length,
      routes: map.getContainer().textContent.includes('Routes'), responseEvent, popup,
    };
    map.remove();
    return actual;
  });
  assert.deepEqual(result, {
    version, query: '[out:json];(relation["route"~"^bicycle$"](around:50,1,2););out;>;',
    tags: ['cycling'], remaining: [], activeRoutes: ['cycling', 'hiking'], hiddenRoutes: [],
    restoredRoutes: ['cycling', 'hiking'], controls: 1, routes: true, responseEvent: true, popup: true,
  });
  assert.deepEqual(errors, []);
});
