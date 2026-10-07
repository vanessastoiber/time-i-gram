# time-i-gram: paper ↔ code grammar audit

Audit date: 2026-10-07. Scope: the paper "time-i-gram: A Grammar for Interactive Visualization of Time-based Data" (VIS 2026 submission, rejected) against this repository.

## 0. Method and evidence base

- **Paper.** The PDF supplied with the audit request. `paper/time-i-gram.pdf` does not exist in the repo.
- **Upstream baseline.** This repo is a *fork of the Gosling.js repository itself*, not a package that depends on it. `package.json` still reads `"name": "gosling.js", "version": "0.10.2"`. The last upstream commit is `98b5b88` ("v0.10.2", 2023-09-22, Sehi L'Yi). All time-i-gram work is in the 31 commits after it (2023-10-20 → 2026-03-13). Every NEW, MODIFIED or INHERITED status below comes from `git diff 98b5b88 HEAD`, plus the uncommitted working tree. NEW and MODIFIED are therefore verified; there was no need to compare against a separate Gosling copy in `node_modules`.
  - Files changed relative to upstream: 32 files, about +1,960 / −117 lines (see §5). About 80% of that is three new files: two data fetchers and one axis track.
- **Working tree.** The audit includes three uncommitted changes: fixes to both time data fetchers, plus a new example `editor/example/spec/temporal-data_unemployment-circular-linear.ts`. Line numbers for `src/data-fetchers/*-time-data-fetcher.ts` refer to the working tree.
- **Runtime checks:**
  1. `tsc --noEmit` passes with no errors.
  2. Every temporal example spec was validated against `src/gosling-schema/gosling.schema.json` with Ajv, the same validator the library uses.
  3. Each fetcher's date parser was re-run on the real example datasets.
  4. Every example was rendered headlessly (Playwright / Chromium) in the dev editor, and the README running example through `embed()`. Screenshots stayed in a scratch directory and are not committed.
- **Environment caveat.** `yarn start` fails dependency pre-bundling in this checkout. The `uuid` alias in `vite.config.js:67` (upstream code) also captures `uuid/v4`, which `higlass-text`'s `slugid` requires, so every module returns HTTP 504. The renders used a temporary Vite config outside the repo that anchors that alias. **No repository file was modified.**
- **Not verifiable here.** The paper's Fig 1 A/B/C and Fig 5 specifications, the OSF supplementary material (Figs S1–S8) and the Observable notebook. None of these specs is in the repo. Claims that depend on them are flagged "unverified".

Status vocabulary used below:
- **NEW**: added by time-i-gram (absent at `98b5b88`).
- **MODIFIED**: exists upstream, changed by time-i-gram.
- **INHERITED**: unchanged from Gosling.js v0.10.2.
- **NOT IMPLEMENTED**: named in the paper, with no corresponding code or syntax.

---

## 1. Concept-to-code mapping table

Component letters follow **Figure 3 as printed** (A Data types, B Marks, C Channels, D Scales, E Layouts, F Interaction). The section text uses different letters; see §3.1.

### A. Data types & variables

| Concept (paper) | Comp. | JSON syntax | Implemented at | Status | Notes |
|---|---|---|---|---|---|
| Temporal field type (implicit in §3.1, §3.4) | A/D | `x: { field, type: "temporal" }` | `src/gosling-schema/gosling.schema.ts:741,759,859`; `src/gosling-schema/validate.ts:51-53,90-132` | NEW | The only new *field type*. Validation is relaxed so a track may have a temporal channel instead of a genomic one. |
| CSV time data source (paper: "`type: csv-file`") | A | `data: { type: "csv-time", url, separator?, dateFields?, timestampField?, dayFirstDate?, yearFirstDate?, includesCalendarWeek?, interval?, sampleLength? }` | schema `gosling.schema.ts:964-984`; fetcher `src/data-fetchers/csv/csv-time-data-fetcher.ts` | NEW | The paper's name `csv-file` does not exist; the type is `csv-time`. `url` is required; there is no inline-values option. |
| JSON time data source | A | `data: { type: "json-time", url? \| values?, dateFields?, timestampField?, sampleLength? }` | schema `gosling.schema.ts:944-962`; fetcher `src/data-fetchers/json/json-time-data-fetcher.ts` | NEW | Supports inline `values` or a `url`. |
| Date given as a single column ("full date, date-time string") | A | `dateFields: ["<col>"]` | `csv-time-data-fetcher.ts:120-148,162-164,199-202` | NEW | **CSV:** date-only strings are read as `MM-DD-YYYY` by default (`:139`). ISO `YYYY-MM-DD` needs `yearFirstDate: true`; without it every row silently becomes `1970-01-01` (`:146`). Strings containing `T` or `:` go straight to `Date.parse`. Accepted years are 1900–2099 (regex `:142`), so pre-1900 dates also become 1970. **JSON:** a single date column is *not* supported: `processRow` only reads keys literally named `year`/`month`/`day` (`json-time-data-fetcher.ts:100-117`), so `dateFields: ["date"]` puts every row at about epoch 0. |
| Date components across columns | A | CSV: `dateFields: ["year","month","day","hour","minute","second"]` (3+ entries). JSON: `dateFields: ["year","month"(,"day")]` | `csv-time-data-fetcher.ts:179-189`; `json-time-data-fetcher.ts:100-117` | NEW | Columns must be *named* exactly `year`, `month`, `day`, `hour`, `minute`, `second`; the field name is the lookup key (`csv…:181-184`). The result overwrites `row[dateFields[0]]`, so the x channel must name the first field, e.g. `x.field: "year"` in the JSON examples. |
| Date + time-of-day columns | A | `dateFields: ["<date>", "<HH:MM:SS>"]` | `csv-time-data-fetcher.ts:165-168` | NEW | Combined into `YYYY-MM-DDTHH:MM:SS` and parsed in the **browser's local time zone**. Date-only strings parse as UTC, and the axis renders UTC (`unix-time-track.ts:101`), so time-of-day data shifts by the local UTC offset. |
| Unix timestamp | A | `timestampField: "<col>"` | `csv-time-data-fetcher.ts:40-44`; `json-time-data-fetcher.ts:44-46,59-62` | NEW | Values must be **epoch seconds**: the axis multiplies by 1000 (`unix-time-track.ts:102`), so millisecond timestamps land 1000× too far out. CSV accepts any number. **JSON bug:** it tests `row.timestampField` (the literal property name) rather than `row[timestampField]`, so the branch never fires. Also, in the `url` branch, rows that took it would be returned but never stored (`:45-47`). |
| Calendar-week dates | A | `dateFields: ["<year>","<week>"], includesCalendarWeek: true` | `csv-time-data-fetcher.ts:170-172,214-229` | NEW | Converts to the Monday of that week, using local-time `Date`. Not mentioned in the paper. |
| Day-first / year-first date order | A | `dayFirstDate: true` / `yearFirstDate: true` | `csv-time-data-fetcher.ts:139` | NEW | Not mentioned in the paper. Without either flag the parser assumes US order. |
| Time primitive: **Instant** | A | One converted time field → `x` | (generic x encoding) | NEW (field type) / INHERITED (encoding) | No `instant` keyword exists; an instant is simply a row with one time value on `x`. |
| Time primitive: **Interval** | A | Two converted time fields → `x` and `xe` (e.g. `mark: "rect"`, `"bar"` or `"withinLink"`) | encoding INHERITED (`x`/`xe`, `ChannelTypes` `gosling.schema.ts:712-731`); CSV conversion of two fields `csv-time-data-fetcher.ts:173-177` | INHERITED (+ NEW parsing) | No `interval` type. Note that `dateFields` with exactly two entries converts both fields *only* if the second is neither `HH:MM:SS` nor (with the flag) a calendar week. The CSV option `interval: [start, end]` (`:46-59`) is **broken** for non-timestamp strings: `[...intervalSpec[0]]` spreads the column *name* into characters (`:53-54`). |
| Time primitive: **Span** | A | none | none | NOT IMPLEMENTED | A duration with no anchor has no representation. It can only be stored as an ordinary quantitative field. |
| Granularity (millisecond → decade) | A | none | Tick labels: `unix-time-track.ts:99-134` (d3 `scaleUtc().ticks()/.tickFormat()`) | NOT IMPLEMENTED as syntax | There is no `granularity`, `timeUnit` or bin-by-calendar-unit property. Tick units are chosen automatically from the visible span by d3's multi-scale UTC formatter. The constants `ZOOM_LEVEL_YEAR/WEEK/DAY` and `calculateZoomLevel()` (`unix-time-track.ts:22-24,252-263`) are dead code and never called. |
| Data values: numerical | A | `type: "quantitative"` | INHERITED | INHERITED | |
| Data values: categorical | A | `type: "nominal"` | INHERITED | INHERITED | Gosling has no separate `ordinal` type. |
| Year-boundary helper transform | A | `dataTransform: [{ type: "interval", field, yearField, weekField, transformedDateField, newField }]` | schema `gosling.schema.ts:1321-1328`; `src/core/utils/data-transform.ts:56-80`; dispatched at `src/tracks/gosling-track/gosling-track.ts:893-895` | NEW | Not in the paper. It sorts rows by year and week, then on the last row of each year writes the next year's first date into `newField`, which yields year-long intervals for `x`/`xe`. `field` is required but never read. Originally committed as "spantransform" (`0eac54f`). |
| Row sampling | A | `sampleLength` (default 1000) | `csv-time-data-fetcher.ts:295-298`; `json-time-data-fetcher.ts:187-190` | NEW (copied from Gosling's csv/json fetchers) | Applies a **random** `lodash.sampleSize` per tile, *before* `dataTransform` filters. The 1,708-row unemployment JSON loses about 41% of its rows at random unless `sampleLength` is raised (the README sets 2000; the editor examples don't). |

### B. Visual marks

| Concept | Comp. | JSON syntax | Implemented at | Status | Notes |
|---|---|---|---|---|---|
| Item mark: line | B | `mark: "line"` | `src/core/mark/line.ts` | MODIFIED | Only change: the circular start/end angles are swapped (`line.ts:72-79`) for the new clockwise direction (see E). |
| Item mark: point | B | `mark: "point"` | `src/core/mark/point.ts` | INHERITED | |
| Item mark: area | B | `mark: "area"` | `src/core/mark/area.ts` | INHERITED (**broken for temporal when stacked**) | The stacked path (`area.ts:50-56`) requires a *genomic* channel and returns early with "Genomic field is not provided" for temporal `x`. An area whose `color` is a nominal field is stacked by default, so the README's overlaid area tracks draw nothing (confirmed in render). |
| Item mark: bars | B | `mark: "bar"` | `src/core/mark/bar.ts:66-72` | MODIFIED | Patched to group by the temporal field when there is no genomic channel. |
| Item mark: rect / text / rule / triangles | B | `mark: "rect" \| "text" \| "rule" \| "triangleLeft" \| …` | `gosling.schema.ts:261-277` | INHERITED | Not named in the paper. Stacked `text` has the same genomic-only early return as stacked area (`src/core/mark/text.ts:50-61`). |
| Link mark: connection | B | `mark: "withinLink"` (arcs/bands from `x`→`xe`, `x1`→`x1e`) or `"betweenLink"` | `src/core/mark/withinLink.ts`, `betweenLink.ts` | INHERITED | The paper's taxi arcs (Fig 1C) would use `withinLink` with `x` = pickup and `xe` = dropoff. Unverified: no such spec in the repo. |
| Link mark: containment | B | none | none | NOT IMPLEMENTED | No enclosure or hull mark exists. |
| Brush (paper calls it a "mark") | B/F | `{ mark: "brush", x: { linkingId: "<id>" }, color?, stroke?, … }` inside an overlay | `src/tracks/gosling-brush/` (unchanged) | INHERITED (**circular case regressed**) | See F. |

### C. Visual channels

| Concept | Comp. | JSON syntax | Implemented at | Status | Notes |
|---|---|---|---|---|---|
| Position (x) | C | `x`, `xe`, `x1`, `x1e` | scale injection `src/core/mark/index.ts:64-67` | INHERITED (+ `temporal` type NEW) | At runtime, temporal `x` uses HiGlass's **linear** `_xScale` over epoch seconds, exactly like genomic `x`. The `ScaleTime` added in `gosling-track-model.ts:21,52,319` is a TypeScript cast only. |
| Position (y) | C | `y`, `ye` | `gosling-track-model.ts:808` | INHERITED | `type: "temporal"` on `y` passes schema validation, but `generateScales()` has no `temporal` branch (`:808-860`) and domain inference skips it (`:656`). **Temporal y produces no scale.** README.md:23 says time can go on "`x` or `y`"; only `x` works. |
| Color | C | `color: { field, type: "nominal" \| "quantitative", domain?, range?, legend? }` or `{ value }` | INHERITED | INHERITED | |
| Size | C | `size: { value }` or field | INHERITED | INHERITED | §3.3 "scalar size channel to control stroke weight" = `size: { value: n }` on line. |
| Shape | C | none (only via the choice of `mark`: point vs triangle*) | — | NOT IMPLEMENTED as a channel | `SUPPORTED_CHANNELS` (`src/core/mark/index.ts:27-46`) contains no `shape`. |
| Tilt | C | none | — | NOT IMPLEMENTED | No rotation or angle channel. |
| Opacity, stroke, strokeWidth, row, text | C | same names | `gosling.schema.ts:712-731` | INHERITED | Supported in code but absent from Fig 3. `row` provides faceting. |

### D. Scales

| Concept | Comp. | JSON syntax | Implemented at | Status | Notes |
|---|---|---|---|---|---|
| Data scale: quantitative | D | `type: "quantitative"`, `domain: [min,max]` | INHERITED | INHERITED | |
| Data scale: qualitative | D | `type: "nominal"`, `domain: [...]` | INHERITED | INHERITED | |
| Time scale: chronological | D | `x: { type: "temporal", domain: { interval: [s0, s1] } }` (epoch **seconds**) | schema `gosling.schema.ts:862,881-884`; compiler `src/compiler/gosling-to-higlass.ts:73-79` | NEW (thin) | `TimeInterval` duplicates the existing genomic `DomainInterval` field for field, including the doc comment "within entire chromosome" (`:882`). It is passed to HiGlass `initXDomain` exactly like a genomic interval. View-level `xDomain` (`:127`) is typed only as genomic, but accepts the same shape. |
| Time scale: relative | D | none | none | NOT IMPLEMENTED | No anchor, offset or align-to-event option exists. It can only be emulated by preprocessing the data. |
| `timeDomain` | D | none (a **JavaScript variable** in README.md:158, holding `{ interval: [...] }`) | — | — | Not a grammar construct. The paper presents it as one ("defined once as `timeDomain` and reused across all tracks"). Pure JSON has to repeat the domain on every track. |
| Time axis (implicit in §4: "Unix time track") | D | auto-created when a temporal channel has `axis` ≠ `"none"` | `src/compiler/gosling-to-higlass.ts:251-296`; `src/compiler/higlass-model.ts:379-447`; `src/tracks/unix-time-track/unix-time-track.ts`; registered `src/core/init.ts:78-86` | NEW | Axis track that labels ticks with d3 UTC formats; works in linear and circular layouts. Ignores theme font and colour options (hard-coded Arial 12, black: `unix-time-track.ts:66-67,74`). The circular label offset is hard-coded (`-100`, `:149`). The curved-label code is commented out, so circular labels are straight text (`:178-186`). A stray centre tick is drawn even when the context label is empty (it compares against `' '` instead of `''`, `:219`), visible as a double tick mid-axis in every render. |

### E. Layouts

| Concept | Comp. | JSON syntax | Implemented at | Status | Notes |
|---|---|---|---|---|---|
| Time: linear | E | `layout: "linear"` (default) | INHERITED | INHERITED | |
| Time: circular | E | `layout: "circular"`, plus `centerRadius`, `startAngle`/`endAngle` (internal) | INHERITED layout; direction MODIFIED in `src/core/utils/polar.ts:8-38`, `src/core/mark/axis.ts:262-303`, `src/tracks/gosling-genomic-axis/axis-track.ts:521,548`, `line.ts:72-79` | MODIFIED | The **only** time-specific change is a global switch from anticlockwise to clockwise, which also affects genomic circular plots. The whole x domain is mapped to one revolution; there is **no period parameter** (wrap by year, week or day). The brush was not updated for this change (see F). |
| Arrangement: vertical / horizontal | E | `arrangement: "vertical" \| "horizontal"` on a view with `views` | `src/compiler/bounding-box.ts:256-281` | INHERITED | |
| Arrangement: parallel / serial | E | `arrangement: "parallel" \| "serial"` | `bounding-box.ts:164-176,256-281,305-354` | INHERITED | In linear layouts `parallel` ≡ `vertical` and `serial` ≡ `horizontal`. They differ only when all children are circular: `parallel` nests them as concentric rings and `serial` splits one circle into angular sectors. Brushes are stripped from circular `parallel`/`serial` groups (`:349-354`). |
| Alignment (overlay / stack) | E | `alignment: "overlay" \| "stack"` (default `stack`) on a view or track group | `gosling.schema.ts:52-61` | INHERITED | Used in Fig 5 and in every example, but not defined in the paper. |
| Timeline: unified | E | not a keyword; overlay several series (`alignment: "overlay"` or a `color` field) on one track | — | INHERITED (by composition) | |
| Timeline: faceted | E | not a keyword; `row: { field, type: "nominal" }` or one track per filtered category | `ChannelTypes.row` `gosling.schema.ts:725` | INHERITED (by composition) | |
| Timeline: segmented (text) / cyclic (Fig 3) | E | none | — | NOT IMPLEMENTED | Nearest available: the NEW `interval` transform plus `rect` marks for year bands. |
| View/track composition (Fig 5) | E | `views: [...]`, `tracks: [...]`, nested | INHERITED | INHERITED | |

### F. Interaction

| Concept | Comp. | JSON syntax | Implemented at | Status | Notes |
|---|---|---|---|---|---|
| Brush | F | `{ mark: "brush", x: { linkingId } }` in an `overlay` group | `src/tracks/gosling-brush/brush-track.ts` (unchanged) | INHERITED | **Linear:** works on a temporal axis, and dragging updates linked views. In one run, though, the detail views' range (about 1995.5–2006) did not match the brushed interval (about 2000–2006); not diagnosed. **Circular:** `brush-track.ts:256-257` pairs the now-clockwise `valueToRadian` with `d3.arc`, so the shaded sector is the **mirror image** of the selection (selecting 2000–2006 shades 2005–2010). |
| `linkingId` (coordinated views) | F | `x: { linkingId }` or view-level `linkingId` | `src/compiler/spec-preprocess.ts:153,318-327`; `src/compiler/create-higlass-models.ts:59-81` | INHERITED | Compiles to HiGlass zoom and location locks. The lock seed values are hard-coded genomic constants (`[124625310.5, 124625310.5, 249250.621]`, `create-higlass-models.ts:79-80`). These may be why the brushed range is offset; unconfirmed. |
| Zoom & pan | F | default on; `static: true` disables; `zoomLimits: [min,max]` | `gosling.schema.ts:106-111` | INHERITED | |
| Semantic zoom | F | `visibility: [{ measure: "zoomLevel", operation, threshold, target }]` | `gosling.schema.ts:681-694`; `gosling-track.ts:358-363`; `gosling-track-model.ts:370-450` | INHERITED | `threshold` is the visible span in x units, i.e. **seconds** on a temporal axis. The schema doc still says "base pairs" (`:692`). |
| "Granularity transition rules" (§4) | F | none | none | NOT IMPLEMENTED | Only the inherited `visibility` rule above exists. |
| Stepped vs continuous (data manipulation) | F | none | — | NOT IMPLEMENTED as syntax | Taxonomy only. Nothing distinguishes them in the code. |
| Operators / operands (exploration & navigation) | F | none | — | NOT IMPLEMENTED as syntax | Taxonomy only. |
| Tooltip / mouse events | F | `tooltip: [...]`, `experimental.mouseEvents` | `gosling.schema.ts:411-418` | INHERITED | Not mentioned in the paper. |

### Section 4 implementation claims

| Concept | JSON syntax | Implemented at | Status | Notes |
|---|---|---|---|---|
| Tile-based multi-resolution fetching | — (implicit) | HiGlass (INHERITED); `tilesetInfo`/`tile` in both time fetchers | NEW fetchers, **no multi-resolution behaviour** | **JSON:** `tile()` ignores `x` and `z` and returns the *whole* dataset for every tile (`json-time-data-fetcher.ts:179-198`). **CSV:** filters rows to the tile's x-range, but its grid starts at 0 (`csv…:231-241`), so pre-1970 data never appears; `max_width` is a hard-coded constant. Neither fetcher aggregates by zoom level; both randomly subsample. |
| Python via Gos | — | external | unverified | Gos loads a Gosling.js bundle. Whether it can load this fork's `csv-time`/`json-time`/`temporal` was not checked. |

---

## 2. Inconsistencies between paper and code

### 2.1 Paper claims the code does not support, does differently, or names differently

1. **Data type name.** §3.1: *"It is declared as `type: csv-file, dateFields: [date]`."* The type is `csv-time` (`gosling.schema.ts:968`); `csv-file` would fail validation. The running example (README.md:150) uses `csv-time`.

2. **Flexible date specifications.** §4: *"two data fetchers … that accept flexible date specifications: a single timestamp column (as a full date, date-time string, or Unix timestamp) or date components distributed across multiple columns."* In practice:
   - **ISO dates in CSV.** An ISO date-only column (`2012-01-01`) parses as `1970-01-01` unless `yearFirstDate: true` is set (`csv-time-data-fetcher.ts:139,146`). This is why the Seattle example renders empty (§6).
   - **Year range.** Only 1900–2099 is accepted (`:142`). This contradicts commit `c7db4c3` "allow negative dates" and the JSON fetcher's ~1500 CE lower bound (`json-time-data-fetcher.ts:9`).
   - **JSON fetcher.** It cannot parse a single date column at all (`:100-117`).
   - **Component columns.** These must be named `year`, `month`, `day`, `hour`, `minute`, `second`.
   - **Timestamp units.** Unix timestamps must be seconds, and the JSON `timestampField` path is dead (`:45,60`).
   - **Time zones.** Date-time strings without a zone parse in local time, while the axis renders UTC.

3. **"Replaces" the genome track.** §4: *"The modification to the base system replaces Gosling's genome-coordinate track with a Unix time track."* Nothing is replaced. A *new axis track* is added (`higlass-model.ts:379-447`), and the data tracks still run through the genomic machinery:
   - HiGlass linear `_xScale`
   - `assembly: "unknown"` / `chromInfoPath` (`higlass-model.ts:402-405`)
   - the genomic tile filter `filterUsingGenoPos`
   - genomic zoom-lock constants

4. **Multi-resolution tiling.** §4: *"…tiles data analogously to a mapping platform — fetching only the resolution required by the current viewport."* True of HiGlass in general, but not of the time fetchers (§1, Section 4 table). The JSON fetcher returns everything for every tile, neither fetcher aggregates by resolution, and both randomly drop rows above `sampleLength` (default 1000). The abstract's "multi-scale encoding that spans orders of temporal magnitude" therefore rests on HiGlass zooming plus d3 tick formatting, not on data-level multi-resolution.

5. **Granularity transition rules.** §4: *"Semantic zooming is configured per-track through granularity transition rules in the specification."* No such syntax exists. The only mechanism is Gosling's inherited `visibility` with `measure: "zoomLevel"` and a threshold in seconds of visible span (used in `temporal-data_seattle-weather.ts:90-95,114-119`).

6. **Cyclic layout.** §3.5: *"…a cyclic layout that wraps the axis into a circle to reveal periodic structure"*. Abstract: *"native support for cyclic layouts that reveal periodic structure"*. §3.5: *"the overview uses a circular layout to display the decade as a ring, revealing annual cycles."* The code wraps the *entire domain once*. In the running example the decade is a single 360° sweep, so years are not aligned and annual cycles are not superimposed (confirmed in render). There is no period parameter. The only change to the circular layout is clockwise direction (`polar.ts:8-38`), which also changes genomic circular plots.

7. **Granularity hierarchy.** §3.1: *"These primitives are organized through a granularity hierarchy from milliseconds to decades."* No granularity concept exists in the data model or the syntax (§1 A). Precision is whatever survives conversion to epoch seconds. Axis tick units come automatically from d3.

8. **Relative time scale.** §3.4: *"Time scales … are defined as either chronological or relative. … Relative scales anchor timelines to a shared reference event."* Only chronological exists. There is no relative or anchor syntax.

9. **`timeDomain`.** §3.4: *"…a Unix timestamp domain [946713600, 1293782400] … defined once as `timeDomain` and reused across all tracks."* `timeDomain` is a JS `const` in the README (README.md:158), not grammar. The JSON key is `x.domain: { interval: [...] }`. Also:
   - The two values are **08:00 UTC** on 2000-01-01 and 2010-12-31, not midnight; they match the dataset's `T08:00:00Z` timestamps.
   - The unemployment data actually ends **2010-02-01**, so about 10 months of the domain are empty.

10. **Containment link marks.** §3.2: *"a containment mark encodes hierarchical relationships through enclosing areas."* Not implemented.

11. **Shape and tilt.** Fig 3 C lists Shape and Tilt as channels. Neither exists (`src/core/mark/index.ts:27-46`).

12. **Interaction categories.** §3.6 describes stepped vs continuous and operators vs operands. None of these is a grammar construct. The interaction syntax that exists is `mark: "brush"`, `linkingId`, `static`, `zoomLimits`, `visibility`, `tooltip` and `mouseEvents`, all inherited.

13. **Brush and link propagation.** §4: *"any brush or zoom event on one track propagates automatically to all tracks sharing that identifier."* Inherited behaviour, and it works on temporal axes. However, the circular brush draws the mirrored sector (`brush-track.ts:256-257`, a side effect of the clockwise change), and one linear run showed the detail range offset from the brush selection (§1 F).

14. **Running example vs repo example.** §3 and Fig 4 describe five sectors including *Finance*, two brushes (circular and timeline bar), and a vertical detail column with two sector panels. That matches README.md:143-266 (renders, see §6). The in-repo editor example `temporal-data_unemployment-circular-linear.ts` (uncommitted) differs: *Education and Health* instead of Finance, a single brush, one detail panel, and no timeline bar.

15. **Python support.** §4 says the prototype *"is additionally accessible from Python via the Gos library."* Unverified. Gos wraps upstream Gosling.js; nothing in this repo targets Gos.

16. **Usage-scenario specs.** §5 says complete specifications are in the supplementary material, *"Figures S3-S8"*. None of the scenario specs (influenza, solar PV, NYC taxi, Fig 5 heart rate) are in the repo, so their reproducibility from this codebase is unverified.

### 2.2 Things the code does that the paper does not mention

- **Data-source options.** `includesCalendarWeek`, `dayFirstDate`, `yearFirstDate`, `separator`, `sampleLength` on `csv-time`, and inline `values` on `json-time` (`gosling.schema.ts:944-984`).
- **The `interval` data transform** (`data-transform.ts:56-80`), which builds year-long intervals from ISO year/week data. This is probably what drives the year bands in Fig 1A; unverified.
- **Global behaviour changes to upstream Gosling, not limited to time:**
  - Circular layouts now run clockwise for *all* tracks, genomic included (`polar.ts`, `axis.ts`, `axis-track.ts`, `line.ts`).
  - `HIGLASS_AXIS_SIZE` changed from 30 to 45 for every axis (`higlass-model.ts:13`).
  - Gosling's JS-API `location` event is commented out for all tracks (`gosling-track.ts:472-483`, "TODO: Add condition"). This is a regression for genomic API users.
  - `preverseZoomStatus` is disabled (`src/core/gosling-component.tsx:140-144`), which reverts upstream fix #971: reactive spec updates now reset zoom.
- **The temporal channel joins aggregation** (`data-transform.ts:464`) and stacking (`gosling-track-model.ts:521-542`).
- **Leftovers and dead artifacts:**
  - `higlass-unix-time-track` is added as an npm dependency (`package.json`) but never imported; the repo ships its own version.
  - The exported-HTML template references two non-existent local scripts, `higlass-time-interval-track.js` and `higlass-unix-time-track.js` (`editor/html-template.ts:14-15`). It also loads upstream `gosling.js` from unpkg, which has no temporal support, so exported HTML cannot render time-i-gram specs.
- **Unsupported constructs that pass validation:**
  - Temporal on `y` (no scale).
  - The README's `genomicFields` on `csv-time` (schema warning, ignored).
  - Stacked `area`/`text` on a temporal axis, which silently draw nothing.

---

## 3. Internal inconsistencies in the paper

| # | Suspected issue | Verdict | Detail |
|---|---|---|---|
| 1 | Section 3 figure references shifted | **Confirmed** | Fig 3 is printed A–F: A Data types, B Marks, C Channels, D Scales, E Layouts, F Interaction. The text cites §3.2 marks → "Figure 3 C" (should be B), §3.3 channels → "3 D" (C), §3.4 scales → "3 E" (D), §3.6 interaction → "3 G" (F; there is no G). §3.1 and §3.5 cite no panel. All references are off by one, consistent with an earlier 7-panel draft. **Also:** §5.3 says *"Figure 3 C represents NYC taxi trip durations"*; it should be **Figure 1 C**. §3.4 cites "Figure S3" for the running example, while §3 says the mapping is in "Figure S1" and §5 assigns S3–S8 to the scenarios. |
| 2 | "Cyclic" under both Layout > Time and Layout > Timeline | **Confirmed** | Fig 3 E lists Time = Linear / Circular and Timeline = Unified / **Cyclic** / Faceted. §3.5 says *"timelines can be unified, faceted by a categorical attribute, or **segmented** into intervals."* So Fig 3 has "cyclic" where the text has "segmented", and cyclic/circular appears twice. In code only one mechanism exists (`layout: "circular"`), and neither cyclic nor segmented timelines exist as constructs. Recommendation: keep circular under Time only, and use Brehmer et al.'s unified / faceted / segmented under Timeline. |
| 3 | `alignment: overlay` in Fig 5 but not defined | **Confirmed** | `alignment` (`"overlay"` / `"stack"`) is inherited Gosling syntax (`gosling.schema.ts:52-61`) and is used in every example. Section 3 never defines it. Fig 4 and §3.2 describe its effect ("overlaid on the same track") without naming it. |
| 4 | Brush described as a "mark" | **Confirmed** | §3.2: *"…appropriate as a brush target"*. §3.6: *"two **brush marks** … allow users to drag a temporal interval"*. Fig 4 labels it "Operator". In code it *is* syntactically a mark (`mark: "brush"`, `gosling.schema.ts:274`), rendered by a separate HiGlass viewport-projection track, but conceptually it is an interaction. Recommendation: present it in §3.6 as the grammar's selection interaction, and note that its *syntax* reuses the mark slot (inherited from Gosling). |
| 5 | Semantic zoom via "granularity transition rules" | **Rejected (no such feature)** | No such syntax exists. Semantic zoom is Gosling's `visibility: [{ measure: "zoomLevel", operation: "less-than" \| "greater-than" \| …, threshold: <seconds of visible span>, target: "track" \| "mark" }]`. The threshold is raw seconds, not a calendar unit. Example: `threshold: 2000000` ≈ 23 days in `temporal-data_seattle-weather.ts:93`. |
| 6 | Granularity: can a user say "show by month"? (Reviewer 1) | **No** | There is no calendar-unit syntax: no `timeUnit`, no `granularity`, no `bin: "month"`. Domains must be epoch **seconds** (`domain: { interval: [s0, s1] }`). Data is not aggregated by calendar unit; Gosling's inherited `aggregate` and `bin` are numeric, not calendar-aware. The only month-level behaviour is automatic: d3 picks monthly tick labels when the visible span suits them. |
| 7 | Is cyclic layout time-specific? | **No: it is Gosling's `layout: "circular"`** | The only change is the clockwise direction (global). The full x domain maps to one revolution, and there is no period-wrapping option. A per-year cyclic view (Fig 1A left) requires preprocessing the data to a within-year coordinate, or one track per year with its own domain. Unverified how Fig 1A was actually built. |
| 8 | Interval and span: distinct types? | **No** | Neither is a type. An interval is two time fields on `x`/`xe`, which is inherited Gosling encoding, plus the fetcher's two-field conversion or the CSV `interval` option (buggy for date strings). Span has no representation. Instant is one field on `x`. |
| 9 | "Four scenarios" in §6 | **Confirmed** | §6: *"Across four scenarios, we demonstrate all six grammar components."* §5 contains three (5.1–5.3). The very next sentence says *"The three usage scenarios"*. A fourth may refer to the running example or Fig 5 (heart rate); if so, say so. |
| 10 | Containment link mark implemented? | **No** | There is no containment mark anywhere in `src/core/mark/` or the schema `Mark` union (`gosling.schema.ts:261-277`). |

Additional issues found:

- **Fig 3 caption** repeats itself: *"Overview of the time-i-gram grammar's components. The six components of the time-i-gram grammar."*
- **§2.2 typo:** "interating marks" → "integrating".
- **§3.3** says the series field has *"a five-value domain ensuring consistent colors across views."* That holds in the README spec. The committed editor example `temporal-data_overview-detail.ts` gives two sectors the same colour (`orange`, `:99,120`).
- **Running-example domain.** §3.4 says *"January 2000–December 2010"*, but the data covers January 2000 – February 2010.
- **Ref [23]** cites the BLS page as accessed 2026-03-11, but the processed dataset used is Vega's `unemployment-across-industries` (the README CSV is a copy). Cite the Vega dataset or state the derivation.
- **§3.1** classes "numerical and categorical values" under the granularity hierarchy sentence. Data values are not part of the granularity hierarchy; this is a structural slip in the paragraph.
- **§1 vs §3.4.** §1 says Vega-Lite treats time "as a quantitative variable", yet time-i-gram's own temporal channel is, at runtime, a linear scale over epoch seconds. Reviewers may see this as the same treatment. The real difference lies in parsing, axis labelling and HiGlass zoom, so frame the claim around those.

---

## 4. Definitions (grounded in the code, for the revised paper)

- **Layout.** The `layout` property (`"linear"` | `"circular"`, set on a view or track, default `"linear"`) determines whether a track's x axis is drawn as a straight horizontal line or bent into an arc, in which the complete x domain is swept clockwise once from `startAngle` to `endAngle` around the view's centre.
- **Arrangement.** The `arrangement` property of a view that contains child `views` places them in reading order:
  - `"vertical"` (synonym `"parallel"`) stacks them top to bottom.
  - `"horizontal"` (synonym `"serial"`) places them left to right.
  - The synonyms differ only when every child is circular. Then `"parallel"` nests the children as concentric rings sharing one centre, and `"serial"` divides a single circle into consecutive angular sectors.
- **Alignment.** The `alignment` property of a group of tracks determines whether they are drawn in separate bands one above another (`"stack"`, default) or superimposed in the same band with shared x and y extents (`"overlay"`).
- **Timeline (unified / faceted / segmented).** A timeline is the set of tracks that share one temporal x axis. It is *unified* when all series are encoded in a single track (overlay or a `color` field), and *faceted* when each category gets its own band (`row` channel, or one filtered track per category). The code has no *segmented* timeline: no construct splits one axis into disjoint periods. *(Not a grammar keyword; the paper should present it as a composition pattern.)*
- **Time scale (chronological / relative).** A *chronological* time scale, the only kind implemented, maps a `type: "temporal"` field, converted to Unix epoch seconds at load time, linearly onto x through `domain: { interval: [s0, s1] }`. A *relative* time scale, which would re-express each record as an offset from a reference event, is not implemented and can only be emulated by preprocessing the data.
- **Granularity.** The code has no declared granularity. The effective granularity is the resolution of the parsed timestamps (whole seconds or finer), and the axis granularity is the calendar unit (year, month, day, hour, …) that d3's UTC tick generator chooses for the currently visible span.
- **Time primitives:**
  - An *instant* is a record whose single parsed time field is encoded on `x`.
  - An *interval* is a record whose two parsed time fields are encoded on `x` (start) and `xe` (end), drawn with an extent-capable mark such as `rect`, `bar` or `withinLink`.
  - A *span* (an unanchored duration) has no temporal representation in the code; it can only be an ordinary quantitative field.

---

## 5. What's genuinely new

The complete set of time-i-gram changes relative to Gosling.js v0.10.2 (`git diff 98b5b88 HEAD`, plus the working tree):

- **`temporal` field type.** Added to `FieldType` and the x-channel schema, with validation relaxed to accept temporal instead of genomic (`gosling.schema.ts:741,759,859`; `validate.ts:51-53,90-132`). Compiler plumbing passes the temporal domain to HiGlass (`gosling-to-higlass.ts:73-79`). *Caveat:* at runtime a temporal axis is the same linear scale as a genomic axis, and it works on `x` only.
- **Two time-aware data fetchers,** `csv-time` and `json-time`, which parse dates into epoch seconds (`src/data-fetchers/csv/csv-time-data-fetcher.ts`, `src/data-fetchers/json/json-time-data-fetcher.ts`; schema `gosling.schema.ts:944-984`). Includes US, day-first and year-first date orders, date + time columns, component columns, and ISO calendar weeks. *Caveats:* the parsing bugs listed in §1 A and §2.1(2); no multi-resolution tiling.
- **Unix time axis track** with human-readable, zoom-adaptive UTC tick labels, in linear and circular layouts (`src/tracks/unix-time-track/unix-time-track.ts`; created by `higlass-model.ts:379-447`; registered in `init.ts:78-86`). Tick logic is d3 `scaleUtc` defaults.
- **`interval` data transform,** which builds year-spanning intervals from year and week columns (`data-transform.ts:56-80`; `gosling.schema.ts:1321-1328`).
- **Temporal-aware patches** to bar grouping, stacking and aggregation (`bar.ts:66-72`; `gosling-track-model.ts:521-542`; `data-transform.ts:464`).
- **Clockwise circular layout** (`polar.ts`, `axis.ts`, `axis-track.ts`, `line.ts`). This is a global behaviour change rather than a temporal feature, and it introduced the mirrored circular brush.

**Presented as new or time-specific in the paper, but inherited unchanged from Gosling.js:**
- Circular layout ("native support for cyclic layouts"); only its direction changed.
- Linking and brushing (`linkingId`, `mark: "brush"`), coordinated views, overview + detail.
- Semantic zoom (`visibility` / `zoomLevel`).
- View and track composition: `views`, `tracks`, `alignment`, `arrangement` (parallel / serial / vertical / horizontal).
- Every mark (line, point, area, bar, rect, text, rule, `withinLink` arcs used for the taxi intervals) and every channel (position, color, size, opacity, stroke, row).
- Tile-based rendering and multi-scale navigation (HiGlass).
- The `x`/`xe` encoding used for intervals.
- Python access (Gos).

**Presented in the paper but not implemented at all:** span; relative time scale; granularity (as syntax); granularity transition rules; containment mark; shape and tilt channels; cyclic or segmented timelines; stepped / continuous and operator / operand interaction syntax; period-based cyclic wrapping.

---

## 6. Example inventory

There are only **three temporal example specs in the repo** (two committed, one uncommitted), plus the running example embedded in the README. Every other spec in `editor/example/` is an upstream genomics example. None of the paper's scenario specs (Fig 1A influenza, Fig 1B solar PV, Fig 1C NYC taxi, Fig 5 heart rate) are in the repo.

| # | File | Dataset | Concepts exercised (§1) | Runs / renders? |
|---|---|---|---|---|
| 1 | `editor/example/json-spec/temporal-data_overview-detail.ts` (registered as `TEMPORAL_DATA_OVERVIEW_DETAIL`) | Vega `unemployment-across-industries.json` | `json-time`, `dateFields: ["year","month"]`, temporal x, line mark, color value, `filter` transform, `alignment: "overlay"`, brush, `linkingId`, stacked (vertical) tracks, instant | **Partially.** Schema-valid, and the five detail lines render. However: (a) the overview track has `values: []` and so draws no data, only a full-width brush; (b) no domain is set, so the default view spans about 1970–2065 with the data squeezed into 2000–2010; (c) the default `sampleLength` 1000 randomly drops about 41% of the 1,708 rows before the series filter; (d) two series share the colour `orange`. |
| 2 | `editor/example/spec/temporal-data_seattle-weather.ts` (`TEMPORAL_DATA_SEATTLE_WEATHER`) | Vega `seattle-weather.csv` | `csv-time`, `dateFields: ["date"]`, temporal x, bar / line / rect / text marks, nominal color with legend, `alignment: "overlay"`, multiple views, `linkingId` (no brush), **semantic zoom** (`visibility`, `zoomLevel`) | **No: renders empty.** Schema-valid. Every ISO date (`2012-01-01`) parses to `1970-01-01` = 0 because `yearFirstDate: true` is missing (`csv-time-data-fetcher.ts:139,146`). The tile filter's strict `minX < value` (`src/data-fetchers/utils.ts:43`) then discards the zeros. Axes appear with no marks. |
| 3 | `editor/example/spec/temporal-data_unemployment-circular-linear.ts` (**uncommitted**; `TEMPORAL_DATA_UNEMPLOYMENT_CIRCULAR_LINEAR`) | Vega `unemployment-across-industries.json` | `json-time`, `dateFields: ["year","month"]`, temporal x with `domain: { interval }`, `layout: "circular"` + linear, `arrangement: "horizontal"`, `alignment: "overlay"`, brush, `linkingId`, `static: true`, nominal color with legend, line mark | **Yes, with caveats.** Schema-valid and renders a circular overview beside a linear detail view. Caveats: random sampling drops about 41% of rows (no `sampleLength`); the circular brush, once moved, shades the mirrored sector; the decade is one revolution, not wrapped by year. |
| 4 | `README.md:143-266` (running example, Fig 4; **not registered in the editor**) | `denisseram/time-i-gram@14a22f2…/unemployment-across-industries.csv` | `csv-time` with ISO date-time, `sampleLength`, temporal x with `domain`, circular overview + vertical detail column, `arrangement: "horizontal"` / `"vertical"`, `alignment: "overlay"`, line / area / bar marks, `opacity`, `size`, nominal color with legend, two brushes, `linkingId`, `centerRadius` | **Yes, with caveats.** Renders through `embed()`, closely matching Fig 4. Caveats: (a) schema warning for `genomicFields`, an undeclared property on `csv-time`, which the fetcher ignores; (b) all area tracks silently draw nothing (stacked-area genomic-only path, `area.ts:50-56`); (c) dragging the timeline brush moves both brushes and the detail views, but the detail range observed (about 1995.5–2006) did not match the brushed interval (about 2000–2006); (d) the circular brush shades the mirrored sector. |
| 5 | `README.md:93-107` (Quick Start) | Vega `seattle-weather.csv` | `csv-time`, bar, temporal x | **Expected to render empty** (inferred, not rendered separately): it uses the same data config as #2. |

### Grammar concepts that no example exercises (gaps for new examples)

- **Time primitives:** **interval** (`x` + `xe`, e.g. `rect` or `withinLink` arcs, as in the taxi scenario); span (not implemented).
- **Data sources and parsing:**
  - `timestampField` (Unix seconds), which is also broken in `json-time`.
  - Date + time-of-day columns (sub-day granularity).
  - `includesCalendarWeek`, `dayFirstDate`, `yearFirstDate`.
  - The CSV `interval` option.
  - `json-time` with inline `values` containing data.
  - Pre-1970 dates.
- **Transform:** the NEW `interval` data transform (year bands).
- **Marks:**
  - `point` on a temporal axis.
  - `withinLink` / `betweenLink` connection marks.
  - Working `area` (non-stacked: `color` as a value, or explicit `stack`-free config).
  - `rule`, `triangle*`.
- **Channels:** `row` (faceted timeline); field-driven `size`, `opacity` or `stroke`.
- **Layout and arrangement:**
  - `arrangement: "parallel"` / `"serial"` with circular children (concentric year rings vs sectors).
  - A cyclic view that aligns periods (one ring or overlay per year), which is what Fig 1A shows.
  - Vertical orientation / temporal y (currently unsupported).
- **Scales:** relative time scale (not implemented); an explicit chronological domain with a non-default zoom extent.
- **Interaction:**
  - `zoomLimits`.
  - `tooltip` / mouse events on temporal data.
  - Semantic zoom that works end to end; the only example using it (#2) renders empty.
  - Brush on a circular view that is actually moved, which would expose the mirroring bug.
- **Paper scenarios:** none of Fig 1A, 1B, 1C or Fig 5 has a spec in the repo.
