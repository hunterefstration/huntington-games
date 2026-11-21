// Tiny static server for local play and benchmarks (localhost skips the licence gate).
//   node tools/bench/serve.mjs [port]        serves the repo root, default port 8090
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const TYPES = { html: 'text/html; charset=utf-8', js: 'text/javascript', mjs: 'text/javascript', css: 'text/css', json: 'application/json', jpg: 'image/jpeg', png: 'image/png', svg: 'image/svg+xml', mp3: 'audio/mpeg', ogg: 'audio/ogg', wasm: 'application/wasm' };

export function startServer(port = 0, root = ROOT) {
    const server = http.createServer((q, r) => {
        let rel; try { rel = decodeURIComponent(q.url.split('?')[0]); } catch (e) { r.writeHead(400); return r.end('bad url'); }
        let f = path.normalize(path.join(root, rel));
        if (!f.startsWith(root)) { r.writeHead(403); return r.end('no'); }
        if (rel.endsWith('/')) f = path.join(f, 'index.html');
        fs.readFile(f, (e, b) => {
            if (e) { r.writeHead(404); return r.end('not found'); }
            r.writeHead(200, { 'content-type': TYPES[f.split('.').pop().toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store' }); r.end(b);
        });
    });
    return new Promise(res => server.listen(port, '127.0.0.1', () => res({ server, port: server.address().port, base: 'http://127.0.0.1:' + server.address().port + '/' })));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const { base } = await startServer(+process.argv[2] || 8090);
    console.log('Serving ' + ROOT + ' at ' + base);
}
