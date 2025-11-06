import { EvaluateCondition } from '../../src/graphics/utility.ts';
const jest = import.meta.jest; // Jest is not properly injected in ESM

describe('EvaluateCondition()', () => {
	const test1 = [['yes', 'no'], ['yes', 'no']];
	const test2 = [['yes', 'yes'], ['yes', 'no']];
	const fn = jest.fn((s) => s === 'yes');
	const cases = [
		[false, test1, fn],
		[true, test2, fn],
	];
	it.each(cases)(
		'should return %p',
		(result, condition, evaluate) => {

			// @ts-expect-error: test is not assignable to type Condition
			expect(EvaluateCondition(condition, evaluate)).toBe(result);
		});
});
