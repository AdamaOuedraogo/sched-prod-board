import { fetchIncidents, ack } from './api.js';
import { mergeIncidents, sortedIds, formatLocal, severityClass } from './board.js';

const REFRESH_MS = 2000; // R4

const list = document.querySelector('[data-testid="incident-list"]');
const loader = document.querySelector('[data-testid="loader"]');
const empty = document.querySelector('[data-testid="empty"]');

const byId = new Map(); // every incident seen tonight, by id
const rows = new Map(); // id -> its <li>, created once and never re-rendered
let loaded = false;
let inFlight = false;

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function fillRow(li, i) {
  li.className = `row ${severityClass(i.severity)}`.trim();
  li.querySelector('.id').textContent = i.id;
  li.querySelector('.sev').textContent = i.severity ?? '';
  li.querySelector('.what').textContent = `${i.service} · ${i.region} · ${i.summary}`;
  const time = li.querySelector('time');
  time.dateTime = i.openedAt; // full UTC value, as the API sent it (R5)
  time.textContent = formatLocal(i.openedAt); // viewer's locale and zone (R5)
}

function makeRow(i) {
  const li = el('li');
  li.dataset.testid = 'incident-row';
  li.dataset.id = i.id;
  li.append(el('span', 'id'), el('span', 'sev'), el('span', 'what'), el('time'));
  const cell = el('span', 'ackcell');
  const btn = el('button', 'ack', 'Ack');
  btn.type = 'button';
  btn.dataset.testid = 'ack';
  btn.addEventListener('click', () => onAck(li, btn));
  cell.append(btn);
  li.append(cell);
  fillRow(li, i);
  return li;
}

// R2: the row is marked acked only after the API answered; on failure it says so and the button comes back.
async function onAck(li, btn) {
  const id = li.dataset.id; // the id of this row, read at click time
  const cell = li.querySelector('.ackcell');
  cell.querySelector('.ack-error')?.remove();
  btn.disabled = true;
  btn.textContent = 'acking…';
  li.classList.add('pending');
  try {
    const reply = await ack(id);
    if (String(reply.id) !== id) throw new Error(`ack answered for ${reply.id}, not ${id}`);
    const mark = el('span', 'acked', `acked ${formatLocal(reply.ackedAt).split(', ').pop()}`);
    mark.dataset.testid = 'acked';
    btn.remove();
    cell.append(mark);
  } catch (err) {
    console.error(err);
    btn.disabled = false;
    btn.textContent = 'Ack';
    const msg = el('span', 'ack-error', `ack failed: ${String(err.message).split(' ').slice(0, 2).join(' ')} · retry`);
    cell.append(msg);
  } finally {
    li.classList.remove('pending');
  }
}

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
