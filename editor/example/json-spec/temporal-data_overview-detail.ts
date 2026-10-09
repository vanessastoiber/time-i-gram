import type { GoslingSpec } from '@gosling-lang/gosling-schema';

const data = {
    url: 'https://raw.githubusercontent.com/vega/vega/main/docs/data/unemployment-across-industries.json',
    type: 'json-time' as const,
    dateFields: ['date']
};

// January 2000 to March 2010, the extent of the dataset (Unix seconds)
const domain = { interval: [946684800, 1267401600] as [number, number] };

const detail = (series: string, color: string) => ({
    title: series,
    dataTransform: [{ type: 'filter' as const, field: 'series', oneOf: [series] }],
    data,
    mark: 'line' as const,
    color: { value: color },
    x: { field: 'date', type: 'temporal' as const, axis: 'bottom' as const, linkingId: 'linking-with-brush', domain },
    y: { field: 'count', type: 'quantitative' as const, domain: [50, 2500], title: 'Unemployed (thousands)' },
    width: 800,
    height: 100
});

export const EX_SPEC_TEMPORAL_OVERVIEW_DETAIL: GoslingSpec = {
    title: 'How many people were unemployed in each industry, 2000 to 2010?',
    subtitle: 'Brush the overview to zoom the five detail tracks. Source: U.S. Bureau of Labor Statistics',
    description: '',
    tracks: [
        {
            title: 'Overview (brush to zoom)',
            data,
            dataTransform: [
                {
                    type: 'filter',
                    field: 'series',
                    oneOf: ['Government', 'Manufacturing', 'Construction', 'Information', 'Education and Health']
                }
            ],
            mark: 'line',
            // the colors of the detail tracks, so that this legend explains them as well
            color: {
                field: 'series',
                type: 'nominal',
                domain: ['Government', 'Manufacturing', 'Construction', 'Information', 'Education and Health'],
                range: ['#d62728', '#2ca02c', '#1f77b4', '#ff7f0e', '#9467bd'],
                legend: true,
                title: 'Industry'
            },
            x: { field: 'date', type: 'temporal', axis: 'bottom', domain },
            // the overview shows the shapes only: the detail tracks have the y axes
            y: { field: 'count', type: 'quantitative', axis: 'none' },
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
            height: 80
        },
        detail('Government', '#d62728'),
        detail('Manufacturing', '#2ca02c'),
        detail('Construction', '#1f77b4'),
        detail('Information', '#ff7f0e'),
        detail('Education and Health', '#9467bd')
    ]
};
