import type { GoslingSpec } from '@gosling-lang/gosling-schema';

// Supplementary material, Fig. S8 (FitBit Activity and Heart Rate Data; paper Fig. 5).
// Copied from the supplementary PDF. Fixed since (docs/grammar-audit.md §7): the domain covers the
// recording period (12 April to 12 May 2016) instead of March to June.
// Since the review of the examples:
// - the daily activity is that of the same participant as the heart rate (it was another participant);
// - heart rate is drawn as means by minute while less than two days are visible, by hour above
//   (`timeUnit` rules): the raw data has a value every few seconds (154,000), which made the views slow;
// - bars (steps) and line (very active minutes) are named in a legend and on their axes, and the bars have
//   one color (calories were encoded by color without a legend).

const PARTICIPANT = [{ type: 'filter', field: 'Id', oneOf: ['2022484408'] }] as const;

const HEART_RATE = {
    url: 'https://raw.githubusercontent.com/vanessastoiber/thesis-datasets/main/6_fitbit/heartrate_seconds_merged.csv',
    type: 'csv-time',
    dateFields: ['Time']
} as const;

/** Mean heart rate by minute while less than 2 days are visible, by hour above. */
const MINUTE_THEN_HOUR = [{ unit: 'minute', maxSpan: '2 days' }, { unit: 'hour' }];

const HEART_RATE_Y = {
    field: 'Value',
    type: 'quantitative',
    aggregate: 'mean',
    domain: [50, 200],
    title: 'Heart rate (bpm)'
} as const;

const fitbitSpec = {
    title: 'How do activity and heart rate change from day to day?',
    subtitle: 'One FitBit user, 12 April to 12 May 2016. Zoom or pan any view.',
    arrangement: 'horizontal',
    xDomain: { interval: ['2016-04-12', '2016-05-12'] },
    views: [
        {
            arrangement: 'vertical',
            spacing: 0,
            views: [
                {
                    tracks: [
                        {
                            title: 'Heart rate (hourly means; by minute when zoomed in)',
                            dataTransform: PARTICIPANT,
                            data: HEART_RATE,
                            mark: 'line',
                            color: { value: 'red' },
                            x: {
                                field: 'Time',
                                type: 'temporal',
                                axis: 'none',
                                timeUnit: MINUTE_THEN_HOUR,
                                linkingId: 'linking-with-brush'
                            },
                            y: HEART_RATE_Y,
                            width: 400,
                            height: 130
                        }
                    ]
                },
                {
                    alignment: 'overlay',
                    title: 'Daily activity',
                    dataTransform: PARTICIPANT,
                    data: {
                        url: 'https://raw.githubusercontent.com/vanessastoiber/thesis-datasets/main/6_fitbit/dailyActivity_merged.csv',
                        type: 'csv-time',
                        dateFields: ['ActivityDate']
                    },
                    x: {
                        field: 'ActivityDate',
                        type: 'temporal',
                        axis: 'bottom',
                        linkingId: 'linking-with-brush'
                    },
                    width: 400,
                    height: 150,
                    tracks: [
                        {
                            mark: 'bar',
                            size: { value: 6 },
                            color: { value: '#f28e2b' },
                            y: {
                                field: 'TotalSteps',
                                type: 'quantitative',
                                domain: [0, 20000],
                                title: 'Steps'
                            },
                            style: { legendTitle: 'Daily', legendLabel: 'Steps (bars)' }
                        },
                        {
                            mark: 'line',
                            color: { value: 'black' },
                            y: {
                                field: 'VeryActiveMinutes',
                                type: 'quantitative',
                                domain: [0, 80],
                                axis: 'right',
                                title: 'Very active minutes'
                            },
                            style: { legendLabel: 'Very active minutes (line)' }
                        }
                    ]
                }
            ]
        },
        {
            views: [
                {
                    layout: 'circular',
                    centerRadius: 0.5,
                    tracks: [
                        {
                            title: 'Heart rate around the month',
                            dataTransform: PARTICIPANT,
                            data: HEART_RATE,
                            mark: 'line',
                            color: { value: 'red' },
                            x: {
                                field: 'Time',
                                type: 'temporal',
                                axis: 'bottom',
                                timeUnit: MINUTE_THEN_HOUR,
                                linkingId: 'linking-with-brush'
                            },
                            y: HEART_RATE_Y,
                            width: 300,
                            height: 40
                        }
                    ]
                }
            ]
        }
    ]
};

export const EX_SPEC_TEMPORAL_SUPP_FITBIT = fitbitSpec as unknown as GoslingSpec;
