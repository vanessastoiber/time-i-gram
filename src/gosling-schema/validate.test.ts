import { validateGoslingSpec, validateTrack } from '@gosling-lang/gosling-schema';
import { EX_SPEC_CYTOBANDS } from '../../editor/example/json-spec/ideograms';

describe('Validate Spec', () => {
    it('Example Specs', () => {
        expect(validateGoslingSpec(EX_SPEC_CYTOBANDS).state).toEqual('success');
        expect(validateGoslingSpec(delete (EX_SPEC_CYTOBANDS as any).views).state).not.toEqual('success');
    });

    it('rejects a temporal y channel with a clear message', () => {
        const track = {
            data: { type: 'csv-time', url: '' },
            mark: 'point',
            x: { field: 'g', type: 'genomic' },
            y: { field: 't', type: 'temporal' },
            width: 100,
            height: 100
        } as any;
        expect(validateGoslingSpec({ tracks: [track] }).state).not.toEqual('success');
        const { valid, errorMessages } = validateTrack(track);
        expect(valid).toEqual(false);
        expect(errorMessages).toContain('`temporal` is only supported on x channels (x, xe, x1, x1e), not on `y`');
    });

    it('accepts a temporal x channel', () => {
        const track = {
            data: { type: 'csv-time', url: '' },
            mark: 'point',
            x: { field: 't', type: 'temporal' },
            y: { field: 'v', type: 'quantitative' },
            width: 100,
            height: 100
        } as any;
        expect(validateGoslingSpec({ tracks: [track] }).state).toEqual('success');
        expect(validateTrack(track).valid).toEqual(true);
    });
});
