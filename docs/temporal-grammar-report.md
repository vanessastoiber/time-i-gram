# Temporal grammar report: branch `feat/temporal-grammar`

Phase B of the temporal grammar work. The design (Phase A, approved) is in [temporal-grammar-design.md](temporal-grammar-design.md); this report covers what was built, where it differs from the design, and the evidence behind it.

**Result**
- All four features are implemented, in the requested order: granularity (1.1–1.4), period, relative, spans.
- Tile-exact aggregation (1.3) worked as planned, so the fallback to per-tile aggregation was not needed.
- Lines and areas no longer break at tile boundaries on temporal axes (your change request 4).

**Branch status** (after the review fixes, see [Round 2](#round-2-review-fixes-performance-and-figure-quality))
- **Tests:** 438 pass, 0 fail (`npx vitest run`). Before the review fixes: 379. The branch point (`fix/temporal-bugs`) had 229.
- **Types:** `npx tsc --noEmit` is clean.
- **Pushed:** every commit is on `denisseram/feat/temporal-grammar`.
- **Genomic behavior unchanged:**
  - The compiled HiGlass specs of all 57 genomic and doc examples are identical to `fix/temporal-bugs`.
  - Seven genomic examples render pixel-identical to it.
  - `MARK_DISPLACEMENT` also renders identically after zoom and pan; see Regression checks.

## The central abstraction: time coordinate systems

Every temporal x axis has a **time coordinate system**: `absolute` (default), `period` or `relative`. It is explicit in the code as the type `TimeCoordinateSystem` in [`src/core/utils/time-coordinate-system.ts`](../src/core/utils/time-coordinate-system.ts). The axis stays a linear scale over seconds; the coordinate system decides which seconds a time maps to. It determines three things:

1. **Where rows go.** `period` and `relative` map rows when the data is loaded, in the `csv-time` and `json-time` fetchers (`applyTimeCoordinates`). This happens before tiling, so HiGlass tiles, zoom, brushes and `visibility` work unchanged.
2. **How the axis is labeled.** The tick module [`time-axis-ticks.ts`](../src/tracks/unix-time-track/time-axis-ticks.ts) labels:
   - absolute axes with dates;
   - period axes with positions within the period (`Jan…Dec`, `W1…W53`, `Mon…Sun`, `00:00…23:00`);
   - relative axes with signed offsets (`−2 wk`, `0`, `+3 wk`), plus a context label naming the anchor ("weeks from the maximum of INF_A").
3. **Which views can be linked.** Only views with the same coordinate-system signature share a link (`filterLinksByCoordinates` in [`linking.ts`](../src/core/utils/linking.ts)).

**Paper sentence (suggested):** *Every temporal axis has a time coordinate system: absolute time, a position within a calendar period, or an offset from a reference event. The coordinate system determines where each record is placed, how the axis is labeled, and which views may be linked.*

## Commits

| Commit | Feature |
|---|---|
| `92833b5` | Design document (Phase A) |
| `43a50c5` | 1.1 + 1.2: date strings in domains, durations in thresholds and zoom limits; calendar module `time-units.ts` |
| `9966ec5` | 2: `period`, `TimeCoordinateSystem`, period axis labels, link filtering, ISO week 53 in `csv-time` |
| `9baccd6` | 1.3: `timeUnit` transform and channel, tile-exact aggregation |
| `563a6dd` | 1.4: granularity transition rules |
| `1f2404e` | 3: `relative` |
| `9aebec7` | 4: `span` transform |
| `0d2c858` | Fix: temporal lines and areas drawn across tile boundaries |
| `583d62c` | Formatting of the new files |
| `89b7e7c` | README, this report |
| `6e2ef31` … `1c75c01` | Round 2: review fixes, performance, figure quality, thumbnails (54 commits; see [Round 2](#round-2-review-fixes-performance-and-figure-quality)) |

## Final syntax

All new properties are optional and valid only on `type: "temporal"` x channels or temporal views. On other x channels, `period`, `timeUnit` and `relative` are a schema error and are removed by the compiler with a warning; date strings and durations are ignored with a warning. Every spec that worked before still validates and renders the same, apart from lines now joined at tile boundaries (see Regression checks).

### 1. Calendar granularity

| Construct | Syntax | Semantics (paper-ready) |
|---|---|---|
| Units | `millisecond`, `second`, `minute`, `hour`, `day`, `week`, `month`, `quarter`, `year`, `decade` | The granularity hierarchy, in UTC. `week` is the ISO week (Monday–Sunday); quarters start in Jan/Apr/Jul/Oct; decades start in years divisible by 10. |
| Date strings | `domain` / `xDomain`: `{ interval: ["2000-01", "2010-12"] }`; also `"2010"`, `"2010-12-31"`, `"2010-Q4"`, `"2015-W53"`, ISO date-times; numbers still allowed | *A partial date as the start of a domain denotes the first instant of the unit it names; as the end, the last instant of that unit, so `["2000-01", "2010-12"]` covers January 2000 through December 2010. A date-time is that instant (UTC without a zone).* |
| Durations | `threshold: "3 months"`, `zoomLimits: ["1 hour", "20 years"]`; numbers still allowed | *A duration is a length of time; units up to a week are exact, a month is 1/12 of a mean Gregorian year (30.44 days), a year 365.2425 days.* |
| `timeUnit` transform | `{ type: "timeUnit", field, unit, newField?, endField? }` | Truncates a time to the start (and end) of its unit; keeps every row. |
| "Show by month" | `x: { …, timeUnit: "month" }` + `y: { …, aggregate: "count" \| "sum" \| "mean" \| "median" \| "min" \| "max" }` | *With an x time unit, every record is placed at the start of its unit; if a channel is aggregated, records are grouped by unit and by the fields of the track's nominal channels and reduced with the channel's operation. A unit at the edge of the data is aggregated from the records present.* Bars and rects span their unit. |
| Granularity transition rules | `timeUnit: [{ unit: "day", maxSpan: "3 months" }, { unit: "week", maxSpan: "2 years" }, { unit: "month" }]`; `unit: "none"` = raw rows | *A rule list orders units from fine to coarse, each with the largest visible span at which it applies; at any zoom level the track is drawn with the first unit whose `maxSpan` exceeds the visible span.* **Pure sugar:** the track is expanded into one overlaid copy per rule, each with `visibility` conditions on `zoomLevel`. |

### 2. Period (cyclic layout)

`x: { field, type: "temporal", period: "year" | "month" | "week" | "day" }`, or the object form `period: { unit, weekBased?, start?, newField? }`.

*A period axis places each instant by its position within its calendar period (its month, day and time for a year; its weekday and time for a week; its time of day for a day), so all periods share one axis or one revolution. Each record also receives its period as a field (e.g. "2010"), which can be encoded with color (overlaid periods) or row (one concentric ring per period).*

- **Calendar years** align by date in a leap reference year. Non-leap years leave a one-day gap at Feb 29.
- **`weekBased: true`** uses ISO week-years: ISO week 1 is always at the start of the period, even when it begins in late December. The reference year has room for week 53. Weeks are counted from the start of the season, so a season without a week 53 leaves the *last* slot empty.
- **`start`** sets where each period begins:
  - a month for years (`8` gives August–July, keys `"2010/11"`);
  - an ISO week for week-based years (`40` gives flu seasons);
  - a weekday for weeks;
  - an hour for days.
- **Period keys** are strings that sort chronologically: `"2010"`, `"2010/11"`, `"2010-03"`, `"2010-W05"`, `"2010-03-01"`. Default field name: `<field>_<unit>`.
- **Intervals** (`x`/`xe`) that cross a period boundary are split, one piece per period.
- **`timeUnit` inside a period** must lie within it, e.g. months of a year or hours of a day; otherwise it is ignored with a warning. Quarters only nest in years that start in January, April, July or October.
- **Rings** of periods have no gap at the origin (the end of one period is the start of the next), and a period axis cannot be zoomed out past one period by default.

### 3. Relative

`x: { field, type: "temporal", relative: { anchor, groupby?, unit? }, domain: { interval: ["-16 weeks", "16 weeks"] } }`

*A relative axis places each record at its signed offset from a reference event of its group (a fixed date, the group's first or last record, the time of the group's largest or smallest value of a field, or a date read from the record itself); the axis labels offsets in a unit, with 0 at the reference event.*

- **`anchor`:** a date or Unix seconds; `"first"`; `"last"`; `{ argmax: field }`; `{ argmin: field }` (ties go to the earliest); or `{ field: name }` (per row: Unix seconds or an ISO date).
- **`groupby`:** field(s), or **`{ period: … }`** to group by calendar period, e.g. flu seasons. This is not in the design; see Deviations.
- **Transform, scale, or both?** Both: a scale property in the syntax, implemented as a load-time transform in the fetcher. Anchors need whole groups, while `dataTransform`s run per tile, and the tile filter must already see offsets.
- **Domain:** offsets, given as durations (`"-36 months"`) or seconds. If missing, it defaults to ±1 year, with a warning.
- **`timeUnit`** on a relative axis counts whole fixed-length units (up to `week`) from the anchor.
- **`label`** names the reference event in the axis title (`"the season's peak"` gives "weeks from the season's peak").

### 4. Spans

`{ type: "span", field, duration, unit?, newField }`

*A span is a duration not tied to a position in time; combined with a start field it yields an interval that ends `duration` later.*
- `duration` is a numeric field in `unit` (default `second`), or a literal such as `"15 minutes"`.
- Months and longer are added on the calendar (31 Jan + 1 month = 29 Feb 2000), fractions at the nominal length.
- Negative durations are not drawn.
- On period and relative axes, the track maps span ends after the transforms; on a period axis they are clipped at the period end.

### 5. Titles, axes and legends (round 2)

| Construct | Syntax | Effect |
|---|---|---|
| Y-axis title | `y: { …, title: "Cases per week" }` | Drawn as "↑ Cases per week" above the axis (or "Title ↑" for a right axis) in the header strip of linear temporal tracks, and in the center of temporal rings |
| Legend title | `color: { …, legend: true, title: "Year" }` (or `style.legendTitle`) | Bold title of the legend |
| Legend entry of a constant color | `style: { legendLabel: "Steps (bars)" }` | Adds the track (e.g. one member of an overlay) to the legend with a swatch of its mark and color |

- **Header strip.** Linear tracks on a temporal axis keep a strip at the top for the track title, the y titles and a one-line legend; the y range starts below it. Genomic tracks are unchanged.
- **Rings.** A ring on a temporal axis draws its y title and, when it fits, its legend in the center.

### Linking across coordinate systems

- **Split by system.** A `linkingId` (zoom/location lock or brush) that joins views in different coordinate systems is split into one link per system:
  - systems differ as absolute, period or relative, or as periods with different `unit` / `weekBased` / `start`;
  - every group of compatible views stays linked, whatever the order of the views;
  - a view alone in its system is not linked;
  - one console warning per `linkingId` names the systems.
- **Changed in round 2 (review S2).** The approved rule kept the system of the link's first member, so a period ring listed after an absolute view lost its brush.
- **Relative views** link with each other whatever their anchors, because offsets are comparable.

## Implementation notes (where it lives)

| Module | Role |
|---|---|
| `src/core/utils/time-units.ts` | Calendar arithmetic: `floorTime`, `offsetTime`, ISO weeks, `parseTimeValue`, `parseDuration`, `addDuration` |
| `src/core/utils/time-coordinate-system.ts` | `TimeCoordinateSystem`; period mapping and keys; relative anchors; `applyTimeCoordinates` (fetchers); time-unit binning helpers, tile assignment (`isRowInTile`, `filterByTimeUnits`); span ends |
| `src/compiler/temporal-preprocess.ts` | Runs after `traverseToFixSpecDownstream`: resolves date strings and durations; expands granularity rules; validates `period` / `relative` / `timeUnit`; rewrites temporal x fields to coordinate fields; attaches internal `_timeCoordinates`, `_timeUnit` and `_timeUnitTiling`. Idempotent, because compile runs it again for responsive specs. |
| `src/compiler/gosling-to-higlass.ts`, `higlass-model.ts` | Pass the coordinate mapping and the time-unit tiling to the fetcher, and the coordinate system to the time axis |
| `csv-time` / `json-time` fetchers | Map rows (period, relative) after parsing; with time units, give each unit to the tile containing its start |
| `src/tracks/gosling-track/gosling-track.ts` | `timeUnit` / `span` transforms; per-track rows of each tile; `binByTimeUnit`; span-end mapping; tile combination for temporal lines |
| `src/tracks/unix-time-track/` | Ticks and labels per coordinate system |
| `src/core/utils/linking.ts`, `create-higlass-models.ts` | Link filtering by coordinate system |
| Schema | `gosling.schema.ts` (+ regenerated `gosling.schema.json` and `template.schema.json`): `TimeValue`, `Duration` (with a pattern), `TimeUnit`, `X.period`, `Period`, `X.timeUnit`, `TimeUnitRule`, `X.relative`, `Relative`, `TimeUnitTransform`, `SpanTransform`, `Aggregate` + `sum` / `median`. Every new property has a doc comment. |

**Tile-exact aggregation.** The time fetchers return, for each tile, the rows whose *unit start* lies in the tile, for every unit used by the overlaid tracks, plus raw rows by their own coordinate. Each overlaid track then keeps only its own unit's rows. So every unit is reduced once, from all of its rows. A test checks this against real HiGlass tile ids through the `csv-time` fetcher: a month straddling a tile edge comes out with its full count, while naive per-tile aggregation produces two partial months.

**Lines across tile boundaries (change request 4).** The breaks were visible in the new examples: the yearly unemployment line between 2002 and 2003, the zoomed granularity view, and the Lehman-aligned view around −16 and −11 months.
- **Fix:** for tracks with `line` / `area` marks on a temporal x, the visible tiles' rows are combined into the first tile (`combineTemporalTiles` in `combine-tiles.ts`). Each tile's own rows are merged, deduplicated by identity, and time units are assigned by the union of the visible tiles.
- **Upstream untouched:** tracks with Gosling's `displace` transform use upstream's combination, verbatim (`combineTilesUpstream`). The improved combination is described in [upstream-proposals.md](upstream-proposals.md). Review S3 had found that the first version also changed `displace`.
- **Side fix:** skipped tiles no longer clear the shared axes, legends and outline (temporal case only).
- **Ring views:** the circular examples were not broken at their default zoom, because the whole reference period falls in one tile. They now also stay joined when zoomed.

## Tests

438 tests in total (+209 on this branch; +59 in round 2). New or extended files (counts as of round 1; round 2 additions are listed in [Round 2](#tests-added-in-round-2)):

| Test file | Tests | Covers |
|---|---|---|
| `src/core/utils/time-units.test.ts` | 31 | floor/offset for every unit; **pre-1970** instants; years < 100; **year boundaries**; **29 Feb (+1 year)**; month-end clamping; **ISO week 53** (2009, 2015, 2020), 2014-W01 = 2013-12-30, 2010-01-03 = 2009-W53; date strings as start/end, offsets, invalid dates; durations (plural/short/signed/invalid) |
| `src/core/utils/time-coordinate-system.test.ts` | 21 | period normalization, signatures; leap reference year; pre-1970 and year < 1000 keys; shifted seasons (Aug, ISO week 40); week-based years (W1 in December, W53); months/weeks/days with `start`; interval split at the year boundary; relative anchors (fixed/first/last/argmax ties/argmin/field/missing); offsets; period-grouped anchors (flu seasons) |
| `src/core/utils/time-unit-aggregation.test.ts` | 19 | `timeUnit` transform; `binByTimeUnit` with every aggregate; ISO weeks across years; units inside a period; **tile exactness** (synthetic tiles, mixed units, real `csv-time` tiles); `span` (numeric/literal/calendar months/negative); span ends on relative and period axes |
| `src/compiler/temporal-preprocess.test.ts` | 49 | schema validity of every new construct; **string vs numeric domains** (same result); genomic axes ignore strings/durations; compile output for durations, period, timeUnit, rules, relative, span; overlays; idempotence; link filtering (period/absolute/relative/genomic) |
| `src/tracks/unix-time-track/time-axis-ticks.test.ts` | 8 | labels per coordinate system (absolute, year, season, ISO weeks incl. W40 start, weekdays, hours, days of month, relative offsets, automatic unit) |
| `src/tracks/unix-time-track/unix-time-track.test.ts` | +2 | the axis track draws period and relative labels, no center tick on relative axes |
| `src/data-fetchers/csv/csv-time-data-fetcher.test.ts` | +2 | ISO week 53 and December week 1 (`includesCalendarWeek`); period coordinates and tiles in the fetcher |
| `src/data-fetchers/json/json-time-data-fetcher.test.ts` | +1 | period coordinates for inline values |
| `src/tracks/gosling-track/gosling-track.test.ts` | +2 | which tracks combine tiles (temporal line/area only, never genomic) |
| `editor/example/temporal-examples.test.ts` | +15 | the five new examples are schema-valid, have explicit domains, and give every drawing track data |

## Screenshots

All 14 temporal examples, after the round 2 fixes:
- **Setup:** headless Chromium, dev editor (`?example=<ID>&full=true`).
- **At load:** cropped to the visualization.
- **After interaction:** after 4 wheel steps in (left), then after a 120 px drag (right), which pans and moves linked brushes. The thin vertical line in these images is HiGlass' mouse-position indicator.
- **Console:** no errors in any of the 42 renders (`temporal-grammar-report/console.json`). The usual React and HiGlass warnings are not recorded.

Every screenshot was checked against the global rules G1–G7 (see Round 2).

| Example | Shows | At load | Zoom, then drag |
|---|---|---|---|
| **Period: WHO flu by week of the year** | One ring for all years (`period: { unit: "year", weekBased: true }`), W1 at 12 o'clock; the ring's brush drives the linear view; absolute timeline below (not linked) | ![](temporal-grammar-report/who-flu-period.png) | ![](temporal-grammar-report/who-flu-period-zoom-drag.png) |
| **Period: FitBit weekly and daily cycles** | Hourly means: one ring per week (`period: "week"`, `row`), and all days on a 24-hour axis (`period: "day"`) | ![](temporal-grammar-report/fitbit-cycles.png) | ![](temporal-grammar-report/fitbit-cycles-zoom-drag.png) |
| **Granularity: unemployment by month or year** | One rule list: the overview (10 years) is yearly, the detail (2 years) monthly; zooming switches | ![](temporal-grammar-report/unemployment-granularity.png) | ![](temporal-grammar-report/unemployment-granularity-zoom-drag.png) |
| **Relative: flu seasons and unemployment aligned to events** | Seasons aligned to their peak (`argmax`, `groupby: { period }`), industries to 2008-09-15, named with `relative.label` | ![](temporal-grammar-report/relative-alignment.png) | ![](temporal-grammar-report/relative-alignment-zoom-drag.png) |
| **Spans: NYC taxi trips and the daily cycle** | Trips as arcs from pickup to pickup + duration (`span`); pickups per hour of the day per vendor | ![](temporal-grammar-report/taxi-spans.png) | ![](temporal-grammar-report/taxi-spans-zoom-drag.png) |
| **Unemployment: overview + detail** | Overview with brush, five detail tracks | ![](temporal-grammar-report/overview-detail.png) | ![](temporal-grammar-report/overview-detail-zoom-drag.png) |
| **Seattle weather** | Three linked views; weather as colored days, as text when zoomed in | ![](temporal-grammar-report/seattle-weather.png) | ![](temporal-grammar-report/seattle-weather-zoom-drag.png) |
| **Unemployment: circular overview + linear detail** | Ring (absolute time) with brush, linear detail | ![](temporal-grammar-report/unemployment-circular-linear.png) | ![](temporal-grammar-report/unemployment-circular-linear-zoom-drag.png) |
| **Supp. S3: unemployment across industries** | Ring with brush, two detail panels, timeline | ![](temporal-grammar-report/supp-unemployment.png) | ![](temporal-grammar-report/supp-unemployment-zoom-drag.png) |
| **Supp. S4: Seattle weather** | Precipitation, temperature, weather | ![](temporal-grammar-report/supp-seattle-weather.png) | ![](temporal-grammar-report/supp-seattle-weather-zoom-drag.png) |
| **Supp. S5: solar power and local weather** | Overview with brush and five linked tracks | ![](temporal-grammar-report/supp-solar-weather.png) | ![](temporal-grammar-report/supp-solar-weather-zoom-drag.png) |
| **Supp. S6: NYC taxi trip duration** | Arcs from pickup to drop-off and trip durations, one hour at load | ![](temporal-grammar-report/supp-nyc-taxi.png) | ![](temporal-grammar-report/supp-nyc-taxi-zoom-drag.png) |
| **Supp. S7: WHO flu data** | Ring of superimposed years, the end and start of the season, timeline by year | ![](temporal-grammar-report/supp-who-flu.png) | ![](temporal-grammar-report/supp-who-flu-zoom-drag.png) |
| **Supp. S8: FitBit activity and heart rate** | Heart rate by minute or hour, daily steps (bars) and very active minutes (line), heart rate around the month | ![](temporal-grammar-report/supp-fitbit.png) | ![](temporal-grammar-report/supp-fitbit-zoom-drag.png) |

## Regression checks

**Compile output.** All editor examples were compiled on this branch and on `fix/temporal-bugs` (renumbering random ids):
- the 57 genomic and doc examples are identical;
- `MATRIX` differs only by its random demo data, the same as base vs base.

**Pixels at load.** The `fix/temporal-bugs` editor (a temporary worktree) and this branch were rendered side by side:

| Examples | Base vs base | Base vs this branch |
|---|---|---|
| `VISUAL_ENCODING`, `VISUAL_ENCODING_CIRCULAR`, `GENE_ANNOTATION`, `SEMANTIC_ZOOM`, `LINKING`, `CANCER_VARIANT` (uses `legendTitle`) | 0% (0.02% for `CANCER_VARIANT`) | **0%** |
| `CIRCULAR_OVERVIEW_LINEAR_DETAIL` | 3.21% | 3.21% (its own noise) |

`LINKING` once rendered without data on this branch; bisecting showed it was a failed fetch of its remote tiles. A rerun was identical, and no commit changes it.

**Render-level regression test for an interactive genomic example.** `scripts/render-regression.cjs` renders `MARK_DISPLACEMENT` at load, after 4 wheel steps, and after zoom + a 150 px pan. Each case is rendered five times on the reference branch (whose renders can differ from run to run after interaction), and this branch must match one of them within 0.05% of the pixels:

| Case | Before the S3 fix (`0b05f99`) | Now |
|---|---|---|
| load | 0.000% (ok) | 0.000% (ok) |
| zoom | 0.806% (**fails**) | 0.000% (ok) |
| zoom + pan | 0.666% (**fails**) | 0.000% (ok) |

**Temporal examples.** They changed on purpose in round 2; see Screenshots.

## Round 2: review fixes, performance and figure quality

Sources:
- the independent review, [review-temporal-grammar.md](review-temporal-grammar.md);
- the request to measure and fix performance;
- the review of the examples as paper figures (rules G1–G7);
- editor thumbnails (E1).

Every code fix has a test that fails before it and passes after, and the full suite and `tsc --noEmit` passed after each commit.

### Review findings

| Finding | What changed | Commit |
|---|---|---|
| S1 `quarter` in a shifted year | Allowed only in years starting in Jan/Apr/Jul/Oct, otherwise ignored with a warning | `6e2ef31` |
| S2 links depend on view order | A `linkingId` is split by coordinate system (see Linking above) | `de5638d` |
| S3 `displace` changed after zoom/pan | `displace` uses upstream's tile combination verbatim. A render-level regression script checks it, and the improvement is written up in [upstream-proposals.md](upstream-proposals.md) | `aff8ae6` |
| S4 week labels overlap | Tick count from the axis length, short labels (`W27`, `Tue`, `12:00`), the visible weeks as context | `7a6d521` |
| S5 temporal-only properties on genomic x | Schema error (`if`/`then` on `X`, added by `scripts/generate-schemas.mjs`, so the editor shows it) and a compiler warning that removes them | `e2452d1` |
| S6 strokes across a zoomed ring | Rows outside the visible arc are not drawn on temporal rings | `d36b7eb` |
| S7 ticks before the period; no zoom limit | Only positions inside the period are labeled. Period views default to an upper zoom limit of one period | `68b0cb8` |
| S8 empty rule list deletes the track | The track falls back to raw rows with a warning; the schema requires at least one rule | `1749e80` |
| S9 partial yearly mean at the data's edge | The example ends at 2009-12; the semantics say how edge units are aggregated | `f4f08fd` |
| M1 notch in the ring brush | It was the circular layout's gap at the origin. Period rings have none now, so ring and brush cover the cycle | `d4d5fa6` |
| M2 empty week-53 slot mid-season | Weeks count from the season start; the spare slot is at the end | `3683cd8` |
| M3 domains of the wrong kind | Durations on absolute axes, dates on relative axes (also inherited view domains), reversed and empty domains: warned and ignored | `6944185` |
| M4 intervals cut at 1,000 pieces silently | Warning | `e072928` |
| M5 skipped tiles | They were already not transformed, but kept stale models (partial aggregates) that mouse events read; those are dropped | `522d417` |
| M6 warnings once per page | Once per compiled spec (`warnOnce`, reset by each compile) | `e072928` |
| M7 relative labels crowd | Same as S4: tick count from the axis length, for every temporal axis | `7a6d521` |
| M8 internal names in the compiled spec | Kept; documented in the README ("Compiled specs") | `21633f0` |
| M9 label collisions | Ring labels in the axis band around the ring center (they were shifted onto the data); no duplicate tick at a ring's end; end labels kept inside or hidden; 24-hour times; titles and legends in a header strip or ring center; link arcs below the header | `ef4d29c`, `da4bcc1`, `816bf04`, `1f952bc`, `3e772f1`, `e9f7b1d`, `40eb452` |
| M10 intervals binned by start | One sentence in Limitations | — |
| §4 missing tests | Added: S1, S2 (all view orders, brush), S5, S7, S8, link partition, empty rules, tick filtering, combine strategies, and the render-level regression script for `MARK_DISPLACEMENT` | — |
| §5 code quality | Shared `utc()` / `DAY` / `WEEK` / `WEEKS_IN_REF_YEAR`, one fetcher config type and tile filter (`rowsOfTile`), alias import in `linking.ts`, one resolved flag per temporal track instead of marker fields | `eec76af`, `e1f1b7c`, `0b05f99` |

Found while fixing the examples:
- **Overlaid tracks with x only in their members.** Such tracks were not recognized as temporal, so their duration thresholds were dropped (Seattle weather showed text labels at every zoom level). Fixed in `bd0fcec`.
- **`relative.label`.** Added (`bb39c7f`) so that axes say "weeks from the season's peak" rather than "the maximum of INF_A".

#### Tests added in round 2

Tests went from 379 to 438. New files:
- `combine-tiles.test.ts`
- `model-cache.test.ts`
- `temporal-header.test.ts`
- `ring-center.test.ts`
- `time-utils.test.ts`

Extended files:
- `temporal-preprocess.test.ts`
- `time-axis-ticks.test.ts`
- `unix-time-track.test.ts`
- `axis.test.ts`
- `legend.test.ts`
- `gosling-track.test.ts`
- `time-units.test.ts`
- `time-unit-aggregation.test.ts`
- `temporal-examples.test.ts`
- `scripts/vite-alias.test.ts` (imports of the schema module)

### Performance

**Method.**
- **Browser:** headless Chromium on an Apple M1 (8 GB), dev editor, one server per version, measured one version at a time.
- **Load:** time until no long task for 2 s.
- **Interaction:** frame intervals and total blocking time (TBT, the sum of long-task time over 50 ms) during 10 wheel steps (zoom) and a 20-step drag (pan, which also moves linked brushes).
- **Runs:** 3 runs each, medians reported.
- **Noise:** the machine was busy (Chrome, VS Code; load average 11–12), so only runs taken side by side are comparable. Unchanged code varied by up to ±50% between batches.

**Final code vs this branch before round 2 (`0b05f99`), measured side by side:**

| Example | Load before → after | Zoom TBT before → after | Drag TBT before → after | p95 frame (zoom) before → after |
|---|---|---|---|---|
| FitBit cycles | 3.3 s → 3.5 s | **75.5 s → 1.6 s** | **288.2 s → 1.8 s** | **13.5 s → 0.15 s** |
| WHO flu period | 3.8 s → 3.3 s | 1.1 s → 0.9 s | 1.6 s → 2.0 s | 133 → 117 ms |
| Granularity | 3.5 s → 4.9 s | 1.4 s → 2.2 s | 2.0 s → 5.1 s | 183 → 233 ms |
| S5 solar | 4.3 s → 3.7 s | 1.6 s → 1.8 s | 2.9 s → 3.2 s | 167 → 217 ms |

The granularity numbers are worse in this batch. A CPU profile of the same drag on the final code shows the new header and legend drawing take about 0.05 s of JavaScript. The rest is native rendering (3.4 s), as before, so I attribute the difference to the noise above.

**Comparison with `fix/temporal-bugs`, for the examples that exist on both branches.** These numbers are from the first batch, before round 2:

| Example | `fix/temporal-bugs` | This branch (`0b05f99`) |
|---|---|---|
| S5 solar | load 3.5 s, zoom TBT 2.3 s, drag TBT 3.3 s | 3.1 s, 2.0 s, 3.4 s |
| S7 WHO flu | 3.9 s, 3.4 s, 4.0 s | 3.5 s, 1.6 s, 2.8 s |
| `MARK_DISPLACEMENT` | 6.4 s, 4.9 s, 8.2 s | 6.8 s, 4.1 s, 6.7 s |
| `CIRCULAR_OVERVIEW_LINEAR_DETAIL` | 6.1 s, 4.1 s, 7.1 s | 7.4 s, 5.2 s, 6.5 s |

**Findings:**
- **No regression from this branch.** The examples present on both branches are within noise of each other. Combining tiles for temporal lines did not slow the earlier temporal examples.
- **What made the editor feel slow was the new FitBit cycles example.** It drew 154,000 per-second points in two views, and Gosling redraws every mark on each zoom or pan event (each wheel step blocked the page for seconds).
- **Inherited cost.** Every example, on both branches, blocks the page 1–8 s per 10 wheel steps on this machine. Most of that is native rendering in Gosling and HiGlass.

**Changes:**

| Commit | Change | Effect |
|---|---|---|
| `ab6bc8b` | FitBit cycles draws hourly means (`timeUnit`) | The table above; S8 also uses minute/hour means (`32fb62c`) |
| `d2732b9` | `utc()` and `isoWeekday()` without `Date` objects | Period axes map every row at load: `utc()` went from 2.4 s to 0.1 s of CPU during the FitBit load |
| `39db2a0` | Temporal tiles reuse their track models while zooming or panning within the same tiles; unchanged tiles are not recombined | `processAllTiles` / `transformDataAndCreateModels` went from about 0.2 s to nothing measurable during a 20-step drag |
| `aff8ae6` | Temporal lines merge each tile's rows in one pass (a `Set`) instead of repeated array spreads | Removes quadratic copying when many tiles are combined |

Raw numbers (JSON) were in the session scratchpad.

### Figure quality: global rules

| Rule | Implementation (temporal tracks only; genomic tracks unchanged) |
|---|---|
| G1 titles over the y axis | A header strip at the top of linear temporal tracks holds the title; the y range and axis start below it (`b1fdf8f`) |
| G2 y-axis titles with units | New `y.title`: "↑ Cases per week" above the axis in the header, or in the center of a ring (`b1fdf8f`, `e3643e2`); set in every example |
| G3 legends with titles | Header legend: one line, right-aligned, with a bold title, entries for nominal `color` or `stroke` categories (those drawn in any visible tile), and new `style.legendLabel` entries for constant-color tracks such as bars vs line (`b1fdf8f`, `8d0b907`, `4a83dec`, `582da40`) |
| G4 sentence case | All view, track, axis and legend titles of the 14 examples |
| G5 time context label | It names the visible range ("2021–2022", "2022 May–Jul", "2016 Feb 3, 12:35–13:35", "W26–W29"); never on rings; no center tick (`e52973d`, `e9f7b1d`) |
| G6 legends compact and visible | One-line header legends on linear tracks; compact titled legends in the center of rings when they fit, otherwise in the corner (`3e14fae`, `e3643e2`) |
| G7 the question in the title | Every example's title is its question; subtitles say what is shown |

### Examples

| Example | Changes beyond G1–G7 |
|---|---|
| S3 unemployment | One legend for the five rings, in the center; taller detail panels |
| S4 Seattle weather | The domain is the data's (2012–2015); thresholds are durations |
| S5 solar | Legends "Fed into the grid / Consumed on site", "Generated / Drawn from the grid", "Maximum / Minimum", "Type"; tooltip labels corrected |
| S6 NYC taxi | **Why it did not load:** the arcs were only drawn below 4,000 s of visible time, but it opened on eight months, so the top view was empty (no error; loading the 39 MB CSV twice takes 9–15 s). It opens on one hour now. Bars are capped at one hour (a 1.9-million-second trip flattened them); "Passengers" legend; the arc view has its own time axis |
| S7 WHO flu | The two identical linear views show the end (Jan–May) and start (Sep–Dec) of the season; no "2010" in the ring center; radial axis title and year legend in the ring center; readable week and month labels; the timeline covers 2010–2014 colored by year (the year bands that hid "2012" were replaced) |
| S8 FitBit | Activity and heart rate are of the same participant (they were two people); bars (steps) and line (very active minutes) named in the legend and on both axes; heart rate by minute below 2 days of visible time, by hour above |
| WHO flu period | Larger ring center for the "Year" legend |
| FitBit cycles | Hourly means (it drew 154,000 points twice); title asks "Is it higher at weekends, and at what time of day?"; the ring's week legend is in its center |
| NYC taxi spans | Vendors named ("Creative Mobile Technologies", "VeriFone") in a "Vendor" legend; the titles say what the arcs and the hourly chart show; arc height grows with trip duration |
| Relative alignment | Events named with `relative.label` |
| Granularity | Zoom-proof track titles |
| Overview + detail | The overview's colors match the detail tracks and are explained by its legend |

**FitBit cycles.** A replacement was not needed: with hourly means and the question in the title, the weekly rings and the hour-of-day bars answer it.

### Editor thumbnails (E1)

Every temporal example has a thumbnail (`editor/example/thumbnails/TEMPORAL_DATA_*.png`, 500 px wide, as the genomic ones), registered in `thumbnails.ts` and `index.ts`. They were made after all visual fixes, and all 14 load in the examples menu.

### Not fixed

- **Y tick labels under the marks.** Tick labels are drawn under the marks of their track (inherited), so tall bars or areas can cover them. Changing the drawing order of Gosling's embellishments is a change to inherited code; I left it.
- **Interaction cost of every view.** Gosling redraws all marks on every zoom or pan event, and every example blocks the page 2–8 s per 10 wheel steps on this machine (also on `fix/temporal-bugs`). Avoiding that needs a change to how inherited Gosling draws tiles, which you asked me to raise before doing.
- **Slow loads of large CSVs.** Each view parses its own copy of a CSV (S6: 39 MB twice). Sharing parsed data between fetchers would be a change to inherited data loading.
- **Duplicate time-axis context labels.** Views that each have an axis (e.g. S5's overview and detail) each show their own context label. Every label now matches its own visible range, and none is drawn more than once per axis.

## Vega-Lite comparison (as implemented)

Updated from the design document; "time-i-gram" describes what this branch actually implements.

### Feature 1: calendar granularity

| Capability | Vega-Lite | time-i-gram |
|---|---|---|
| Calendar units, truncation, aggregation by unit ("show by month") | **Native** (`timeUnit` on encodings and as a transform, `utc` variants, all aggregates) | Parity: **not a novelty**. Differences: ISO weeks (Vega-Lite's `week` is Sunday-based), a `decade` unit, exact aggregation under tiled loading. |
| Date strings in domains | **Native** (DateTime objects / dates in `scale.domain`) | Parity, plus the inclusive end-of-unit reading of partial dates and ISO week / quarter strings |
| Durations as literals (zoom thresholds, zoom limits, offset domains) | **Not available** (no duration type, no semantic zoom) | New, minor |
| Granularity that changes with zoom | **Workaround:** interval selection bound to scales + layers filtered by an expression on the selection extent; all data in memory | **Native**, as one channel property (rule list, compiled to `visibility`), with tiled loading |

### Feature 2: period

| Capability | Vega-Lite | time-i-gram |
|---|---|---|
| Superposed periods on a linear axis | **Native** (`timeUnit: "monthdate"`, color by year) | Parity |
| Periodic bars / rose on a circle | **Native** (`arc` + `theta` with `timeUnit`) | Parity |
| Continuous periodic line/area around a circle with a time axis | **Workaround** (`calculate` sin/cos; no polar axis, no zoom) | **Native** |
| ISO week-years with week 1 at the start; seasons starting in another month or week | **Workaround** (`calculate` with Vega expressions) | **Native** (`weekBased`, `start`) |
| One concentric ring per period | **Workaround** (`radius` offset per year, bars only) | **Native** (`row` on the period field) |
| Zoomable cyclic view linked to linear views by a brush | **Not possible** (no interval selection on `theta` / `radius`, no polar zoom) | **Native** within one period system; links across systems are refused with a warning |

### Feature 3: relative

| Capability | Vega-Lite | time-i-gram |
|---|---|---|
| Offset from a fixed date, labeled "+3 mo" | **Workaround** (`calculate` + quantitative axis + `labelExpr`) | **Native** |
| Per-group anchor (first / last / argmax / argmin / per-row date) | **Workaround** (`joinaggregate` + `calculate` + `labelExpr`, 3–4 constructs) | **Native** (one property) |
| Groups defined by calendar period (e.g. flu seasons from week 40) | **Workaround** (expression for the season key) | **Native** (`groupby: { period }`) |
| Offset-aware binning | **Workaround** (`bin` with `step` on the offset; no calendar units) | **Native** for fixed-length units |
| Linked, zoomable aligned views | **Possible** (interval selections on the offset; no tiling) | **Native**, with tiling |

Be precise in the paper: Vega-Lite *can* express relative timelines with workarounds. time-i-gram's contribution is a first-class reference event and unit as part of the axis' coordinate system, with offset labels, offset domains, anchor-relative binning, and coordinate-aware linking.

### Feature 4: spans

| Capability | Vega-Lite | time-i-gram |
|---|---|---|
| Interval from start + duration | **Workaround** (`calculate`, `timeOffset` for calendar units, then `x` / `x2`) | Declarative transform: convenience, not novelty |

### Summary

| Feature | Gosling.js | Vega-Lite | time-i-gram contribution |
|---|---|---|---|
| Date strings, durations | no | native / n/a | parity / minor |
| `timeUnit` aggregation | no | native | parity (exact under tiles) |
| Granularity transition rules | no | workaround | **new** declarative semantic zoom by calendar unit |
| Period: linear | no | native | parity |
| Period: circular continuous marks, rings per period, ISO week-years, shifted seasons | no | workaround / not possible | **new** |
| Linked zoomable periodic views; links checked by coordinate system | no | not possible | **new** |
| Relative time | no | workaround | **new as a scale concept** |
| Spans | no | workaround | convenience |

## Deviations from the design

- **`relative.groupby: { period }`: added.** It is needed for "flu seasons aligned to their peak": seasons cross the year boundary, so no data column defines them. `ISO_YEAR` splits seasons, and `dateFields` overwrites it with the date. It reuses the period machinery, and the period's `newField` can be encoded, e.g. `color: season`.
- **Validation messages are mostly console warnings from the compiler, not schema errors.** Ajv (the schema) checks shapes (units, duration pattern, anchor kinds, at least one granularity rule) and, since round 2, rejects `period` / `timeUnit` / `relative` on non-temporal x channels. Semantic problems are reported as `[time-i-gram]` warnings and the construct is ignored:
  - unparseable dates;
  - a `timeUnit` outside a period;
  - mismatched links;
  - a domain on a period channel;
  - a relative axis without a domain.
- **Domains on period channels:** an *inherited* view-level domain (e.g. a root `xDomain` in absolute time) is replaced by the period silently; only a domain on the channel itself warns.
- **Axis context tick:** the center "context" tick is now drawn only on absolute axes; on period and relative axes it marked nothing.
- **Example data:** the WHO examples read dates from `ISO_YEAR` + `ISO_WEEK` (as approved), so the converted date sits in the field `ISO_YEAR`. This is how `csv-time` stores component dates; the examples' comments say so, and the readable period field is `year` / `season`.

## Limitations

- **Period**
  - no custom domain (v1; zoom, brushes or `start` instead);
  - no non-calendar periods (e.g. a 7-day cycle from an arbitrary day, lunar months);
  - non-leap years leave a one-day gap at Feb 29;
  - week-based seasons count weeks from their start: a season without a week 53 leaves the last slot empty, and after a week 53 the weeks of the new year are one slot later than in other seasons (the axis labels follow 52-week seasons).
- **Relative**
  - `groupby` and anchor fields must be data columns (or `{ period }`), not `dataTransform` outputs, because anchors are computed before tiling;
  - month and year offsets use nominal lengths;
  - no time warping between two events;
  - no anchors from another data source.
- **`timeUnit`**
  - exact only with `csv-time` / `json-time`; other sources aggregate per tile;
  - weighted means and interval overlap are not supported;
  - an interval is binned by its start: with `x.timeUnit`, intervals (`xe`) and link ends (`x1`) are assigned to tiles by the start of their unit, so a link whose start is far off-screen is not drawn;
  - a unit at the edge of the data is aggregated from the rows present (e.g. a yearly mean of two months): end domains on whole units where that matters.
- **Granularity rules**
  - the switch is abrupt (no transition animation);
  - only the unit switches, not mark or encoding.
- **Spans**
  - no duration axis; a span alone stays a quantitative field;
  - span ends on period axes are clipped, not split.
- **Linking:** links across coordinate systems are not mapped: each system keeps its own link. Highlighting matching windows of an absolute view from a period brush is future work.
- **Performance:** Gosling redraws every mark on each zoom or pan event. Tracks with tens of thousands of marks (e.g. per-second data) are slow to interact with; aggregate them with `timeUnit`.
- **Headers and legends:** only linear temporal tracks get a header strip, and only temporal rings get a center legend. Legends of other tracks are drawn as in Gosling. A legend lists at most one line of entries next to the title; very long legends are cut at the track's width.
- **Inherited, observed while making the examples (not changed)**
  - stacked bars with a nominal color misorder across tiles (the taxi example uses `row` instead);
  - a brush whose range lies outside a zoomed view leaves a thin vertical line;
  - y-axis tick labels are drawn under the marks of the track, so tall bars and areas can cover them (e.g. FitBit cycles zoomed in);
  - linear axes of genomic tracks keep their label behavior (only temporal axes were changed).
- **Out of scope as agreed:** temporal y / vertical time axes; rewriting the paper. No HiGlass internals were refactored.

## Housekeeping

- The temporary worktrees of `fix/temporal-bugs` and of earlier commits used for the regression renders and the bisection were removed.
- Playwright was installed in the session scratch directory, as in Phase 1; the branch does not change how it is installed.
