import type { GoslingSpec } from '@gosling-lang/gosling-schema';

const data = {
    url: 'https://raw.githubusercontent.com/vega/vega/main/docs/data/unemployment-across-industries.json',
    type: 'json-time' as const,
    dateFields: ['date']
};

// January 2000 to March 2010, the extent of the dataset (Unix seconds)
const domain = { interval: [946684800, 1267401600] as [number, number] };

const detail = (series: string, color: string) => ({
    title: `Detail (${series})`,
    dataTransform: [{ type: 'filter' as const, field: 'series', oneOf: [series] }],
    data,
    mark: 'line' as const,
    color: { value: color },
    x: { field: 'date', type: 'temporal' as const, axis: 'bottom' as const, linkingId: 'linking-with-brush', domain },
    y: { field: 'count', type: 'quantitative' as const, domain: [50, 2500] },
    width: 800,
    height: 80
});

export const EX_SPEC_TEMPORAL_OVERVIEW_DETAIL: GoslingSpec = {
    title: 'Temporal Data',
    subtitle: 'Unemployment rates',
    description: '',
    tracks: [
        {
            title: 'Overview',
            data,
            dataTransform: [
                {
                    type: 'filter',
                    field: 'series',
                    oneOf: ['Government', 'Manufacturing', 'Construction', 'Information', 'Education and Health']
                }
            ],
            mark: 'line',
            color: { field: 'series', type: 'nominal' },
            x: { field: 'date', type: 'temporal', axis: 'bottom', domain },
            y: { field: 'count', type: 'quantitative' },
            alignment: 'overlay',
            tracks: [
                {},
                {
                    mark: 'brush',
                    x: { linkingId: 'linking-with-brush' },
                    color: { value: 'steelBlue' }
                }
            ],
            width: 800,
            height: 50
        },
        detail('Government', '#d62728'),
        detail('Manufacturing', '#2ca02c'),
        detail('Construction', '#1f77b4'),
        detail('Information', '#ff7f0e'),
        detail('Education and Health', '#9467bd')
    ]
};
