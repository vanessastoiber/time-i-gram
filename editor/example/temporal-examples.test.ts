import fs from 'fs';
import path from 'path';
import { compile } from '../../src/compiler/compile';
import { getTheme } from '../../src/core/utils/theme';
import { validateGoslingSpec, type GoslingSpec } from '@gosling-lang/gosling-schema';
import { EX_SPEC_TEMPORAL_OVERVIEW_DETAIL } from './json-spec/temporal-data_overview-detail';
import { EX_SPEC_TEMPORAL_SEATTLE_WEATHER } from './spec/temporal-data_seattle-weather';
import { EX_SPEC_TEMPORAL_UNEMPLOYMENT_CIRCULAR_LINEAR } from './spec/temporal-data_unemployment-circular-linear';
import { EX_SPEC_TEMPORAL_SUPP_UNEMPLOYMENT } from './spec/temporal-data_supp-unemployment';
import { EX_SPEC_TEMPORAL_SUPP_SEATTLE_WEATHER } from './spec/temporal-data_supp-seattle-weather';
import { EX_SPEC_TEMPORAL_SUPP_SOLAR_WEATHER } from './spec/temporal-data_supp-solar-weather';
import { EX_SPEC_TEMPORAL_SUPP_NYC_TAXI } from './spec/temporal-data_supp-nyc-taxi';
import { EX_SPEC_TEMPORAL_SUPP_WHO_FLU } from './spec/temporal-data_supp-who-flu';
import { EX_SPEC_TEMPORAL_SUPP_FITBIT } from './spec/temporal-data_supp-fitbit';
import { EX_SPEC_TEMPORAL_WHO_FLU_PERIOD } from './spec/temporal-data_who-flu-period';
import { EX_SPEC_TEMPORAL_FITBIT_CYCLES } from './spec/temporal-data_fitbit-cycles';
import { EX_SPEC_TEMPORAL_UNEMPLOYMENT_GRANULARITY } from './spec/temporal-data_unemployment-granularity';

/** The JS code blocks of README.md that build a spec, evaluated to the spec object. */
function readmeSpecs(): Record<string, GoslingSpec> {
    const md = fs.readFileSync(path.resolve(__dirname, '../../README.md'), 'utf8');
    const running = md.slice(md.indexOf('const CSV_URL'), md.indexOf('embed(document.getElementById("container"), spec);'));
    const quickStart = md.slice(md.indexOf("const spec = {\n  title: 'Seattle Weather'"), md.indexOf('function App()'));
    return {
        'README running example': new Function(`${running}; return spec;`)(),
        'README quick start': new Function(`${quickStart}; return spec;`)()
    };
}

const examples: Record<string, GoslingSpec> = {
    'overview-detail': EX_SPEC_TEMPORAL_OVERVIEW_DETAIL,
    'seattle-weather': EX_SPEC_TEMPORAL_SEATTLE_WEATHER,
    'unemployment-circular-linear': EX_SPEC_TEMPORAL_UNEMPLOYMENT_CIRCULAR_LINEAR,
    'supp S3 unemployment': EX_SPEC_TEMPORAL_SUPP_UNEMPLOYMENT,
    'supp S4 seattle weather': EX_SPEC_TEMPORAL_SUPP_SEATTLE_WEATHER,
    'supp S5 solar and weather': EX_SPEC_TEMPORAL_SUPP_SOLAR_WEATHER,
    'supp S6 NYC taxi': EX_SPEC_TEMPORAL_SUPP_NYC_TAXI,
    'supp S7 WHO flu': EX_SPEC_TEMPORAL_SUPP_WHO_FLU,
    'supp S8 FitBit': EX_SPEC_TEMPORAL_SUPP_FITBIT,
    'period: WHO flu': EX_SPEC_TEMPORAL_WHO_FLU_PERIOD,
    'period: FitBit cycles': EX_SPEC_TEMPORAL_FITBIT_CYCLES,
    'granularity: unemployment': EX_SPEC_TEMPORAL_UNEMPLOYMENT_GRANULARITY,
    ...readmeSpecs()
};

/** Compile a spec and return the HiGlass view config. */
function compileToHiGlass(spec: GoslingSpec) {
    let hiGlassSpec: any;
    compile(JSON.parse(JSON.stringify(spec)), hs => (hiGlassSpec = hs), [], getTheme(), {});
    return hiGlassSpec;
}

/** Initial x domains of the compiled views that contain a temporal track. */
function temporalViewDomains(spec: GoslingSpec): number[][] {
    return compileToHiGlass(spec)
        .views.filter((view: any) => JSON.stringify(view.tracks).includes('"type":"temporal"'))
        .map((view: any) => view.initialXDomain as number[]);
}

/**
 * Titles (or marks) of tracks that draw marks but have no data, neither their own nor inherited from an
 * enclosing view or track group. The compiler silently drops such tracks, so they would not appear at all.
 */
function tracksWithoutData(spec: any): string[] {
    const missing: string[] = [];
    const visit = (node: any, inherited: { data?: unknown; mark?: string }) => {
        const scope = { data: node.data ?? inherited.data, mark: node.mark ?? inherited.mark };
        const children = [...(node.views ?? []), ...(node.tracks ?? [])];
        if (children.length > 0) {
            children.forEach(child => visit(child, scope));
        } else if (scope.mark !== 'brush' && !scope.data) {
            missing.push(node.title ?? scope.mark ?? 'untitled track');
        }
    };
    visit(spec, {});
    return missing;
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

    it('gives every track that draws marks a data source', () => {
        expect(tracksWithoutData(spec)).toEqual([]);
    });
});

describe('temporal example "supp S8 FitBit"', () => {
    const spec = EX_SPEC_TEMPORAL_SUPP_FITBIT as any;
    const dailyActivity = spec.views[0].views[1];

    it('starts at the recording period of the heart-rate data (12 April to 12 May 2016)', () => {
        expect(spec.xDomain.interval).toEqual([Date.UTC(2016, 3, 12) / 1000, Date.UTC(2016, 4, 13) / 1000]);
    });

    it('colors calories as a quantitative field', () => {
        expect(dailyActivity.tracks[0].color.type).toEqual('quantitative');
    });
});
