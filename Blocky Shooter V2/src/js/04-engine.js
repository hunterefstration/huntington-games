// ==========================================
// 2. ENGINE SETUP
// ==========================================


const sharedBox = new THREE.BoxGeometry(1, 1, 1);
const edgeMat = new THREE.LineBasicMaterial({ color: 0x0b0b12, transparent: true, opacity: 0.5 });
const mats = {};
const VM_FOV = 58, VM_SCALE = 0.55;


// A 4GB Chromebook reports deviceMemory <= 4 and few cores: Auto starts lighter there
const LOWEND = (navigator.deviceMemory && navigator.deviceMemory <= 4) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);
// Auto remembers the last tier that ran smoothly here; each launch starts one tier better and re-checks on the menu
const AUTO_TIERS = 4, AUTO_KEY = 'blocky_autotier';
let autoTier = (() => { try { const v = localStorage.getItem(AUTO_KEY); if (v !== null) return clamp((+v | 0) - 1, 0, AUTO_TIERS - 1); } catch (e) {} return LOWEND ? 1 : 0; })();
const autoTierStart = autoTier;
function saveAutoTier() { try { localStorage.setItem(AUTO_KEY, String(autoTier)); } catch (e) {} }
function qualityPreset() {
    const dpr = window.devicePixelRatio || 1;
    const base = { shadows: true, shadowSize: 1024, extent: 48, soft: false, env: true, lite: false, dynamic: false, pointLights: 1, lampLights: 0, particles: 550, aniso: 2, post: null, cones: false, enemyShadows: 1, rain: 1, msaa: 0 };
    switch (settings.quality) {
        case 'low':       return Object.assign(base, { name: 'low', shadows: false, shadowSize: 512, env: false, lite: true, scale: Math.min(dpr, 1) * 0.75, pointLights: 0, particles: 260, aniso: 1, enemyShadows: 0, rain: 0.5 });
        case 'normal':    return Object.assign(base, { name: 'normal', scale: Math.min(dpr, 1) });
        // High / Cinematic hold their frame rate by trimming render resolution only (never effects)
        case 'high':      return Object.assign(base, { name: 'high', shadowSize: 2048, extent: 56, soft: true, scale: Math.min(dpr, 1), minScale: 0.7, dynamic: true, resOnly: true, pointLights: 2, lampLights: 2, particles: 800, aniso: 8, post: 'high', cones: true, enemyShadows: 2, msaa: 4 });
        case 'cinematic': return Object.assign(base, { name: 'cinematic', shadowSize: 2048, extent: 50, soft: true, scale: Math.min(dpr, 1.25), minScale: 0.75, dynamic: true, resOnly: true, pointLights: 2, lampLights: 3, particles: 900, aniso: 16, post: 'cinematic', cones: true, enemyShadows: 2, msaa: 4 });
        // AUTO has 4 tiers (0 = normal look ... 3 = fastest). It remembers the tier that ran smoothly on this device.
        default: {
            const t = autoTier, sc = Math.min(dpr, 1) * [1, 1, 0.85, 0.72][t];
            return Object.assign(base, { name: 'auto', tier: t, extent: 44, shadows: t === 0, env: t < 2, lite: t >= 2, scale: sc, minScale: sc * 0.72, dynamic: true,
                                         pointLights: t < 2 ? 1 : 0, particles: [520, 460, 360, 260][t], aniso: t < 2 ? 2 : 1, enemyShadows: t === 0 ? 1 : 0, rain: t < 2 ? 1 : 0.5 });
        }
    }
}
const QUALITY_DESC = {
    auto: 'Tests your device on the menu and picks the best look that holds 60 FPS (it remembers it). In a fight it only nudges resolution; bigger changes wait for the break between waves, so no stutter. Best for Chromebooks.',
    low: 'Fastest. Baked corner shadows, contact shadows under buildings, soft blob shadows under zombies, glowing muzzle flashes and explosions (no real lights), fog, sky and tone mapping. 75% resolution.',
    normal: 'Everything in Low plus sun shadows, sky reflections and full-resolution rendering.',
    high: 'Soft 2K shadows, bloom glow on lights and muzzle flashes, light shafts under street lamps, real lamp lights, 4x MSAA.',
    cinematic: 'Everything in High plus 4K shadows, stronger bloom, 4 real lamp lights, film grain, lens vignette and color grading. Needs a strong GPU.'
};


// ---------- POST PROCESSING (High / Cinematic) ----------
// The gun is its own render pass inside the chain so bloom + grading hit it too.
class ViewmodelPass extends Pass {
    constructor() { super(); this.needsSwap = false; }
    render(r, writeBuffer, readBuffer) {
        if (!vmModel || !vmModel.root.visible || !(currentGameState === 'playing' || currentGameState === 'paused' || currentGameState === 'main')) return;
        r.setRenderTarget(this.renderToScreen ? null : readBuffer);
        r.clearDepth();
        r.render(viewScene, weaponCam);
    }
}
const GradeShader = {
    uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) }, uVig: { value: 0.35 }, uGrain: { value: 0 }, uCA: { value: 0 }, uSat: { value: 1.08 }, uContrast: { value: 0.2 }, uExposure: { value: 1 } },
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
        uniform sampler2D tDiffuse; uniform float uTime, uVig, uGrain, uCA, uSat, uContrast, uExposure; uniform vec2 uRes; varying vec2 vUv;
        // ACES filmic (same curve three.js uses) + sRGB, done here so FXAA can run on the final image
        vec3 rrtOdt(vec3 v) { vec3 a = v * (v + 0.0245786) - 0.000090537; vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081; return a / b; }
        vec3 aces(vec3 c) {
            const mat3 inM = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
            const mat3 outM = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
            c *= uExposure / 0.6; c = outM * rrtOdt(inM * c); return clamp(c, 0.0, 1.0);
        }
        vec3 toSRGB(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
        void main() {
            vec2 d = vUv - 0.5; float r2 = dot(d, d);
            vec2 off = d * uCA * r2;
            vec3 c = vec3(texture2D(tDiffuse, vUv + off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - off).b);
            float l = dot(c, vec3(0.299, 0.587, 0.114));
            c = mix(vec3(l), c, uSat);
            c = mix(c, c * c * (3.0 - 2.0 * min(c, vec3(1.0))), uContrast);      // gentle S-curve (HDR-safe)
            c += vec3(-0.012, 0.004, 0.02) * (1.0 - l) + vec3(0.02, 0.008, -0.014) * l;   // teal shadows, warm highlights
            gl_FragColor = vec4(toSRGB(aces(c)), 1.0);
            gl_FragColor.rgb *= 1.0 - uVig * smoothstep(0.08, 0.55, r2 * 1.7);
            float n = fract(sin(dot(vUv * uRes + fract(uTime * 7.13) * 91.7, vec2(12.9898, 78.233))) * 43758.5453);
            gl_FragColor.rgb += (n - 0.5) * uGrain;
        }`
};
let composer = null, bloomPass = null, gradePass = null, fxaaPass = null;
function updatePostSize() {
    if (!composer) return;
    gradePass.uniforms.uRes.value.set(window.innerWidth, window.innerHeight);
    fxaaPass.material.uniforms.resolution.value.set(1 / (window.innerWidth * dynScale), 1 / (window.innerHeight * dynScale));
}
function setupPost() {
    if (composer) { composer.renderTarget1.dispose(); composer.renderTarget2.dispose(); composer = null; bloomPass = gradePass = null; }
    if (!Q.post) return;
    const cine = Q.post === 'cinematic';
    // no MSAA on the HDR target (it was ~80% of the cost); FXAA at the end smooths edges for almost nothing
    const rt = new THREE.WebGLRenderTarget(window.innerWidth * dynScale, window.innerHeight * dynScale, { type: THREE.HalfFloatType });
    composer = new EffectComposer(renderer, rt);
    composer.setPixelRatio(dynScale);
    composer.setSize(window.innerWidth, window.innerHeight);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new ViewmodelPass());
    bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), cine ? 0.8 : 0.55, cine ? 0.65 : 0.45, 0.8);
    // bloom is soft anyway: run it at half resolution (a quarter of the pixels)
    const bloomSize = bloomPass.setSize.bind(bloomPass);
    bloomPass.setSize = (w, h) => bloomSize(Math.max(1, Math.round(w / 2)), Math.max(1, Math.round(h / 2)));
    composer.addPass(bloomPass);
    gradePass = new ShaderPass(GradeShader);
    const u = gradePass.uniforms;
    u.uVig.value = cine ? 0.55 : 0.3; u.uGrain.value = cine ? 0.045 : 0; u.uCA.value = cine ? 0.012 : 0; u.uSat.value = cine ? 1.12 : 1.06; u.uContrast.value = cine ? 0.35 : 0.2;
    u.uRes.value.set(window.innerWidth, window.innerHeight);
    composer.addPass(gradePass);
    fxaaPass = new ShaderPass(FXAAShader);
    composer.addPass(fxaaPass);
    composer.setSize(window.innerWidth, window.innerHeight);
    updatePostSize();
}


function makeCanvas(size) { const c = document.createElement('canvas'); c.width = c.height = size; return [c, c.getContext('2d')]; }
function canvasTex(c, repeat) {
    const tex = new THREE.CanvasTexture(c);
    if (repeat) { tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(repeat, repeat); }
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}
function makeFloorTexture() {
    const [c, g] = makeCanvas(256);
    g.fillStyle = '#d0d3da'; g.fillRect(0, 0, 256, 256);
    g.fillStyle = '#c3c6ce'; g.fillRect(0, 0, 128, 128); g.fillRect(128, 128, 128, 128);
    for (let i = 0; i < 2200; i++) { const v = 170 + Math.random() * 70 | 0; g.fillStyle = `rgba(${v},${v},${v + 6},0.35)`; g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2); }
    for (let i = 0; i < 22; i++) { const x = Math.random() * 256, y = Math.random() * 256, r = 10 + Math.random() * 34, v = Math.random() < 0.6 ? 0 : 255; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(${v},${v},${v},0.09)`); gr.addColorStop(1, `rgba(${v},${v},${v},0)`); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
    g.lineCap = 'round'; g.strokeStyle = 'rgba(60,62,72,0.35)'; g.lineWidth = 1;
    for (let i = 0; i < 6; i++) { let x = Math.random() * 256, y = Math.random() * 256; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 7; k++) { x += (Math.random() - 0.5) * 22; y += (Math.random() - 0.5) * 22; g.lineTo(x, y); } g.stroke(); }
    g.strokeStyle = '#8e93a6'; g.lineWidth = 4; g.strokeRect(0, 0, 256, 256);
    g.strokeStyle = '#a3a8b8'; g.lineWidth = 2; g.beginPath(); g.moveTo(128, 0); g.lineTo(128, 256); g.moveTo(0, 128); g.lineTo(256, 128); g.stroke();
    const tex = canvasTex(c, 25);
    tex.anisotropy = 4;
    return tex;
}
function makeDetailTexture() {
    // neutral grey wall detail (multiplied by each block's colour): mottled blotches, fine grain, hairline cracks, rain streaks, scuffs and panel seams
    const N = 256, [c, g] = makeCanvas(N);
    g.fillStyle = '#e6e6e6'; g.fillRect(0, 0, N, N);
    for (let i = 0; i < 70; i++) {          // big soft blotches (uneven paint / weathering), wrapped so the tile stays seamless
        const x = Math.random() * N, y = Math.random() * N, r = 14 + Math.random() * 40, v = Math.random() < 0.5 ? 0 : 255;
        const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(${v},${v},${v},0.11)`); gr.addColorStop(1, `rgba(${v},${v},${v},0)`);
        g.fillStyle = gr; for (const ox of [-N, 0, N]) for (const oy of [-N, 0, N]) { if (x + ox + r < 0 || x + ox - r > N || y + oy + r < 0 || y + oy - r > N) continue; g.save(); g.translate(ox, oy); g.fillRect(x - r, y - r, r * 2, r * 2); g.restore(); }
    }
    for (let i = 0; i < 3600; i++) { const v = 196 + Math.random() * 59 | 0; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(Math.random() * N, Math.random() * N, 1 + (Math.random() < 0.3), 1 + (Math.random() < 0.3)); }
    for (let i = 0; i < 9; i++) {            // rain / rust streaks running down from the top
        const x = Math.random() * N, h = 30 + Math.random() * 110, gr = g.createLinearGradient(0, 0, 0, h);
        gr.addColorStop(0, 'rgba(60,55,50,0.22)'); gr.addColorStop(1, 'rgba(60,55,50,0)'); g.fillStyle = gr; g.fillRect(x, 0, 1 + Math.random() * 3, h);
    }
    g.lineCap = 'round';
    for (let i = 0; i < 7; i++) {            // hairline cracks
        let x = Math.random() * N, y = Math.random() * N; g.strokeStyle = 'rgba(40,40,44,0.4)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y);
        for (let k = 0; k < 6; k++) { x += (Math.random() - 0.4) * 16; y += (Math.random() - 0.5) * 12; g.lineTo(x, y); }
        g.stroke();
    }
    g.strokeStyle = 'rgba(255,255,255,0.22)'; g.lineWidth = 1;
    for (let i = 0; i < 14; i++) { const x = Math.random() * N, y = Math.random() * N, a = Math.random() * 6.28, l = 4 + Math.random() * 10; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
    g.strokeStyle = 'rgba(70,70,76,0.3)'; g.lineWidth = 1.5;      // panel seams with a lit lower lip
    for (const y of [N / 3, N * 2 / 3]) { g.beginPath(); g.moveTo(0, y); g.lineTo(N, y); g.stroke(); }
    g.strokeStyle = 'rgba(255,255,255,0.28)'; for (const y of [N / 3 + 2, N * 2 / 3 + 2]) { g.beginPath(); g.moveTo(0, y); g.lineTo(N, y); g.stroke(); }
    g.fillStyle = 'rgba(70,70,76,0.4)'; for (const [x, y] of [[8, 8], [N - 8, 8], [8, N - 8], [N - 8, N - 8]]) { g.beginPath(); g.arc(x, y, 2, 0, 6.28); g.fill(); }   // rivets
    g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 3; g.strokeRect(5, 5, N - 10, N - 10);
    g.strokeStyle = 'rgba(90,90,90,0.55)'; g.lineWidth = 2; g.strokeRect(0, 0, N, N);
    return canvasTex(c, 1);
}
function makeRadialTexture(stops) {
    const [c, g] = makeCanvas(128);
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    stops.forEach(([o, col]) => gr.addColorStop(o, col));
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    return canvasTex(c);
}
function makeFlashTexture() {
    const [c, g] = makeCanvas(128);
    g.translate(64, 64);
    for (let i = 0; i < 7; i++) {
        g.rotate(Math.PI * 2 / 7 + Math.random() * 0.3);
        const L = 40 + Math.random() * 22;
        const gr = g.createLinearGradient(0, 0, L, 0); gr.addColorStop(0, 'rgba(255,240,200,1)'); gr.addColorStop(1, 'rgba(255,140,40,0)');
        g.fillStyle = gr; g.beginPath(); g.moveTo(0, -6); g.lineTo(L, 0); g.lineTo(0, 6); g.fill();
    }
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, 34);
    gr.addColorStop(0, 'rgba(255,255,240,1)'); gr.addColorStop(0.35, 'rgba(255,210,120,0.9)'); gr.addColorStop(1, 'rgba(255,120,30,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 34, 0, Math.PI * 2); g.fill();
    return canvasTex(c);
}
function makeHoleTexture() {
    const [c, g] = makeCanvas(64);
    g.translate(32, 32);
    const halo = g.createRadialGradient(0, 0, 4, 0, 0, 31);        // chipped, lighter ring around the hole
    halo.addColorStop(0, 'rgba(235,230,220,0.0)'); halo.addColorStop(0.35, 'rgba(235,230,220,0.38)'); halo.addColorStop(1, 'rgba(235,230,220,0)');
    g.fillStyle = halo; g.fillRect(-32, -32, 64, 64);
    g.strokeStyle = 'rgba(25,22,20,0.55)'; g.lineWidth = 1;
    for (let i = 0; i < 6; i++) { const a = i * 1.05 + Math.random() * 0.5, l = 13 + Math.random() * 14; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * l * 0.5, Math.sin(a) * l * 0.5); g.lineTo(Math.cos(a + 0.25) * l, Math.sin(a + 0.25) * l); g.stroke(); }
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, 16);
    gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.45, 'rgba(8,8,8,0.96)'); gr.addColorStop(0.75, 'rgba(40,36,32,0.55)'); gr.addColorStop(1, 'rgba(40,36,32,0)');
    g.fillStyle = gr; g.fillRect(-32, -32, 64, 64);
    return canvasTex(c);
}
function makeScorchTexture() {       // blast mark: a dark ragged soot patch with a few streaks flung outward
    const [c, g] = makeCanvas(128);
    g.translate(64, 64);
    for (let i = 0; i < 14; i++) { const a = Math.random() * 6.28, l = 26 + Math.random() * 34, w = 2 + Math.random() * 4; g.save(); g.rotate(a); const gr = g.createLinearGradient(0, 0, l, 0); gr.addColorStop(0, 'rgba(10,8,8,0.55)'); gr.addColorStop(1, 'rgba(10,8,8,0)'); g.fillStyle = gr; g.fillRect(0, -w / 2, l, w); g.restore(); }
    for (let i = 0; i < 9; i++) { const a = Math.random() * 6.28, d = Math.random() * 14, r = 14 + Math.random() * 16, gr = g.createRadialGradient(Math.cos(a) * d, Math.sin(a) * d, 0, Math.cos(a) * d, Math.sin(a) * d, r); gr.addColorStop(0, 'rgba(8,6,6,0.5)'); gr.addColorStop(1, 'rgba(8,6,6,0)'); g.fillStyle = gr; g.fillRect(-64, -64, 128, 128); }
    const core = g.createRadialGradient(0, 0, 0, 0, 0, 26); core.addColorStop(0, 'rgba(0,0,0,0.85)'); core.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = core; g.fillRect(-64, -64, 128, 128);
    return canvasTex(c);
}
function makeSmokeTexture() {        // soft puff with an uneven edge
    const [c, g] = makeCanvas(64);
    for (let i = 0; i < 6; i++) { const x = 32 + (Math.random() - 0.5) * 16, y = 32 + (Math.random() - 0.5) * 16, r = 14 + Math.random() * 10, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); }
    return canvasTex(c);
}
let detailTex, floorTex, poolTex, flashTex, holeTex, blobTex, scorchTex, smokeTex;


function init3D() {
    Q = qualityPreset();
    renderer = new THREE.WebGLRenderer({ antialias: settings.quality !== 'low' && !(settings.quality === 'auto' && (LOWEND || autoTierStart > 0)), powerPreference: 'high-performance', stencil: false });
    dynScale = Q.scale;
    renderer.setPixelRatio(dynScale);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.autoClear = false;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = Q.shadows;
    renderer.shadowMap.type = Q.soft ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    $('game-container').appendChild(renderer.domElement);


    detailTex = makeDetailTexture(); detailTex.anisotropy = Q.aniso;
    floorTex = makeFloorTexture(); floorTex.anisotropy = Math.max(Q.aniso, 2);
    poolTex = makeRadialTexture([[0, 'rgba(255,255,255,1)'], [0.4, 'rgba(255,255,255,0.45)'], [1, 'rgba(255,255,255,0)']]);
    blobTex = makeRadialTexture([[0, 'rgba(0,0,0,0.75)'], [0.6, 'rgba(0,0,0,0.35)'], [1, 'rgba(0,0,0,0)']]);
    flashTex = makeFlashTexture(); holeTex = makeHoleTexture(); scorchTex = makeScorchTexture(); smokeTex = makeSmokeTexture();


    const aspect = window.innerWidth / window.innerHeight;
    camera = new THREE.PerspectiveCamera(settings.fov, aspect, 0.05, 1200);
    camera.position.set(0, EYE_STAND, 0);
    fovNow = settings.fov;
    scene = new THREE.Scene();
    scene.add(camera);
    // The gun is drawn in its own pass with its own camera: never clips into walls,
    // and zooming in (ADS) doesn't blow the gun up.
    viewScene = new THREE.Scene();
    weaponCam = new THREE.PerspectiveCamera(VM_FOV, aspect, 0.01, 10);
    viewScene.add(weaponCam);


    hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1); scene.add(hemi);
    sun = new THREE.DirectionalLight(0xffffff, 2);
    sun.shadow.camera.near = 1; sun.shadow.camera.far = 420;
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
    scene.add(sun, sun.target);
    viewHemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
    viewSun = new THREE.DirectionalLight(0xffffff, 2);
    viewScene.add(viewHemi, viewSun, viewSun.target);
    vmLight = new THREE.PointLight(0xffc36b, 0, 3, 2); vmLight.position.set(0.1, -0.05, -0.75); weaponCam.add(vmLight);
    // soft key light that follows the view so the gun always reads clearly, whatever the arena lighting
    viewFill = new THREE.DirectionalLight(0xfff4e6, 2.2); viewFill.position.set(-0.6, 1, 0.9); weaponCam.add(viewFill); viewFill.target.position.set(0.1, -0.1, -0.5); weaponCam.add(viewFill.target);


    // Sky dome (gradient + sun/moon), used both on screen and to bake the reflection map
    skyMat = new THREE.ShaderMaterial({
        uniforms: {
            top: { value: new THREE.Color() }, horizon: { value: new THREE.Color() }, bottom: { value: new THREE.Color() },
            sunDir: { value: new V3(0, 1, 0) }, sunColor: { value: new THREE.Color() }, sunSize: { value: 0.999 }, glow: { value: 0.5 },
            cloudCol: { value: new THREE.Color(1, 1, 1) }, cloudAmt: { value: 0.5 }, ridge: { value: 1 }, uT: { value: 0 }
        },
        vertexShader: `varying vec3 vDir; void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `
            uniform vec3 top; uniform vec3 horizon; uniform vec3 bottom; uniform vec3 sunDir; uniform vec3 sunColor; uniform float sunSize; uniform float glow;
            uniform vec3 cloudCol; uniform float cloudAmt; uniform float ridge; uniform float uT;
            varying vec3 vDir;
            float hs(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
            float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hs(i), hs(i + vec2(1.0, 0.0)), f.x), mix(hs(i + vec2(0.0, 1.0)), hs(i + vec2(1.0, 1.0)), f.x), f.y); }
            void main() {
                vec3 d = normalize(vDir);
                float h = d.y;
                vec3 col = h > 0.0 ? mix(horizon, top, pow(clamp(h, 0.0, 1.0), 0.5)) : mix(horizon, bottom, pow(clamp(-h, 0.0, 1.0), 0.3));
                float s = max(dot(d, normalize(sunDir)), 0.0);
                if (h > 0.0) {
                    // drifting clouds on a flat layer (fbm), lit brighter on the sun side, thinning toward the zenith; plus a haze band on the horizon
                    vec2 cp = d.xz / (h + 0.22) * 1.6 + vec2(uT, uT * 0.4);
                    float cn = vn(cp) * 0.58 + vn(cp * 2.1 + 7.0) * 0.28;
                    #if SKY_OCT > 2
                    cn += vn(cp * 4.3 + 3.0) * 0.14;
                    #endif
                    float cv = smoothstep(1.0 - cloudAmt * 0.85, 1.02 - cloudAmt * 0.3, cn) * smoothstep(0.0, 0.16, h) * (1.0 - smoothstep(0.55, 1.0, h) * 0.6);
                    vec3 cc = cloudCol * (0.78 + 0.5 * pow(s, 3.0)) * (0.82 + 0.3 * cn);
                    col = mix(col, cc, cv * 0.9);
                    col = mix(col, horizon, (1.0 - smoothstep(0.0, 0.2, h)) * 0.35);
                    if (ridge > 0.5) {
                        // far ridge line on the horizon, a hazy silhouette that sits in the fog colour
                        float az = atan(d.z, d.x);
                        float rh = 0.012 + 0.03 * vn(vec2(az * 5.0, 1.0)) + 0.018 * vn(vec2(az * 17.0, 4.0)) + 0.008 * vn(vec2(az * 41.0, 9.0));
                        col = mix(col, mix(horizon, bottom, 0.72) * 0.9, (1.0 - smoothstep(rh - 0.002, rh + 0.002, h)) * 0.95);
                    }
                }
                col += sunColor * (smoothstep(sunSize, sunSize + 0.0004, s) * 5.0 + pow(s, 90.0) * glow + pow(s, 7.0) * glow * 0.22);
                col += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;   // dither: no colour banding in the sky
                gl_FragColor = vec4(col, 1.0);
                #include <tonemapping_fragment>
                #include <colorspace_fragment>
            }`,
        side: THREE.BackSide, depthWrite: false, fog: false
    });
    skyMat.fragmentShader = '#define SKY_OCT ' + (Q.lite ? 2 : 3) + '\n' + skyMat.fragmentShader;
    skyGroup = new THREE.Group();
    const dome = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), skyMat);
    dome.renderOrder = -10; skyGroup.add(dome);
    // Stars: tiny crisp dots of different brightness. Kept below the bloom threshold and
    // outside tone mapping so they never grow a fuzzy glow.
    const starPos = [], starCol = [];
    for (let i = 0; i < 1400; i++) {
        const th = Math.random() * Math.PI * 2, ph = Math.random() * Math.PI * 0.48 + 0.04;
        starPos.push(850 * Math.cos(th) * Math.cos(ph), 850 * Math.sin(ph), 850 * Math.sin(th) * Math.cos(ph));
        const b = 0.22 + Math.pow(Math.random(), 3) * 0.5, tint = Math.random();
        starCol.push(b * (tint < 0.15 ? 0.85 : 1), b * 0.97, b * (tint > 0.85 ? 0.85 : 1.05));
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
    starGeo.setAttribute('color', new THREE.Float32BufferAttribute(starCol, 3));
    stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ vertexColors: true, size: 1.5, sizeAttenuation: false, fog: false, depthWrite: false, toneMapped: false }));
    stars.renderOrder = -9;
    skyGroup.add(stars);
    scene.add(skyGroup);
    envScene = new THREE.Scene();
    envScene.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), skyMat));
    pmrem = new THREE.PMREMGenerator(renderer);


    setupPointLights();
    initFx();
    initRain();
    currentMap = MAPS[settings.map] && isUnlocked('map', settings.map) ? settings.map : 'blockyard';
    applyTheme(THEMES[settings.light] && isUnlocked('light', settings.light) ? settings.light : 'night');
    buildWorld(currentMap);
    applyShadowSettings();
    setupPost();


    controls = new PointerLockControls(camera, document.body);
    controls.addEventListener('unlock', function () {
        if (currentGameState === 'playing' && !debugNoLock) changeGameState('paused');
    });
    document.addEventListener('pointerlockerror', () => { if (currentGameState === 'playing' && !debugNoLock) changeGameState('paused'); });


    raycaster = new THREE.Raycaster(); raycaster.layers.enableAll();   // enemy hit boxes live on their own (hidden) layer


    window.addEventListener('resize', onWindowResize);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('wheel', onWheel, { passive: true });
    document.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('blur', clearInputs);
}


// Point lights cost every pixel something, so how many exist depends on the quality level.
// They're created once (never added mid-game) so shaders don't recompile and stutter.
function setupPointLights() {
    if (muzzleLight) { camera.remove(muzzleLight); muzzleLight = null; }
    boomLights.forEach(b => scene.remove(b.light)); boomLights = [];
    if (Q.pointLights >= 1) {
        muzzleLight = new THREE.PointLight(0xffc36b, 0, 16, 2);
        muzzleLight.position.set(0.25, -0.1, -1.4);
        camera.add(muzzleLight);
    }
    for (let i = 0; i < Q.pointLights; i++) { const l = new THREE.PointLight(0xff8a3c, 0, 45, 2); scene.add(l); boomLights.push({ light: l, t: 0 }); }
    lampLights.forEach(l => scene.remove(l)); lampLights = [];
    for (let i = 0; i < Q.lampLights; i++) { const l = new THREE.PointLight(0xffc47a, 0, 22, 2); scene.add(l); lampLights.push(l); }
}


function applyShadowSettings() {
    renderer.shadowMap.enabled = Q.shadows;
    renderer.shadowMap.type = Q.soft ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    sun.castShadow = Q.shadows;
    if (sun.shadow.map && sun.shadow.mapSize.x !== Q.shadowSize) { sun.shadow.map.dispose(); sun.shadow.map = null; }
    sun.shadow.mapSize.set(Q.shadowSize, Q.shadowSize);
    const c = sun.shadow.camera;
    c.left = c.bottom = -Q.extent; c.right = c.top = Q.extent; c.updateProjectionMatrix();
    if (blobMesh) blobMesh.visible = !Q.shadows;
}
function recompileAll() {
    ziReset();
    const touch = (o) => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.needsUpdate = true); };
    scene.traverse(touch); viewScene.traverse(touch);
}


function applyQuality() {
    Q = qualityPreset();
    dynScale = Q.scale; lowFpsStreak = 0; autoStage = 0; autoRes.t = autoRes.good = autoRes.bad = 0; autoRes.warm = 4; autoMenuFps.length = 0;
    renderer.setPixelRatio(dynScale);
    renderer.setSize(window.innerWidth, window.innerHeight);
    detailTex.anisotropy = Q.aniso; detailTex.needsUpdate = true;
    setupPointLights();
    applyShadowSettings();
    refreshWorldMaterials();
    applyTheme(themeId);
    setupPost();
    recompileAll();
}
function setRenderScale(s) {
    dynScale = s;
    renderer.setPixelRatio(s);
    if (composer) { composer.setPixelRatio(s); composer.setSize(window.innerWidth, window.innerHeight); updatePostSize(); }
}


function applyTheme(id) {
    themeId = id; theme = THEMES[id];
    const u = skyMat.uniforms;
    u.top.value.setHex(theme.top); u.horizon.value.setHex(theme.horizon); u.bottom.value.setHex(theme.bottom);
    u.sunDir.value.fromArray(theme.sunDir).normalize(); u.sunColor.value.setHex(theme.disc);
    u.sunSize.value = theme.discSize; u.glow.value = theme.glow;
    const SKYC = { night: [0x26306a, 0.3], sunset: [0xffb48a, 0.6], day: [0xffffff, 0.55], bloodmoon: [0x5a1218, 0.42], storm: [0x3a414a, 0.98], neon: [0x7a2a8a, 0.34] }[id] || [0xffffff, 0.4];
    u.cloudCol.value.setHex(SKYC[0]); u.cloudAmt.value = SKYC[1];
    u.ridge.value = (typeof currentMap !== 'undefined' && currentMap === 'sky') ? 0 : 1;
    if (!scene.fog) scene.fog = new THREE.Fog(theme.fog, theme.fogNear, theme.fogFar);
    scene.fog.color.setHex(theme.fog); scene.fog.near = theme.fogNear; scene.fog.far = theme.fogFar;
    renderer.setClearColor(theme.fog);
    renderer.toneMappingExposure = theme.exposure;
    const ambBoost = Q.env ? 1 : 2.1;
    for (const [h, k] of [[hemi, 1], [viewHemi, 0.9]]) { h.color.setHex(theme.hemiSky); h.groundColor.setHex(theme.hemiGround); h.intensity = theme.hemiInt * ambBoost * k; }
    for (const [s, k] of [[sun, 1], [viewSun, 0.85]]) { s.color.setHex(theme.sunColor); s.intensity = theme.sunInt * k; }
    viewSun.position.copy(u.sunDir.value).multiplyScalar(10);
    stars.visible = theme.stars;
    // shadows pick up the sky's color (cool fill vs warm sun), edges catch a little sky light
    const sky = new THREE.Color(theme.hemiSky), lum = Math.max(0.05, sky.r * 0.3 + sky.g * 0.55 + sky.b * 0.15);
    LIGHT_U.uCool.value.set(1, 1, 1).lerp(sky.clone().multiplyScalar(1 / lum), 0.28);
    LIGHT_U.uRim.value.copy(sky).multiplyScalar(0.05 + 0.04 * (1 - theme.bright));
    LIGHT_U.uRimE.value.copy(sky).lerp(new THREE.Color(theme.neon), 0.35).multiplyScalar(0.34 - 0.16 * theme.bright);
    LIGHT_U.uHaze.value = theme.rain ? 0.55 : 0.35;


    if (envRT) envRT.dispose();
    envRT = pmrem.fromScene(envScene, 0.04);
    envTex = envRT.texture;
    scene.environment = Q.env ? envTex : null;
    viewScene.environment = envTex;   // the gun always gets reflections - it's small, so it's cheap
    for (const k in mats) if (mats[k].isMeshStandardMaterial) mats[k].envMapIntensity = theme.envInt;
    applyFloorTint();
    if (rainMesh) rainMesh.visible = !!theme.rain;
    lightningT = 5 + Math.random() * 6;
    if (mats.neon) mats.neon.color.setHex(theme.neon);
    if (mats.lampHead) mats.lampHead.color.setHex(theme.lamp);
    if (mats.pool) { mats.pool.color.setHex(theme.lamp); mats.pool.opacity = theme.lampPool; }
    lampLightT = 0;
}


function applyFloorTint() {
    for (const m of [mats.floor, mats.floor_l]) {
        if (!m) continue;
        m.color.setHex(theme.floor);
        if (currentMap === 'plains') m.color.multiply(_tint.setHex(0x8fd07a)).multiplyScalar(1.25);
        if (currentMap === 'downtown') m.color.multiplyScalar(0.8);
        if (currentMap === 'mall') m.color.multiplyScalar(0.62);                                   // parking-lot asphalt
        if (currentMap === 'military') m.color.multiply(_tint.setHex(0xc9c09a)).multiplyScalar(0.95);   // dusty ground
    }
    updateCones();
}


// Keep the shadow camera centered on the player: sharp shadows from a small shadow map.
const _sunDir = new V3();
function updateSun() {
    _sunDir.fromArray(theme.sunDir).normalize();
    const p = camera.position;
    const texel = (Q.extent * 2) / Q.shadowSize;
    const tx = Math.round(p.x / texel) * texel, tz = Math.round(p.z / texel) * texel;
    sun.target.position.set(tx, 0, tz);
    sun.position.set(tx + _sunDir.x * 160, _sunDir.y * 160, tz + _sunDir.z * 160);
    sun.target.updateMatrixWorld();
    skyGroup.position.copy(p);
    // the gun's world mirrors the main camera orientation, so its lighting matches the world
    weaponCam.quaternion.copy(camera.quaternion);
    updateLampLights(1 / 60);
}


function onWindowResize() {
    const a = window.innerWidth / window.innerHeight;
    camera.aspect = a; camera.updateProjectionMatrix();
    weaponCam.aspect = a; weaponCam.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    if (composer) { composer.setSize(window.innerWidth, window.innerHeight); updatePostSize(); }
}
