# Review: branch `feat/temporal-grammar`

Independent review of `feat/temporal-grammar` (`89b7e7c`) against `fix/temporal-bugs` (merge base `fd22d23`), checked against [temporal-grammar-design.md](temporal-grammar-design.md) and [temporal-grammar-report.md](temporal-grammar-report.md). No code was modified. All probes ran in throwaway git worktrees, which have been removed.

## Summary

- **The report's core claims hold.** These were confirmed independently:
  - tile-exact aggregation;
  - ISO week 1 at the start of the ring;
  - date-string and duration resolution;
  - granularity switching at zoom thresholds;
  - relative anchors;
  - period splitting;
  - calendar spans;
  - refusal of links across coordinate systems;
  - identical compile output for every genomic example.
- **Blockers: none.**
- **Should fix: 9.** The most important are:
  - a wrong-output bug for `timeUnit: "quarter"` inside a shifted year;
  - links that are dropped depending on view order;
  - an undocumented behavior change in the upstream genomic `displace` path after zoom or pan;
  - week-based axis labels that overlap at a modest zoom in the headline WHO example;
  - temporal-only properties on genomic channels that are accepted silently, although the report says they warn.
- **Minor: 10**, plus code-quality and test-quality notes.

| Check | Result |
|---|---|
| `npx vitest run` | 379 passed, 0 failed (base `fd22d23`: 229, as reported) |
| `npx tsc --noEmit` | clean |
| Merge with current `fix/temporal-bugs` (`dde1019`) | clean (base moved by docs only) |
| Compile output, 57 genomic/doc examples, base vs branch | identical after ID normalization (MATRIX differs only in its random demo data) |
| Compile output, 9 earlier temporal examples | differ only by an added `timeCoordinates: {kind: "absolute"}` axis option |
| Pixel diff, 6 examples incl. zoom + pan | genomic static renders identical; **`MARK_DISPLACEMENT` differs after zoom/pan** (S3) |
| Console, 5 new examples at load and during interaction | no errors from time-i-gram; only the usual React/HiGlass warnings already in `temporal-grammar-report/console.json` |

## 1. Claims verified independently

Each claim was re-checked with a new test or render. Pre-existing tests were not reused as evidence.

| # | Claim | How I checked | Result |
|---|---|---|---|
| 1 | Tile-exact aggregation | Mapped 3 years of daily rows into a `period: "year"` system, cut the reference year at an arbitrary tile edge (17 June), filtered with `filterByTimeUnits` + `isRowInTile`, binned per tile. Also zoomed the taxi hourly-count view in the browser | Holds. All 36 (month, year) pairs come out exactly once, e.g. June 2011 = 30. In the browser, the taxi 12:00 bar (~6,400) is the same at default zoom and when zoomed to 3 hours |
| 2 | ISO week 1 at the start of the ring | `toPeriodCoordinate` / `periodKey` for 2013-12-30, 2015-12-28, 2016-01-03, 2016-01-04, plus `timeAxisTicks` | Holds. 2014-W01 (Mon 2013-12-30) is at the ring start and keyed `"2014"`. 2015-W53 is slot 53. The first tick is `W1` at the ring start |
| 3 | Links refused across coordinate systems | Compiled ring (period, brush) + linear period view + absolute view on one `linkingId`, then inspected `brush-track.fromViewUid` and `zoomLocks` | Holds when the ring is listed first: the brush targets the period view, the absolute view is unlocked, and a warning is logged. **Fails for the valid pair when the absolute view is listed first** (S2) |
| 4 | Genomic rendering unchanged | Compiled every editor example on both branches and diffed the JSON; pixel-diffed renders before and after zoom/pan | Compile: holds. Render: holds at load; **not after interaction for `MARK_DISPLACEMENT`** (S3) |
| 5 | `["2000-01","2010-12"]` → `[946684800, 1293840000]` | `parseTimeValue` | Holds |
| 6 | `"3 months"` = 3 × 30.436875 days; signed durations | `parseDuration` | Holds |
| 7 | Exactly one rule copy visible at any span | Compiled a 3-rule list and evaluated the generated `visibility` at 1 s, exactly `3 months`, `3 months`+1 s, exactly `2 years`, and 10¹⁰ s. Zoomed the unemployment example across 4 years in the browser | Holds. Yearly at ~4.7 years visible, monthly at ~3.1. Both zoom limits (`6 months`, `20 years`) work |
| 8 | Relative anchors: argmax ties → earliest; groups without an anchor dropped | `relativeAnchors` / `applyTimeCoordinates` on tied and NaN rows | Holds |
| 9 | Intervals split at period boundaries, one key per piece | 2010-12-30 → 2011-01-02 in `period: "year"` | Holds (two rows, `2010` / `2011`, end at the reference end) |
| 10 | Spans on the calendar: 31 Jan + 1 month = 29 Feb 2000 | `addSpan` | Holds |
| 11 | Leap reference year; pre-1970 | 1 Mar 2011 vs 2012 positions; 1918-09-15 through the `csv-time` fetcher into a year ring | Holds (keys `1918`, `1969`; positions in the 2000 reference year) |

## 2. Findings

### Blockers

None found.

### Should fix

**S1. `timeUnit: "quarter"` inside a shifted year (`period: { unit: "year", start: m }`, m ∉ {1, 4, 7, 10}) puts rows in the wrong place and produces bins whose end is before their start.**
`unitsWithinPeriod` ([time-coordinate-system.ts:493](../src/core/utils/time-coordinate-system.ts#L493)) allows `quarter` for every calendar year, but quarters only nest in a year that starts on a quarter boundary. With `start: 8`, the quarter Jul–Sep straddles the season boundary:
- a row on 2010-08-15 sits at the start of the ring (1999-08-15 in the reference);
- its bin starts at the *end* of the ring (2000-07-01);
- its bin ends at 1999-10-01, i.e. before the bin starts.

Bars render inverted or wrapped, and August–September data of season *n* is drawn at July of the ring.
*Repro:*
```ts
const cs = periodCoordinates({ unit: 'year', start: 8 });
unitStartCoordinate(Date.UTC(2010, 7, 15) / 1000, 'quarter', cs); // 2000-07-01 (end of ring)
unitEndCoordinate(Date.UTC(2010, 7, 15) / 1000, 'quarter', cs);   // 1999-10-01 (start of ring)
```
*Fix:* allow `quarter` only when `(start - 1) % 3 === 0`, otherwise warn and ignore it, as for the other units.

**S2. With mixed coordinate systems, links are kept or dropped depending on view order, so a valid period↔period link can be lost.**
`filterLinksByCoordinates` ([linking.ts:92](../src/core/utils/linking.ts#L92)) gives a `linkingId` the system of its first member. If an absolute view comes first, *both* period views are removed: the ring loses its brush, and the two period views are no longer linked to each other.
*Repro:* compile `views: [absolute, ring(period year, brush L), linearPeriod(L)]`. Result:
- the ring view has no `brush-track`;
- `zoomLocks` contains only the absolute view;
- the warning says "the views in period (year) are not linked".

With the order `[ring, linearPeriod, absolute]`, everything works as described.
*Fix:* partition each `linkingId` by signature (`linkId|signature`) so that every compatible group stays linked, and warn once per `linkingId`. The design (§2.5) says the *mismatched* views are left out; this implementation leaves out whoever is not first.

**S3. The upstream genomic `displace` path behaves differently after zoom and pan (unclaimed, untested).**
The report says "the upstream `displace` path is unchanged". At load `MARK_DISPLACEMENT` is pixel-identical, and base-vs-base noise is 0%. After interaction it is not:
- after 4 wheel steps in, 2.7% of pixels differ, because transcripts are packed into different rows;
- after a 150 px pan, 1.2% differ: **base draws an empty track and this branch draws the transcripts**;
- after zooming back out, the renders are identical again.

The behavior is reproducible with 8 s waits. The cause is the new reset loop and the `ownTabularData` handling in `combineAllTilesIfNeeded` ([gosling-track.ts:796](../src/tracks/gosling-track/gosling-track.ts#L796)), which also run for `displace` tracks. This looks like an *improvement*: base re-merged already-merged tiles. Still, it changes an upstream Gosling feature.
*Repro:* open `?example=MARK_DISPLACEMENT&full=true` on both branches, wheel-zoom 4 steps at (600, 350), then drag from (600, 350) to (450, 350).
*Fix:* either keep `displace` on the old path, or keep the fix but say so in the report, add a test, and consider proposing it upstream separately.

**S4. Week-based period axis: labels overlap once fewer than 6 weeks are visible.**
Below 6 weeks, `weekBasedTicks` ([time-axis-ticks.ts:189](../src/tracks/unix-time-track/time-axis-ticks.ts#L189)) uses `scaleUtc().ticks(10)` with labels like `W27 Tue` / `Tue 12:00`. It does not take label width into account, so on the 420 px linear view of the WHO example the axis reads `W26 SuW27 TuW27 ThW27 SaW28 MoW28 We…`.
*Repro:* in `TEMPORAL_DATA_WHO_FLU_PERIOD`, wheel-zoom 16 steps on the linear view at (716, 350).
*Fix:* derive the tick count from the axis width (as other Gosling axes do), and use short labels (`Tue`) except at week starts.

**S5. `period`, `timeUnit`, `relative` and rule lists on a genomic x channel are accepted silently.**
The report says "anywhere else they are ignored with a warning". The design says they are a validation error. In fact the schema accepts all four on `type: "genomic"`, and `resolveTemporalSugar` only looks at temporal tracks ([temporal-preprocess.ts:95](../src/compiler/temporal-preprocess.ts#L95)). The result is 0 warnings, and the properties remain in the compiled spec.
*Repro:* compile `{ tracks: [{ data: csv, mark: 'point', x: { field: 'p', type: 'genomic', period: 'year' } }] }` (same for `timeUnit: 'month'`, `relative: { anchor: 'first' }`, `timeUnit: [{ unit: 'month' }]`). `validateGoslingSpec` returns `success` and no `[time-i-gram]` warning is logged.
*Fix:* warn and delete these properties in `resolveTrack` when `!isTemporal`. Or, better, restrict them in the schema with an `if type = temporal` condition.

**S6. Zooming a period ring draws data from outside the visible arc as spurious strokes.**
After 6 wheel steps on the WHO ring, the ring shows W19–W37 over 360°. The 2014 line then draws a radial stroke across the ring at the W37/W19 seam, out to the outer radius. These are rows outside the visible arc, mapped to angles beyond 360°. Linear layouts mask such rows; circular ones wrap them. This is probably inherited from Gosling's circular zoom, which I did not check on base, and the new tile combining for lines does not filter rows to the visible domain. It matters here because a "zoomable cyclic view" is the paper's headline claim (design §2.7).
*Repro:* in `TEMPORAL_DATA_WHO_FLU_PERIOD`, wheel-zoom 6 steps at the ring centre (306, 347).
*Fix:* for circular tracks, drop or clip rows whose x lies outside the current x-scale domain before drawing lines and areas.

**S7. Period axes zoomed out past the period: ticks before the period are labeled, ticks after it are not.**
`periodTicks` keeps ticks `< refEnd` but does not drop those `< refStart` ([time-axis-ticks.ts:170](../src/tracks/unix-time-track/time-axis-ticks.ts#L170)). So a zoomed-out `period: "day"` axis reads `00:00 00:00 00:00 00:00 00:00` across the empty days before the reference day and nothing after it. Period views also have no default zoom limit, so the whole period can shrink to a few pixels. The week-based axis then shows `W1` and `W27` one pixel apart.
*Repro:* in `TEMPORAL_DATA_FITBIT_CYCLES`, wheel 40 steps out on the right view. Or in `TEMPORAL_DATA_TAXI_SPANS`, wheel 30 steps out on the bottom view.
*Fix:* filter ticks to `[refStart, refEnd)`, and default `zoomLimits` on period views to `[…, period length]`.

**S8. Granularity rule lists that reduce to zero rules delete the track.**
`timeUnit: []` is schema-valid, logs no warning, and leaves `overlay: []`, so the track silently disappears. An all-invalid list (e.g. `[{ unit: "fortnight" }]`) does the same after a warning. The cause is `expandGranularityRules` ([temporal-preprocess.ts:210](../src/compiler/temporal-preprocess.ts#L210)).
*Repro:* compile a temporal line track with `x.timeUnit: []` and inspect `gs.tracks[0].overlay.length` (it is `0`).
*Fix:* if no valid rule remains, warn and fall back to the raw track (`timeUnit` removed). Add `minItems: 1` to the schema.

**S9. Aggregating a partial unit at the edge of the data looks like a full unit.**
The unemployment data ends in February 2010, so the "2010" yearly mean averages January–February only, the seasonal high. Construction's 2010 point therefore goes past the explicit y-domain `[0, 25]` and is clipped at the top of both views. This is correct per the semantics, but misleading in a figure labeled "yearly means".
*Repro:* `TEMPORAL_DATA_UNEMPLOYMENT_GRANULARITY` at load (overview, right edge), or zoom the detail view out to 20 years.
*Fix:* in the example, end the domain at `2009-12` or filter the data to whole years. In the report's semantics, state that edge units are aggregated from the rows present.

### Minor

**M1. Full-period ring brush has a ~20° notch.**
When the linked linear view shows the entire period, the ring's brush is drawn from W1 to about W50 instead of the full circle. It is visible in the report's own `who-flu-period.png` and in a 1918 test ring. This is probably the existing circular brush when its extent is about 2π. Reproduce by loading `TEMPORAL_DATA_WHO_FLU_PERIOD`.

**M2. Report inaccuracy on week-based seasons.**
The report says "week-based seasons without a week 53 leave the last week empty". With `start ≠ 1`, the empty slot is in the *middle* of the season, between W52 and W1, because `toPeriodCoordinate` reserves slot 53 − start. For a flu season from W40 that is just before the usual peak. Either fix the wording or move the gap to the end.

**M3. Domains of the wrong kind are accepted silently.**
- A relative axis that inherits a view `xDomain` of dates gets absolute seconds (`[1199145600, 1293840000]`) as offsets, which gives a blank view.
- An absolute axis with `domain: ["10 years", "20 years"]` becomes 1980–1990.
- A reversed domain (`["2012", "2010"]`) and a zero-width date-time domain also pass without a warning.

See `resolveInterval` and `resolveTimeCoordinates` in [temporal-preprocess.ts](../src/compiler/temporal-preprocess.ts).

**M4. Interval splitting stops silently at 1,000 pieces.**
`MAX_PIECES` ([time-coordinate-system.ts:356](../src/core/utils/time-coordinate-system.ts#L356)) is never reported. An interval of 1,500 days on a `period: "day"` axis yields 1,000 rows (last key `2012-09-26`), and the remaining 500 days are dropped without a warning.

**M5. Skipped tiles still aggregate partial units.**
This is a code-level concern; I could not produce a visible effect. When tiles are combined (temporal lines), the non-first tiles are still transformed with the union bounds, i.e. with their own partial rows, by `#rowsOfTileForTimeUnit` ([gosling-track.ts:951](../src/tracks/gosling-track/gosling-track.ts#L951)) and `processAllTiles` ([gosling-track.ts:549-551](../src/tracks/gosling-track/gosling-track.ts#L549-L551)). Their partial aggregates go into `shareScaleAcrossTracks` and the `rawData` API. With `mean`/`median` and no y-domain, this can inflate the auto y-domain.
- A side-by-side line-vs-point probe (yearly mean, no y-domain, 3 zoom states) showed equal axes, so the effect is at most rare.
- Skipping `transformDataAndCreateModels` for `skipRendering` tiles would remove it and save work.

**M6. Warnings that fire once per page.**
`hasWarnedNegativeSpan` and `hasWarnedClippedSpan` are module-level ([data-transform.ts:107](../src/core/utils/data-transform.ts#L107), [time-coordinate-system.ts:563](../src/core/utils/time-coordinate-system.ts#L563)). After the first spec, later specs in the same page (e.g. the editor) never warn again.

**M7. Relative axis labels crowd on narrow tracks.**
`relativeTicks` always asks for 10 ticks. At 380 px, `−3 d −2.5 d … +3` overlap and the last label is clipped. The absolute axis has the same limitation (inherited); see the edge-case table, E3.

**M8. Internal names leak into the compiled spec.**
Internal fields (`_timeCoordinates`, `_timeUnit`, `_timeUnitTiling`) and rewritten field names (`__period_date`, `__month_date`) are visible through the JS API's track specs and the editor's compiled spec. Anything that reads `x.field` from the compiled spec, such as tooltips configured by field name in downstream tools, sees internal names. Consider documenting this, or keeping the user-facing `x.field` and storing the coordinate field separately.

**M9. Label collisions in the new examples.**
Most of these are from existing Gosling axes and legends, but they show in the screenshots intended for the paper:
- WHO ring: `W1` collides with the radial y-axis label `10000`; after zooming the ring, `W19` collides with `10000`;
- linear views: the first x label and the top y label are clipped (`/1`, `14000`);
- the track titles overlap the top y label;
- the legends cover data (unemployment, taxi);
- the FitBit week ring's labels (`Sun 12:00`, `Sat 12:00`, `Thu 12:00`) sit on top of points;
- taxi arcs longer than about 20 minutes are clipped at the track top.

**M10. With `x.timeUnit`, intervals are assigned to tiles by their start only.**
With `x.timeUnit`, `gosling-to-higlass` passes only `x` to the fetcher ([gosling-to-higlass.ts:157](../src/compiler/gosling-to-higlass.ts#L157)). Intervals (`xe`) and `withinLink` ends (`x1`) are therefore assigned to tiles by unit start only. This is documented ("an interval is binned by its start"), but a link whose start is far off-screen will not be drawn. Worth one sentence in Limitations.

## 3. Edge cases

Rendered in the browser through a scratch example (`json-time` inline data). Pure functions were also probed directly.

| Case | Result |
|---|---|
| E1 Empty data (period ring, relative axis, `csv-time` header-only, `binByTimeUnit([])`) | OK: empty tracks, axes drawn, no console errors |
| E2 Single row (`timeUnit` month + mean; relative `"first"`) | OK: point at 2010-03-01, and at offset 0. The auto y-domain puts the point on the top edge (inherited) |
| E3 Data before 1970 (1918–1921 monthly sums; 1918 on a year ring; `floorTime` day/week/decade before the epoch) | OK: correct bins and keys. The absolute axis labels overlap at 380 px (inherited, M7) |
| E4 Domain starting and ending in the same unit (`["2010","2010"]`, `["2010-05","2010-05"]`, `["2010-05-03","2010-05-03"]`) | OK: whole year, month, or day. A date-time with start = end gives a zero-width domain with no warning (M3) |
| E5 Period spec in a circular view with a brush (calendar year; week-based with `start: 40`; linked to an absolute view) | Works within one system. Linked to absolute: refused with a warning. The full-period brush has a notch (M1). The order bug is S2 |
| E6 Granularity rules with one rule (`[{month}]`, `[{month, maxSpan}]`, `[{none}]`) | OK: one copy, no visibility bounds, the dangling `maxSpan` is dropped. `[]` deletes the track (S8) |
| `quarter` in a shifted year | Wrong (S1) |

## 4. Do the tests test behavior?

Mostly yes for the pure modules, less for the track:

- **Good:** `time-units`, `time-coordinate-system`, `time-unit-aggregation` and `temporal-preprocess` assert values, not just that functions run. The `csv-time` tile test uses real HiGlass tile ids and shows that naive per-tile aggregation would be wrong.
- **Weak:**
  - `gosling-track.test.ts` only tests the predicate `drawsTemporalLines`. Nothing tests that tiles are combined, that `#rowsOfTileForTimeUnit` picks the right rows, or that the `displace` path is unaffected, which is where S3 lives.
  - The tile-exact track side is re-implemented in the test with `isRowInTile` rather than run through the track.
  - `temporal-examples.test.ts` (+15) checks schema validity, explicit domains and data presence, not rendered behavior.
  - The linking tests count locks but never check a brush across systems, which is the main use case, or view order (S2).
- **Missing:**
  - genomic misuse of the new properties (S5);
  - `quarter` with `start` (S1);
  - an empty rule list (S8);
  - tick filtering outside the period (S7);
  - a render-level regression test for an interactive genomic example (S3).

## 5. Code quality and upstream risk

- **Duplicated helpers:**
  - `utc()` is defined in both [time-units.ts:57](../src/core/utils/time-units.ts#L57) and [time-coordinate-system.ts:115](../src/core/utils/time-coordinate-system.ts#L115);
  - `DAY`/`WEEK` are defined in three files, in two different units (seconds vs milliseconds in `time-axis-ticks.ts`);
  - `WEEKS_IN_REF_YEAR = 53` is defined in two files, and the axis and the mapping must agree;
  - the fetcher config type extension and the `timeUnitTiling ? filterByTimeUnits : filterUsingGenoPos` branch are copy-pasted in both time fetchers.

  Export these from one place.
- **Layering:** `core/utils/linking.ts` imports `../../gosling-schema/validate` by relative path, while the rest of the code uses `@gosling-lang/gosling-schema`. This invites two module instances and circular imports.
- **Upstream blast radius:**
  - `drawsTemporalLines` turns on tile combining for *every* temporal line or area track, including the nine earlier examples. Each draw now processes all visible rows in one tile, which the report notes.
  - The `combineAllTilesIfNeeded` changes reach `displace` (S3).
  - The early return in `drawTile` ([gosling-track.ts:391](../src/tracks/gosling-track/gosling-track.ts#L391)) depends on `#combinedTileBounds` being reset at the start of every combine. That is correct today, but brittle.
- **Spec mutation:** `resolveTemporalSugar` mutates the spec in place and relies on internal markers for idempotence, since it runs twice for responsive specs. It works and is tested, but a future pass that copies tracks without the `_` fields would re-resolve them. A single "resolved" flag on the spec would be sturdier.
- **Schema vs runtime:** semantic errors are runtime warnings, not schema errors (a documented deviation). Combined with S5, the editor's validation badge says "success" for specs that do nothing.

## 6. Not checked

- Performance with large datasets (the taxi example loads the full CSV; it rendered within the 5 s wait).
- Circular brush and circular zoom behavior on the base branch, to confirm that S6 and M1 are inherited.
- Browsers other than headless Chromium; time zones other than the machine's (all code is UTC, and the fetcher tests passed).
- The paper text and README examples beyond schema validity.
