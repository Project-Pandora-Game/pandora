import { Conjunction, EvaluateCondition, GetAngle, RotateVector } from '../../src/graphics/utility.ts';
const jest = import.meta.jest; // Jest is not properly injected in ESM

describe('GetAngle()', () => {
	const cases = [
		[84, 10, 100],
		[88, 5, 150],
		[41, 100, 88],
	];
	it.each(cases)('should return %p degree given x: %p, y: %p ',
		(result, x, y) => {
			expect(GetAngle(x, y)).toBe(result);
		});
});

describe('RotateVector()', () => {
	const cases = [
		[-7.5167402365709535, 100.21725707789011, 10, 100, 10],
		[-112.0768301881056, 99.81875642877216, 5, 150, 50.22],
		[36.945108901093235, 127.98069748320002, 100, 88, 32.55],
	];
	it.each(cases)(
		'should return [%p, %p] given x: %p, y: %p, angle: %p',
		(r1, r2, x, y, angle) => {

			expect(RotateVector(x, y, angle)).toStrictEqual([r1, r2]);
		});
});

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

describe('Conjunction()', () => {
	const cases = [
		[true, new Set(['cat', 'dog']), new Set(['cat', 'bone'])],
		[true, new Set(['cat', 'dog', 'ice', 'bowl', 'bone']), new Set(['cat', 'bone'])],
		[false, new Set(['cat', 'dog']), new Set(['sky', 'land'])],
	];
	it.each(cases)(
		'should return %p given a: %p, b: %p',
		(result, a, b) => {
			expect(Conjunction(a as Set<string>, b as Set<string>)).toBe(result);
		},
	);
});
