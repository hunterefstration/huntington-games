// Small line charts (one series each: the panel title names it) with a hover crosshair and tooltip.
const CHART = { line: '#6da7ec', grid: 'rgba(160,190,230,.12)', axis: '#93a3bd', zero: 'rgba(200,210,230,.35)' };

// el: a .chart div. vals: numbers, oldest first, one per step. label(i) names step i for the tooltip.
function drawChart(el, vals, { fmt = v => v.toFixed(1), label = i => '', zero = false, color = CHART.line } = {}) {
  let cv = el.querySelector('canvas'), tip = el.querySelector('.tip');
  if (!cv) { cv = document.createElement('canvas'); tip = document.createElement('div'); tip.className = 'tip'; el.append(cv, tip); }
  const pr = Math.min(devicePixelRatio || 1, 2), W = el.clientWidth, H = el.clientHeight;
  cv.width = W * pr; cv.height = H * pr;
  const c = cv.getContext('2d'); c.setTransform(pr, 0, 0, pr, 0, 0); c.clearRect(0, 0, W, H);
  if (!vals.length) { c.fillStyle = CHART.axis; c.font = '12px system-ui'; c.fillText('No history yet: let some time pass.', 8, H / 2); return; }
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (zero) { lo = Math.min(lo, 0); hi = Math.max(hi, 0); }
  if (hi - lo < 1e-9) { hi += Math.abs(hi) * 0.05 + 1; lo -= Math.abs(lo) * 0.05 + 1; }
  const pad = (hi - lo) * 0.1; lo -= pad; hi += pad;
  const L = 46, R = 8, T = 8, B = 18, x = i => L + (vals.length < 2 ? (W - L - R) / 2 : i / (vals.length - 1) * (W - L - R)), y = v => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  // recessive grid and axis labels
  c.font = '10px system-ui'; c.fillStyle = CHART.axis; c.textAlign = 'right'; c.textBaseline = 'middle';
  for (let k = 0; k <= 3; k++) {
    const v = lo + (hi - lo) * k / 3, yy = y(v);
    c.strokeStyle = CHART.grid; c.lineWidth = 1; c.beginPath(); c.moveTo(L, yy); c.lineTo(W - R, yy); c.stroke();
    c.fillText(fmt(v), L - 5, yy);
  }
  if (lo < 0 && hi > 0) { c.strokeStyle = CHART.zero; c.setLineDash([3, 3]); c.beginPath(); c.moveTo(L, y(0)); c.lineTo(W - R, y(0)); c.stroke(); c.setLineDash([]); }
  c.textAlign = 'left'; c.textBaseline = 'alphabetic'; c.fillText(label(0), L, H - 4);
  c.textAlign = 'right'; c.fillText(label(vals.length - 1), W - R, H - 4);
  // the line
  c.strokeStyle = color; c.lineWidth = 2; c.lineJoin = 'round'; c.lineCap = 'round'; c.beginPath();
  vals.forEach((v, i) => i ? c.lineTo(x(i), y(v)) : c.moveTo(x(i), y(v))); c.stroke();
  c.fillStyle = color; c.beginPath(); c.arc(x(vals.length - 1), y(vals[vals.length - 1]), 4, 0, 7); c.fill();
  const base = c.getImageData(0, 0, cv.width, cv.height);
  cv.onpointermove = e => {
    const r = cv.getBoundingClientRect(), mx = (e.clientX - r.left) / (r.width / W);
    const i = clamp(Math.round((mx - L) / (W - L - R) * (vals.length - 1)), 0, vals.length - 1);
    c.putImageData(base, 0, 0); c.setTransform(pr, 0, 0, pr, 0, 0);
    c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 1; c.beginPath(); c.moveTo(x(i), T); c.lineTo(x(i), H - B); c.stroke();
    c.fillStyle = color; c.strokeStyle = '#0b1424'; c.lineWidth = 2; c.beginPath(); c.arc(x(i), y(vals[i]), 4.5, 0, 7); c.fill(); c.stroke();
    tip.style.display = 'block'; tip.style.left = (x(i) / W * 100) + '%'; tip.style.top = (y(vals[i]) / H * 100) + '%';
    tip.textContent = label(i) + ': ' + fmt(vals[i]);
  };
  cv.onpointerleave = () => { c.putImageData(base, 0, 0); tip.style.display = 'none'; };
}
