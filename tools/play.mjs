#!/usr/bin/env node
// Play the games on this computer: no launcher account, no codes.
//   node tools/play.mjs [port] [--no-open]        (Windows: double-click "Play Huntington Games.cmd")
// Serves this folder on http://localhost:8090/ with a games menu at / (tools/play.html, filled with the launcher's own
// GAMES list so the two never drift apart). On localhost a game skips its licence gate, so each one opens straight
// from its folder. Only this computer can reach the server (it listens on 127.0.0.1).
// Saves live in the browser for exactly this address: the same browser and the same port keep them, which is why a
// busy port is an error here instead of quietly moving to another one.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2), PORT = +(args.find(a => /^\d+$/.test(a)) || process.env.HG_PLAY_PORT || 8090), OPEN = !args.includes('--no-open');
const TYPES = { html: 'text/html; charset=utf-8', js: 'text/javascript', mjs: 'text/javascript', css: 'text/css', json: 'application/json', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp',
    svg: 'image/svg+xml', ico: 'image/x-icon', mp3: 'audio/mpeg', ogg: 'audio/ogg', wav: 'audio/wav', woff: 'font/woff', woff2: 'font/woff2', txt: 'text/plain; charset=utf-8', wasm: 'application/wasm' };

// the launcher's lists, read from its source each time the menu is asked for (edit the launcher, refresh the page)
export function gameLists() {
    const src = fs.readFileSync(path.join(ROOT, 'launcher/js/10-hub/010-where-the-games-live-opened.js'), 'utf8');
    const grab = name => { const m = new RegExp('var ' + name + ' = (\\[[\\s\\S]*?\\n\\]);').exec(src); if (!m) throw new Error('could not find the ' + name + ' list in the launcher'); return new Function('return ' + m[1])(); };
    const tidy = list => list.map(g => {
        const file = fs.existsSync(path.join(ROOT, g.dir, 'index.html')) ? 'index.html' : g.file && fs.existsSync(path.join(ROOT, g.dir, g.file)) ? g.file : null; if (!file) return null;
        return { dir: g.dir, name: g.name, file, img: g.img && fs.existsSync(path.join(ROOT, 'hub', g.img + '.jpg')) ? g.img : null, tags: g.tags || [], desc: g.hero || g.desc || '', credit: g.credit || '' };
    }).filter(Boolean);
    return { games: tidy(grab('GAMES')), more: tidy(grab('EXPERIMENTAL')) };
}
function menuPage() {
    const tpl = fs.readFileSync(path.join(ROOT, 'tools/play.html'), 'utf8'), json = JSON.stringify(gameLists()).replace(/</g, '\\u003c');
    return tpl.replace(/\/\*HG_GAMES\*\/[\s\S]*?\/\*END\*\//, () => json);
}
export function startPlayServer(port = PORT) {
    const server = http.createServer((q, r) => {
        let rel; try { rel = decodeURIComponent(q.url.split('?')[0]); } catch (e) { r.writeHead(400); return r.end('bad address'); }
        if (rel === '/__hg_play') { r.writeHead(200, { 'content-type': 'application/json' }); return r.end('{"hgPlay":true}'); }
        if (rel === '/' || rel === '/index.html') {        // the repo's own index.html is the public site's page, not the menu
            try { const page = menuPage(); r.writeHead(200, { 'content-type': TYPES.html, 'cache-control': 'no-store' }); return r.end(page); }
            catch (e) { r.writeHead(500, { 'content-type': TYPES.txt }); return r.end('The games menu could not be built: ' + e.message); }
        }
        let f = path.normalize(path.join(ROOT, rel));
        if (!f.startsWith(ROOT)) { r.writeHead(403); return r.end('no'); }
        if (rel.endsWith('/')) f = path.join(f, 'index.html');
        fs.readFile(f, (e, b) => {
            if (e) { r.writeHead(404, { 'content-type': TYPES.txt }); return r.end('not found'); }
            r.writeHead(200, { 'content-type': TYPES[f.split('.').pop().toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-cache' }); r.end(b);
        });
    });
    return new Promise((res, rej) => { server.once('error', rej); server.listen(port, '127.0.0.1', () => { const p = server.address().port; res({ server, port: p, url: 'http://localhost:' + p + '/' }); }); });
}
function openBrowser(url) {
    try {
        const cmd = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]] : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
        spawn(cmd[0], cmd[1], { stdio: 'ignore', detached: true }).unref();
    } catch (e) { }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const url = 'http://localhost:' + PORT + '/';
    try {
        await startPlayServer(PORT);
        const n = gameLists(); console.log('\n  Huntington Games is running on this computer.\n\n    ' + url + '\n\n  ' + (n.games.length + n.more.length) + ' games. Keep this window open while you play; close it (or press Ctrl+C) to stop.\n');
        if (OPEN) openBrowser(url);
    } catch (e) {
        if (e && e.code === 'EADDRINUSE') {
            // already running (a second double-click)? then just open the menu again
            const mine = await fetch('http://127.0.0.1:' + PORT + '/__hg_play').then(r => r.json()).then(j => !!j.hgPlay, () => false);
            if (mine) { console.log('\n  Already running: ' + url + '\n'); if (OPEN) openBrowser(url); process.exit(0); }
            console.error('\n  Port ' + PORT + ' is being used by another program, so the games cannot start there.\n  Close that program, or pick another port:  node tools/play.mjs 8091\n  (your saves belong to the address, so a new port starts with fresh saves)\n'); process.exit(1);
        }
        console.error('\n  Could not start: ' + (e && e.message || e) + '\n'); process.exit(1);
    }
}
