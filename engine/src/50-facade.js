// ============================================================
// The renderer object a game holds. It answers to the part of THREE.WebGLRenderer the games use
// (render, setSize, setPixelRatio, shadowMap, info, ...), so a game switches engines by changing one
// line: the place where it creates its renderer. Returns null when WebGL2 is not available.
// ============================================================
function createRenderer(opts) {
    opts = opts || {};
    const canvas = opts.canvas || document.createElement('canvas');
    const E = createEngine(canvas, { antialias: !!opts.antialias, alpha: !!opts.alpha, stencil: !!opts.stencil, depth: opts.depth !== false, powerPreference: opts.powerPreference || 'high-performance', preserveDrawingBuffer: !!opts.preserveDrawingBuffer });
    if (!E) return null;
    E.L = newLists(); E.lights = newLights(); E.env = { fog: 0, nSun: 0, nPL: 0, shadow: 0, soft: 0, tone: 0, srgb: 0 }; E.envCode = 0; E.frame = 0; E.time = 0;
    const gl = E.gl, clear = { r: 0, g: 0, b: 0, a: 1 };
    let pixelRatio = 1, cssW = canvas.width, cssH = canvas.height;
    const R = {
        isHG3D: true, engine: E, domElement: canvas,
        autoClear: true, sortObjects: true, outputColorSpace: 'srgb', toneMapping: 0, toneMappingExposure: 1,
        shadowMap: { enabled: false, type: 1, autoUpdate: true, needsUpdate: false },
        capabilities: { isWebGL2: true, getMaxAnisotropy: () => E.maxAniso, maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE), precision: 'highp' },
        info: {
            autoReset: true, render: { calls: 0, triangles: 0, frame: 0, lines: 0, points: 0 }, memory: { geometries: 0, textures: 0 }, programs: [],
            reset() { E.stats.calls = 0; E.stats.tris = 0; this.render.calls = 0; this.render.triangles = 0; }
        },
        getContext() { return gl; },
        getPixelRatio() { return pixelRatio; },
        setPixelRatio(v) { if (v === undefined || v === pixelRatio) return; pixelRatio = v; this.setSize(cssW, cssH, false); },
        getSize(target) { if (target && target.set) return target.set(cssW, cssH); return { width: cssW, height: cssH }; },
        getDrawingBufferSize(target) { if (target && target.set) return target.set(canvas.width, canvas.height); return { width: canvas.width, height: canvas.height }; },
        setSize(w, h, updateStyle) {
            cssW = w; cssH = h; const pw = Math.max(1, Math.floor(w * pixelRatio)), ph = Math.max(1, Math.floor(h * pixelRatio));
            if (canvas.width !== pw) canvas.width = pw; if (canvas.height !== ph) canvas.height = ph;
            if (updateStyle !== false && canvas.style) { canvas.style.width = w + 'px'; canvas.style.height = h + 'px'; }
        },
        setClearColor(c, a) { if (c && c.r !== undefined) { clear.r = c.r; clear.g = c.g; clear.b = c.b; } else if (typeof c === 'number') { clear.r = (c >> 16 & 255) / 255; clear.g = (c >> 8 & 255) / 255; clear.b = (c & 255) / 255; } if (a !== undefined) clear.a = a; },
        getClearColor(target) { if (target && target.setRGB) return target.setRGB(clear.r, clear.g, clear.b); return clear; },
        getClearAlpha() { return clear.a; }, setClearAlpha(a) { clear.a = a; },
        clear(color, depth) {
            let bits = 0; if (color !== false) { setColorMask(E, true); gl.clearColor(clear.r, clear.g, clear.b, clear.a); bits |= gl.COLOR_BUFFER_BIT; }
            if (depth !== false) { setDepth(E, 1, 1, gl.LEQUAL); bits |= gl.DEPTH_BUFFER_BIT; }
            if (bits) gl.clear(bits);
        },
        clearDepth() { this.clear(false, true); }, clearColor() { this.clear(true, false); },
        setRenderTarget() { }, getRenderTarget() { return null; }, setViewport() { }, setScissorTest() { },
        // build every program and vertex array a scene needs now, so nothing compiles in the middle of play
        compile(scene, camera) {
            if (!scene || !camera || E.lost) return;
            const hidden = [];
            const walk = o => { if (o.visible === false) { hidden.push(o); o.visible = true; } const ch = o.children; if (ch) for (let i = 0; i < ch.length; i++) walk(ch[i]); };
            walk(scene);
            const fc = [], cull = o => { if (o.frustumCulled !== false && (o.isMesh || o.isPoints || o.isLineSegments)) { fc.push(o); o.frustumCulled = false; } const ch = o.children; if (ch) for (let i = 0; i < ch.length; i++) cull(ch[i]); };
            cull(scene);
            try { renderScene(E, R, scene, camera); } finally { for (const o of hidden) o.visible = false; for (const o of fc) o.frustumCulled = true; }
        },
        render(scene, camera) {
            if (this.info.autoReset) this.info.reset();
            renderScene(E, this, scene, camera);
            const i = this.info; i.render.calls = E.stats.calls; i.render.triangles = E.stats.tris; i.render.frame = E.frame; i.memory.geometries = E.stats.geometries; i.memory.textures = E.stats.textures;
            if (i.programs.length !== E.stats.programs) i.programs.length = E.stats.programs;
        },
        get failed() { return E.failed; },
        dispose() { const l = gl.getExtension('WEBGL_lose_context'); if (l) l.loseContext(); },
        forceContextLoss() { const l = gl.getExtension('WEBGL_lose_context'); if (l) l.loseContext(); }
    };
    return R;
}

// Which renderer should this game use? '?r=three' / '?r=hg' in the address decides for one visit; a failed
// start is remembered per game (so the next visit goes straight to three.js); otherwise HG3D when it can run.
function pick(game, fallbackDefault) {
    let q = null; try { const m = /[?&]r=(three|hg)\b/.exec(location.search); if (m) q = m[1]; } catch (e) { }
    if (q === 'three') return 'three';
    if (typeof WebGL2RenderingContext === 'undefined') return 'three';
    if (q === 'hg') return 'hg';
    try { if (localStorage.getItem('hgq:r:' + game) === 'three') return 'three'; } catch (e) { }
    return fallbackDefault || 'hg';
}
// HG3D could not draw this game here: remember it and start again on three.js (once)
function bail(game, why) {
    try { console.warn('[HG3D] falling back to three.js: ' + why); localStorage.setItem('hgq:r:' + game, 'three'); if (!/[?&]r=hg\b/.test(location.search) && !sessionStorage.getItem('hgq:bailed')) { sessionStorage.setItem('hgq:bailed', '1'); location.reload(); } } catch (e) { }
}
