import { describe, expect, it } from '@jest/globals';
import type { GraphicsBuildContext } from '../../../src/assets/graphicsBuilding/graphicsBuildContext.ts';
import { LoadLayerImageSetting, type GraphicsBuildImageResource } from '../../../src/assets/graphicsBuilding/graphicsBuildImageResource.ts';

function Context(maskCapability: boolean) {
	const calls: string[] = [];
	const resource = (name: string): GraphicsBuildImageResource => ({
		resultName: name,
		addCutImageRelative: () => {
			calls.push(`cut:${name}`); return resource(`${name}_cut`);
		},
		addDownscaledImage: (resolution) => {
			calls.push(`resolution:${name}:${resolution}`); return resource(`${name}_r${resolution}`);
		},
		addMaskImage: maskCapability ? () => {
			calls.push(`mask:${name}`); return resource(`${name}_mask`);
		} : undefined,
		addResizedImage: () => {
			throw new Error('Unexpected resize');
		},
		addSizeCheck: () => {
			return;
		},
		getSize: () => Promise.resolve({ width: 100, height: 100 }),
		getContentBoundingBox: () => {
			throw new Error('Unexpected bounds');
		},
	});
	const context: Pick<GraphicsBuildContext<unknown>, 'loadImage' | 'generateResolutions'> = {
		loadImage: resource,
		generateResolutions: [0.5],
	};
	return { calls, context: context as GraphicsBuildContext<unknown> };
}

const setting = { image: 'base.png', normalMapImage: 'normal.png', overrides: [{ image: 'override.png', normalMapImage: 'overrideNormal.png', condition: [] }] };

describe('optional mask image build capability', () => {
	it('converts base and override masks after crop, while normal maps and ordinary images retain their pipeline', () => {
		const { calls, context } = Context(true);
		const result = LoadLayerImageSetting(setting, context, [0, 0, 1, 1], true);
		expect(result.image).toBe('base.png_cut_mask');
		expect(result.overrides[0].image).toBe('override.png_cut_mask');
		expect(result.normalMapImage).toBe('normal.png_cut');
		expect(result.overrides[0].normalMapImage).toBe('overrideNormal.png_cut');
		expect(calls.filter((call) => call.startsWith('mask:'))).toEqual(['mask:override.png_cut', 'mask:base.png_cut']);
		expect(calls).toContain('resolution:base.png_cut_mask:0.5');
		calls.length = 0;
		expect(LoadLayerImageSetting(setting, context, null).image).toBe('base.png');
		expect(calls.some((call) => call.startsWith('mask:'))).toBe(false);
	});

	it('keeps older builders and mocks compatible without mask support', () => {
		const { calls, context } = Context(false);
		expect(LoadLayerImageSetting(setting, context, null, true).image).toBe('base.png');
		expect(calls.some((call) => call.startsWith('mask:'))).toBe(false);
	});
});
