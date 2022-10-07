import { PseudoRandom } from '../../src/math/pseudoRandom';

describe('PseudoRandom', () => {
	describe('rand()', () => {
		it('should return a random number between 0 -> 1', () => {
			const rand = new PseudoRandom('my seed');
			for (let i = 0; i < 200; i++) {
				const num = rand.rand();
				expect(0 <= num || num <= 1).toBeTruthy();
			}
		});

		it('should provide a random number each time', () => {
			const rand = new PseudoRandom('my seed');
			for (let i = 0; i < 200; i++) {
				expect(rand.rand()).not.toEqual(rand.rand());
			}
		});

		it('should be random based on seed', () => {
			const rand1 = new PseudoRandom('my seed');
			const rand2 = new PseudoRandom('my different seed');
			for (let i = 0; i < 200; i++) {
				expect(rand1.rand()).not.toEqual(rand2.rand());
			}
		});

		it('should not be random with same seed', () => {
			const rand1 = new PseudoRandom('same seed');
			const rand2 = new PseudoRandom('same seed');
			for (let i = 0; i < 200; i++) {
				expect(rand1.rand()).toEqual(rand2.rand());
			}

		});
	});
});
