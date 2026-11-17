// Pure board logic: merging API pages and formatting times. No DOM here, so it is unit-tested.

/**
 * Merges one API page into the board's incidents (a Map by id). A page may hold only what changed since
 * the last cursor, so a page never replaces the board: known ids are updated, new ids are added.
 * Returns the ids that were new.
 */
export function mergeIncidents(byId, incidents) {
  const added = [];
  for (const i of incidents ?? []) {
    if (!i || i.id == null) continue;
    const id = String(i.id);
    if (!byId.has(id)) added.push(id);
    byId.set(id, { ...byId.get(id), ...i, id });
  }
  return added;
}

/** Ids newest first (openedAt descending; ties keep the higher id first). */
export function sortedIds(byId) {
  return [...byId.values()]
    .sort((a, b) => Date.parse(b.openedAt) - Date.parse(a.openedAt) || String(b.id).localeCompare(String(a.id)))
    .map((i) => i.id);
}

/**
 * An ISO time in the viewer's zone and locale order: de-DE "12.11.2026, 04:03", en-NZ "12/11/2026, 4:03 pm".
 * The locale decides day/month order, so EU locales get day before month.
 */
export function formatLocal(iso, locale, timeZone) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    ...(timeZone ? { timeZone } : {}),
  }).format(d);
}

/** Only sev1..sev9 become a CSS class; anything else from the API is dropped. */
export function severityClass(severity) {
  return /^sev[0-9]$/.test(String(severity)) ? String(severity) : '';
}
