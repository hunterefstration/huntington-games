#!/usr/bin/env node
// Builds Sovereign/data/{map50,map110,cities,countries}.json from public data packages.
// Sources (downloaded with `npm pack` into $HG_TOOLS/sov-src, outside the repo):
//   world-atlas@2.0.2 (Natural Earth borders, public domain), world-countries@5.1.0 (ODbL, mledoze/countries),
//   all-the-cities@3.1.0 (GeoNames, CC BY 4.0). Needs pbf in $HG_TOOLS/node_modules (tools/setup-tools.sh + npm i pbf@3).
// Usage: node tools/sovereign-data.js
const fs = require('fs'), path = require('path'), cp = require('child_process');
const T = process.env.HG_TOOLS || '/tmp/hg-tools', SRC = path.join(T, 'sov-src'), OUT = path.join(__dirname, '..', 'Sovereign', 'data');
const PKGS = ['world-atlas@2.0.2', 'world-countries@5.1.0', 'all-the-cities@3.1.0'];
fs.mkdirSync(SRC, { recursive: true }); fs.mkdirSync(OUT, { recursive: true });
for (const p of PKGS) {
  const dir = path.join(SRC, p.split('@')[0]);
  if (fs.existsSync(dir)) continue;
  const tgz = cp.execSync('npm pack ' + p, { cwd: SRC }).toString().trim().split('\n').pop();
  fs.mkdirSync(dir); cp.execSync('tar xzf ' + tgz + ' -C ' + dir + ' --strip-components=1', { cwd: SRC });
}
const C = require(path.join(SRC, 'world-countries/countries.json'));
const EXTRA = ['TWN', 'UNK', 'PSE', 'VAT'];
const sov = C.filter(x => x.unMember || EXTRA.includes(x.cca3));
const SOV = new Set(sov.map(x => x.cca3));
const byNum = Object.fromEntries(C.map(x => [x.ccn3, x]));
// Map features that are not sovereign states -> the state that runs them ('' = unowned / disputed)
const OWNER = {
  MNP: 'USA', VIR: 'USA', GUM: 'USA', ASM: 'USA', PRI: 'USA',
  SGS: 'GBR', IOT: 'GBR', SHN: 'GBR', PCN: 'GBR', AIA: 'GBR', FLK: 'GBR', CYM: 'GBR', BMU: 'GBR', VGB: 'GBR', TCA: 'GBR', MSR: 'GBR', JEY: 'GBR', GGY: 'GBR', IMN: 'GBR',
  NIU: 'NZL', COK: 'NZL', ABW: 'NLD', CUW: 'NLD', SXM: 'NLD',
  SPM: 'FRA', WLF: 'FRA', MAF: 'FRA', BLM: 'FRA', PYF: 'FRA', NCL: 'FRA', ATF: 'FRA',
  ALA: 'FIN', GRL: 'DNK', FRO: 'DNK', MAC: 'CHN', HKG: 'CHN', HMD: 'AUS', NFK: 'AUS', ESH: '', ATA: ''
};
const BYNAME = { 'Somaliland': 'SOM', 'Kosovo': 'UNK', 'N. Cyprus': 'CYP', 'Indian Ocean Ter.': 'AUS', 'Siachen Glacier': 'IND' };
const missing = new Set();
function mapFile(res) {
  const t = require(path.join(SRC, 'world-atlas/countries-' + res + '.json'));
  const geoms = t.objects.countries.geometries.map(g => {
    const w = byNum[g.id], nm = g.properties.name;
    let c;
    if (w && SOV.has(w.cca3)) c = w.cca3;
    else if (w && w.cca3 in OWNER) c = OWNER[w.cca3];
    else if (nm in BYNAME) c = BYNAME[nm];
    else { missing.add(nm); c = ''; }
    const o = { type: g.type, arcs: g.arcs, c };
    if (!w || !SOV.has(w.cca3)) o.n = nm;
    return o;
  });
  const out = { transform: t.transform, arcs: t.arcs, geoms };
  fs.writeFileSync(path.join(OUT, 'map' + res + '.json'), JSON.stringify(out));
  return new Set(geoms.map(g => g.c));
}
const have50 = mapFile('50m'), have110 = mapFile('110m');
if (missing.size) throw new Error('no owner for: ' + [...missing].join(', '));
// Countries: the static facts the map and menus need (game stats live in data/stats.tsv)
const countries = sov.map(x => ({
  id: x.cca3, c2: x.cca2, name: x.name.common, official: x.name.official, flag: x.flag,
  region: x.region, sub: x.subregion, capital: (x.capital || [])[0] || '', ll: x.latlng, area: x.area,
  borders: (x.borders || []).filter(b => SOV.has(b)), landlocked: !!x.landlocked,
  cur: Object.keys(x.currencies || {})[0] || '', curName: (Object.values(x.currencies || {})[0] || {}).name || '',
  langs: Object.values(x.languages || {}).slice(0, 3), demonym: ((x.demonyms || {}).eng || {}).m || '',
  onMap: have50.has(x.cca3)
})).sort((a, b) => a.name.localeCompare(b.name));
fs.writeFileSync(path.join(OUT, 'countries.json'), JSON.stringify(countries));
// Cities: capital + the biggest places of each state (territories count for their owner)
const Pbf = require(path.join(T, 'node_modules/pbf'));
const pbf = new Pbf(fs.readFileSync(path.join(SRC, 'all-the-cities/cities.pbf')));
const all = []; let lat = 0, lon = 0;
while (pbf.pos < pbf.length) all.push(pbf.readMessage((tag, o, p) => {
  if (tag === 2) o.name = p.readString(); else if (tag === 3) o.cc = p.readString(); else if (tag === 7) o.fc = p.readString();
  else if (tag === 9) o.pop = p.readVarint(); else if (tag === 10) { lon += p.readSVarint(); o.lon = lon / 1e5; }
  else if (tag === 11) { lat += p.readSVarint(); o.lat = lat / 1e5; } else if (tag === 1) p.readSVarint(); else if (tag === 4 || tag === 5 || tag === 6 || tag === 8) p.readString();
}, { name: '', cc: '', fc: '', pop: 0, lon: 0, lat: 0 }));
const byC2 = Object.fromEntries(C.map(x => [x.cca2, x.cca3]));
const owner3 = c3 => SOV.has(c3) ? c3 : (OWNER[c3] || '');
const groups = {};
for (const ci of all) {
  const o = owner3(byC2[ci.cc] || ''); if (!o) continue;
  (groups[o] = groups[o] || []).push(ci);
}
const PER = 30, cities = {};
for (const id of SOV) {
  const list = (groups[id] || []).sort((a, b) => b.pop - a.pop);
  const capName = (sov.find(x => x.cca3 === id).capital || [])[0];
  let cap = list.filter(x => x.fc === 'PPLC' && byC2[x.cc] === id)[0] || list.find(x => x.name === capName);
  const pick = cap ? [cap] : [];
  for (const ci of list) {
    if (pick.length >= PER) break;
    if (pick.includes(ci)) continue;
    if (pick.some(p => Math.abs(p.lat - ci.lat) < 0.25 && Math.abs(p.lon - ci.lon) < 0.25)) continue; // suburbs of a bigger city
    pick.push(ci);
  }
  // [name, lon, lat, population, isCapital]
  cities[id] = pick.map(p => [p.name, +p.lon.toFixed(3), +p.lat.toFixed(3), p.pop, p === cap ? 1 : 0]);
}
fs.writeFileSync(path.join(OUT, 'cities.json'), JSON.stringify(cities));
const noCap = [...SOV].filter(id => !(cities[id] || []).some(x => x[4]));
console.log('countries', countries.length, 'not on 50m map:', countries.filter(x => !x.onMap).map(x => x.id).join(' '),
  '| cities', Object.values(cities).reduce((s, l) => s + l.length, 0), '| no capital:', noCap.join(' '));
for (const f of fs.readdirSync(OUT)) console.log(f, fs.statSync(path.join(OUT, f)).size);
