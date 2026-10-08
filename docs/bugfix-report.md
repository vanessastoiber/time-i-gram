# Bugfix report: branch `fix/temporal-bugs`

Phase 1 of the time-i-gram cleanup. Item numbers follow the Phase 1 request; audit references point to [grammar-audit.md](grammar-audit.md).

**Result.** All 23 items are handled:
- 21 are fixed;
- item 13 turned out not to be a bug (investigated, documented);
- item 14 is resolved by rejecting temporal y with a clear error rather than implementing it.

Two problems not on the list were fixed along the way (rows marked "—").

**Status of the branch:**
- **Tests:** 229 pass, 0 fail (`npx vitest run`). Before Phase 1, no test file could run on Node 22. Once the setup was fixed, 146 passed and 2 failed: the upstream `polar.test.ts` tests, broken by the global clockwise change.
- **Types:** `npx tsc --noEmit` is clean.
- **Publishing:** not pushed. A push to `denisseram/time-i-gram` failed with a GitHub-side HTTP 500; see the note at the end.

## Items

| # | Item | Status | Commits |
|---|---|---|---|
| — | Test setup: Node ≥ 19 has a read-only global `crypto`, so every test file failed before running | fixed | `96bcf7b` |
| 1 | CSV: ISO dates fell back to 1970; date order is now detected (ISO / US / day-first), `dayFirstDate` / `yearFirstDate` resolve ambiguous dates, unparseable dates warn and are not drawn | fixed | `cedb986` |
| 2 | CSV: years limited to 1900–2099, tile grid started at 0 (no data before 1970) | fixed: any year; tile grid covers years 1–9999 | `5e674cd` |
| 3 | CSV: `interval` spread column names into characters | fixed | `9ec5a61` |
| 4 | CSV: date-times parsed in the browser's time zone | fixed: read as UTC (also time-of-day columns, component columns, calendar weeks); explicit zones kept | `31c1146` |
| 5 | JSON: only literal `year`/`month`/`day` keys worked in `dateFields` | fixed: a single date or date-time column works; components built in UTC | `3a4b01b` |
| 6 | JSON: `row.timestampField` instead of `row[timestampField]` | fixed: both the url and inline branches store the rows | `21ef605` |
| 7 | Both: millisecond timestamps | added: `timestampUnit: "s" \| "ms"` (default `"s"`) | `de55d29` |
| 8 | Both: random sampling to 1,000 rows by default | fixed: sampling only when `sampleLength` is set (documented) | `1698be3` |
| 9 | JSON: every tile returned the whole dataset | fixed: rows filtered to the tile's x-range | `612217b` |
| 10 | Stacked area / text skipped temporal tracks | fixed | `690a5c2` |
| — | Stacked area threw on a color category without rows, aborting the whole render loop (latent upstream bug, reachable after item 10) | fixed | `ab0b073` |
| 11 | Circular brush shaded the mirrored sector | fixed: drawing (part of item 15) and drag → domain conversion | `4b6307a`, `b7d61d0` |
| 12 | Time axis: stray center tick; hard-coded Arial 12 / black | fixed: theme font, size, weight, label and tick colors | `d76238b` |
| 13 | Brush/detail range offset | **not a bug**, no code change (see note C) | — |
| 14 | Temporal on y produced no scale | **rejected**: schema restricts `y` to quantitative / nominal / genomic; `validateTrack` reports "`temporal` is only supported on x channels" (note D) | `c4aa7cd` |
| 15 | Clockwise circular layout was global (and partial) | fixed: `clockwise` option on views and tracks; default `true` for a temporal x, `false` otherwise (upstream) | `4b6307a` |
| 16 | JS API `location` event disabled | restored for genomic tracks (verified in the browser); skipped for temporal tracks | `e2cb090` |
| 17 | `preverseZoomStatus` disabled | restored for genomic views; skipped for temporal views, for a measured reason (note E) | `9734bfb` |
| 18 | `HIGLASS_AXIS_SIZE` 30 → 45 for every axis | fixed: 30 again; `TIME_AXIS_SIZE` (45) only for time axes, in the axis track and the reserved layout space | `60cd95b` |
| 19 | Unused `higlass-unix-time-track` dependency | removed (it was also missing from `yarn.lock`, so `yarn check` failed) | `1ce791b` |
| 20 | Exported HTML loaded upstream gosling.js and two missing local scripts | fixed: imports the time-i-gram embed bundle; **needs a new npm release** (note F) | `c03f0f9` |
| 21 | Genomic wording in temporal schema docs | fixed: Unix seconds, date parsing rules, all `csv-time` / `json-time` options and the `interval` transform documented | `e742bce` |
| 22 | Example specs | fixed: all 9 editor examples and both README specs render (table below) | `66f188f`, `fd1b56f`, `bfb7123`, `991a87f`, `05399c5` |
| 23 | `uuid` alias broke `yarn start` | fixed | `5e3d479` |

## Notes

**A. Taxi arcs below ~67 minutes come from the spec, not the code.**
- The supplementary S6 spec puts a visibility rule on the `withinLink` track: `visibility: [{ operation: "less-than", measure: "zoomLevel", threshold: 4000, target: "track" }]`.
- The threshold is the visible span in seconds (4000 s ≈ 67 min), so at the printed 8-month domain only the bars show.
- The arcs themselves use Gosling's `withinLink` unchanged. With only `x` (pickup) and `x1` (dropoff) set, it draws an arc between them (`withinLink.ts:82-89`).

**B. Item 15: one direction mechanism instead of scattered flips.**
- The earlier change flipped only line marks, axis labels and y-axis ticks. Bar, rect, area, point, rule, grid, link, title, outline and brush stayed anticlockwise, so marks on the same circle were mirrored against each other (the cause of item 11). Circular genomic plots changed too.
- `polar.ts`, `axis.ts`, `line.ts` and `axis-track.ts` are restored to upstream. The compiler expresses clockwise tracks as swapped start/end angles, which `valueToRadian` already traverses in reverse. Arc sweep flags, label widths and curved-text ropes follow the direction.
- The genomic `VISUAL_ENCODING_CIRCULAR` example matches its upstream thumbnail again, and the two upstream `polar` tests pass.

**C. Item 13 is not a bug.** HiGlass's internal view scales were read in the browser:
- **Dragging the brush body pans the brush.** The timeline brush spans the view's full domain (2000–2011) and is clipped at the view edge, so a panned brush looks like a 2000–2006 selection while the detail views correctly show 1995–2006. The "before" screenshot `readme-running-example-brushed.png` shows such a pan.
- **Dragging the brush's right handle resizes it.** The detail views then show exactly the brushed range, `[2000, 2006.05]`; see `readme-running-example-brush-resized.png` in the "after" set.
- **The hard-coded zoom-lock seeds are harmless.** The seeds in `create-higlass-models.ts:79-80` are equal for every member, so HiGlass's zoom ratio is 1 and its location offset 0.

**D. Item 14: rejected, not implemented.** Temporal y would need a time-scale path for y (none exists in `generateScales`) and a vertical time axis track. That is not a small change, so I didn't count it as a bug fix.

**E. Item 17: the temporal reason.** Measured with `GoslingComponent` in reactive mode, which the editor uses:
- HiGlass view uids change on every compile, so `preverseZoomStatus` finds no linked view in the previous config and sets `initialXDomain = undefined`.
- **Temporal views** then fall back to an empty domain, `[1970, 1970]`, and show no data; they are skipped now.
- **Genomic views** fall back to the whole genome, losing the spec's domain. This is upstream behavior, restored unchanged; worth reporting to the Gosling project.

**F. Item 20 needs a release.**
- The exported page imports `embed` from `@vanessa_stoiber1999/time-i-gram@0.0.1` (constant `TIME_I_GRAM_EMBED_URL` in `editor/html-template.ts`).
- That release dates from 2024-04-28 and predates every fix here. With it, the exported running example draws axes but no data.
- With a bundle built from this branch (`yarn build-lib`), the exported page renders completely.
- After publishing a new version, bump the version in the URL.

## Example fixes (item 22)

| Example | Problem | Fix |
|---|---|---|
| `overview-detail` | Overview had no data (`values: []`); view started at 1970–2067; two series shared a color | Overview shows all series; 2000–2010 domain; distinct colors |
| `seattle-weather` | Empty (ISO dates → 1970), then no domain | Dates parse (item 1); 2012–2015 domain |
| `unemployment-circular-linear` | Worked, with comments describing fetcher bugs | Reads the single `date` column; comments corrected |
| README running example, S3 | `genomicFields` made the spec invalid → blank in the editor; areas not drawn | `genomicFields` removed; areas draw (item 10) |
| README Quick Start | No domain (1970–2067) | 2012–2015 domain |
| S4 Seattle | — | No change needed |
| S5 solar | `type` / `legend` on fixed colors made it invalid; Overview read a missing `time` column | Removed; Overview reads `Datum und Uhrzeit` |
| S6 NYC taxi | — | No change needed; the `interval` option now takes effect (item 3) |
| S7 WHO flu | Circular view inherited a 2.6-year domain (no ring); comparison views had no data and were dropped | Circular view shows 2010; comparison views read the superimposed file; the hand-made file and its ISO week-1 placement are documented in the spec, **not changed** |
| S8 FitBit | Domain 3× the data; `Calories` nominal with `domain: [0, 50]` (arbitrary colors) | Domain 12 Apr–12 May 2016; `Calories` quantitative on the `hot` scale (Gosling accepts only predefined scales for quantitative colors) |

Not done, but worth deciding:
- **S7.** Fig 1A's middle panel appears to show the two comparison views as August–December and January–July, i.e. one flu season. That would need a domain per view, which the printed spec doesn't have. Currently both views show the same root range.
- **S5.** The Overview track has no `y` channel in the printed spec, so its line is flat (a brush target only).

## Tests added

Each fix has a test that fails before it and passes after. I checked this by running the test with the changed sources reverted to the previous commit.

| Test file | Covers |
|---|---|
| `scripts/vite-alias.test.ts` | 23 |
| `src/data-fetchers/csv/csv-time-data-fetcher.test.ts` | 1, 2, 3, 4, 7, 8 |
| `src/data-fetchers/json/json-time-data-fetcher.test.ts` | 5, 6, 7, 8, 9 |
| `src/core/mark/stacked-temporal.test.ts` | 10, empty color categories |
| `src/compiler/clockwise.test.ts` | 15, `radianToValue` |
| `src/tracks/gosling-brush/brush-track.test.ts` | 11 |
| `src/tracks/unix-time-track/unix-time-track.test.ts` | 12 |
| `src/gosling-schema/validate.test.ts` (2 tests added) | 14 |
| `src/tracks/gosling-track/gosling-track.test.ts` (2 tests added) | 16 |
| `src/core/utils/preserve-zoom-status.test.ts` | 17 (the temporal-skip test fails if the skip is removed) |
| `src/compiler/axis-size.test.ts` | 18 |
| `scripts/dependencies.test.ts` | 19 (every declared dependency is in `yarn.lock`) |
| `editor/html-template.test.ts` | 20 |
| `src/gosling-schema/temporal-docs.test.ts` | 21 |
| `editor/example/temporal-examples.test.ts` | 22 (all temporal examples are schema-valid, start at an explicit time domain, give every drawing track data; S8 domain and color) |

**Upstream tests repaired:** the two `polar.test.ts` tests (item 15).

## Screenshots

Headless Chromium, viewport 1300×950. "Before" was taken on `cb7f84f`, before any code fix; "after" on `05399c5`. Editor views use `?example=<ID>&full=true`. The `embed-*` and `readme-*` images use `embed()`, because the editor refuses schema-invalid specs (`Editor.tsx:542`) and the README spec isn't registered.

| Example | Before | After |
|---|---|---|
| Overview + detail | ![](bugfix-report/before/overview-detail.png) | ![](bugfix-report/after/overview-detail.png) |
| Seattle weather | ![](bugfix-report/before/seattle-weather.png) | ![](bugfix-report/after/seattle-weather.png) |
| Circular + linear | ![](bugfix-report/before/unemployment-circular-linear.png) | ![](bugfix-report/after/unemployment-circular-linear.png) |
| README running example | ![](bugfix-report/before/readme-running-example.png) | ![](bugfix-report/after/readme-running-example.png) |
| README, brush body dragged (pan) | ![](bugfix-report/before/readme-running-example-brushed.png) | ![](bugfix-report/after/readme-running-example-brushed.png) |
| README, brush handle dragged (resize) | — | ![](bugfix-report/after/readme-running-example-brush-resized.png) |
| S3 unemployment (editor) | ![](bugfix-report/before/supp-S3-unemployment.png) | ![](bugfix-report/after/supp-S3-unemployment.png) |
| S3 unemployment (`embed`) | ![](bugfix-report/before/embed-supp-S3-unemployment.png) | ![](bugfix-report/after/embed-supp-S3-unemployment.png) |
| S4 Seattle | ![](bugfix-report/before/supp-S4-seattle-weather.png) | ![](bugfix-report/after/supp-S4-seattle-weather.png) |
| S5 solar (editor) | ![](bugfix-report/before/supp-S5-solar-weather.png) | ![](bugfix-report/after/supp-S5-solar-weather.png) |
| S5 solar (`embed`) | ![](bugfix-report/before/embed-supp-S5-solar-weather.png) | ![](bugfix-report/after/embed-supp-S5-solar-weather.png) |
| S6 taxi | ![](bugfix-report/before/supp-S6-nyc-taxi.png) | ![](bugfix-report/after/supp-S6-nyc-taxi.png) |
| S6 taxi, 1-hour window | ![](bugfix-report/before/embed-supp-S6-nyc-taxi-1h.png) | ![](bugfix-report/after/embed-supp-S6-nyc-taxi-1h.png) |
| S7 WHO flu | ![](bugfix-report/before/supp-S7-who-flu.png) | ![](bugfix-report/after/supp-S7-who-flu.png) |
| S8 FitBit | ![](bugfix-report/before/supp-S8-fitbit.png) | ![](bugfix-report/after/supp-S8-fitbit.png) |

Console errors and warnings per render are in `bugfix-report/{before,after}/console.json`. After the fixes, only two generic HiGlass warnings remain ("unknown data type", "No dataConfig children"); they also appear for upstream examples.

## Paper figures that need regenerating

| Figure | Why |
|---|---|
| Fig 4 / S3, README GIF | Area layers now draw; circular direction and brush consistent; time axis uses theme styles, no stray tick; rows no longer randomly dropped |
| Fig 1A / S7 | The printed spec didn't produce the ring; the ring now runs clockwise |
| Fig 1B / S5 | Overview now has data; spec now valid. Data is daily for 2022, while §5.2 describes hourly data for 2021–2024 (ask the author) |
| Fig 1C / S6 | Times are now UTC: the clock times shown change by the original renderer's UTC offset (the old figure was rendered in local time) |
| Fig 5 / S8 | Daily bars move to the correct day, heart-rate times shift (UTC), domain and calorie colors changed |

## Follow-ups (not fixed here)

- **Lines and areas break at tile boundaries.** They are drawn per tile and not joined, which is visible as a gap around late 2002 in the unemployment examples. The gaps used to be hidden by random sampling. This is inherited Gosling behavior.
- **HTML export (item 20, note F).** Publish a new npm release of the embed bundle and bump `TIME_I_GRAM_EMBED_URL`.
- **`preverseZoomStatus` loses the domain of genomic views** whenever view uids change (note E). This is an upstream issue.
- **Dead code in the time fetchers and the time axis:** `createDateFromFields` (both fetchers), `parseCalendarWeek`, and in the time axis `calculateZoomLevel`, `zoomText` and the commented-out curved labels.
- **The `interval` transform** requires a `field` key that it never reads.
- **Circular brushes** are still removed from circular `parallel` / `serial` view groups (`bounding-box.ts`, inherited).
- **Grammar features** for the next branch, as agreed: a period-based cyclic layout (would replace the hand-made S7 superimposed file), calendar granularity syntax, a relative time scale, spans.

## Environment notes

- `yarn start` works again (item 23).
- `yarn install --frozen-lockfile`, run while fixing item 19, removed Playwright from `node_modules`, because it was installed locally without being declared. For the renders I used Playwright 1.63 installed outside the repo; this branch doesn't change how Playwright is installed.
- **Publishing.** `git push -u denisseram fix/temporal-bugs` returned HTTP 500 from GitHub, and so did adding an SSH key on github.com. The branch is not on GitHub yet. Retry the push once GitHub accepts writes again; if it keeps failing, contact GitHub Support with Request ID `FBB0:238C1F:2427579:22E99EE:6AC66081`.
