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
  const result = await page.evaluate(async () => {
    const map = new (L.LeafletMap || L.Map)('map', {
      center: [1, 2], zoom: 12,
      trailsControl: { Routes: { trails: ['cycling', 'hiking'], minZoom: 10, maxZoom: 14 } },
    });
    const layer = new L.TileLayer('https://tiles.invalid/{z}/{x}/{y}.png', { pointable: true, id: 'cycling' }).addTo(map);
    const tags = map._trails_api.route_tags.slice();
    let responseEvent = false;
    const finished = new Promise(resolve => map.once('trails_response', () => { responseEvent = true; resolve(); }));
    window.fetch = async () => ({ ok: true, json: async () => ({
      results: [{ id: 123, type: 'relation', name: 'Cycle route' }],
    }) });
    map.fire('pointable_mouseclick', { latlng: new L.LatLng(1, 2) });
    await finished;
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
      version: L.version, tags, remaining, activeRoutes, hiddenRoutes, restoredRoutes,
      controls: map.getContainer().querySelectorAll('.leaflet-control-layers').length,
      routes: map.getContainer().textContent.includes('Routes'), responseEvent, popup,
    };
    map.remove();
    return actual;
  });
  assert.deepEqual(result, {
    version, tags: ['cycling'], remaining: [], activeRoutes: ['cycling', 'hiking'], hiddenRoutes: [],
    restoredRoutes: ['cycling', 'hiking'], controls: 1, routes: true, responseEvent: true, popup: true,
  });
  assert.deepEqual(errors, []);
});

Then('trail clicks show results, errors and ignore stale responses', async function () {
  const page = this.page = await browser.newPage();
  await page.route('https://tiles.invalid/**', route => route.fulfill({ status: 204 }));
  await page.route('https://hiking.waymarkedtrails.org/api/v1/symbols/id/**', route =>
    route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg"></svg>' }));
  await page.setContent('<div id="map" style="width:400px;height:300px"></div>');
  await page.addScriptTag({ url: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js' });
  await page.addScriptTag({ path: path.join(__dirname, '..', '..', 'leaflet-trails.js') });
  const result = await page.evaluate(async () => {
    const map = L.map('map', { center: [45, 7], zoom: 15 });
    const hiking = L.tileLayer('https://tiles.invalid/{z}/{x}/{y}.png', { pointable: true, id: 'hiking' }).addTo(map);
    const slopes = L.tileLayer('https://tiles.invalid/{z}/{x}/{y}.png', { pointable: true, id: 'slopes' }).addTo(map);
    const requests = [];
    window.fetch = (url, options) => new Promise(resolve => requests.push({ url, options, resolve }));
    const click = lat => map.fire('pointable_mouseclick', { latlng: L.latLng(lat, 7) });
    const done = () => new Promise(resolve => map.once('trails_response', resolve));
    const response = results => ({ ok: true, json: async () => ({ results }) });
    click(45);
    const loading = map.getContainer().querySelector('.leaflet-popup-content').textContent;
    click(46);
    const oldAborted = requests[0].options.signal.aborted && requests[1].options.signal.aborted;
    const finished = done();
    requests[2].resolve(response([{ id: 123, type: 'relation', name: '<img src=x>', symbol_id: 'cai_test' }]));
    requests[3].resolve(response([{ id: 456, type: 'way', ref: 'Blue' }]));
    await finished;
    const initialPopup = map._popup.getElement().querySelector('.leaflet-popup-content');
    const symbol = initialPopup.querySelector('.leaflet-trails img').src;
    const images = initialPopup.querySelectorAll('.leaflet-trails img').length;
    requests[0].resolve(response([{ id: 999, name: 'Old result' }]));
    requests[1].resolve(response([]));
    await new Promise(resolve => setTimeout(resolve, 0));
    const popup = map._popup.getElement().querySelector('.leaflet-popup-content');
    const links = [...popup.querySelectorAll('.leaflet-trails a')];
    const current = {
      text: popup.textContent,
      hrefs: links.map(link => link.href),
      symbol,
      images,
      lat: map._popup.getLatLng().lat,
      urls: requests.slice(2).map(request => request.url),
    };
    const failed = done();
    click(47);
    requests[4].resolve(response([]));
    requests[5].resolve({ ok: false, status: 503 });
    await failed;
    const error = map._popup.getElement().querySelector('.leaflet-popup-content').textContent;
    const emptyDone = done();
    click(48);
    requests[6].resolve(response([]));
    requests[7].resolve(response([]));
    await new Promise(resolve => setTimeout(resolve, 0));
    requests[8].resolve(response([]));
    requests[9].resolve(response([]));
    await emptyDone;
    const empty = map._popup.getElement().querySelector('.leaflet-popup-content').textContent;
    hiking.isPointablePixel = () => true;
    slopes.isPointablePixel = () => false;
    const retryDone = done();
    click(45);
    const first = requests[10];
    first.resolve(response([]));
    await new Promise(resolve => setTimeout(resolve, 0));
    const retry = requests[11];
    retry.resolve(response([{ id: 777, name: 'Nearby route' }]));
    await retryDone;
    const nearby = map._popup.getElement().querySelector('.leaflet-popup-content').textContent;
    const retryUrls = [first.url, retry.url];
    map.setZoom(10);
    const cappedDone = done();
    click(45);
    requests[12].resolve(response([]));
    await new Promise(resolve => setTimeout(resolve, 0));
    const cappedUrl = requests[13].url;
    requests[13].resolve(response([]));
    await cappedDone;
    const totalRequests = requests.length;
    map.remove();
    return { loading, oldAborted, current, error, empty, nearby, retryUrls, cappedUrl, totalRequests };
  });
  assert.match(result.loading, /Loading trails/);
  assert.equal(result.oldAborted, true);
  assert.match(result.current.text, /<img src=x>/);
  assert.doesNotMatch(result.current.text, /Old result/);
  assert.equal(result.current.images, 1);
  assert.equal(result.current.lat, 46);
  assert.equal(result.current.symbol, 'https://hiking.waymarkedtrails.org/api/v1/symbols/id/cai_test');
  assert.match(result.current.hrefs[1], /slopes\.waymarkedtrails\.org\/#route\?id=456&type=way/);
  assert.ok(result.current.urls.every(url => url.includes('/api/v1/list/by_area?bbox=') && url.includes('limit=100')));
  assert.match(result.error, /Could not load all trails/);
  assert.match(result.empty, /No trails found nearby/);
  assert.match(result.nearby, /showing nearby results.*Nearby route/);
  assert.equal(result.totalRequests, 14);
  assert.ok(result.retryUrls.every(url => new URL(url).hostname === 'hiking.waymarkedtrails.org'));
  const widths = result.retryUrls.map(url => {
    const bbox = new URL(url).searchParams.get('bbox').split(',').map(Number);
    return bbox[2] - bbox[0];
  });
  assert.ok(widths[1] > widths[0] && widths[1] <= 16 * 40075016.68557849 / (256 * 2 ** 15) + 0.001);
  const capped = new URL(result.cappedUrl).searchParams.get('bbox').split(',').map(Number);
  assert.ok(capped[2] - capped[0] <= 1000 / Math.cos(Math.PI / 4) + 0.001);
});
