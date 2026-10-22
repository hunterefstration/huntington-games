// Graphics quality and frame rate. Auto mode starts at Medium and steps down if the frame rate stays low.
const Perf = {
  level: 'medium', fps: 60, frames: 0, acc: 0, slow: 0, active: 0,
  LEVELS: ['low', 'medium', 'high'],
  init() { this.level = Settings.quality === 'auto' ? (Settings.autoLevel || 'medium') : Settings.quality; },
  pixelRatio() {
    const d = devicePixelRatio || 1;
    return this.level === 'low' ? Math.min(d, 1) * 0.75 : this.level === 'medium' ? Math.min(d, 1.25) : Math.min(d, 2);
  },
  set(level) { if (level === this.level) return; this.level = level; resizeGlobe(); Bus.emit('quality', level); },
  // called once per drawn frame; busy = the view was changing (only those frames say anything about speed)
  tick(dt, busy) {
    if (!busy) return;
    this.frames++; this.acc += dt;
    if (this.acc < 1.5) return;
    this.fps = this.frames / this.acc; this.frames = 0; this.acc = 0;
    if (Settings.fps) $('#fps').textContent = this.fps.toFixed(0) + ' fps · ' + this.level + ' · ' + Globe.lod + ' · ' + Globe.renderer.info.render.triangles + ' tris';
    if (Settings.quality !== 'auto') return;
    this.slow = this.fps < 26 ? this.slow + 1 : 0;
    const i = this.LEVELS.indexOf(this.level);
    if (this.slow >= 2 && i > 0) {
      this.slow = 0; this.set(this.LEVELS[i - 1]); Settings.autoLevel = this.level; saveSettings();
      toast('Graphics lowered to ' + this.level + ' to keep things smooth');
    }
  }
};
