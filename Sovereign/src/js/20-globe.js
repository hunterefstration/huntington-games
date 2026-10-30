// The globe: three.js renderer, ocean, land, borders, atmosphere, clouds, city lights.
THREE.ColorManagement.enabled = false; // colours are used exactly as written (display colours)

const Globe = {
  renderer: null, scene: null, camera: null, root: null,
  land: {}, lines: {}, lod: '110m', colorTex: null, colorData: null,
  uni: null, cityPts: null, outline: null, clouds: null, atmo: null,
  dirty: true, night: 0, nightTarget: 0
};

const NOISE_GLSL = `
float hash(vec3 p){ p = fract(p * 0.3183099 + .1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vnoise(vec3 x){ vec3 i = floor(x), f = fract(x); f = f*f*(3.0-2.0*f);
  return mix(mix(mix(hash(i), hash(i+vec3(1,0,0)), f.x), mix(hash(i+vec3(0,1,0)), hash(i+vec3(1,1,0)), f.x), f.y),
             mix(mix(hash(i+vec3(0,0,1)), hash(i+vec3(1,0,1)), f.x), mix(hash(i+vec3(0,1,1)), hash(i+vec3(1,1,1)), f.x), f.y), f.z); }`;

function initGlobe(canvas) {
  const r = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', alpha: false });
  r.outputColorSpace = THREE.LinearSRGBColorSpace;
  r.setClearColor(0x050912);
  Globe.renderer = r;
  const scene = Globe.scene = new THREE.Scene();
  Globe.camera = new THREE.PerspectiveCamera(40, 1, 0.01, 20);
  const root = Globe.root = new THREE.Group(); scene.add(root);

  // shared uniforms
  const tex = Globe.colorTex = new THREE.DataTexture(Globe.colorData = new Uint8Array(256 * 4), 256, 1, THREE.RGBAFormat);
  tex.magFilter = tex.minFilter = THREE.NearestFilter; tex.needsUpdate = true;
  Globe.uni = {
    sunDir: { value: new THREE.Vector3(0, 0, 1) }, night: { value: 0 }, colors: { value: tex },
    hover: { value: -1 }, sel: { value: -1 }, home: { value: -1 }, time: { value: 0 }, alt: { value: 2 }, pxr: { value: 1 }
  };
  const U = Globe.uni;

  // ocean with a faint latitude/longitude grid
  const ocean = new THREE.Mesh(new THREE.SphereGeometry(0.998, 96, 64), new THREE.ShaderMaterial({
    uniforms: U,
    vertexShader: `varying vec3 vN; varying vec3 vW; void main(){ vN = normalize(position); vec4 w = modelMatrix*vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform vec3 sunDir; uniform float night; uniform float alt; varying vec3 vN; varying vec3 vW;
      void main(){
        vec3 n = normalize(vN); float d = dot(n, sunDir);
        float lit = smoothstep(-0.25, 0.35, d);
        vec3 deep = vec3(0.055, 0.15, 0.27), shallow = vec3(0.10, 0.27, 0.42);
        vec3 col = mix(deep, shallow, 0.5 + 0.25 * sin(n.x * 7.0) * sin(n.z * 5.0));
        vec3 v = normalize(cameraPosition - vW);
        float spec = pow(max(dot(reflect(-sunDir, n), v), 0.0), 40.0) * 0.35;
        float lat = asin(clamp(n.y,-1.,1.)) * 57.2958, lon = atan(n.x, n.z) * 57.2958;
        float step = alt > 0.35 ? 15.0 : 5.0;
        vec2 g = abs(fract(vec2(lat, lon) / step + 0.5) - 0.5) * step;
        float w = fwidth(lat) * 1.2;
        float grid = (1.0 - smoothstep(0.0, w, g.x)) + (1.0 - smoothstep(0.0, w * 1.0, g.y));
        col += vec3(0.08, 0.12, 0.18) * clamp(grid, 0., 1.) * 0.6;
        col = col * mix(0.22, 1.0, lit) + spec * lit;
        float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);
        col += vec3(0.15, 0.3, 0.55) * fres * 0.5;
        gl_FragColor = vec4(col, 1.0);
      }`,
    extensions: { derivatives: true }
  }));
  root.add(ocean);

  // land material: colour per country from the lookup texture
  Globe.landMat = new THREE.ShaderMaterial({
    uniforms: U, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
    vertexShader: `attribute float cid; uniform sampler2D colors; uniform float hover, sel, home;
      varying vec3 vN; varying vec3 vCol; varying vec3 vHi; varying vec3 vP;
      void main(){
        vCol = texture2D(colors, vec2((cid + 0.5) / 256.0, 0.5)).rgb;
        vHi = vec3(abs(cid - hover) < 0.5 ? 1.0 : 0.0, abs(cid - sel) < 0.5 ? 1.0 : 0.0, abs(cid - home) < 0.5 ? 1.0 : 0.0);
        vN = normalize(position); vP = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: NOISE_GLSL + `uniform vec3 sunDir; uniform float night, time, alt;
      varying vec3 vN; varying vec3 vCol; varying vec3 vHi; varying vec3 vP;
      void main(){
        vec3 n = normalize(vN); float d = dot(n, sunDir);
        float lit = smoothstep(-0.2, 0.45, d);
        float grain = vnoise(vP * 90.0) * 0.6 + vnoise(vP * 420.0) * 0.4;
        vec3 col = vCol * (0.93 + 0.09 * grain);
        col = mix(col, col * 1.25 + 0.05, vHi.x * 0.6);
        float pulse = 0.5 + 0.5 * sin(time * 3.0);
        col = mix(col, vec3(0.98, 0.84, 0.5), vHi.y * (0.18 + 0.1 * pulse));
        col = mix(col, vec3(1.0, 0.9, 0.6), vHi.z * 0.08);
        col *= mix(0.16, 1.05, lit);
        col += vec3(0.02, 0.03, 0.06) * (1.0 - lit);
        gl_FragColor = vec4(col, 1.0);
      }`
  });

  // atmosphere glow (back faces of a bigger sphere)
  Globe.atmo = new THREE.Mesh(new THREE.SphereGeometry(1.07, 64, 48), new THREE.ShaderMaterial({
    uniforms: U, side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `varying vec3 vN; varying vec3 vW; void main(){ vN = normalize(position); vec4 w = modelMatrix*vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform vec3 sunDir; varying vec3 vN; varying vec3 vW;
      void main(){ vec3 v = normalize(cameraPosition - vW); float rim = dot(vN, v);
        float a = pow(clamp(rim * 1.15 + 0.05, 0.0, 1.0), 2.5);
        float day = 0.35 + 0.65 * smoothstep(-0.4, 0.4, dot(vN, sunDir));
        gl_FragColor = vec4(vec3(0.3, 0.55, 1.0) * a * day, a * day); }`
  }));
  scene.add(Globe.atmo);

  // clouds: soft noise texture drawn once on a small canvas
  Globe.clouds = new THREE.Mesh(new THREE.SphereGeometry(1.012, 64, 48), new THREE.MeshBasicMaterial({
    map: makeCloudTexture(), transparent: true, depthWrite: false, opacity: 0.5
  }));
  Globe.clouds.material.onBeforeCompile = sh => {
    sh.uniforms.sunDir = U.sunDir;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWN;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvWN = normalize((modelMatrix * vec4(position, 0.0)).xyz);');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 sunDir; varying vec3 vWN;')
      .replace('#include <opaque_fragment>', 'outgoingLight *= mix(0.12, 1.0, smoothstep(-0.2, 0.4, dot(vWN, sunDir)));\n#include <opaque_fragment>');
  };
  scene.add(Globe.clouds);

  // selection outline
  Globe.outline = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xffd98a, transparent: true, opacity: 0.95 }));
  Globe.outline.renderOrder = 3; root.add(Globe.outline);

  resizeGlobe();
  addEventListener('resize', resizeGlobe);
}

function makeCloudTexture() {
  const w = 512, h = 256, cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d'), img = ctx.createImageData(w, h), rng = makeRng(7);
  // value-noise octaves on a wrapping grid
  const oct = [8, 16, 32, 64].map(s => { const g = new Float32Array(s * (s / 2 + 1)); for (let i = 0; i < g.length; i++) g[i] = rng(); return { s, g }; });
  for (let y = 0; y < h; y++) {
    const lat = (0.5 - y / h) * 180, band = 0.75 + 0.25 * Math.cos(lat * DEG * 3) - (Math.abs(lat) > 75 ? 0.3 : 0);
    for (let x = 0; x < w; x++) {
      let v = 0, amp = 0.55;
      for (const { s, g } of oct) {
        const fx = x / w * s, fy = y / h * s / 2, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy, r = s;
        const at = (a, b) => g[(b % (s / 2 + 1)) * r + (a % r)];
        const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
        v += amp * lerp(lerp(at(ix, iy), at(ix + 1, iy), sx), lerp(at(ix, iy + 1), at(ix + 1, iy + 1), sx), sy);
        amp *= 0.5;
      }
      const a = clamp((v * band - 0.52) * 3.2, 0, 1), i = (y * w + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255; img.data[i + 3] = a * 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv); t.wrapS = THREE.RepeatWrapping; return t;
}

function setLandGeometry(res, geo, lines) {
  const mesh = new THREE.Mesh(geo, Globe.landMat); mesh.renderOrder = 1;
  const mk = (g, color, op) => { const l = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity: op, depthWrite: false })); l.renderOrder = 2; return l; };
  const grp = new THREE.Group();
  grp.add(mk(lines.coast, 0x0b1e33, 0.55), mk(lines.border, 0x14161c, 0.75), mk(lines.terr, 0x14161c, 0.25));
  Globe.land[res] = mesh; Globe.lines[res] = grp;
  Globe.root.add(mesh, grp);
  applyLOD(true);
}
function applyLOD(force) {
  const want = Cam.alt < 0.9 && Globe.land['50m'] ? '50m' : Globe.land['110m'] ? '110m' : '50m';
  if (want === Globe.lod && !force) return;
  Globe.lod = want;
  for (const k in Globe.land) { Globe.land[k].visible = k === want; Globe.lines[k].visible = k === want; }
  Globe.dirty = true;
}

// Map colours: fn(country) -> '#rrggbb'; index 0 is unowned land
function setCountryColors(fn) {
  const d = Globe.colorData, col = new THREE.Color();
  for (let i = 0; i < 256; i++) {
    const c = World.countries[i];
    col.set(i === 0 ? '#9aa3ad' : c ? fn(c) : '#000000');
    d[i * 4] = col.r * 255; d[i * 4 + 1] = col.g * 255; d[i * 4 + 2] = col.b * 255; d[i * 4 + 3] = 255;
  }
  Globe.colorTex.needsUpdate = true; Globe.dirty = true;
}

function setSelectedOutline(idx) {
  Globe.uni.sel.value = idx == null ? -1 : idx;
  const m = World.maps[Globe.land['50m'] ? '50m' : '110m'];
  Globe.outline.geometry.dispose();
  Globe.outline.geometry = idx == null ? new THREE.BufferGeometry() : buildOutline(m, idx, 1);
  Globe.dirty = true;
}

// City lights and dots: one Points draw call for every city
function buildCityPoints() {
  const n = World.cities.length, pos = new Float32Array(n * 3), size = new Float32Array(n), v = new THREE.Vector3();
  World.cities.forEach((c, i) => {
    ll2v(c.lon, c.lat, 1, v); pos.set([v.x, v.y, v.z], i * 3);
    size[i] = clamp(Math.log10(Math.max(c.pop, 1000)) - 3.2, 0.4, 3.8) + (c.cap ? 0.6 : 0);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('size', new THREE.BufferAttribute(size, 1));
  const pts = new THREE.Points(g, new THREE.ShaderMaterial({
    uniforms: Globe.uni, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute float size; uniform vec3 sunDir; uniform float alt, pxr; varying float vDark; varying float vSize;
      void main(){ vec3 n = normalize(position); vDark = smoothstep(0.15, -0.2, dot(n, sunDir));
        vec4 mv = modelViewMatrix * vec4(position * 1.0003, 1.0);
        float zoom = clamp(0.9 / sqrt(alt), 0.8, 7.0);
        vSize = size; gl_PointSize = size * zoom * pxr * mix(0.9, 1.8, vDark);
        gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying float vDark; varying float vSize;
      void main(){ vec2 p = gl_PointCoord - 0.5; float r = length(p) * 2.0; if (r > 1.0) discard;
        float glow = pow(1.0 - r, 1.6);
        vec3 day = vec3(0.25, 0.22, 0.18) * smoothstep(1.0, 0.6, r);
        vec3 nightc = vec3(1.0, 0.78, 0.42) * glow * (0.55 + vSize * 0.12);
        gl_FragColor = vec4(mix(day * 0.5, nightc, vDark), 1.0); }`
  }));
  pts.renderOrder = 4; Globe.cityPts = pts; Globe.root.add(pts);
}

function resizeGlobe() {
  const w = innerWidth, h = innerHeight, pr = Perf.pixelRatio();
  Globe.renderer.setPixelRatio(pr); Globe.renderer.setSize(w, h, false);
  Globe.uni.pxr.value = pr;
  Globe.camera.aspect = w / h; Globe.camera.updateProjectionMatrix();
  Overlay.resize(); Globe.dirty = true;
}

function renderGlobe(dt, t) {
  const U = Globe.uni;
  U.time.value = t; U.alt.value = Cam.alt;
  // light follows the camera (sun a little to the upper left), night view swings it behind the globe
  Globe.night += (Globe.nightTarget - Globe.night) * Math.min(1, dt * 4);
  if (Math.abs(Globe.nightTarget - Globe.night) > 0.002) Globe.dirty = true;
  const cd = Globe.camera.position.clone().normalize(), up = new THREE.Vector3(0, 1, 0), east = new THREE.Vector3().crossVectors(up, cd).normalize();
  const sun = cd.clone().multiplyScalar(Math.cos(lerp(0.75, 2.6, Globe.night))).addScaledVector(east, -Math.sin(lerp(0.75, 2.6, Globe.night))).addScaledVector(up, 0.25).normalize();
  U.sunDir.value.copy(sun);
  const showClouds = Settings.clouds && Perf.level !== 'low' && Cam.alt > 0.08;
  Globe.clouds.visible = showClouds;
  if (showClouds) { Globe.clouds.rotation.y = t * 0.004; Globe.clouds.material.opacity = 0.5 * smooth(0.08, 0.6, Cam.alt) * (1 - Globe.night * 0.5); }
  // keep borders just above the land at every zoom level
  for (const k in Globe.lines) Globe.lines[k].scale.setScalar(1 + clamp(Cam.alt * 0.0012, 0.000012, 0.0005));
  Globe.outline.scale.setScalar(1 + clamp(Cam.alt * 0.0016, 0.000016, 0.0007));
  Globe.renderer.render(Globe.scene, Globe.camera);
  if (!window.__hgReady) { window.__hgReady = 1; try { if (parent !== window && parent.HG_gameReady) setTimeout(() => parent.HG_gameReady(), 80); } catch (e) {} }      // the launcher's loading screen can go
  Globe.dirty = false;
}
