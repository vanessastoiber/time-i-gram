import { IsChannelDeep, getTemporalChannelFromTrack } from '@gosling-lang/gosling-schema';
import type { HiGlassModel } from '../../compiler/higlass-model';
import { SUPPORTED_CHANNELS } from '../mark';
import { resolveSuperposedTracks } from './overlay';
import {
    ABSOLUTE_TIME,
    describeTimeCoordinates,
    getTrackTimeCoordinates,
    timeCoordinateSignature
} from './time-coordinate-system';

/** Coordinate system of a view's x axis: `genomic`, or the signature of its time coordinate system. */
function xCoordinates(spec: any): { signature: string; description: string } | undefined {
    const time =
        getTrackTimeCoordinates(spec)?.system ?? (getTemporalChannelFromTrack(spec) ? ABSOLUTE_TIME : undefined);
    if (time) return { signature: timeCoordinateSignature(time), description: describeTimeCoordinates(time) };
    return IsChannelDeep(spec.x) && spec.x.type === 'genomic'
        ? { signature: 'genomic', description: 'genomic' }
        : undefined;
}

/**
 *
 */
export function getLinkingInfo(hgModel: HiGlassModel) {
    const linkingInfo: {
        layout: 'circular' | 'linear';
        hgViewId: string;
        linkId: string;
        isBrush: boolean;
        style: any;
        /** The coordinate system of the view's x axis (see `xCoordinates`) */
        coordinates?: { signature: string; description: string };
    }[] = [];

    hgModel.spec().views.forEach(v => {
        const hgViewId = v.uid;

        // TODO: Better way to get view specifications?
        // Get spec of a view
        let spec = /* TODO: */ (v.tracks as any).center?.[0]?.contents?.[0]?.options?.spec;

        if (!spec) {
            // This means the orientation of this view is vertical, and spec might be positioned on the left
            spec = /* TODO: */ (v.tracks as any).left?.[0]?.contents?.[0]?.options?.spec;
            if (!spec) {
                // in case the first one is the axis track
                spec = /* TODO: */ (v.tracks as any).left?.[1]?.contents?.[0]?.options?.spec;
            }
        }

        if (!hgViewId || !spec) return;

        const resolved = resolveSuperposedTracks(spec);
        const viewCoordinates = xCoordinates(resolved.find(d => d.mark !== 'brush') ?? spec);

        resolved.forEach(spec => {
            SUPPORTED_CHANNELS.forEach(cKey => {
                const channel = spec[cKey];

                if (IsChannelDeep(channel) && 'linkingId' in channel && channel.linkingId) {
                    linkingInfo.push({
                        layout: spec.layout === 'circular' ? 'circular' : 'linear',
                        hgViewId,
                        linkId: channel.linkingId,
                        isBrush: spec.mark === 'brush',
                        coordinates: viewCoordinates,
                        style: {
                            color: (spec as any).color?.value,
                            stroke: (spec as any).stroke?.value,
                            strokeWidth: (spec as any).strokeWidth?.value,
                            opacity: (spec as any).opacity?.value,
                            startAngle: spec.startAngle,
                            endAngle: spec.endAngle,
                            innerRadius: spec.innerRadius,
                            outerRadius: spec.outerRadius
                        }
                    });
                    return;
                }
            });
        });
    });
    return linkingInfo;
}

/**
 * Link only views that share an x coordinate system. Linking a period view (e.g. a year ring) to an absolute
 * timeline, or either to a relative view, would copy raw seconds between unrelated coordinate systems, since a
 * position within a period stands for many absolute instants. A `linkingId` whose members are in several
 * systems is split into one link per system (`<linkingId>|<signature>`), so every group of compatible views
 * stays linked whatever the order of the views; a member left alone in its system is not linked. One warning
 * is given per `linkingId`. Links within one system are returned unchanged.
 */
export function filterLinksByCoordinates<
    T extends { linkId: string; coordinates?: { signature: string; description: string } }
>(linkingInfo: T[], warn: (message: string) => void = message => console.warn(`[time-i-gram] ${message}`)): T[] {
    const systems = new Map<string, Map<string, { description: string; count: number }>>();
    linkingInfo.forEach(({ linkId, coordinates }) => {
        if (!coordinates) return;
        const bySignature = systems.get(linkId) ?? new Map<string, { description: string; count: number }>();
        const entry = bySignature.get(coordinates.signature) ?? { description: coordinates.description, count: 0 };
        entry.count++;
        bySignature.set(coordinates.signature, entry);
        systems.set(linkId, bySignature);
    });
    systems.forEach((bySignature, linkId) => {
        if (bySignature.size <= 1) return;
        const descriptions = Array.from(bySignature.values()).map(d => d.description);
        warn(
            `linkingId "${linkId}" joins views in different coordinate systems (${descriptions.join(', ')}); ` +
                'only views in the same coordinate system are linked.'
        );
    });
    return linkingInfo.flatMap(info => {
        const bySignature = info.coordinates && systems.get(info.linkId);
        if (!info.coordinates || !bySignature || bySignature.size <= 1) return [info];
        if (bySignature.get(info.coordinates.signature)!.count < 2) return [];
        return [{ ...info, linkId: `${info.linkId}|${info.coordinates.signature}` }];
    });
}
