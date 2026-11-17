import { fetchIncidents, ack } from './api.js';
import { mergeIncidents, sortedIds, formatLocal, severityClass } from './board.js';

const REFRESH_MS = 2000; // R4

const list = document.querySelector('[data-testid="incident-list"]');
const loader = document.querySelector('[data-testid="loader"]');
const empty = document.querySelector('[data-testid="empty"]');
const panel = document.querySelector('[data-testid="incident-panel"]');
const panelAck = panel.querySelector('[data-testid="panel-ack"]');

const byId = new Map(); // every incident seen tonight, by id
const rows = new Map(); // id -> its <li>, created once and never re-rendered
const acked = new Map(); // id -> ackedAt, from the API reply
let loaded = false;
let inFlight = false;
let panelId = null; // the incident the panel is bound to (R7); only openPanel/closePanel change it

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

const clock = (iso) => formatLocal(iso).split(', ').pop();

function fillRow(li, i) {
  li.className = `row ${severityClass(i.severity)}`.trim();
  li.classList.toggle('selected', i.id === panelId);
  li.querySelector('.id').textContent = i.id;
  li.querySelector('.sev').textContent = i.severity ?? '';
  li.querySelector('.what').textContent = `${i.service} · ${i.region} · ${i.summary}`;
  const time = li.querySelector('time');
  time.dateTime = i.openedAt; // full UTC value, as the API sent it (R5)
  time.textContent = formatLocal(i.openedAt); // viewer's locale and zone (R5)
}

// R2: a row has no Ack button; clicking it opens its incident panel.
function makeRow(i) {
  const li = el('li');
  li.dataset.testid = 'incident-row';
  li.dataset.id = i.id;
  li.tabIndex = 0;
  li.append(el('span', 'id'), el('span', 'sev'), el('span', 'what'), el('time'), el('span', 'ackcell'));
  li.addEventListener('click', () => openPanel(li.dataset.id));
  li.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openPanel(li.dataset.id);
    }
  });
  fillRow(li, i);
  return li;
}

function markRowAcked(id) {
  const cell = rows.get(id)?.querySelector('.ackcell');
  if (!cell || cell.querySelector('[data-testid="acked"]')) return;
  const mark = el('span', 'acked', `acked ${clock(acked.get(id))}`);
  mark.dataset.testid = 'acked';
  cell.append(mark);
}

// The panel shows the incident it is bound to; a refresh only updates its text, never which incident it is.
function fillPanel() {
  const i = byId.get(panelId);
  if (!i) return;
  panel.querySelector('.p-id').textContent = i.id;
  panel.querySelector('.p-sev').textContent = i.severity ?? '';
  panel.querySelector('.p-what').textContent = `${i.service} · ${i.region}`;
  panel.querySelector('.p-summary').textContent = i.summary;
  const time = panel.querySelector('time');
  time.dateTime = i.openedAt;
  time.textContent = formatLocal(i.openedAt);
  const done = acked.has(i.id);
  panelAck.hidden = done;
  panel.querySelector('.p-acked').hidden = !done;
  panel.querySelector('.p-acked').textContent = done ? `acked ${clock(acked.get(i.id))}` : '';
}

function openPanel(id) {
  if (panelId !== id) {
    rows.get(panelId)?.classList.remove('selected');
    panelId = id;
    panel.querySelector('.p-error').textContent = '';
    panelAck.disabled = false;
    panelAck.textContent = 'Ack';
  }
  rows.get(id)?.classList.add('selected');
  fillPanel();
  panel.hidden = false;
}

function closePanel() {
  rows.get(panelId)?.classList.remove('selected');
  panelId = null;
  panel.hidden = true;
}

// R2: Ack acks the incident the panel names; the row is marked only after the reply.
async function onPanelAck() {
  const id = panelId; // the panel's own incident, read at click time
  if (!id) return;
  const error = panel.querySelector('.p-error');
  error.textContent = '';
  panelAck.disabled = true;
  panelAck.textContent = 'acking…';
  try {
    const reply = await ack(id);
    if (String(reply.id) !== id) throw new Error(`ack answered for ${reply.id}, not ${id}`);
    acked.set(id, reply.ackedAt);
    markRowAcked(id);
  } catch (err) {
    console.error(err);
    if (panelId === id) error.textContent = `ack failed: ${String(err.message).split(' ').slice(0, 2).join(' ')} · retry`;
  } finally {
    if (panelId === id) {
      panelAck.disabled = false;
      panelAck.textContent = 'Ack';
      fillPanel();
    }
  }
}

panelAck.addEventListener('click', onPanelAck);
panel.querySelector('.p-close').addEventListener('click', closePanel);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && panelId) closePanel();
});

// R1: rows already on screen stay the same elements; new ones are put in their place, newest first.
function render() {
  const ids = sortedIds(byId);
  ids.forEach((id, idx) => {
    let li = rows.get(id);
    if (!li) {
      li = makeRow(byId.get(id));
      rows.set(id, li);
    } else {
      fillRow(li, byId.get(id));
    }
    const at = list.children[idx];
    if (at !== li) list.insertBefore(li, at ?? null);
  });
  empty.hidden = !(loaded && ids.length === 0);
  if (panelId) fillPanel();
}

async function refresh() {
  if (inFlight) return; // skip a tick rather than stack requests
  inFlight = true;
  try {
    const page = await fetchIncidents();
    mergeIncidents(byId, page.incidents);
    if (!loaded) {
      loaded = true;
      loader.remove(); // R3: gone once incidents load
    }
    render();
  } catch (err) {
    console.error(err);
    if (!loaded) loader.textContent = 'Could not load incidents. Retrying…';
  } finally {
    inFlight = false;
  }
}

refresh();
setInterval(refresh, REFRESH_MS); // R4: every 2 s while the page is open
