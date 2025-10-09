import { TransformDefinition } from 'pandora-common';
import { ParseCondition, ParseTransforms, SerializeTransforms, SplitAndClean } from '../../src/editor/parsing.ts';

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
