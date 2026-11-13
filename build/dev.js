const esbuild = require('esbuild');
const { createServer } = require('node:http');

const cdnPrefix = /https:\/\/unpkg\.com\/leaflet-trails(?:@[^/\s"'<>]+)?\//g;
const pluginPrefix = /(["'`])leaflet-trails(?:@[^/\s"'<>]+)?\//g;

async function startServer(port = 8080) {
  const builds = await Promise.all([
    esbuild.context({ entryPoints: ['leaflet-trails.js'], outfile: 'leaflet-trails.min.js', minify: true }),
    esbuild.context({ entryPoints: ['leaflet-trails.css'], outfile: 'leaflet-trails.min.css', minify: true }),
  ]);
  let server;
  try {
    await Promise.all(builds.map(build => build.watch()));
    const assets = await builds[0].serve({ servedir: '.', host: '127.0.0.1', port: 0 });
    server = createServer(async (request, response) => {
      try {
        const upstream = await fetch(`http://127.0.0.1:${assets.port}${request.url}`, {
          method: request.method === 'HEAD' ? 'GET' : request.method,
          headers: { 'Accept-Encoding': 'identity' },
        });
        const headers = Object.fromEntries(upstream.headers);
        let body = Buffer.from(await upstream.arrayBuffer());
        if ((headers['content-type'] || '').startsWith('text/html')) {
          body = Buffer.from(body.toString().replace(cdnPrefix, '/').replace(pluginPrefix, '$1/')
            .replace(/(["'])\/leaflet-trails\.(js|css)(?=[?"'])/g, '$1/leaflet-trails.min.$2'));
        }
        delete headers['transfer-encoding'];
        headers['content-length'] = body.length;
        headers['cache-control'] = 'no-store';
        response.writeHead(upstream.status, headers);
        response.end(request.method === 'HEAD' ? undefined : body);
      } catch (error) {
        console.error(error);
        response.writeHead(500).end('Development server error');
      }
    });
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, '127.0.0.1', () => { server.off('error', reject); resolve(); });
    });
    return {
      port: server.address().port,
      close: () => Promise.all([
        new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())),
        ...builds.map(build => build.dispose()),
      ]),
    };
  } catch (error) {
    if (server && server.listening) await new Promise(resolve => server.close(resolve));
    await Promise.all(builds.map(build => build.dispose()));
    throw error;
  }
}

async function main() {
  const server = await startServer();
  console.log(`Serving on http://127.0.0.1:${server.port}`);
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, async () => { await server.close(); });
  }
}

module.exports = { startServer };
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
