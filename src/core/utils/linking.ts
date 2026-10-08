import { IsChannelDeep } from '@gosling-lang/gosling-schema';
import type { HiGlassModel } from '../../compiler/higlass-model';
import { SUPPORTED_CHANNELS } from '../mark';
import { resolveSuperposedTracks } from './overlay';
import { getTemporalChannelFromTrack } from '../../gosling-schema/validate';
import {
    ABSOLUTE_TIME,
    describeTimeCoordinates,
    getTrackTimeCoordinates,
    timeCoordinateSignature
} from './time-coordinate-system';

/** Coordinate system of a view's x axis: `genomic`, or the signature of its time coordinate system. */
function xCoordinates(spec: any): { signature: string; description: string } | undefined {
    const time = getTrackTimeCoordinates(spec)?.system ?? (getTemporalChannelFromTrack(spec) ? ABSOLUTE_TIME : undefined);
    if (time) return { signature: timeCoordinateSignature(time), description: describeTimeCoordinates(time) };
    return IsChannelDeep(spec.x) && spec.x.type === 'genomic' ? { signature: 'genomic', description: 'genomic' } : undefined;
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
 * Keep only links between views that share an x coordinate system. Linking a period view (e.g. a year ring)
 * to an absolute timeline, or either to a relative view, would copy raw seconds between unrelated coordinate
 * systems, since a position within a period stands for many absolute instants. The first member of a link
 * (in spec order) defines its coordinate system; members with another system are left out of the link,
 * with a warning.
 */
export function filterLinksByCoordinates<T extends { linkId: string; coordinates?: { signature: string; description: string } }>(
    linkingInfo: T[],
    warn: (message: string) => void = message => console.warn(`[time-i-gram] ${message}`)
): T[] {
    const linkSystems: Record<string, { signature: string; description: string }> = {};
    const warned = new Set<string>();
    return linkingInfo.filter(info => {
        if (!info.coordinates) return true;
        const first = linkSystems[info.linkId];
        if (!first) {
            linkSystems[info.linkId] = info.coordinates;
            return true;
        }
        if (first.signature === info.coordinates.signature) return true;
        const key = `${info.linkId}|${info.coordinates.signature}`;
        if (!warned.has(key)) {
            warned.add(key);
            warn(
                `linkingId "${info.linkId}" joins views in different coordinate systems (${first.description} and ` +
                    `${info.coordinates.description}); the views in ${info.coordinates.description} are not linked.`
            );
        }
        return false;
    });
}
