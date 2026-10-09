# Fix progress: review findings and example quality (`feat/temporal-grammar`)

Status as of 2026-10-09. Sources: [review-temporal-grammar.md](review-temporal-grammar.md) (section A) and the requests for performance (B), example quality (C) and editor thumbnails (E1).

**State:** every commit is pushed to `denisseram/feat/temporal-grammar`. The suite has 411 tests, all passing, and `tsc --noEmit` is clean. Nothing is half-done.

**Genomic check:** compiled output of all 57 genomic and doc examples is identical to `fix/temporal-bugs`. `MATRIX` differs only by its random demo data, the same as base vs base.

## A. Review findings

| Item | Status | Commit |
|---|---|---|
| S1 `quarter` in a shifted year | Done | `6e2ef31` |
| S2 links dropped by view order | Done | `de5638d` |
| S3 `displace` back on the upstream path + `docs/upstream-proposals.md` | Done: the upstream logic is kept verbatim in `combine-tiles.ts`; render-level regression script `scripts/render-regression.cjs` | `aff8ae6` |
| S4 week labels overlap | Done: tick count from the axis length; short week labels; the context names the visible weeks | `7a6d521` |
| S5 temporal-only properties on genomic x | Done: a schema error (an `if`/`then` on `X`, added in `scripts/generate-schemas.mjs`) and a compiler warning | `e2452d1` |
| S6 ring draws rows outside the visible arc | Done | `d36b7eb` |
| S7 period ticks before the period; no zoom limit | Done | `68b0cb8` |
| S8 empty rule list deletes the track | Done: the track falls back to raw rows with a warning; schema `minItems: 1` | `1749e80` |
| S9 partial yearly unit at the data edge | To do (example + one sentence in the semantics) | |
| M1 ring brush notch | Done: the notch was the circular layout's gap at the origin; period rings now have none | `d4d5fa6` |
| M2 week-53 gap | Done: the gap is now at the end of the season | `3683cd8` |
| M3 domains of the wrong kind | Done | `6944185` |
| M4 1,000-piece cap reported | Done | `e072928` |
| M5 skipped tiles transformed | Done: they were already not transformed, but kept stale models; those are now dropped | `522d417` |
| M6 once-per-page warnings | Done: once per compiled spec, via `warnOnce` in `temporal-warnings.ts` | `e072928` |
| M7 relative tick count by width | Done (with S4) | `7a6d521` |
| M8 document internal names | To do (README) | |
| M9 label collisions | To do (with section C) | |
| M10 one sentence in Limitations | To do (report) | |
| §4 missing tests | Done: unit tests for every fix, and the render-level regression script for `MARK_DISPLACEMENT` (load, zoom, zoom + pan; it fails on `0b05f99` and passes now) | |
| §5 code quality | Done: shared helpers `eec76af`, `linking.ts` import `e1f1b7c`, single resolved flag `0b05f99` | |

**Behavior changes to note in the report:**
- **S2:** a `linkingId` that spans several coordinate systems is now split into one link per system. A view left alone in its system is not linked.
- **S7:** period views now default to an upper zoom limit of one period.
- **Resolved flag:** it is set on temporal tracks only, so compiled genomic specs are unchanged.

## B. Performance

Done; numbers to go into the report.

**Method.**
- **Browser:** headless Chromium on an Apple M1 (8 GB), with the dev editor serving each branch.
- **Metrics:** load time and total blocking time (TBT), plus frame times and TBT during 10 wheel steps and a 20-step drag.
- **Runs:** 3 runs each, medians reported.
- **Noise:** the machine was busy (load average about 12), so compare runs made side by side, not absolute times.

**Findings:**
- **No regression on shared examples.** On examples that exist on both branches (genomic ×2, S5, S7), this branch is within run-to-run noise of `fix/temporal-bugs`.
- **The slowness was the new FitBit cycles example.** It drew 154,000 per-second points twice, and Gosling redraws every mark on each interaction:
  - zoom TBT: 51.1 s;
  - drag TBT: 108.7 s;
  - p95 frame: 6.2 s.
- **Inherited cost.** Every example blocks 2–8 s per 10 wheel steps on both branches, because Gosling redraws everything on each event.

**Fixes:**

| Commit | Change |
|---|---|
| `ab6bc8b` | The FitBit example uses hourly means (`timeUnit`). Zoom TBT 51.1 → 4.1 s, drag TBT 108.7 → 3.0 s, p95 frame 6.2 → 0.45 s |
| `d2732b9` | `utc()` / `isoWeekday()` without `Date` objects. `utc()` drops from 2.4 s to 0.1 s of CPU during the FitBit load |
| `39db2a0` | Temporal tiles reuse their models while zooming or panning within the same tiles, and unchanged tiles are not recombined. `processAllTiles` no longer shows in a drag profile; it was 0.2 s per 20 steps |

**Raw results:** the JSON and the summary were in the session scratchpad under `perf/`.

## C. Example quality (G1–G7, per example)

Not started.

**Design decided, not built.** For temporal linear tracks only, so genomic output stays the same:
- **Header strip:** reserve one at the top of each track by giving quantitative `y` the range `[0, rowHeight - header]` in `gosling-track-model.ts`. The y axis in `axis.ts` follows the range.
- **Title and legend:** the HiGlass title stays on the left of the strip. A compact inline legend with its title goes on the right. Extend `style.inlineLegend` / `color.title` in `legend.ts`.
- **New `style.legendLabel`:** for overlaid members with a constant color (bar vs line, orange vs green). It needs a schema change.
- **New `y.title`:** the y-axis title, drawn rotated outside the track on the axis side. It needs a schema change.
- **G5:** context label computed from the visible range in `time-axis-ticks.ts`, and not drawn on circular axes (`unix-time-track.ts`).

## E1. Thumbnails

Not started.

**Plan:** render each temporal example after the visual fixes, then save it to `editor/example/thumbnails/<ID>.png` (500 px wide, like the genomic ones). Import it in `editor/example/thumbnails.ts` and set `image:` in `editor/example/index.ts`.

## Next

1. **C**, global rules first:
   - G1/G6: header strip, compact inline legends;
   - G2: `y.title`;
   - G3: `style.legendLabel`;
   - G5: context label from the visible range, none on rings.
2. **Then** the per-example fixes with G4/G7, and S9.
3. **Then** M8–M10, E1, re-render and check every screenshot, and the report.

## Resume notes

- **Render scripts:** the Playwright scripts (`render.js`, `zoom.js`, `compare.js`) were in the session scratchpad under `pw/`. The same scripts are in the earlier session's scratchpad: `/private/tmp/claude-501/-Users-cdr-c-Documents-time-i-gram/4a664fa4-.../scratchpad/pw`. `/tmp` may be cleared on shutdown; if so, reinstall `playwright@1.63`, `pixelmatch` and `pngjs` in a scratch folder.
- **Dev server:** `npx vite --mode editor --port 3456 --strictPort`. Examples open at `?example=<ID>&full=true`, rendered at 1300×950.
- **Formatting:** run `npx prettier` only on files this branch added. On inherited files (e.g. `data-transform.ts`, `polar.ts`), it reformats upstream code.
- **Schemas:** regenerate with `node scripts/generate-schemas.mjs` (deterministic).
