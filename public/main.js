// MH://cortex · imatin.dev
// The name on this page is drawn by ~400–900 leaky integrate-and-fire neurons.
// They are wired to their neighbours, spike for real, and keep themselves near
// criticality with homeostatic synaptic scaling. Your cursor is the electrode.

// ------------------------------------------------------------------ your details
// null = not shown. The mail door falls back to the lab's contact section.
const CONFIG = {
  github: 'sudometin',
  email: 'hi@imatin.dev',
  telegramChannel: 'UNFINITUM',
  cv: null,               // e.g. 'https://cv.imatin.dev' once it exists
};

const $ = (s) => document.querySelector(s);
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const root = document.documentElement;
const born = performance.now();
const rand = (a, b) => a + Math.random() * (b - a);
const sleepMs = (ms) => new Promise((r) => setTimeout(r, ms));

// ------------------------------------------------------------------ toast / theme
const toastEl = $('#toast');
let toastT = 0;
function toast(msg, ms = 2800) {
  toastEl.textContent = msg; toastEl.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => (toastEl.hidden = true), ms);
}
const readAcc = () => getComputedStyle(root).getPropertyValue('--accent-rgb').trim() || '110, 231, 200';
let ACC = readAcc();
const THEMES = ['mint', 'amber', 'violet', 'matrix', 'mono'];
function setTheme(t) { root.dataset.theme = t; ACC = readAcc(); try { localStorage.setItem('mh.theme', t); } catch {} }
try { const t = localStorage.getItem('mh.theme'); if (THEMES.includes(t)) setTheme(t); } catch {}

// ------------------------------------------------------------------ event log
const logEl = $('#log');
const stampFmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
const stamp = () => { const d = new Date(); return `${stampFmt.format(d)}.${String(d.getMilliseconds()).padStart(3, '0')}`; };
function log(msg, cls = '') {
  const li = document.createElement('li');
  if (cls) li.className = cls;
  const t = document.createElement('span'); t.className = 't'; t.textContent = `[${stamp()}] `;
  li.append(t, document.createTextNode(msg));
  logEl.appendChild(li);
  while (logEl.children.length > 9) logEl.firstChild.remove();
}

// ================================================================== NAME FORMS
const FORMS = [
  { text: 'MATIN HASSANLOO', split: ['MATIN', 'HASSANLOO'] },
  { text: 'متین حسنلو', split: ['متین', 'حسنلو'], rtl: true, msg: 'متین حسنلو · same name, other script.' },
  { text: 'M4T1N H455ANL00', split: ['M4T1N', 'H455ANL00'], msg: 'leet mode engaged.' },
  { text: '0x4D48', msg: '0x4D48 · "MH" in hex.' },
  { text: 'MH', msg: 'compressed to initials. lossless, mostly.' },
];
let formIdx = 0;
const FONT = '"Space Grotesk", "Helvetica Neue", Arial, sans-serif';
const FONT_RTL = 'Tahoma, "Geeza Pro", "Noto Sans Arabic", sans-serif';

// ================================================================== FIELD
const cv = $('#field');
const g = cv.getContext('2d');
let W = 0, H = 0, DPR = 1;
let neurons = [], edges = [], spikes = [];
let letterCount = 0;
let nameBox = { x: 0, y: 0, w: 0, h: 0 };
let t = 0, firedThisFrame = 0, totalSpikes = 0, rateEMA = 0;
let W_EXC = 0.82;
const TARGET_HZ = 0.8;
const mouse = { x: -1e4, y: -1e4, on: false };
const st = { mode: 'awake', coffeeUntil: 0, plume: null, wave: null, glitchUntil: 0, bands: [], rewireAt: 0 };

function layout(form) {
  const narrow = W < 760;
  const lines = narrow && form.split ? form.split : [form.text];
  const fam = form.rtl ? FONT_RTL : FONT;
  const c = document.createElement('canvas').getContext('2d');
  c.font = `700 100px ${fam}`;
  const w100 = Math.max(...lines.map((l) => c.measureText(l).width));
  const slot = $('#name-slot');
  const colW = slot.getBoundingClientRect().width || W * 0.9;
  const maxW = Math.min(colW * (narrow ? 0.98 : 0.9), 1280);
  const lineH = 1.02;
  // leave room in the center column for the identity line, prompt and doors
  const centerH = H - 47 - 78 - 36;
  // below the name: identity + prompt + doors (+ side panels on wide screens)
  const reserve = W < 900 ? 430 : W >= 1180 ? 330 : 300;
  let size = (maxW / w100) * 100;
  size = Math.min(size, narrow ? 140 : 180, Math.max(48 * lines.length, Math.min(H * 0.4, centerH - reserve)) / (lines.length * lineH));
  c.font = `700 ${size}px ${fam}`;
  const tw = Math.max(...lines.map((l) => c.measureText(l).width));
  const bw = Math.ceil(tw + size * 0.2), bh = Math.ceil(lines.length * size * lineH + size * 0.15);
  slot.style.height = `${bh}px`;
  const r = slot.getBoundingClientRect();
  return { lines, size, fam, lineH, box: { x: Math.round(r.left + (r.width - bw) / 2), y: Math.round(r.top), w: bw, h: bh } };
}

function samplePoints(form, count) {
  const L = layout(form);
  const oc = document.createElement('canvas');
  oc.width = L.box.w; oc.height = L.box.h;
  const c = oc.getContext('2d');
  c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.font = `700 ${L.size}px ${L.fam}`;
  if (form.rtl) c.direction = 'rtl';
  L.lines.forEach((ln, i) => c.fillText(ln, L.box.w / 2, L.size * (0.55 + i * L.lineH) + L.size * 0.02));
  const data = c.getImageData(0, 0, oc.width, oc.height).data;
  const step = Math.max(2, Math.round(L.size / 40));
  const pts = [];
  for (let y = 0; y < oc.height; y += step)
    for (let x = 0; x < oc.width; x += step)
      if (data[(y * oc.width + x) * 4 + 3] > 140) pts.push({ x: L.box.x + x + rand(-step, step) * 0.35, y: L.box.y + y + rand(-step, step) * 0.35 });
  for (let i = pts.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pts[i], pts[j]] = [pts[j], pts[i]]; }
  // too few glyph pixels means the font or layout wasn't ready yet: scatter the
  // neurons across the name box for now (never stack them) and let the caller retry
  const ok = pts.length >= 60 && L.box.w > 40 && L.box.h > 20;
  const out = [];
  for (let i = 0; i < count; i++) {
    if (!ok) { out.push({ x: L.box.x + Math.random() * Math.max(40, L.box.w), y: L.box.y + Math.random() * Math.max(20, L.box.h) }); continue; }
    const p = pts[i % pts.length];
    out.push(i < pts.length ? p : { x: p.x + rand(-2, 2), y: p.y + rand(-2, 2) });
  }
  // faint ghost of the glyphs, drawn under the neurons so the name stays legible
  if (ok) { ghost = oc; ghostBox = L.box; }
  return { pts: out, box: L.box, ok };
}
let ghost = null, ghostBox = null;

function placeChrome(box) {
  nameBox = box;
  root.style.setProperty('--below', `${box.y + box.h + 18}px`);
  const hit = $('#name-hit');
  Object.assign(hit.style, { left: `${box.x}px`, top: `${box.y}px`, width: `${box.w}px`, height: `${box.h}px` });
}

function makeNeuron(x, y, letter) {
  return { x, y, hx: x, hy: y, vx: 0, vy: 0, v: Math.random() * 0.5, ref: 0, glow: 0, out: [], inh: Math.random() < 0.16, gain: rand(0.55, 1.25), letter, track: -1, id: 0 };
}

// k-nearest wiring with a spatial hash
function wire() {
  edges = []; spikes = [];
  for (const n of neurons) n.out = [];
  const CELL = 48, grid = new Map();
  const key = (x, y) => `${Math.floor(x / CELL)},${Math.floor(y / CELL)}`;
  for (const n of neurons) { const k = key(n.hx, n.hy); (grid.get(k) || grid.set(k, []).get(k)).push(n); }
  const near = (a, k, filter) => {
    for (let r = 1; r <= 6; r++) {
      const cx = Math.floor(a.hx / CELL), cy = Math.floor(a.hy / CELL), cand = [];
      for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) for (const b of grid.get(`${cx + dx},${cy + dy}`) || []) if (b !== a && filter(b)) cand.push(b);
      if (cand.length >= k || r === 6) return cand.map((b) => ({ b, d: Math.hypot(a.hx - b.hx, a.hy - b.hy) })).sort((p, q) => p.d - q.d).slice(0, k);
    }
    return [];
  };
  const link = (a, b, d) => { const e = { a, b, len: Math.max(8, d), j: rand(-0.08, 0.08) }; a.out.push(e); edges.push(e); };
  for (const a of neurons) {
    if (a.letter) {
      for (const { b, d } of near(a, 3, (b) => b.letter)) link(a, b, d);
      if (Math.random() < 0.06) { const b = neurons[Math.floor(Math.random() * letterCount)]; const d = Math.hypot(a.hx - b.hx, a.hy - b.hy); if (d < 320 && b !== a) link(a, b, d); }
    } else {
      for (const { b, d } of near(a, 2, (b) => !b.letter)) link(a, b, d);
      if (Math.random() < 0.35) { const n = near(a, 1, (b) => b.letter)[0]; if (n && n.d < 260) link(a, n.b, n.d); }
    }
  }
  $('#m-n').textContent = neurons.length;
  $('#m-syn').textContent = edges.length;
}

function build() {
  DPR = Math.min(2, window.devicePixelRatio || 1);
  W = innerWidth; H = innerHeight;
  cv.width = W * DPR; cv.height = H * DPR;
  g.setTransform(DPR, 0, 0, DPR, 0, 0);
  letterCount = Math.round(Math.max(650, Math.min(1700, (W * H) / 720)));
  const { pts, box, ok } = samplePoints(FORMS[formIdx], letterCount);
  placeChrome(box);
  neurons = pts.map((p) => makeNeuron(p.x, p.y, true));
  if (!ok) scheduleRetarget(250);
  else for (let i = 0; i < letterCount; i++) neurons[i].letterOk = true;
  const bgN = Math.round(Math.max(30, Math.min(110, (W * H) / 16000)));
  for (let i = 0; i < bgN; i++) {
    let x, y, tries = 0;
    do { x = rand(10, W - 10); y = rand(56, H - 60); tries++; }
    while (tries < 30 && x > box.x - 30 && x < box.x + box.w + 30 && y > box.y - 30 && y < box.y + box.h + 30);
    neurons.push(makeNeuron(x, y, false));
  }
  neurons.forEach((n, i) => (n.id = i));
  // track 24 letter units for the raster
  tracked = [];
  for (let i = 0; i < 24; i++) { const n = neurons[Math.floor((i / 24) * letterCount)]; n.track = i; tracked.push([]); }
  wire();
}

// Re-sample the name and let the neurons fly to their new homes. Called when fonts finish
// loading, when the name slot moves or resizes, and as a retry if a sample came back empty.
let retargetT = 0, retargetTries = 0;
function scheduleRetarget(ms) { clearTimeout(retargetT); retargetT = setTimeout(retarget, ms); }
function retarget() {
  if (!neurons.length) return;
  const { pts, box, ok } = samplePoints(FORMS[formIdx], letterCount);
  if (!ok) { if (++retargetTries < 20) scheduleRetarget(300); return; }
  retargetTries = 0;
  const moved = Math.abs(box.x - nameBox.x) > 2 || Math.abs(box.y - nameBox.y) > 2 || Math.abs(box.w - nameBox.w) > 2 || Math.abs(box.h - nameBox.h) > 2;
  const scattered = !edges.length || neurons[0].letterOk !== true;
  if (!moved && !scattered) return;
  placeChrome(box);
  for (let i = 0; i < letterCount; i++) { neurons[i].pending = { x: pts[i].x, y: pts[i].y, at: t + rand(0, 0.35) }; neurons[i].letterOk = true; }
  spikes = [];
  st.rewireAt = t + 1.2;
}

function morph(next) {
  formIdx = next;
  const { pts, box } = samplePoints(FORMS[formIdx], letterCount);
  placeChrome(box);
  spikes = [];
  for (let i = 0; i < letterCount; i++) {
    const n = neurons[i];
    const p = pts[i];
    n.pending = { x: p.x, y: p.y, at: t + rand(0, 0.45) };
  }
  st.rewireAt = t + 1.5;
  glitch(500);
  log(`morph → "${FORMS[formIdx].text}" · rewiring ${letterCount} units`, 'warm');
}

function fire(n) {
  n.v = 0; n.ref = 0.11; n.glow = 1;
  firedThisFrame++; totalSpikes++; binCount++;
  if (n.track >= 0) tracked[n.track].push(performance.now());
  if (spikes.length < 3000) for (const e of n.out) spikes.push({ e, p: 0 });
  if (Math.random() < 0.0016) lastSpikeSample = n;
}
function stimulate(x, y, r = 130, s = 1.3) {
  for (const n of neurons) { const d = Math.hypot(n.x - x, n.y - y); if (d < r) n.v += s * (1 - d / r) + 0.3; }
}
function glitch(ms = 280) {
  if (reduce) return;
  st.glitchUntil = performance.now() + ms;
  st.bands = Array.from({ length: 2 + Math.floor(Math.random() * 3) }, () => {
    const y = rand(nameBox.y, nameBox.y + nameBox.h);
    return { y0: y, y1: y + rand(6, 26), dx: rand(-28, 28) };
  });
}

// ------------------------------------------------------------------ dynamics
function step(dt) {
  t += dt;
  const caf = performance.now() < st.coffeeUntil;
  const asleep = st.mode === 'asleep';
  const spont = (asleep ? 0.03 : 0.11) * (caf ? 3 : 1);
  const leak = Math.exp(-dt / 0.09);
  const inhib = Math.min(4, rateEMA * 0.35);
  const slow = asleep ? Math.max(0, Math.sin(2 * Math.PI * 0.8 * t)) ** 6 * 0.22 : 0;

  for (const n of neurons) {
    // membrane
    n.v = n.v * leak - inhib * dt;
    if (Math.random() < spont * dt) n.v += 1.05;
    if (slow) n.v += slow * n.gain;
    if (mouse.on) {
      const dx = n.x - mouse.x, dy = n.y - mouse.y, d = Math.hypot(dx, dy);
      if (d < 90) {
        n.v += (1 - d / 90) * 16 * dt * (caf ? 1.4 : 1);
        if (d > 0.1 && !reduce) { const push = (1 - d / 90) * 1500 * dt; n.vx += (dx / d) * push; n.vy += (dy / d) * push; }
      }
    }
    if (st.plume) { const p = st.plume, d = Math.hypot(n.x - p.x, n.y - p.y); if (d < p.r) n.v += (1 - d / p.r) * 14 * dt; }
    if (st.wave && !n.ref && Math.abs(n.x - st.wave.x) < 16) n.v = 1.1;
    n.glow *= Math.exp(-dt / 0.35);
    // body: spring back home (and fly to a new home during a morph)
    if (n.pending && t >= n.pending.at) { n.hx = n.pending.x; n.hy = n.pending.y; n.pending = null; }
    const k = 55, damp = 10;
    n.vx += ((n.hx - n.x) * k - n.vx * damp) * dt;
    n.vy += ((n.hy - n.y) * k - n.vy * damp) * dt;
    n.x += n.vx * dt; n.y += n.vy * dt;
  }

  const speed = 260;
  for (let i = spikes.length - 1; i >= 0; i--) {
    const s = spikes[i];
    s.p += (speed * dt) / s.e.len;
    if (s.p >= 1) { s.e.b.v += s.e.a.inh ? -0.9 : W_EXC + s.e.j; spikes[i] = spikes[spikes.length - 1]; spikes.pop(); }
  }
  for (const n of neurons) {
    if (n.ref > 0) n.ref -= dt;
    else if (n.v >= 1) fire(n);
    if (n.v < -0.5) n.v = -0.5;
  }
  if (st.rewireAt && t >= st.rewireAt) { st.rewireAt = 0; wire(); log('rewiring complete · synapses ' + edges.length, 'ok'); }
  if (!asleep && !caf && !mouse.on && !st.rewireAt) W_EXC = Math.min(0.97, Math.max(0.6, W_EXC + dt * 0.015 * (TARGET_HZ - rateEMA)));
  if (st.plume) { const p = st.plume; p.x += p.vx * dt; p.y += Math.sin(t * 1.3) * 18 * dt; p.r += 6 * dt; if (p.x - p.r > W) st.plume = null; }
  if (st.wave) { st.wave.x += 1000 * dt; if (st.wave.x > W + 40) st.wave = null; }
  // burst detection in 50 ms bins
  binT += dt;
  if (binT >= 0.05) { onBin(binCount); binT = 0; binCount = 0; }
}

// ------------------------------------------------------------------ render
function draw() {
  g.clearRect(0, 0, W, H);
  const glitching = performance.now() < st.glitchUntil;
  const off = (n) => {
    if (!glitching || !n.letter) return 0;
    for (const b of st.bands) if (n.y >= b.y0 && n.y <= b.y1) return b.dx;
    return 0;
  };
  if (ghost) { g.globalAlpha = 0.055; g.drawImage(ghost, ghostBox.x, ghostBox.y); g.globalAlpha = 1; }
  // synapses
  g.lineWidth = 1;
  g.strokeStyle = `rgba(${ACC}, 0.075)`;
  g.beginPath();
  for (const e of edges) { if (!e.a.letter) continue; g.moveTo(e.a.x + off(e.a), e.a.y); g.lineTo(e.b.x + off(e.b), e.b.y); }
  g.stroke();
  g.strokeStyle = `rgba(${ACC}, 0.035)`;
  g.beginPath();
  for (const e of edges) { if (e.a.letter) continue; g.moveTo(e.a.x, e.a.y); g.lineTo(e.b.x, e.b.y); }
  g.stroke();
  // odor plume
  if (st.plume) {
    const p = st.plume, grd = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
    grd.addColorStop(0, 'rgba(245,180,84,0.16)'); grd.addColorStop(1, 'rgba(245,180,84,0)');
    g.fillStyle = grd; g.beginPath(); g.arc(p.x, p.y, p.r, 0, Math.PI * 2); g.fill();
  }
  // spikes in flight
  g.fillStyle = `rgba(${ACC}, 0.9)`;
  for (const s of spikes) { const a = s.e.a, b = s.e.b; g.fillRect(a.x + (b.x - a.x) * s.p - 1, a.y + (b.y - a.y) * s.p - 1, 2, 2); }
  // somata
  const pass = (dx, color, alphaMul) => {
    for (const n of neurons) {
      const x = n.x + off(n) + dx, y = n.y;
      const a = (n.letter ? 0.5 : 0.16) + (n.letter ? 0.5 : 0.8) * n.glow;
      g.fillStyle = color ? color : n.inh ? `rgba(245,180,84,${a})` : `rgba(${ACC}, ${a * alphaMul})`;
      const r = (n.letter ? 1.05 : 1.3) + n.glow * 1.6;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
  };
  if (glitching) {
    g.globalCompositeOperation = 'lighter';
    pass(-3, 'rgba(255,42,109,0.35)', 1);
    pass(3, 'rgba(5,217,232,0.35)', 1);
    g.globalCompositeOperation = 'source-over';
  }
  pass(0, null, 1);
  // halos on fresh spikes
  for (const n of neurons) {
    if (n.glow < 0.25) continue;
    g.fillStyle = n.inh ? `rgba(245,180,84,${0.1 * n.glow})` : `rgba(${ACC}, ${0.12 * n.glow})`;
    g.beginPath(); g.arc(n.x + off(n), n.y, 4 + n.glow * 5, 0, Math.PI * 2); g.fill();
  }
  // electrode
  if (mouse.on) {
    g.strokeStyle = `rgba(${ACC}, 0.35)`; g.setLineDash([3, 5]);
    g.beginPath(); g.arc(mouse.x, mouse.y, 90, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
    g.strokeStyle = `rgba(${ACC}, 0.8)`;
    g.beginPath(); g.moveTo(mouse.x - 7, mouse.y); g.lineTo(mouse.x + 7, mouse.y); g.moveTo(mouse.x, mouse.y - 7); g.lineTo(mouse.x, mouse.y + 7); g.stroke();
    g.fillStyle = `rgba(${ACC}, 0.7)`; g.font = '10px JetBrains Mono, monospace';
    g.fillText(`stim ${Math.round(mouse.x)},${Math.round(mouse.y)}`, mouse.x + 12, mouse.y - 10);
  }
}

// ------------------------------------------------------------------ LFP + raster
const lfpC = $('#lfp'), lg = lfpC.getContext('2d');
const rasC = $('#raster'), rg = rasC.getContext('2d');
const trace = new Float32Array(420);
let lfpVal = 0, tracked = [];
function sizeAux() {
  for (const [c, x] of [[lfpC, lg], [rasC, rg]]) {
    const r = c.getBoundingClientRect();
    c.width = Math.max(1, r.width * DPR); c.height = Math.max(1, r.height * DPR);
    x.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
}
function drawLfp() {
  const w = lfpC.width / DPR, h = lfpC.height / DPR;
  lfpVal += ((firedThisFrame / Math.max(1, neurons.length)) * 60 - lfpVal) * 0.2;
  trace.copyWithin(0, 1); trace[trace.length - 1] = lfpVal;
  lg.clearRect(0, 0, w, h);
  lg.strokeStyle = `rgba(${ACC}, 0.12)`;
  lg.beginPath(); for (let x = 0; x < w; x += 40) { lg.moveTo(x, 0); lg.lineTo(x, h); } lg.stroke();
  lg.strokeStyle = `rgba(${ACC}, 0.85)`; lg.lineWidth = 1.3; lg.shadowColor = `rgba(${ACC}, .8)`; lg.shadowBlur = 6;
  lg.beginPath();
  for (let i = 0; i < trace.length; i++) { const x = (i / (trace.length - 1)) * w, y = h * 0.6 + Math.min(h * 0.55, trace[i] * 12); i ? lg.lineTo(x, y) : lg.moveTo(x, y); }
  lg.stroke(); lg.shadowBlur = 0;
}
function drawRaster() {
  const w = rasC.width / DPR, h = rasC.height / DPR;
  if (w < 2) return;
  const now = performance.now(), span = 4000, rowH = h / tracked.length;
  rg.clearRect(0, 0, w, h);
  rg.fillStyle = `rgba(${ACC}, 0.9)`;
  tracked.forEach((arr, i) => {
    while (arr.length && now - arr[0] > span) arr.shift();
    for (const ts of arr) rg.fillRect(w - ((now - ts) / span) * w, i * rowH + 1, 1.5, Math.max(1, rowH - 1.5));
  });
}

// ------------------------------------------------------------------ bursts → log
let binT = 0, binCount = 0, baseBin = 2, burst = null, lastSpikeSample = null, lastSampleLog = 0;
function onBin(c) {
  baseBin += (c - baseBin) * 0.02;
  if (!burst && c > baseBin * 2.4 + 6) burst = { size: 0, start: performance.now() };
  if (burst) {
    burst.size += c;
    if (c < baseBin * 1.3 + 2) {
      const dur = performance.now() - burst.start;
      if (burst.size > 25) log(`avalanche · size ${burst.size} · ${Math.round(dur)} ms`, burst.size > 150 ? 'hot' : 'ok');
      burst = null;
    }
  }
  const now = performance.now();
  if (lastSpikeSample && now - lastSampleLog > 1100) {
    lastSampleLog = now;
    log(`ch${String(lastSpikeSample.id % 64).padStart(2, '0')} spike · −${Math.round(rand(38, 140))} µV · ${lastSpikeSample.letter ? 'cortex' : 'white matter'}`);
    lastSpikeSample = null;
  }
}

// ------------------------------------------------------------------ monitor
const gaugeEl = $('#m-gauge');
function monitor() {
  $('#m-rate').textContent = rateEMA.toFixed(2);
  $('#m-w').textContent = W_EXC.toFixed(3);
  $('#m-flight').textContent = spikes.length;
  $('#m-total').textContent = totalSpikes.toLocaleString();
  const caf = performance.now() < st.coffeeUntil;
  $('#mon-state').textContent = st.mode === 'asleep' ? 'slow-wave sleep · δ' : caf ? 'caffeinated' : 'awake';
  gaugeEl.style.width = `${Math.min(100, (rateEMA / 3) * 100)}%`;
  $('#clock').textContent = clockFmt.format(new Date());
}
const clockFmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
$('#sess').textContent = '0x' + Math.floor(Math.random() * 0xffff).toString(16).toUpperCase().padStart(4, '0');

// ------------------------------------------------------------------ loop
let last = performance.now(), lastReduced = 0, nextGlitch = performance.now() + 5000;
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  firedThisFrame = 0;
  if (!reduce || now - lastReduced > 350) {
    step(reduce ? 0.35 : dt);
    lastReduced = now;
    draw(); drawLfp(); drawRaster();
    rateEMA += ((firedThisFrame / Math.max(1, neurons.length)) / Math.max(dt, 1 / 120) - rateEMA) * 0.03;
  }
  if (now > nextGlitch) { glitch(); nextGlitch = now + rand(6000, 12000); }
  requestAnimationFrame(loop);
}

let resizeT = 0;
addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(() => { build(); sizeAux(); }, 160); });
addEventListener('pointermove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; mouse.on = true; activity(); });
document.addEventListener('pointerleave', () => (mouse.on = false));
cv.addEventListener('pointerdown', (e) => { stimulate(e.clientX, e.clientY); log(`pulse delivered @ ${Math.round(e.clientX)},${Math.round(e.clientY)}`, 'warm'); activity(); });
addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') mouse.on = false; });

// name: click to stimulate, 5 fast clicks to morph
let clicks = 0, clickT = 0;
$('#name-hit').addEventListener('click', (e) => {
  if (e.detail) e.currentTarget.blur(); // mouse clicks shouldn't leave a focus ring
  stimulate(e.clientX || nameBox.x + nameBox.w / 2, e.clientY || nameBox.y + nameBox.h / 2, 110, 1.4);
  const now = performance.now();
  clicks = now - clickT < 650 ? clicks + 1 : 1; clickT = now;
  if (clicks >= 5) {
    clicks = 0;
    const next = (formIdx + 1) % FORMS.length;
    morph(next);
    toast(next === 0 ? 'back to baseline.' : FORMS[next].msg);
  }
});

// ================================================================== SLEEP / WAKE
let lastActive = performance.now();
function activity() { lastActive = performance.now(); if (st.mode === 'asleep') wake(true); }
function sleep(manual = false) {
  if (st.mode === 'asleep') return;
  st.mode = 'asleep';
  toast(manual ? 'entering slow-wave sleep · δ ~1 Hz' : 'no input… entering slow-wave sleep. move to wake me.', 3600);
  log('state → slow-wave sleep', 'warm');
}
function wake(auto = false) {
  if (st.mode !== 'asleep') return;
  st.mode = 'awake';
  toast(auto ? 'arousal ✓ back to the wake state' : 'awake.');
  log('state → awake', 'ok');
}
setInterval(() => { if (st.mode === 'awake' && performance.now() - lastActive > 25000 && termEl.hidden) sleep(); }, 1000);

// ================================================================== TAGLINE
const TAGS = [
  'neuroengineer // olfactory neural interfaces',
  'decoding smells straight from the olfactory bulb',
  'listening to neurons at 30 kHz',
  'spike sorting is my cardio',
  'turning brainwaves into bits, and bits into smells',
  'signal processing · deep nets · wetware',
  'currently: teaching a CNN to smell',
];
const tagEl = $('#tag');
if (reduce) tagEl.textContent = TAGS[0];
else {
  let ti = 0, pos = 0, dir = 1, hold = 0;
  setInterval(() => {
    const s = TAGS[ti];
    if (dir === 1) { pos++; if (pos >= s.length) { dir = 0; hold = 40; } }
    else if (dir === 0) { if (--hold <= 0) dir = -1; }
    else { pos -= 3; if (pos <= 0) { pos = 0; dir = 1; ti = (ti + 1) % TAGS.length; } }
    // a couple of garbage chars at the typing head look like decryption
    const head = dir === 1 && pos < s.length ? String.fromCharCode(33 + Math.floor(Math.random() * 60)) : '';
    tagEl.textContent = s.slice(0, Math.max(0, pos)) + head;
  }, 45);
}

// ================================================================== LINKS
const linkByKey = {};
const descEl = $('#desc');
document.querySelectorAll('.doors a').forEach((a) => {
  linkByKey[a.dataset.key] = a;
  const show = () => { descEl.textContent = `→ ${a.dataset.desc}`; };
  a.addEventListener('mouseenter', () => { show(); log(`probe → ${a.dataset.desc.split(' · ')[0]}`); glitch(160); });
  a.addEventListener('focus', show);
  a.addEventListener('mouseleave', () => (descEl.innerHTML = '&nbsp;'));
});
function go(a) {
  a.classList.add('pressed');
  const r = a.getBoundingClientRect();
  stimulate(r.left + r.width / 2, r.top, 200, 1.6);
  glitch(300);
  log(`exec → ${a.href.replace(/^https?:\/\//, '').replace(/^mailto:/, 'mailto ')}`, 'ok');
  setTimeout(() => (location.href = a.href), 320);
}
const typing = () => { const el = document.activeElement; return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable); };

// ================================================================== EGGS
function burstStim() { stimulate(W / 2, nameBox.y + nameBox.h / 2, Math.max(W, H) * 0.4, 1.6); glitch(300); toast('⚡ all-or-none. population burst delivered.'); log('population burst', 'hot'); }
function travelingWave() { st.wave = { x: -20 }; log('traveling wave initiated', 'ok'); }
function sniff() {
  st.plume = { x: -60, y: rand(H * 0.25, H * 0.7), vx: 170, r: 80 };
  const o = ['isoamyl acetate (banana)', '2-phenylethanol (rose)', '(R)-carvone (spearmint)', 'vanillin (vanilla)', 'eugenol (clove)', 'limonene (citrus)'];
  const odor = o[Math.floor(Math.random() * o.length)];
  toast(`odorant detected: ${odor}`); log(`odor plume · ${odor}`, 'warm');
}
function coffee() { st.coffeeUntil = performance.now() + 20000; toast('☕ adenosine receptors blocked · excitability ↑ 20 s'); log('caffeine on board', 'warm'); }
function matrix() { setTheme('matrix'); toast('wake up… the cortex has you.'); log('theme → matrix', 'ok'); }

const breachEl = $('#breach');
async function breach(sub = 'root@cortex · welcome back, operator') {
  $('#breach-s').textContent = sub;
  breachEl.hidden = false;
  glitch(900); travelingWave();
  log('!! ACCESS GRANTED · uid=0(root)', 'hot');
  await sleepMs(reduce ? 1200 : 1800);
  breachEl.hidden = true;
}

// keyboard
const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
const SECRET_WORDS = ['sniff', 'smell', 'coffee', 'sleep', 'hack', 'matrix'];
let kpos = 0, typed = '', lastKey = 0, pendingNav = 0;
addEventListener('keydown', (e) => {
  if (bootEl && !bootEl.hidden) { endBoot(); return; }
  if (e.key === '`' || e.key === '~' || (e.key === 'Escape' && !termEl.hidden)) {
    if (e.key === 'Escape' || !typing() || document.activeElement === termInput) { e.preventDefault(); toggleTerm(); }
    return;
  }
  activity();
  if (typing() || e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  kpos = k === KONAMI[kpos] ? kpos + 1 : k === KONAMI[0] ? 1 : 0;
  if (kpos === KONAMI.length) { kpos = 0; breach('↑↑↓↓←→←→BA · cheat accepted · uid=0'); return; }
  clearTimeout(pendingNav);
  if (k.length !== 1) return;
  const now = performance.now();
  if (now - lastKey > 1500) typed = '';
  lastKey = now;
  typed = (typed + k).slice(-12);
  if (typed.endsWith('sniff') || typed.endsWith('smell')) { sniff(); typed = ''; return; }
  if (typed.endsWith('coffee')) { coffee(); typed = ''; return; }
  if (typed.endsWith('sleep')) { sleep(true); typed = ''; return; }
  if (typed.endsWith('hack')) { breach('nice try. you typed "hack". that is how hacking works now.'); typed = ''; return; }
  if (typed.endsWith('matrix')) { matrix(); typed = ''; return; }
  if (typed.endsWith('42')) { toast('42 · the answer. the question was "how many neurons is too many?"'); typed = ''; return; }
  const a = linkByKey[k];
  if (!a || kpos) return;
  const midWord = SECRET_WORDS.some((w) => { for (let n = 2; n <= typed.length; n++) if (w.startsWith(typed.slice(-n))) return true; return false; });
  if (midWord) return;
  pendingNav = setTimeout(() => go(a), SECRET_WORDS.some((w) => w[0] === k) ? 450 : 0);
});
const baseTitle = document.title;
document.addEventListener('visibilitychange', () => { document.title = document.hidden ? '⚡ connection idle · the neurons miss you' : baseTitle; });

// ================================================================== SHELL
const termEl = $('#term'), termOut = $('#term-out'), termInput = $('#term-input'), shellBtn = $('#shell-btn');
const hist = []; let hi = 0, termBooted = false, busy = false;
function line(text, cls = '') { const d = document.createElement('div'); if (cls) d.className = cls; d.textContent = text; termOut.appendChild(d); termOut.scrollTop = termOut.scrollHeight; return d; }
function linkLine(prefix, label, href) { const d = line(prefix, 'ok'); const a = document.createElement('a'); a.href = href; a.textContent = label; d.appendChild(a); }
function toggleTerm(force) {
  const open = force ?? termEl.hidden;
  termEl.hidden = !open; shellBtn.setAttribute('aria-expanded', String(open));
  if (open) {
    if (!termBooted) { termBooted = true; line('MH://cortex root shell · type `help` · Tab completes', 'dim'); }
    setTimeout(() => termInput.focus(), 10);
  } else termInput.blur();
}
shellBtn.addEventListener('click', () => toggleTerm());
$('#term-close').addEventListener('click', () => toggleTerm(false));

const FORTUNES = [
  'Resting potential is −70 mV. Aim for it sometimes.',
  'A spike is all-or-none. Your commits should be too.',
  'Correlation is not causation, but it is a great reason to record more channels.',
  'Every bug is just an action potential you did not expect.',
  'Your olfactory bulb was doing unsupervised learning before it was cool.',
  'There are roughly 86 billion neurons in your head and none of them read the docs.',
  'The brain runs on about 20 W. Your laptop is jealous.',
  'Noise is just signal you have not modelled yet.',
];
const GH = `https://github.com/${CONFIG.github}`;
const MAIL = CONFIG.email ? `mailto:${CONFIG.email}` : 'https://lab.imatin.dev/#contact';
{ const m = document.getElementById('door-mail'); if (m) { m.href = MAIL; if (CONFIG.email) m.dataset.desc = `${CONFIG.email} · i reply`; } }
const DEST = { lab: 'https://lab.imatin.dev', ops: 'https://lab.imatin.dev/ops/', builds: 'https://lab.imatin.dev/#builds', github: GH, code: GH, mail: MAIL };
if (CONFIG.cv) DEST.cv = CONFIG.cv;
if (CONFIG.telegramChannel) DEST.unfinitum = `https://t.me/${CONFIG.telegramChannel}`;
const BUILDS = [
  ['Axial', 'v0.2.0', 'macOS MRI viewer + DICOM de-identifier', `${GH}/Axial`],
  ['EFFERENT-008', 'open beta', 'server & ops manager in Telegram', 'https://t.me/TheEfferentBot'],
  ['NULLBYTE', 'building', 'security toolkit in a Telegram bot', null],
  ['UNFINITUM', 'live', 'daily projects, code & papers', CONFIG.telegramChannel ? `https://t.me/${CONFIG.telegramChannel}` : null],
];
const COMMANDS = ['help', 'now', 'builds', 'whoami', 'ls', 'cat', 'open', 'cd', 'lab', 'ops', 'cv', 'github', 'mail', 'ssh', 'ping', 'hack', 'neofetch', 'fortune', 'stats', 'fire', 'wave', 'sniff', 'coffee', 'sleep', 'wake', 'morph', 'glitch', 'theme', 'matrix', 'date', 'uptime', 'history', 'echo', 'clear', 'exit', 'sudo', 'vim', 'emacs', 'sl', 'hello'];

async function ping(host) {
  const url = host.startsWith('http') ? host : `https://${host}`;
  line(`PING ${host} · HTTP probes (browsers can't speak ICMP)`, 'dim');
  const times = [];
  for (let i = 0; i < 4; i++) {
    const t0 = performance.now();
    try { await fetch(`${url}/?ping=${Date.now()}${i}`, { mode: 'no-cors', cache: 'no-store' }); const ms = performance.now() - t0; times.push(ms); line(`reply from ${host}: seq=${i} time=${ms.toFixed(1)} ms`); }
    catch { line(`seq=${i} timeout`, 'err'); }
  }
  if (times.length) { const avg = times.reduce((a, b) => a + b, 0) / times.length; line(`${times.length}/4 received · avg ${avg.toFixed(1)} ms · a myelinated axon covers ~${(avg * 0.1).toFixed(1)} m in that time`, 'ok'); }
}
async function hack() {
  busy = true;
  line('initiating neural intrusion…', 'warm');
  await sleepMs(350);
  for (const p of ['22/tcp  ssh', '80/tcp  http', '443/tcp https', '7/tcp   olfactory (open, smells funny)']) { line(`[*] port ${p}`); await sleepMs(160); }
  const bar = line('');
  for (let i = 0; i <= 20; i++) { bar.textContent = `[*] bypassing blood–brain firewall [${'█'.repeat(i)}${'░'.repeat(20 - i)}] ${i * 5}%`; await sleepMs(55); }
  line('[*] injecting payload: dopamine.so', 'dim'); await sleepMs(300);
  line('[*] escalating: guest → root via CVE-1906-NOBEL (golgi stain overflow)', 'dim'); await sleepMs(400);
  line('[+] ACCESS GRANTED', 'ok');
  line('(this is theatre. no brains were harmed.)', 'dim');
  busy = false;
  toggleTerm(false);
  breach();
}

async function run(raw) {
  const cmd = raw.trim();
  line(`root@cortex:~# ${cmd}`, 'cmd');
  if (!cmd || busy) return;
  hist.push(cmd); hi = hist.length;
  const [c, ...rest] = cmd.split(/\s+/);
  const arg = rest.join(' '), low = c.toLowerCase();
  switch (low) {
    case 'help': case 'man':
      line('commands:', 'ok');
      ['  whoami · ls · builds · cat <file> · open <lab|ops|builds|github|mail> · ssh lab · ping <host>',
       '  cat now.log · hack · neofetch · fortune · stats · fire · wave · sniff · coffee · morph · glitch',
       '  sleep · wake · theme <mint|amber|violet|matrix|mono> · date · uptime · history · clear · exit',
       '  …plus a few unlisted ones. `cat secrets.txt` if you get stuck.'].forEach((l) => line(l));
      break;
    case 'now':
      printNow();
      break;
    case 'whoami':
      line('root. (well, guest with ambitions.) about the owner:');
      line('Matin Hassanloo · neuroengineer · olfactory neural interfaces · neural signal processing · deep learning on brain recordings', 'ok');
      break;
    case 'ls':
      line('drwxr-xr-x  lab/  ops/  builds/  github/', 'ok');
      line('-rw-r--r--  mail  now.log  secrets.txt  cortex.c  .bash_history');
      break;
    case 'cat':
      if (arg === 'secrets.txt') ['1. the field is alive. click it. hover the name.', '2. click the name 5× fast. it has other forms.', '3. some words do things when typed on the page.', '   (one smells, one is a drink, one is a nap, one is a movie)', '4. ↑ ↑ ↓ ↓ ← → ← → b a', '5. leave me alone for 25 s and i fall asleep.', '6. the devtools console takes commands too.'].forEach((l) => line(l, 'warm'));
      else if (arg === 'cortex.c') ['while (alive) {', '    v = v * leak + input();', '    if (v >= threshold) { spike(); v = reset; }', '}', '// that is it. that is the whole trick.'].forEach((l) => line(l, 'ok'));
      else if (arg === 'now.log') printNow();
      else if (arg === '.bash_history') ['make coffee', 'git commit -m "it works, do not touch"', 'python sort_spikes.py --channels 64', 'sudo make me a sandwich', 'exit'].forEach((l) => line(l, 'dim'));
      else if (arg === 'mail') linkLine('→ ', 'open a channel', DEST.mail);
      else line(arg ? `cat: ${arg}: no such file` : 'usage: cat <file>', 'err');
      break;
    case 'builds':
    case 'projects':
      BUILDS.forEach(([n, st, tag, href]) => (href ? linkLine(`  ${n.padEnd(14)} ${st.padEnd(10)} `, tag, href) : line(`  ${n.padEnd(14)} ${st.padEnd(10)} ${tag}`)));
      line('all of them: open builds', 'dim');
      break;
    case 'open': case 'cd': case 'lab': case 'ops': case 'cv': case 'github': case 'code': case 'mail': {
      const target = (['open', 'cd'].includes(low) ? arg : low).replace(/^\.\//, '').replace(/\/$/, '').toLowerCase();
      if (DEST[target]) { linkLine(`→ ${target}: `, DEST[target], DEST[target]); setTimeout(() => (location.href = DEST[target]), 500); }
      else line(target ? `${low}: ${target}: not found` : `usage: ${low} <lab|cv|github|mail>`, 'err');
      break;
    }
    case 'ssh':
      if (/lab/.test(arg)) { line('ssh guest@lab.imatin.dev · handshake ok · forwarding…', 'ok'); setTimeout(() => (location.href = 'https://lab.imatin.dev/#terminal'), 900); }
      else line('ssh: try `ssh lab`', 'err');
      break;
    case 'ping': await ping(arg || 'lab.imatin.dev'); break;
    case 'hack': await hack(); break;
    case 'neofetch':
      ['      .---.       root@cortex', '     / o o \\      -----------', '    |  (_)  |     OS: MH Cortex 3.0 (browser)', '     \\_____/      Kernel: leaky-integrate-and-fire',
       `    /|  |  |\\     Units: ${neurons.length} · Synapses: ${edges.length}`, `   / |  |  | \\    Rate: ${rateEMA.toFixed(2)} Hz · w_exc: ${W_EXC.toFixed(3)}`, `                  Theme: ${root.dataset.theme} · Uptime: ${Math.floor((performance.now() - born) / 1000)} s`].forEach((l) => line(l, 'ok'));
      break;
    case 'fortune': line(FORTUNES[Math.floor(Math.random() * FORTUNES.length)], 'warm'); break;
    case 'stats':
      line(`units ${neurons.length} (${letterCount} in the name) · synapses ${edges.length} · in flight ${spikes.length}`);
      line(`spikes since load ${totalSpikes.toLocaleString()} · rate ${rateEMA.toFixed(2)} Hz · w_exc ${W_EXC.toFixed(3)} (homeostasis → ${TARGET_HZ} Hz)`, 'ok');
      break;
    case 'fire': case 'stim': burstStim(); line('pulse delivered.', 'ok'); break;
    case 'wave': travelingWave(); line('wave propagating →', 'ok'); break;
    case 'sniff': case 'smell': sniff(); line('releasing odorant…', 'warm'); break;
    case 'coffee': coffee(); line('caffeine on board.', 'warm'); break;
    case 'morph': { const n = (formIdx + 1) % FORMS.length; morph(n); line(`morphing → ${FORMS[n].text}`, 'ok'); break; }
    case 'glitch': glitch(800); line('g̷l̴i̶t̸c̵h̷', 'hot'); break;
    case 'sleep': toggleTerm(false); sleep(true); break;
    case 'wake': wake(); line('awake.', 'ok'); break;
    case 'matrix': matrix(); line('follow the white rabbit.', 'ok'); break;
    case 'theme':
      if (THEMES.includes(arg)) { setTheme(arg); line(`theme → ${arg}`, 'ok'); } else line(`usage: theme <${THEMES.join('|')}>`, 'err');
      break;
    case 'date': line(new Date().toString()); break;
    case 'uptime': { const s = Math.floor((performance.now() - born) / 1000); line(`up ${Math.floor(s / 60)} min ${s % 60} s · ${totalSpikes.toLocaleString()} spikes · load ${rateEMA.toFixed(2)} Hz`); break; }
    case 'history': hist.forEach((h, i) => line(`  ${String(i + 1).padStart(3)}  ${h}`)); break;
    case 'echo': line(arg); break;
    case 'clear': termOut.textContent = ''; break;
    case 'exit': case 'logout': toggleTerm(false); break;
    case 'sudo': line(/sandwich/.test(arg) ? 'okay.' : 'you are already root. power corrupts. use it wisely.', /sandwich/.test(arg) ? 'ok' : 'warm'); break;
    case 'rm': line(/-rf/.test(arg) ? 'denied. neurons are not deletable (well, some regenerate in the nose).' : 'rm: permission denied', 'err'); break;
    case 'vim': line('you are now trapped in vim. type :q! to escape.', 'warm'); break;
    case ':q': case ':q!': case ':wq': line('freedom.', 'ok'); break;
    case 'emacs': line('M-x butterfly · a cosmic ray flips the desired bit. done.', 'warm'); break;
    case 'sl': ['      ====        ________', '  _D _|  |_______/        \\__I_I_____', '   |(_)---  |   H\\________/ |   |', '   /     |  |   H  |  |     |   |', '  you meant `ls`. the train has left.'].forEach((l) => line(l, 'warm')); break;
    case 'hello': case 'hi': case 'hey': line('hello, human. our neurons are now weakly coupled.', 'ok'); break;
    case '42': line('the answer. but what was the question?', 'warm'); break;
    default: line(`cortex-sh: command not found: ${c} · try \`help\``, 'err');
  }
}
$('#term-form').addEventListener('submit', (e) => { e.preventDefault(); run(termInput.value); termInput.value = ''; });
termInput.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
    if (!hist.length) return;
    e.preventDefault(); hi = Math.max(0, Math.min(hist.length, hi + (e.key === 'ArrowUp' ? -1 : 1))); termInput.value = hist[hi] ?? '';
  } else if (e.key === 'Tab') {
    e.preventDefault();
    const m = COMMANDS.filter((c) => c.startsWith(termInput.value));
    if (m.length === 1) termInput.value = m[0] + ' '; else if (m.length > 1) line(m.join('  '), 'dim');
  } else if (e.key === 'l' && e.ctrlKey) { e.preventDefault(); termOut.textContent = ''; }
});

// ================================================================== BOOT SEQUENCE
const bootEl = $('#boot');
const BOOT = [
  ['MH-BIOS v2.6.0 · hassanloo labs', ''],
  ['wetware x86_64 · 8.6e10 cores detected · 20 W', ''],
  ['', ''],
  ['[  OK  ] mounting /dev/cortex', 'ok'],
  ['[  OK  ] loading module olfactory_bulb.ko', 'ok'],
  ['[  OK  ] loading module mitral_tufted.ko', 'ok'],
  ['[  OK  ] calibrating electrodes · 64/64 channels', 'ok'],
  ['[  OK  ] spike detector armed · threshold −4.5σ', 'ok'],
  ['[  OK  ] homeostasis daemon · set point 0.8 Hz', 'ok'],
  ['[ WARN ] caffeine levels: nominal-ish', 'warn'],
  ['[  OK  ] uplink → lab.imatin.dev', 'ok'],
  ['[  OK  ] decrypting identity', 'ok'],
];
let bootDone = false;
function endBoot() {
  if (bootDone) return;
  bootDone = true;
  try { sessionStorage.setItem('mh.booted', '1'); } catch {}
  bootEl.classList.add('out');
  setTimeout(() => { bootEl.hidden = true; }, 450);
  log('session established · welcome, guest', 'ok');
}
async function runBoot() {
  let seen = false;
  try { seen = sessionStorage.getItem('mh.booted') === '1'; } catch {}
  if (seen || reduce) { bootDone = true; log('session resumed', 'ok'); return; }
  bootEl.hidden = false;
  bootEl.addEventListener('click', endBoot);
  const pre = $('#boot-text');
  for (const [txt, cls] of BOOT) {
    if (bootDone) return;
    const s = document.createElement('span'); if (cls) s.className = cls; s.textContent = txt + '\n'; pre.appendChild(s);
    await sleepMs(txt ? rand(60, 150) : 60);
  }
  const bar = document.createElement('span'); bar.className = 'ok'; pre.appendChild(bar);
  for (let i = 0; i <= 24 && !bootDone; i++) { bar.textContent = `         [${'█'.repeat(i)}${'░'.repeat(24 - i)}] ${Math.round((i / 24) * 100)}%\n`; await sleepMs(28); }
  if (bootDone) return;
  const big = document.createElement('span'); big.className = 'big'; big.textContent = '\nACCESS GRANTED · MATIN HASSANLOO\n'; pre.appendChild(big);
  await sleepMs(650);
  endBoot();
}

// ================================================================== CONSOLE
const css = () => `color:rgb(${ACC});font-family:monospace`;
console.log(`%c
 ███╗   ███╗██╗  ██╗
 ████╗ ████║██║  ██║   MH://cortex · imatin.dev
 ██╔████╔██║███████║   you opened the devtools. we'll get along.
 ██║╚██╔╝██║██╔══██║
 ██║ ╚═╝ ██║██║  ██║   try: cortex.help()
 ╚═╝     ╚═╝╚═╝  ╚═╝
`, css());
window.cortex = {
  help() { console.log('%ccortex.fire() · .wave() · .sniff() · .coffee() · .sleep() · .wake() · .morph() · .glitch() · .hack() · .theme("matrix") · .stats()', css()); return '⚡'; },
  fire: () => (burstStim(), 'pulse'), wave: () => (travelingWave(), 'wave'), sniff: () => (sniff(), 'plume'),
  coffee: () => (coffee(), '☕'), sleep: () => (sleep(true), 'zzz'), wake: () => (wake(), 'awake'),
  morph: () => (morph((formIdx + 1) % FORMS.length), FORMS[formIdx].text), glitch: () => (glitch(800), 'g̷l̴i̶t̸c̵h̷'),
  hack: () => (breach('via devtools. classic.'), 'uid=0(root)'), theme: (t) => (THEMES.includes(t) ? (setTheme(t), t) : THEMES),
  stats: () => ({ units: neurons.length, inName: letterCount, synapses: edges.length, spikesSinceLoad: totalSpikes, rateHz: +rateEMA.toFixed(2), w_exc: +W_EXC.toFixed(3), state: st.mode }),
};

// ================================================================== LIVE FEED (lab + github)
// The lab publishes /feed.json (CORS open). Override with window.MH_FEED for local testing.
const FEED_URL = window.MH_FEED || 'https://lab.imatin.dev/feed.json';
let feed = null;
const agoTxt = (iso) => {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  const d = Math.round(s / 86400);
  return d === 1 ? 'yesterday' : `${d}d ago`;
};
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
function setLive(key, html) { const el = document.querySelector(`[data-live="${key}"]`); if (el) el.innerHTML = html; }

function printNow() {
  if (!feed) { line('now.log: lab feed unreachable · try `open lab`', 'err'); return; }
  feed.log.slice(0, 4).forEach((c) => line(`› ${c.msg}  [${c.date}]`, c.type === 'feat' ? '' : 'ok'));
  if (feed.notes[0]) line(`› latest note: ${feed.notes[0].title}  [${feed.notes[0].date}]`, 'ok');
}

function renderNowPanel() {
  const ol = $('#now');
  ol.innerHTML = '';
  const items = [];
  feed.log.slice(0, 3).forEach((c) => items.push(`${esc(c.msg)} <span class="d">· ${c.date.slice(5)}</span>`));
  if (feed.notes[0]) items.push(`note: <a href="${esc(feed.notes[0].url)}">${esc(feed.notes[0].title)}</a> <span class="d">· ${feed.notes[0].date.slice(5)}</span>`);
  for (const h of items) { const li = document.createElement('li'); const sp = document.createElement('span'); sp.innerHTML = h; li.appendChild(sp); ol.appendChild(li); }
  $('#now-age').textContent = `synced ${agoTxt(feed.updated)}`;
}

function renderHeatmap(dates) {
  const box = $('#hm');
  box.innerHTML = '';
  const DAY = 86400000;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const dow = (today.getDay() + 6) % 7;
  const start = new Date(today.getTime() - (15 * 7 + dow) * DAY);
  const count = {};
  for (const d of dates) count[d] = (count[d] || 0) + 1;
  let total = 0;
  for (let i = 0; i < 16 * 7; i++) {
    const day = new Date(start.getTime() + i * DAY);
    const k = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
    const c = count[k] || 0; total += c;
    const cell = document.createElement('i');
    if (c) cell.className = c >= 3 ? 'l3' : c === 2 ? 'l2' : 'l1';
    if (day > today) cell.style.opacity = '0.25';
    cell.title = `${k} · ${c} note${c === 1 ? '' : 's'}`;
    box.appendChild(cell);
  }
  $('#hm-total').textContent = `${total} notes`;
  $('#hm-meta').textContent = `${feed.stats.notes} notes · ${feed.stats.concepts} concepts in the lab`;
}

async function loadFeed() {
  try {
    const r = await fetch(FEED_URL, { cache: 'no-cache' });
    if (!r.ok) throw new Error(r.status);
    feed = await r.json();
    const n = feed.notes[0], o = feed.ops[0];
    if (n) setLive('lab', `latest: <b>${esc(n.title)}</b> · ${agoTxt(n.date)}`);
    if (o) setLive('ops', `latest: <b>${esc(o.title)}</b> · ${agoTxt(o.date)}`);
    if (feed.builds?.length) setLive('builds', feed.builds.slice(0, 3).map((b) => `<b>${esc(b.name)}</b>`).join(' · '));
    renderNowPanel();
    renderHeatmap(feed.stats.noteDates);
    log(`feed synced · ${feed.stats.notes} notes · lab.imatin.dev`, 'ok');
  } catch {
    setLive('lab', 'notes, tools, games & a shell');
    setLive('ops', 'bots, security & CTF writeups');
    $('#now').innerHTML = '<li class="dim"><span></span><span>lab feed unreachable · <a href="https://lab.imatin.dev/now/">open /now ↗</a></span></li>';
    $('#hm-meta').textContent = 'lab feed unreachable';
    log('feed: lab.imatin.dev unreachable', 'warm');
  }
}

async function loadGithub(user = CONFIG.github) {
  const KEY = `mh.gh.${user}`;
  try {
    let ev;
    try { const c = JSON.parse(localStorage.getItem(KEY) || 'null'); if (c && Date.now() - c.t < 600000) ev = c.ev; } catch {}
    if (!ev) {
      const r = await fetch(`https://api.github.com/users/${user}/events/public?per_page=30`);
      if (!r.ok) throw new Error(r.status);
      ev = await r.json();
      try { localStorage.setItem(KEY, JSON.stringify({ t: Date.now(), ev })); } catch {}
    }
    const p = ev.find((e) => e.type === 'PushEvent' || e.type === 'CreateEvent');
    setLive('gh', p ? `last push: <b>${esc(p.repo.name.split('/')[1])}</b> · ${agoTxt(p.created_at)}` : 'busy in private repos');
    if (p) log(`github · push → ${p.repo.name.split('/')[1]} · ${agoTxt(p.created_at)}`);
  } catch {
    setLive('gh', `github.com/${CONFIG.github}`);
  }
}

// ================================================================== START
(async () => {
  try { await Promise.race([document.fonts.load(`700 120px ${FONT}`), sleepMs(1200)]); } catch {}
  build();
  sizeAux();
  requestAnimationFrame(loop);
  // fonts and the stylesheet can finish after the first sample: re-check then
  document.fonts?.ready?.then(() => scheduleRetarget(50));
  document.fonts?.addEventListener?.('loadingdone', () => scheduleRetarget(80));
  addEventListener('load', () => scheduleRetarget(80));
  new ResizeObserver(() => scheduleRetarget(120)).observe($('#below'));
  setInterval(monitor, 125);
  runBoot();
  loadFeed();
  loadGithub();
})();
