// Vice Cover Studio — the cover drawing engine.
// Everything here is drawn on canvas from scratch: no external images, no
// fonts shipped in, no Rockstar art. The sky, sun, skyline and palm
// silhouettes are shapes; the photos are the user's own. Every random
// number comes from a seeded generator, so the same state always draws
// the same pixels.

/** The export sizes the app offers: label, width, height. */
export const SIZES = {
  square: { label: 'Square 1080 x 1080', w: 1080, h: 1080 },
  portrait: { label: 'Portrait 1080 x 1350', w: 1080, h: 1350 },
  wide: { label: 'Wide 1920 x 1080', w: 1920, h: 1080 },
};

/** The colour grades: name and the tints laid over each photo panel. */
export const GRADES = {
  sunset: {
    label: 'Vice Sunset',
    sky: ['#2b0a4a', '#7a1e6e', '#ff2e88', '#ff7a18', '#ffd319'],
    top: 'rgba(255,46,136,0.20)',
    bottom: 'rgba(255,122,24,0.24)',
    blend: 'overlay',
    caption: '#ffffff',
    glow: 'rgba(255,46,136,0.85)',
  },
  neon: {
    label: 'Neon Nights',
    sky: ['#0b0630', '#2a0a6e', '#581c87', '#0ea5e9', '#22d3ee'],
    top: 'rgba(88,28,255,0.22)',
    bottom: 'rgba(0,229,255,0.16)',
    blend: 'overlay',
    caption: '#e0faff',
    glow: 'rgba(34,211,238,0.85)',
  },
  dusk: {
    label: 'Palm Dusk',
    sky: ['#12082b', '#3b1d5e', '#b8325e', '#e8734a', '#f7b733'],
    top: 'rgba(0,64,80,0.24)',
    bottom: 'rgba(255,211,25,0.14)',
    blend: 'soft-light',
    caption: '#fff7e0',
    glow: 'rgba(247,183,51,0.85)',
  },
};

/** The four panels of the poster, as fractions of the canvas. */
export const PANELS = [
  { id: 'hero', name: 'Hero', x: 0.04, y: 0.04, w: 0.56, h: 0.56 },
  { id: 'top', name: 'Top right', x: 0.625, y: 0.04, w: 0.335, h: 0.275 },
  { id: 'mid', name: 'Mid right', x: 0.625, y: 0.34, w: 0.335, h: 0.26 },
  { id: 'strip', name: 'Bottom strip', x: 0.04, y: 0.625, w: 0.92, h: 0.155 },
];

/** A fresh editor state: no photos yet, every panel on photo 1. */
export function defaultState() {
  return {
    size: 'square',
    caption: 'SUNSET HEIST',
    sub: 'A VICE CITY STORY',
    grade: 'sunset',
    gradeStrength: 0.55,
    photos: [null, null, null],
    panels: PANELS.map((p) => ({ id: p.id, photo: 0, zoom: 1.15, ox: 0, oy: 0 })),
  };
}

/** A tiny seeded generator (mulberry32): the same seed, the same skyline. */
function rng(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The panel rectangle in pixels for a canvas of w by h. */
export function panelRect(panel, w, h) {
  return { x: panel.x * w, y: panel.y * h, w: panel.w * w, h: panel.h * h };
}

/** Which panel (if any) holds the point px, py on a w by h canvas. */
export function panelAt(px, py, w, h) {
  for (let i = PANELS.length - 1; i >= 0; i--) {
    const r = panelRect(PANELS[i], w, h);
    if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) return PANELS[i].id;
  }
  return null;
}

/** The sky's vertical gradient for a grade. */
function skyGradient(ctx, grade, h) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  const stops = grade.sky;
  for (let i = 0; i < stops.length; i++) g.addColorStop(i / (stops.length - 1), stops[i]);
  return g;
}

/** A palm silhouette at (x, y), scaled by s, in dark purple. */
function drawPalm(ctx, x, y, s, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(2, 0.045 * s);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + 0.08 * s, y - 0.55 * s, x + 0.22 * s, y - 0.95 * s);
  ctx.stroke();
  const topX = x + 0.22 * s;
  const topY = y - 0.95 * s;
  ctx.lineWidth = Math.max(1.5, 0.03 * s);
  for (let i = 0; i < 6; i++) {
    const a = (-Math.PI * (0.15 + i * 0.14));
    const len = (0.42 + (i % 2) * 0.1) * s;
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.quadraticCurveTo(
      topX + Math.cos(a) * len * 0.6,
      topY + Math.sin(a) * len * 0.4 - 0.12 * s,
      topX + Math.cos(a) * len,
      topY + Math.sin(a) * len + 0.22 * s,
    );
    ctx.stroke();
  }
  ctx.restore();
}

/** A dark skyline along the bottom edge, from a fixed seed. */
function drawSkyline(ctx, w, h, color) {
  const rand = rng(20261120);
  ctx.fillStyle = color;
  let x = 0;
  while (x < w) {
    const bw = (0.04 + rand() * 0.05) * w;
    const bh = (0.02 + rand() * 0.055) * h;
    ctx.fillRect(x, h - bh, bw, bh);
    if (rand() > 0.6) ctx.fillRect(x + bw * 0.4, h - bh - 0.02 * h, 2, 0.02 * h);
    x += bw + rand() * 0.015 * w;
  }
}

/** The retro sun: horizontal bands of a yellow-to-pink gradient with gaps. */
function drawSun(ctx, cx, cy, r) {
  const bands = 9;
  for (let i = 0; i < bands; i++) {
    const t = i / (bands - 1);
    const y0 = cy - r + (2 * r * i) / bands;
    const y1 = cy - r + (2 * r * (i + 0.78)) / bands;
    const half = Math.sqrt(Math.max(0, r * r - Math.pow((y0 + y1) / 2 - cy, 2)));
    const red = Math.round(255 - 0 * t);
    const green = Math.round(211 - 165 * t);
    const blue = Math.round(25 + 111 * t);
    ctx.fillStyle = `rgb(${red},${green},${blue})`;
    ctx.fillRect(cx - half, y0, half * 2, Math.max(1, y1 - y0));
  }
  const glow = ctx.createRadialGradient(cx, cy, r * 0.4, cx, cy, r * 1.9);
  glow.addColorStop(0, 'rgba(255,120,60,0.28)');
  glow.addColorStop(1, 'rgba(255,120,60,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(cx - r * 2, cy - r * 2, r * 4, r * 4);
}

/** Draw one photo into a panel, cover-fit, with its zoom and offsets. */
function drawPhotoInPanel(ctx, img, rect, panelState) {
  const zoom = panelState.zoom;
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const scale = Math.max(rect.w / iw, rect.h / ih) * zoom;
  const dw = iw * scale;
  const dh = ih * scale;
  const overflowX = Math.max(0, (dw - rect.w) / 2);
  const overflowY = Math.max(0, (dh - rect.h) / 2);
  const dx = rect.x + (rect.w - dw) / 2 - panelState.ox * overflowX;
  const dy = rect.y + (rect.h - dh) / 2 - panelState.oy * overflowY;
  ctx.drawImage(img, dx, dy, dw, dh);
}

/** The placeholder a panel shows before a photo is loaded. */
function drawPlaceholder(ctx, rect, name) {
  const g = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h);
  g.addColorStop(0, '#3b1d5e');
  g.addColorStop(1, '#ff2e88');
  ctx.fillStyle = g;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  drawPalm(ctx, rect.x + rect.w * 0.5, rect.y + rect.h * 0.92, Math.min(rect.w, rect.h) * 0.5, 'rgba(20,8,38,0.85)');
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.font = `900 ${Math.max(14, rect.h * 0.09)}px "Arial Black", Impact, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('ADD YOUR PHOTO', rect.x + rect.w / 2, rect.y + rect.h * 0.42);
  ctx.font = `700 ${Math.max(11, rect.h * 0.05)}px Arial, sans-serif`;
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillText(name.toUpperCase() + ' PANEL', rect.x + rect.w / 2, rect.y + rect.h * 0.56);
}

/** The grade tint and vignette over one panel. */
function gradePanel(ctx, rect, grade, strength) {
  const g = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
  g.addColorStop(0, grade.top);
  g.addColorStop(1, grade.bottom);
  ctx.globalCompositeOperation = grade.blend;
  ctx.globalAlpha = strength;
  ctx.fillStyle = g;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  const v = ctx.createRadialGradient(
    rect.x + rect.w / 2, rect.y + rect.h / 2, Math.min(rect.w, rect.h) * 0.35,
    rect.x + rect.w / 2, rect.y + rect.h / 2, Math.max(rect.w, rect.h) * 0.75,
  );
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, `rgba(10,4,24,${0.30 * strength + 0.08})`);
  ctx.fillStyle = v;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
}

/** The bold caption lettering across the bottom band. */
function drawCaption(ctx, w, h, state, grade) {
  const bandY = 0.80 * h;
  const bandH = 0.17 * h;
  const caption = (state.caption || 'VICE CITY').toUpperCase();
  const sub = (state.sub || '').toUpperCase();
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (sub) {
    ctx.font = `700 ${Math.max(12, 0.02 * h)}px Arial, sans-serif`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${Math.max(2, 0.008 * w)}px`;
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 8;
    ctx.fillText(sub, w / 2, bandY + 0.035 * h);
    ctx.shadowBlur = 0;
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  }
  let size = 0.088 * h;
  const fit = () => {
    ctx.font = `italic 900 ${size}px "Arial Black", Impact, "Helvetica Neue", sans-serif`;
    return ctx.measureText(caption).width;
  };
  while (size > 0.03 * h && fit() > 0.94 * w) size *= 0.94;
  ctx.font = `italic 900 ${size}px "Arial Black", Impact, "Helvetica Neue", sans-serif`;
  const cy = bandY + bandH * 0.58;
  ctx.save();
  ctx.translate(w / 2, cy);
  ctx.scale(0.86, 1);
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(3, size * 0.14);
  ctx.strokeStyle = '#14081f';
  ctx.shadowColor = grade.glow;
  ctx.shadowBlur = Math.max(10, size * 0.35);
  ctx.strokeText(caption, 0, 0);
  ctx.shadowBlur = 0;
  ctx.fillStyle = grade.caption;
  ctx.fillText(caption, 0, 0);
  ctx.restore();
  ctx.restore();
}

/** Film grain: seeded specks over the whole cover. */
function drawGrain(ctx, w, h) {
  const rand = rng(777);
  const n = Math.round((w * h) / 900);
  for (let i = 0; i < n; i++) {
    const x = rand() * w;
    const y = rand() * h;
    ctx.fillStyle = rand() > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';
    ctx.fillRect(x, y, 1 + rand() * 1.5, 1 + rand() * 1.5);
  }
}

/**
 * Draw the whole cover for `state` on `ctx` at w by h pixels.
 * `state.photos` holds HTMLImageElements (or null); `state.panels` holds
 * one {photo, zoom, ox, oy} per panel id, in PANELS order.
 */
export function drawCover(ctx, w, h, state) {
  const grade = GRADES[state.grade] || GRADES.sunset;
  const strength = state.gradeStrength ?? 0.55;
  ctx.save();
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = skyGradient(ctx, grade, h);
  ctx.fillRect(0, 0, w, h);
  const bandY = 0.80 * h;
  const bandH = 0.17 * h;
  drawSun(ctx, 0.80 * w, bandY + bandH * 0.30, bandH * 0.40);
  drawPalm(ctx, 0.03 * w, bandY + bandH * 0.98, bandH * 0.9, 'rgba(22,10,38,0.9)');
  drawPalm(ctx, 0.97 * w, bandY + bandH * 0.98, bandH * 0.7, 'rgba(22,10,38,0.9)');
  drawSkyline(ctx, w, h, '#1a0b2e');
  for (let i = 0; i < PANELS.length; i++) {
    const panel = PANELS[i];
    const rect = panelRect(panel, w, h);
    const ps = state.panels[i];
    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
    ctx.clip();
    const img = state.photos[ps.photo];
    if (img) drawPhotoInPanel(ctx, img, rect, ps);
    else drawPlaceholder(ctx, rect, panel.name);
    gradePanel(ctx, rect, grade, strength);
    ctx.restore();
    ctx.lineWidth = Math.max(3, w * 0.004);
    ctx.strokeStyle = '#ffffff';
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
  }
  drawCaption(ctx, w, h, state, grade);
  drawGrain(ctx, w, h);
  ctx.lineWidth = Math.max(4, w * 0.006);
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.strokeRect(0.008 * w, 0.008 * h, 0.984 * w, 0.984 * h);
  ctx.restore();
}
