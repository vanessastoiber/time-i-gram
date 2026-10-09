/**
 * The header strip of linear tracks on a temporal x axis: a band at the top of the track (of each row) that holds
 * the track title on the left and a compact legend on the right, so that neither covers the y axis or the data.
 * The y range of the track's marks starts below it (see `GoslingTrackModel`). Tracks on other axes are unchanged.
 */
import type { Datum, SingleTrack } from '@gosling-lang/gosling-schema';
import { IsChannelDeep, IsChannelValue } from '@gosling-lang/gosling-schema';

/** Height of one line of the header, in px (the title and legend labels are 12 px). */
export const HEADER_LINE_HEIGHT = 16;
/** Space between legend entries and around the legend, in px. */
export const LEGEND_GAP = 10;
/** Width of a legend swatch and the space after it, in px. */
export const SWATCH_WIDTH = 14;

/** One entry of a header legend: a color category of a member, or a member with a constant color. */
export interface HeaderLegendEntry {
    label: string;
    /** The member it describes (its mark gives the swatch shape) */
    spec: SingleTrack;
    /** The color category, for members that encode color by a nominal field */
    category?: string;
}

export interface HeaderLegend {
    title?: string;
    entries: HeaderLegendEntry[];
}

/** Whether resolved tracks get a header strip: linear tracks on a temporal x axis. */
export function usesTemporalHeader(specs: SingleTrack[]): boolean {
    return (
        specs.length > 0 &&
        specs.every(s => s.layout !== 'circular' && s.orientation !== 'vertical') &&
        specs.some(s => IsChannelDeep(s.x) && s.x.type === 'temporal')
    );
}

/**
 * The legend of a track's header. Members that encode `color` by a nominal field with `legend: true` contribute
 * their categories: per field, the union over all members that encode it (e.g. one member per series), in the
 * order of the members; members with a constant color and `style.legendLabel` contribute one entry each. The
 * title is the first `color.title`, or the track's `style.legendTitle`.
 */
export function headerLegend(specs: SingleTrack[], categories: (spec: SingleTrack) => string[]): HeaderLegend {
    const entries: HeaderLegendEntry[] = [];
    const legendFields = new Set<string>();
    specs.forEach(spec => {
        const color = spec.color;
        if (IsChannelDeep(color) && color.type === 'nominal' && color.legend && color.field)
            legendFields.add(color.field);
    });
    const seen = new Set<string>();
    let title: string | undefined;
    specs.forEach(spec => {
        const color = spec.color;
        if (IsChannelDeep(color) && color.type === 'nominal' && color.field && legendFields.has(color.field)) {
            title = title ?? color.title;
            categories(spec).forEach(category => {
                const key = `${color.field}\u0000${category}`;
                if (seen.has(key)) return;
                seen.add(key);
                entries.push({ label: category, spec, category });
            });
        } else if (spec.style?.legendLabel && IsChannelValue(color)) {
            entries.push({ label: spec.style.legendLabel, spec });
        }
    });
    title = title ?? specs.find(s => s.style?.legendTitle)?.style?.legendTitle;
    return { title, entries };
}

/**
 * Categories of a nominal color channel that a member draws: the values of its field in its rows, in the order
 * of `color.domain` (or of the rows, without a domain).
 */
export function colorCategories(spec: SingleTrack, rows: Datum[]): string[] {
    const color = spec.color;
    if (!IsChannelDeep(color) || !color.field) return [];
    const field = color.field;
    const present = Array.from(new Set(rows.map(row => String(row[field]))));
    if (!Array.isArray(color.domain)) return present;
    const domain = (color.domain as (string | number)[]).map(String);
    return rows.length === 0 ? domain : domain.filter(category => present.includes(category));
}

/** Width of a header legend, in px, with `measure(text, bold)` giving text widths. */
export function legendWidth(legend: HeaderLegend, measure: (text: string, bold: boolean) => number): number {
    if (legend.entries.length === 0) return 0;
    const titleWidth = legend.title ? measure(`${legend.title}:`, true) + LEGEND_GAP / 2 : 0;
    return titleWidth + legend.entries.reduce((sum, e) => sum + SWATCH_WIDTH + measure(e.label, false) + LEGEND_GAP, 0);
}

/** Where the header places its parts: the number of lines, and the line (0-based) of the legend and y titles. */
export interface HeaderLayout {
    height: number;
    legendLine: number;
    yTitleLine: number;
}

/** Titles of the y axes of a track: `y.title` of members with a left or a right y axis. */
export function yAxisTitles(specs: SingleTrack[]): { left?: string; right?: string } {
    const titles: { left?: string; right?: string } = {};
    specs.forEach(spec => {
        const y = spec.y;
        if (!IsChannelDeep(y) || !('title' in y) || !y.title || y.axis === 'none') return;
        const side = y.axis === 'right' ? 'right' : 'left';
        titles[side] = titles[side] ?? y.title;
    });
    return titles;
}

/** A y title as drawn above its axis, e.g. "\u2191 Consumption (Wh)" (or "Count \u2191" on the right). */
export function yTitleLabel(title: string, side: 'left' | 'right') {
    return side === 'left' ? `\u2191 ${title}` : `${title} \u2191`;
}

/**
 * Layout of the header strip. The track title is on the first line, on the left. The y-axis titles are above
 * their axes, on the line after the title (on the first line without a title). The legend is on the right of the
 * first line, or on the next line when it does not fit next to the texts there. No title, y title or legend: no
 * header.
 */
export function headerLayout(
    title: string | undefined,
    yTitles: { left?: string; right?: string },
    legend: HeaderLegend,
    width: number,
    measure: (text: string, bold: boolean) => number
): HeaderLayout {
    const legendPx = legendWidth(legend, measure);
    const hasYTitle = !!(yTitles.left || yTitles.right);
    if (!title && legendPx === 0 && !hasYTitle) return { height: 0, legendLine: 0, yTitleLine: 0 };
    const yTitleLine = title ? 1 : 0;
    // texts on the first line: the title, or the y titles when there is no title
    const firstLinePx = title
        ? measure(title, false)
        : (yTitles.left ? measure(yTitleLabel(yTitles.left, 'left'), false) : 0) +
          (yTitles.right ? measure(yTitleLabel(yTitles.right, 'right'), false) : 0);
    const legendFits = legendPx === 0 || firstLinePx + LEGEND_GAP + legendPx <= width;
    // a legend that does not fit goes to the first free line
    const legendLine = legendFits ? 0 : hasYTitle && title ? 2 : 1;
    const lines = Math.max(1, hasYTitle ? yTitleLine + 1 : 0, legendPx > 0 ? legendLine + 1 : 0);
    return { height: lines * HEADER_LINE_HEIGHT, legendLine, yTitleLine };
}

/** Height of the header strip (see `headerLayout`). */
export function headerHeight(
    title: string | undefined,
    legend: HeaderLegend,
    width: number,
    measure: (text: string, bold: boolean) => number,
    yTitles: { left?: string; right?: string } = {}
): number {
    return headerLayout(title, yTitles, legend, width, measure).height;
}
