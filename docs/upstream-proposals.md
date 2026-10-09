# Proposals for upstream Gosling

Changes to inherited Gosling code that time-i-gram does **not** make, so genomic behavior stays exactly as upstream, but that could be proposed to Gosling separately.

## 1. Combining tiles for `displace`: re-merge each tile's own rows

**Where:** `combineAllTilesIfNeeded()` in `src/tracks/gosling-track/gosling-track.ts`. Since `feat/temporal-grammar`, the upstream logic lives verbatim in `combineTilesUpstream()` in [`combine-tiles.ts`](../src/tracks/gosling-track/combine-tiles.ts).

**What upstream does.** For a track with a `displace` transform, all visible tiles are merged into the first tile, and the others are marked `skipRendering`.
- The merge reads each tile's current `tabularData`.
- After a combination, the first tile's `tabularData` *is* the previous combination.
- Rows deduplicate only if they have a `uid` field.

**Why it is a problem.** When the visible tiles change (zoom, pan), the next combination merges the previous combination again, together with the newly visible tiles. Two things go wrong:
- **Stale or duplicated rows.** Without `uid`, rows are duplicated. With `uid`, rows of tiles that are no longer visible stay in the first tile.
- **Tiles never reset.** A tile once marked `skipRendering` is not reset when it becomes the first visible tile.

`displace` then packs a different set of rows than the visible one, so the result depends on the interaction history:
- **Zoom:** transcripts are packed into different rows.
- **Pan:** the track can stay empty.

**Evidence.** The independent review measured this on `MARK_DISPLACEMENT` ([review-temporal-grammar.md](review-temporal-grammar.md), S3):

| Interaction | Pixels that differ |
|---|---|
| 4 wheel steps in | 2.7% |
| 150 px pan | 1.2%, with upstream drawing an empty track |

The render regression script `scripts/render-regression.cjs` shows the same kind of difference between upstream and the earlier variant of this branch that used the fix below:
- **Zoom:** 0.81% of pixels differ.
- **Zoom + pan:** 0.67% differ.

Upstream's own renders of the same interaction are not always identical: up to 0.8% differ between runs. This is consistent with the dependence on the interaction history. The script therefore compares against several upstream renders. The earlier variant matched none of five, while the upstream path on this branch matches one exactly.

**Proposed change.** It is the same as the combination time-i-gram uses for temporal lines and areas (`combineTemporalTiles()` in `combine-tiles.ts`):

1. **Keep own rows.** Each tile keeps its own rows (`ownTabularData`) the first time it is combined.
2. **Reset before combining.** Every visible tile gets its own rows back and `skipRendering = false`.
3. **Merge only own rows.** The first tile receives each visible tile's own rows only, deduplicated by `uid` when present and by object identity otherwise. The time data fetchers return the same row objects to every tile that needs them.
4. **Build in one pass.** The combined array is built once, instead of `merged = [...merged, ...rows]` per tile.

**How to test it upstream:**
- **Unit tests.** `combine-tiles.test.ts` contains tests for both strategies. One of them shows that the upstream strategy merges a previous combination again.
- **Render test.** Run `scripts/render-regression.cjs` with upstream as the reference: after the change, zoom and pan should no longer depend on the interaction history.

Expect `MARK_DISPLACEMENT` renders after interaction to change. This is why time-i-gram keeps the upstream path for `displace`.
