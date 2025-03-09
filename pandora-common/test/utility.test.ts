import { describe, expect, it } from '@jest/globals';
import { IntervalSetIntersection, IntervalSetUnion, ReadonlyIntervalSet } from '../src/index.ts';

describe('IntervalSet utilities', () => {
	// Set of test cases - a, b, a∩b, a∪b
	describe.each<[ReadonlyIntervalSet, ReadonlyIntervalSet, ReadonlyIntervalSet, ReadonlyIntervalSet]>([
		[ // Empty
			[],
			[],
			[],
			[],
		],
		[ // One empty
			[[1, 5], [10, 20], [111, 112]],
			[],
			[],
			[[1, 5], [10, 20], [111, 112]],
		],
		[ // Exactly matching intervals
			[[1, 5], [10, 20], [111, 112]],
			[[10, 20]],
			[[10, 20]],
			[[1, 5], [10, 20], [111, 112]],
		],
		[ // Subinterval
			[[1, 5], [10, 20], [111, 112]],
			[[6, 25]],
			[[10, 20]],
			[[1, 5], [6, 25], [111, 112]],
		],
		[ // Left-overlap
			[[1, 5], [10, 20], [111, 112]],
			[[6, 15]],
			[[10, 15]],
			[[1, 5], [6, 20], [111, 112]],
		],
		[ // Right-overlap
			[[1, 5], [10, 20], [111, 112]],
			[[15, 25]],
			[[15, 20]],
			[[1, 5], [10, 25], [111, 112]],
		],
		[ // Multiple subintervals 1
			[[1, 5], [10, 20], [111, 112]],
			[[10, 12], [19, 25]],
			[[10, 12], [19, 20]],
			[[1, 5], [10, 25], [111, 112]],
		],
		[ // Multiple subintervals 2
			[[1, 5], [10, 20], [111, 112]],
			[[7, 12], [14, 16], [18, 22]],
			[[10, 12], [14, 16], [18, 20]],
			[[1, 5], [7, 22], [111, 112]],
		],
		[ // Edge-overlap
			[[1, 5], [10, 20], [111, 112]],
			[[20, 30]],
			[[20, 20]],
			[[1, 5], [10, 30], [111, 112]],
		],
		[ // Touching (does not merge neighbors)
			[[1, 5], [10, 20], [111, 112]],
			[[21, 30]],
			[],
			[[1, 5], [10, 20], [21, 30], [111, 112]],
		],
	])('Interval operations', (a, b, expectedIntersection, expectedUnion) => {
		it('Performs intersection', () => {
			expect(IntervalSetIntersection(a, b)).toStrictEqual(expectedIntersection);
		});

		it('Performs intersection (symmetric)', () => {
			expect(IntervalSetIntersection(b, a)).toStrictEqual(expectedIntersection);
		});

		it('Performs union', () => {
			expect(IntervalSetUnion(a, b)).toStrictEqual(expectedUnion);
		});

		it('Performs union (symmetric)', () => {
			expect(IntervalSetUnion(b, a)).toStrictEqual(expectedUnion);
		});
	});
});
