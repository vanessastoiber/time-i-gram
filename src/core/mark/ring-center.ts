/**
 * The center of a ring on a temporal axis: the title of the radial (y) axis and the color legend, stacked and
 * centered in the empty middle of the ring, where they cover no data. A legend that does not fit there is drawn
 * in the corner, as in other tracks (`drawColorLegendCategories`).
 */
import type { SingleTrack } from '@gosling-lang/gosling-schema';
import { IsChannelDeep } from '@gosling-lang/gosling-schema';

/** Height of a line of text in the center, in px. */
export const RING_LINE_HEIGHT = 15;
/** Width of a legend swatch and the space after it, in px. */
const SWATCH = 14;

/** Whether a track is a ring on a temporal axis. */
export function isTemporalRing(spec: SingleTrack): boolean {
    return spec.layout === 'circular' && IsChannelDeep(spec.x) && spec.x.type === 'temporal';
}

export interface RingCenterContent {
    /** The y title, wrapped */
    titleLines: string[];
    legendTitle?: string;
    categories: string[];
}

export interface RingCenterLayout {
    width: number;
    height: number;
    /** Whether the legend fits in the center with the title */
    legendInCenter: boolean;
}

/** Wrap a text into lines of at most `maxWidth` px. */
export function wrapText(text: string, maxWidth: number, measure: (text: string, bold: boolean) => number): string[] {
    const lines: string[] = [];
    text.split(/\s+/).forEach(word => {
        const last = lines[lines.length - 1];
        if (last !== undefined && measure(`${last} ${word}`, false) <= maxWidth) lines[lines.length - 1] = `${last} ${word}`;
        else lines.push(word);
    });
    return lines;
}

/**
 * Size of the centered block (y title, a blank line, then the legend title and entries), and whether it fits in
 * a circle of `innerRadius`; without room for the legend, the block is the y title alone.
 */
export function ringCenterLayout(
    content: RingCenterContent,
    innerRadius: number,
    measure: (text: string, bold: boolean) => number
): RingCenterLayout {
    const titleWidth = Math.max(0, ...content.titleLines.map(l => measure(l, false)));
    const legendLines = content.categories.length + (content.legendTitle ? 1 : 0);
    const legendWidth = Math.max(
        content.legendTitle ? measure(content.legendTitle, true) : 0,
        ...content.categories.map(c => SWATCH + measure(c, false))
    );
    const fits = (w: number, h: number) => Math.hypot(w / 2, h / 2) <= innerRadius * 0.95;
    const titleHeight = content.titleLines.length * RING_LINE_HEIGHT;
    const gap = content.titleLines.length > 0 && legendLines > 0 ? RING_LINE_HEIGHT / 2 : 0;
    const both = { width: Math.max(titleWidth, legendWidth), height: titleHeight + gap + legendLines * RING_LINE_HEIGHT };
    if (legendLines > 0 && fits(both.width, both.height)) return { ...both, legendInCenter: true };
    return { width: titleWidth, height: titleHeight, legendInCenter: legendLines === 0 };
}
