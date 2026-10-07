# Bugfix report: branch `fix/temporal-bugs`

**Status: in progress (paused 2026-10-07).** This file is the resume note. The final report (one line per item, before/after screenshots, follow-ups) replaces it once all items are done.

Item numbers refer to the Phase 1 list in the request; audit references are to [grammar-audit.md](grammar-audit.md).

## State at pause

- Working tree is clean. Every finished item is committed; nothing is half done. `paper/` is deliberately untracked. Nothing has been pushed.
- Last check, run on commit `daeff20`:
  - `npx vitest run`: **185 passed, 0 failed**. The baseline before Phase 1 was 146 passed and 2 failed: the upstream `polar.test.ts` tests, broken by the global clockwise change and fixed by item 15.
  - `npx tsc --noEmit`: clean.
- "Before" screenshots are committed in [`bugfix-report/before/`](bugfix-report/before/) (commit `eaeda37`). They were taken before any rendering or fetcher change. The "after" set has not been taken yet.

## Items

| # | Item | Status | Commit |
|---|---|---|---|
| — | Test setup: Node ≥ 19 has a read-only global `crypto`, so every test file failed (prerequisite, not on the list) | done | `0c5146a` |
| 1 | CSV: detect date order (ISO / US / day-first); warn instead of 1970 | done | `2bc1d66` |
| 2 | CSV: dates before 1900 and before 1970, tile grid now covers years 1–9999 | done | `f5f23c1` |
| 3 | CSV: `interval` option spread column names into characters | done | `cf9efe0` |
| 4 | CSV: date-times read as UTC (also time-of-day columns, component columns, calendar weeks) | done | `be8891d` |
| 5 | JSON: single date column in `dateFields` | done | `33c87cc` |
| 6 | JSON: `row[timestampField]`, rows stored in the url branch | done | `f9a6cb7` |
| 7 | Both: `timestampUnit: "s" \| "ms"` (default `"s"`) | done | `ee21cc6` |
| 8 | Both: random sampling only when `sampleLength` is set | done | `6bae959` |
| 9 | JSON: `tile()` filters rows to the tile's x-range | done | `53cd1a0` |
| 10 | Stacked area / text on a temporal x | done | `75576c8`, plus `ee5060f` (see note A) |
| 11 | Circular brush mirrored | done | `bc07aec` (drawing) + `2d032e2` (drag → domain) |
| 12 | Time axis: stray center tick; theme font and colors | done | `9c987e8` |
| 13 | Brush/detail range offset | **investigated, no bug, no code change** (note B) | — |
| 14 | Temporal on y | done: **rejected** in schema + `validateTrack` message (note C) | `5a5eb3d` |
| 15 | Clockwise circular layout opt-in (`clockwise`) | done (note D) | `bc07aec` |
| 16 | JS API `location` event restored for genomic tracks | done (verified in browser) | `b7c86af` |
| 17 | `preverseZoomStatus` | done: **restored for genomic, skipped for temporal views** (note E) | `daeff20` |
| 18 | `HIGLASS_AXIS_SIZE` 30 → 45 globally; scope to the time axis | **next** | — |
| 19 | Remove unused `higlass-unix-time-track` dependency | to do | — |
| 20 | `editor/html-template.ts`: exported HTML loads upstream gosling.js and two missing scripts | to do | — |
| 21 | Schema docs: genomic wording in temporal parts | to do (partly done: `sampleLength`, `timestampUnit`, `clockwise`, `Y.type` docs) | — |
| 22 | Fix the example specs so they all render | to do | — |
| 23 | `uuid` alias breaks `yarn start` | done (`yarn start` works again) | `ce02d6a` |

## Notes for resuming

**A. Stacked area crash (`ee5060f`).**
- Enabling stacked areas on temporal tracks (item 10) exposed a latent upstream bug: a color category with no rows made `reduce` throw.
- The README / S3 spec triggers it, because each area track filters to one series but lists all five in the color domain. The exception aborted the whole render loop, so lines and brush linking stopped working too.
- Fixed by skipping empty categories, with a test.

**B. Item 13: no offset bug.**
- I probed HiGlass's internal view scales in the browser:
  - Dragging the brush **body** pans it. The brush spans the view's full domain (2000–2011) and is clipped at the view edge, so a panned brush *looks* like a 2000–2006 selection while the detail views correctly show 1995–2006.
  - Dragging the brush's right **handle** (≈2 px wide, at x≈1028 in the README layout) resizes it, and the detail views show exactly the brushed range (`[2000, 2006.05]`).
- The hard-coded zoom-lock seeds in `create-higlass-models.ts:79-80` are harmless: every member gets the same seed, so HiGlass's zoom ratio is 1 and its location offset 0.
- The "before" screenshot `readme-running-example-brushed.png` shows a *pan*. For the "after" set, use a handle drag (mouse down at x=1028, y=540).

**C. Item 14: rejected rather than implemented.**
- Temporal y is not small to implement: there's no time-scale path for y in `generateScales`, and the time axis track is horizontal only.
- `Y.type` is now `quantitative | nominal | genomic`, and `validateTrack` reports "`temporal` is only supported on x channels (x, xe, x1, x1e), not on `y`".

**D. Item 15: one mechanism instead of scattered flips.**
- The old change flipped only lines, axis labels and y ticks. Bars, areas, points, rects, rules, grid, links, title, outline and brush stayed anticlockwise, which is the real cause of the mirrored brush.
- `polar.ts`, `axis.ts`, `line.ts` and `axis-track.ts` are restored to upstream.
- The compiler swaps `startAngle`/`endAngle` for clockwise tracks (`isClockwiseTrack` in `bounding-box.ts`). Arc sweep flags, label widths and curved-text ropes follow the direction.
- `clockwise` (view or track) defaults to `true` for a temporal x, `false` otherwise.
- Verified that the genomic `VISUAL_ENCODING_CIRCULAR` example matches its upstream thumbnail.

**E. Item 17: there was a temporal reason.**
- Measured in a reactive-mode harness (`GoslingComponent` with `experimental.reactive`, which the editor uses): HiGlass view uids change on every compile, so the function finds no linked view in the previous config and sets `initialXDomain = undefined`.
  - **Temporal views** then show an empty domain (`[1970, 1970]`) and no data. These are skipped now.
  - **Genomic views** fall back to the whole genome, losing the spec domain. That's upstream behavior, restored unchanged, but worth reporting upstream.

**Taxi arcs (your question).** The arcs show only below about 67 minutes because of a **visibility rule in the spec**, not code. S6 sets `visibility: [{ operation: "less-than", measure: "zoomLevel", threshold: 4000, target: "track" }]` on the `withinLink` track. The threshold is the visible span in seconds: 4000 s ≈ 67 min.

**Figures that need regenerating** once item 22 is done:
- **S6 / Fig 1C (taxi):** UTC parsing (item 4) shifts the displayed clock times by the renderer's UTC offset; the old figure was made in local time.
- **S8 / Fig 5 (FitBit):** daily bars move to the correct day; heart-rate times shift (item 4).
- **S3 / Fig 4 (running example) and README GIF:** area layers now draw (item 10), circular direction and brush are consistent (items 11 and 15), the time axis uses theme styles with no stray tick (item 12), and the rows that were randomly dropped are back (item 8).
- **S7 / Fig 1A (influenza):** after the spec fix in item 22. The ring direction also follows item 15.

## What's next (in order)

1. **Item 18.** `HIGLASS_AXIS_SIZE` is used for the genomic axis in `higlass-model.ts` (`setAxisTrack`), the time axis (`setUnixTimeTrack`), `bounding-box.ts`, `gosling-track.ts` and the circular axis radii in `gosling-to-higlass.ts`. Plan:
   - restore 30 for everything upstream;
   - add a separate constant (45) used only by `setUnixTimeTrack` and the matching radius/size calculations for temporal axes;
   - test that a genomic axis track gets height 30 and a time axis 45.
2. **Items 19, 20, 21:** cleanup.
3. **Item 22:** fix the specs. Agreed decisions:
   - supp specs are fixed in place;
   - S7: add a 2010 domain to the circular view and data to the two comparison views; do **not** edit the superimposed data or fix week 1, only document it;
   - S5: fix against the daily 2022 data;
   - remove `genomicFields` from the README / S3 spec;
   - Seattle needs a domain, overview-detail needs a domain, overview data and distinct colors.
4. Take the **"after" screenshots** with the same script as the "before" set, add a handle-drag variant, and write the final report.

## How to resume (tooling)

- **Dev server:** `yarn start` now works (`npx vite --mode editor --port 3459 --strictPort`). The scratchpad Vite workaround is no longer needed.
- **Helper scripts** were in this session's scratchpad (temporary, may be gone). What they did:
  - `check.sh`: `npx vitest run` + `npx tsc --noEmit -p tsconfig.json`.
  - `fails-before.sh <test> <files…>`: temporarily restores the listed tracked files from `HEAD`, runs the test, restores the working copies. Used to show each new test fails before its fix.
  - `render-all.mjs <outdir> [port]`: Playwright renders.
    - Editor views: `?example=<ID>&full=true` for the 9 temporal examples.
    - `embed()` renders, by importing `/src/index.ts` in the page: the README spec (read from `README.md`), S3 and S5 (which the editor won't show while they're schema-invalid, see `Editor.tsx:542`), and S6 in a 1-hour window.
    - A brush drag on the README spec.
    - Viewport 1300×950. Large CSVs (S6, S8) need about 60 s.
- **Data:** all supplementary data URLs were reachable on 2026-10-07 (audit §7.1).
