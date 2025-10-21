import { describe, expect, it } from '@jest/globals';
import { Vector2GetAngle, Vector2Rotate } from '../../../src/index.ts';

describe('Vector2GetAngle()', () => {
	const cases = [
		[84, 10, 100],
		[88, 5, 150],
		[41, 100, 88],
	];
	it.each(cases)('should return %p degree given x: %p, y: %p ',
		(result, x, y) => {
			expect(Vector2GetAngle(x, y)).toBe(result);
		});
});

describe('Vector2Rotate()', () => {
	const cases = [
		[-7.5167402365709535, 100.21725707789011, 10, 100, 10],
		[-112.0768301881056, 99.81875642877216, 5, 150, 50.22],
		[36.945108901093235, 127.98069748320002, 100, 88, 32.55],
	];
	it.each(cases)(
		'should return [%p, %p] given x: %p, y: %p, angle: %p',
		(r1, r2, x, y, angle) => {

			expect(Vector2Rotate(x, y, angle)).toStrictEqual([r1, r2]);
		});
});
