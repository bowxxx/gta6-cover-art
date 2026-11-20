// Vice Cover Studio — the editor: photos, panels, caption, sizes, export.
// The page runs fully offline: photos are read on the user's machine with
// FileReader and never uploaded; the sample photo is a local file.

import { SIZES, GRADES, PANELS, defaultState, drawCover, panelRect, panelAt } from './cover.js';

const state = defaultState();
const SAMPLE_URL = './samples/miami-sunset.jpg';

const $ = (id) => document.getElementById(id);
const preview = $('preview');
const pctx = preview.getContext('2d');
const statusEl = $('status');
let selectedPanel = 'hero';
let drag = null;

function setStatus(text) {
  statusEl.textContent = text;
}

function previewSize() {
  const s = SIZES[state.size];
  const scale = Math.min(1, 640 / Math.max(s.w, s.h));
  return { w: Math.round(s.w * scale), h: Math.round(s.h * scale) };
}

/** Redraw the preview canvas from the current state. */
function render() {
  const { w, h } = previewSize();
  if (preview.width !== w || preview.height !== h) {
    preview.width = w;
    preview.height = h;
  }
  drawCover(pctx, w, h, state);
  preview.style.aspectRatio = `${w} / ${h}`;
}

/** Load an image from a URL into photo slot i. */
function loadPhotoFromUrl(url, i) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      state.photos[i] = img;
      render();
      resolve(img);
    };
    img.onerror = () => reject(new Error('Could not load ' + url));
    img.src = url;
  });
}

/** Load an image from a File object into photo slot i. */
function loadPhotoFromFile(file, i) {
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      state.photos[i] = img;
      document.querySelector(`#thumb-${i}`).src = reader.result;
      setStatus(`Photo ${i + 1} loaded — drag it inside a panel to position it.`);
      render();
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

/** Build the three photo slots. */
function buildPhotoSlots() {
  const wrap = $('photo-slots');
  for (let i = 0; i < 3; i++) {
    const slot = document.createElement('div');
    slot.className = 'slot';
    const thumb = document.createElement('img');
    thumb.id = `thumb-${i}`;
    thumb.alt = '';
    const label = document.createElement('span');
    label.textContent = `Photo ${i + 1}`;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.setAttribute('aria-label', `Choose photo ${i + 1}`);
    input.addEventListener('change', () => {
      if (input.files && input.files[0]) loadPhotoFromFile(input.files[0], i);
    });
    slot.append(thumb, label, input);
    wrap.append(slot);
  }
  $('sample-btn').addEventListener('click', async () => {
    try {
      await loadPhotoFromUrl(SAMPLE_URL, 0);
      $('thumb-0').src = SAMPLE_URL;
      setStatus('Sample photo loaded into Photo 1.');
    } catch (err) {
      setStatus('Sample photo failed to load.');
    }
  });
  $('fill-all-btn').addEventListener('click', () => {
    for (const p of state.panels) p.photo = 0;
    syncPanelCards();
    render();
    setStatus('Every panel now uses Photo 1.');
  });
}

/** Build one control card per panel. */
function buildPanelCards() {
  const wrap = $('panel-cards');
  PANELS.forEach((panel, idx) => {
    const card = document.createElement('div');
    card.className = 'panel-card';
    card.dataset.panel = panel.id;
    const title = document.createElement('button');
    title.type = 'button';
    title.className = 'panel-title';
    title.textContent = panel.name;
    title.addEventListener('click', () => selectPanel(panel.id));
    const photoRow = document.createElement('label');
    photoRow.textContent = 'Photo ';
    const select = document.createElement('select');
    select.setAttribute('aria-label', `Photo for ${panel.name} panel`);
    for (let i = 0; i < 3; i++) {
      const opt = document.createElement('option');
      opt.value = String(i);
      opt.textContent = `Photo ${i + 1}`;
      select.append(opt);
    }
    select.addEventListener('change', () => {
      state.panels[idx].photo = Number(select.value);
      render();
    });
    photoRow.append(select);
    const slider = (labelText, key, min, max, step) => {
      const row = document.createElement('label');
      row.className = 'slider-row';
      row.textContent = labelText + ' ';
      const input = document.createElement('input');
      input.type = 'range';
      input.min = String(min);
      input.max = String(max);
      input.step = String(step);
      input.value = String(state.panels[idx][key]);
      input.setAttribute('aria-label', `${labelText} for ${panel.name} panel`);
      input.addEventListener('input', () => {
        state.panels[idx][key] = Number(input.value);
        render();
      });
      row.append(input);
      return row;
    };
    card.append(title, photoRow, slider('Zoom', 'zoom', 1, 2.5, 0.05), slider('Left-right', 'ox', -0.5, 0.5, 0.01), slider('Up-down', 'oy', -0.5, 0.5, 0.01));
    wrap.append(card);
  });
}

/** Mark a panel selected and sync its card's controls. */
function selectPanel(id) {
  selectedPanel = id;
  for (const card of document.querySelectorAll('.panel-card')) {
    card.classList.toggle('selected', card.dataset.panel === id);
  }
}

/** Push the state into every panel card's controls. */
function syncPanelCards() {
  PANELS.forEach((panel, idx) => {
    const card = document.querySelector(`.panel-card[data-panel="${panel.id}"]`);
    if (!card) return;
    const select = card.querySelector('select');
    if (select) select.value = String(state.panels[idx].photo);
    const sliders = card.querySelectorAll('input[type="range"]');
    if (sliders[0]) sliders[0].value = String(state.panels[idx].zoom);
    if (sliders[1]) sliders[1].value = String(state.panels[idx].ox);
    if (sliders[2]) sliders[2].value = String(state.panels[idx].oy);
  });
}

/** Drag a panel's photo inside the preview to reposition it. */
function bindDrag() {
  const toCanvas = (e) => {
    const r = preview.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (preview.width / r.width), y: (e.clientY - r.top) * (preview.height / r.height) };
  };
  preview.addEventListener('pointerdown', (e) => {
    const p = toCanvas(e);
    const id = panelAt(p.x, p.y, preview.width, preview.height);
    if (!id) return;
    selectPanel(id);
    const idx = PANELS.findIndex((panel) => panel.id === id);
    const rect = panelRect(PANELS[idx], preview.width, preview.height);
    drag = { idx, startX: p.x, startY: p.y, ox: state.panels[idx].ox, oy: state.panels[idx].oy, rect };
    preview.setPointerCapture(e.pointerId);
    preview.style.cursor = 'grabbing';
  });
  preview.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const p = toCanvas(e);
    const ps = state.panels[drag.idx];
    ps.ox = Math.max(-0.5, Math.min(0.5, drag.ox - ((p.x - drag.startX) / drag.rect.w) * 1.2));
    ps.oy = Math.max(-0.5, Math.min(0.5, drag.oy - ((p.y - drag.startY) / drag.rect.h) * 1.2));
    syncPanelCards();
    render();
  });
  const endDrag = () => {
    drag = null;
    preview.style.cursor = 'grab';
  };
  preview.addEventListener('pointerup', endDrag);
  preview.addEventListener('pointercancel', endDrag);
}

/** Export the cover at full size as a PNG download. */
async function exportPng() {
  const s = SIZES[state.size];
  const off = document.createElement('canvas');
  off.width = s.w;
  off.height = s.h;
  drawCover(off.getContext('2d'), s.w, s.h, state);
  setStatus(`Exporting ${s.w} x ${s.h} PNG…`);
  const blob = await new Promise((resolve) => off.toBlob(resolve, 'image/png'));
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `vice-cover-${s.w}x${s.h}.png`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  setStatus(`Exported ${s.w} x ${s.h} PNG — share it anywhere.`);
}

/** Size buttons and the grade controls. */
function buildOptions() {
  const wrap = $('size-buttons');
  for (const [key, s] of Object.entries(SIZES)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'size-btn';
    b.dataset.size = key;
    b.textContent = s.label;
    b.addEventListener('click', () => {
      state.size = key;
      for (const other of wrap.querySelectorAll('.size-btn')) {
        other.classList.toggle('active', other === b);
      }
      render();
    });
    if (key === state.size) b.classList.add('active');
    wrap.append(b);
  }
  const grade = $('grade');
  for (const [key, g] of Object.entries(GRADES)) {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = g.label;
    grade.append(opt);
  }
  grade.value = state.grade;
  grade.addEventListener('change', () => {
    state.grade = grade.value;
    render();
  });
  const strength = $('grade-strength');
  strength.value = String(state.gradeStrength);
  strength.addEventListener('input', () => {
    state.gradeStrength = Number(strength.value);
    render();
  });
  $('caption').addEventListener('input', (e) => {
    state.caption = e.target.value;
    render();
  });
  $('sub').addEventListener('input', (e) => {
    state.sub = e.target.value;
    render();
  });
  $('export').addEventListener('click', exportPng);
}

/** Apply ?photo=sample&caption=&sub=&grade=&size= so shots are repeatable. */
async function applyParams() {
  const q = new URLSearchParams(window.location.search);
  if (q.get('caption') !== null) {
    state.caption = q.get('caption');
    $('caption').value = state.caption;
  }
  if (q.get('sub') !== null) {
    state.sub = q.get('sub');
    $('sub').value = state.sub;
  }
  if (q.get('grade') && GRADES[q.get('grade')]) {
    state.grade = q.get('grade');
    $('grade').value = state.grade;
  }
  if (q.get('size') && SIZES[q.get('size')]) {
    state.size = q.get('size');
    for (const b of document.querySelectorAll('.size-btn')) {
      b.classList.toggle('active', b.dataset.size === state.size);
    }
  }
  if (q.get('photo') === 'sample') {
    try {
      await loadPhotoFromUrl(SAMPLE_URL, 0);
      $('thumb-0').src = SAMPLE_URL;
    } catch (err) {
      setStatus('Sample photo failed to load.');
    }
  }
  render();
}

buildPhotoSlots();
buildPanelCards();
buildOptions();
bindDrag();
selectPanel('hero');
preview.style.cursor = 'grab';
applyParams();
setStatus('Add a photo, write a caption, export your cover.');

window.__vice = { state, render, exportPng };
