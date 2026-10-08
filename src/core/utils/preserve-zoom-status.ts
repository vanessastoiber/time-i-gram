import type { HiGlassSpec } from '@gosling-lang/higlass-schema';

/**
 * This makes sure that all the current zooming status is preserved when new tracks are added
 *
 * Views with a temporal axis are skipped and keep the domain from their spec: HiGlass view uids
 * change on every compile, so the linked view is usually not found in `prevSpec` and the domain
 * becomes `undefined`, and the fallback domain of a temporal view is empty, so it shows no data.
 */
export const preverseZoomStatus = (newSpec: HiGlassSpec, prevSpec: HiGlassSpec) => {
    newSpec.views.forEach(view => {
        if (isTemporalHiGlassView(view)) return;
        const viewUid = view.uid!;
        const newView = !prevSpec.views.find(v => v.uid === viewUid);
        if (newView) {
            // if this view is linked with another view, we need to preverse the current zooming status of this view from the linked view
            // Otherwise, all the views that is linked with this view will be reset to the original zooming position
            const { locksByViewUid } = newSpec.zoomLocks;
            const lockUid = locksByViewUid[viewUid];
            const linkedViewUid = Object.entries(locksByViewUid).find(([_, uid]) => _ && uid === lockUid)?.[0];
            if (linkedViewUid) {
                // We found a linked view, so copy the current zooming status
                view.initialXDomain = prevSpec.views.find(v => v.uid === linkedViewUid)?.initialXDomain;
                view.initialYDomain = prevSpec.views.find(v => v.uid === linkedViewUid)?.initialYDomain;
            }
        }
    });
};

/** Whether a HiGlass view contains a time axis or a Gosling track with a temporal x channel. */
function isTemporalHiGlassView(view: HiGlassSpec['views'][number]): boolean {
    const isTemporalSpec = (spec: any): boolean =>
        spec?.x?.type === 'temporal' || (spec?.overlay ?? []).some((o: any) => o?.x?.type === 'temporal');
    const visit = (track: any): boolean =>
        track?.type === 'unix-time-track' ||
        isTemporalSpec(track?.options?.spec) ||
        (track?.contents ?? []).some(visit);
    return Object.values(view.tracks ?? {}).some(tracks => (tracks as any[]).some(visit));
}
