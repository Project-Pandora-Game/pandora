import { ParseCondition, SplitAndClean } from '../../src/editor/parsing.ts';

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

