import type { GoslingSpec } from '@gosling-lang/gosling-schema';

// WHO flu (USA), rebuilt with the period coordinate system from the original `who_flu_usa.csv`.
// Supplementary Fig. S7 / paper Fig. 1A drew its ring from a hand-made file in which every date was moved
// into 2010; here `period` wraps the time axis by year instead. The years are ISO week-based (`weekBased`),
// so ISO week 1 is at 12 o'clock in every year, also when it starts in late December (2014-W01 starts on
// 2013-12-30).
//
// Time coordinate systems: the ring and the season comparison share the period system
// "year, ISO weeks", so the brush on the ring drives the comparison view; the timeline below is absolute
// time and is linked to neither.

// The ISO_SDATE column holds local (CET) midnight exported as UTC, i.e. Sunday 23:00 UTC, which falls in the
// previous ISO week. So the dates are read from the year and week columns: with `includesCalendarWeek`,
// the Monday of each ISO week is stored, as Unix seconds, in the first field (`ISO_YEAR`).
const FLU = {
    url: 'https://raw.githubusercontent.com/vanessastoiber/thesis-datasets/main/5_who-flu/who_flu_usa.csv',
    type: 'csv-time',
    dateFields: ['ISO_YEAR', 'ISO_WEEK'],
    includesCalendarWeek: true
} as const;

/** Wrap the time axis by ISO week-based year; each row's year is stored in the field `year`. */
const PERIOD = { unit: 'year', weekBased: true, newField: 'year' } as const;

const YEAR_COLOR = {
    field: 'year',
    type: 'nominal',
    domain: ['2010', '2011', '2012', '2013', '2014'],
    range: ['#C635BB', '#E5C011', '#12C340', '#1279C3', '#CC2F06'],
    title: 'Year'
} as const;

const CASES = { field: 'INF_A', type: 'quantitative', domain: [0, 14000], title: 'Cases per week' } as const;

const spec = {
    title: 'When in the year does influenza A peak?',
    subtitle: 'Weekly influenza A cases in the USA, 2010 to 2014. Brush the ring to compare weeks across years.',
    arrangement: 'vertical',
    views: [
        {
            arrangement: 'horizontal',
            views: [
                {
                    // --- Ring: every year on one revolution, week 1 at 12 o'clock ---
                    layout: 'circular',
                    centerRadius: 0.45,
                    tracks: [
                        {
                            alignment: 'overlay',
                            data: FLU,
                            x: { field: 'ISO_YEAR', type: 'temporal', period: PERIOD, axis: 'top' },
                            y: CASES,
                            tracks: [
                                { mark: 'line', color: { ...YEAR_COLOR, legend: true }, size: { value: 2 } },
                                // a brush in the period coordinate system: it selects weeks of every year at once
                                {
                                    mark: 'brush',
                                    x: { linkingId: 'weeks' },
                                    color: { value: 'gray' },
                                    opacity: { value: 0.12 }
                                }
                            ],
                            width: 380,
                            height: 120
                        }
                    ]
                },
                {
                    // --- Season comparison: the same period system on a linear axis, driven by the brush ---
                    tracks: [
                        {
                            title: 'Selected weeks, every year',
                            data: FLU,
                            mark: 'line',
                            x: {
                                field: 'ISO_YEAR',
                                type: 'temporal',
                                period: PERIOD,
                                axis: 'bottom',
                                linkingId: 'weeks'
                            },
                            y: { ...CASES, axis: 'left' },
                            color: { ...YEAR_COLOR, legend: true },
                            size: { value: 2 },
                            width: 420,
                            height: 380
                        }
                    ]
                }
            ]
        },
        {
            // --- Timeline: absolute time, a separate coordinate system (not linked to the period views) ---
            tracks: [
                {
                    title: 'All weeks, 2010 to 2014',
                    data: FLU,
                    mark: 'bar',
                    x: { field: 'ISO_YEAR', type: 'temporal', axis: 'bottom', domain: { interval: ['2010', '2014'] } },
                    y: CASES,
                    color: { value: 'black' },
                    size: { value: 2 },
                    width: 820,
                    height: 100
                }
            ]
        }
    ]
};

export const EX_SPEC_TEMPORAL_WHO_FLU_PERIOD = spec as unknown as GoslingSpec;
