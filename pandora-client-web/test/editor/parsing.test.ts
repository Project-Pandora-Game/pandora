import { LayerImageOverride, TransformDefinition } from 'pandora-common';
import { ParseCondition, ParseLayerImageOverride, ParseLayerImageOverrides, ParseTransforms, SerializeLayerImageOverride, SerializeLayerImageOverrides, SerializeTransforms, SplitAndClean } from '../../src/editor/parsing.ts';

describe('SplitAndClean()', () => {
	it('should split but trim and filter out items', () => {
		expect(SplitAndClean(' , test1   , test2, , test3, , ', ','))
			.toStrictEqual(['test1', 'test2', 'test3']);
	});
});

describe('ParseCondition()', () => {
	it('should parse bone from string', () => {
		expect(ParseCondition('test_bone=10', ['test_bone']))
			.toStrictEqual([[{
				bone: 'test_bone',
				operator: '=',
				value: 10,
			}]]);
	});
});

describe('Transforms', () => {

	const mocktransform: TransformDefinition = {
		type: 'rotate',
		value: 10,
		bone: 'base_bone',
		condition: [
			[
				{
					bone: 'test_bone',
					operator: '=',
					value: 10,
				},
			],
		],
	};

	const mockSerialize = 'rotate base_bone 10 test_bone=10\nrotate base_bone 10 test_bone=10';

	describe('ParseTransforms()', () => {
		it('should parse string to transforms', () => {
			expect(ParseTransforms(mockSerialize, ['test_bone', 'base_bone']))
				.toStrictEqual([mocktransform, mocktransform]);
		});

		it('should throw error if bone is not valid', () => {
			expect(() => ParseTransforms(mockSerialize, ['invalid_bone'])).toThrow();
		});

	});
	describe('SerializeTransforms()', () => {
		it('should serialize TransformDefinition into string', () => {
			expect(SerializeTransforms([mocktransform, mocktransform]))
				.toBe(mockSerialize);
		});
	});

});

describe('LayerImageOverride', () => {
	const mockImageOverride: LayerImageOverride = {
		image: 'test_image',
		condition: [[{
			bone: 'test_bone',
			operator: '=',
			value: 10,
		}]],
	};

	const serializeImageOverride = 'test_bone=10 test_image';

	describe('ParseLayerImageOverride()', () => {
		expect(ParseLayerImageOverride(serializeImageOverride, ['test_bone']))
			.toStrictEqual(mockImageOverride);
	});

	describe('SerializeLayerImageOverride()', () => {
		it('should serialize image override', () => {
			expect(SerializeLayerImageOverride(mockImageOverride))
				.toBe(serializeImageOverride);
		});
	});

	describe('ParseLayerImageOverrides()', () => {
		expect(ParseLayerImageOverrides(serializeImageOverride + '\n' + serializeImageOverride, ['test_bone']))
			.toStrictEqual([mockImageOverride, mockImageOverride]);
	});

	describe('SerializeLayerImageOverrides()', () => {
		expect(SerializeLayerImageOverrides([mockImageOverride, mockImageOverride]))
			.toBe(serializeImageOverride + '\n' + serializeImageOverride);
	});
});
