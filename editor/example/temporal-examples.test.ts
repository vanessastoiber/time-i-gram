import { compile } from '../../src/compiler/compile';
import { getTheme } from '../../src/core/utils/theme';
import { validateGoslingSpec, type GoslingSpec } from '@gosling-lang/gosling-schema';
import { EX_SPEC_TEMPORAL_OVERVIEW_DETAIL } from './json-spec/temporal-data_overview-detail';
import { EX_SPEC_TEMPORAL_SEATTLE_WEATHER } from './spec/temporal-data_seattle-weather';
import { EX_SPEC_TEMPORAL_UNEMPLOYMENT_CIRCULAR_LINEAR } from './spec/temporal-data_unemployment-circular-linear';

const examples: Record<string, GoslingSpec> = {
    'overview-detail': EX_SPEC_TEMPORAL_OVERVIEW_DETAIL,
    'seattle-weather': EX_SPEC_TEMPORAL_SEATTLE_WEATHER,
    'unemployment-circular-linear': EX_SPEC_TEMPORAL_UNEMPLOYMENT_CIRCULAR_LINEAR
};

/** Initial x domains of the compiled views that contain a temporal track. */
function temporalViewDomains(spec: GoslingSpec): number[][] {
    let domains: number[][] = [];
    compile(
        JSON.parse(JSON.stringify(spec)),
        hs => {
            domains = hs.views
                .filter(view => JSON.stringify(view.tracks).includes('"type":"temporal"'))
                .map(view => view.initialXDomain as number[]);
        },
        [],
        getTheme(),
        {}
    );
    return domains;
}

describe.each(Object.entries(examples))('temporal example "%s"', (_, spec) => {
    it('is valid, so the editor renders it', () => {
        const { state, details } = validateGoslingSpec(spec);
        expect(state, details).toEqual('success');
    });

    it('starts every temporal view at an explicit time domain, not the genomic default', () => {
        const domains = temporalViewDomains(spec);
        expect(domains.length).toBeGreaterThan(0);
        // without a domain, the view falls back to the length of hg38 (0 to 3,088,269,832), i.e. 1970-2067
        domains.forEach(domain => expect(domain).not.toEqual([0, 3088269832]));
    });
});
