# sched-prod incident board — plan

The on-call board for sched-prod. One page, one list: tonight's incidents, newest first, so on-call sees
what just broke and takes it.

## Flows

| flow | who | what happens |
|------|-----|--------------|
| `open-board` | on-call | opens the board; sees tonight's incidents |
| `ack-incident` | on-call | picks an incident on the board, opens its panel and acks it there — "I've got this one" |
| `watch-board` | on-call | keeps the board open; it stays current without a reload |

## Requirements

- **R1** New incidents appear live at the top of the list, newest first.
- **R2** A row has no Ack button. Clicking a row opens its **incident panel**, which names the incident id. The
  panel has the **Ack** button: it sends the ack (`api.ack(id)`) for the incident the panel names and, after the
  reply, marks that incident's row acked. Product, 2026-11-17: "New incidents stay live at the top. Ack leaves the
  row: a row opens its incident panel, and Ack lives there."
- **R3** Show a loader until incidents load.
- **R4** The board refreshes itself every 2 seconds while open.
- **R5** Times show in the viewer's local time; day before month for EU locales (dd/mm).
- **R6** The page names its build: `<meta name="build" content="<git sha>">` in the head and the same sha in the footer.
- **R7** The incident panel.
  - From the course's replay (constraints): the panel shows within 400 ms of the row click; it names the incident
    id in its text; it does not cover or move the list where the rows are clicked; clicking another row switches
    it to that incident; the acked mark stays in the row (`acked`); no `incident-row` is removed when the list
    refreshes.
  - Implementation choices: one panel at a time; a row also opens with Enter or Space when focused; the selected
    row is highlighted; a close button and Escape close it; it sits fixed to the right of
    the list (bottom right on screens narrower than 1260 px); it stays bound to the incident it opened with while
    the list refreshes and rows move; it shows the incident's severity, service, region, summary and local time;
    after the reply it shows "acked HH:MM" in place of Ack.

## Hooks (pinned — tests and the replay rely on them)

| `data-testid` | element |
|---------------|---------|
| `board` | the board's main area |
| `loader` | the loader (gone once incidents load) |
| `empty` | what shows when there are no incidents |
| `incident-list` | the list |
| `incident-row` | one incident row, with `data-id="<incident id>"` |
| `incident-panel` | the incident panel, naming the incident id |
| `panel-ack` | the Ack button in the panel |
| `acked` | the acked mark in a row |
| `build-sha` | the sha in the footer |

## Done

Every issue in `issues/` delivered, deployed to a public https address, and shown working.
