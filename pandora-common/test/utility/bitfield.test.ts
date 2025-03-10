import { describe, expect, it } from '@jest/globals';
import { BitField } from '../../src/utility/bitfield.ts';

describe('BitField', () => {
	const SET_CLEAR_TEST_SIZE = 26; // Intentionally not a multiple of 8 to test that testcase

	it('Starts with correct size and empty', () => {
		const bf = new BitField(SET_CLEAR_TEST_SIZE);

		expect(bf.length).toBeGreaterThanOrEqual(SET_CLEAR_TEST_SIZE);
		for (let i = 0; i < SET_CLEAR_TEST_SIZE; i++) {
			expect(bf.get(i)).toBe(false);
		}
	});

	it('Sets and gets the correct bits', () => {
		for (let i = 0; i < SET_CLEAR_TEST_SIZE; i++) {
			const bf = new BitField(SET_CLEAR_TEST_SIZE);

			bf.set(i, true);

			for (let j = 0; j < SET_CLEAR_TEST_SIZE; j++) {
				expect(bf.get(j)).toBe(i === j);
			}
		}
	});

	it('Sets, clears and gets the correct bits', () => {
		for (let i = 0; i < SET_CLEAR_TEST_SIZE; i++) {
			const bf = new BitField(SET_CLEAR_TEST_SIZE);

			for (let j = 0; j < SET_CLEAR_TEST_SIZE; j++) {
				bf.set(j, true);
			}
			for (let j = 0; j < SET_CLEAR_TEST_SIZE; j++) {
				expect(bf.get(j)).toBe(true);
			}

			bf.set(i, false);

			for (let j = 0; j < SET_CLEAR_TEST_SIZE; j++) {
				expect(bf.get(j)).toBe(i !== j);
			}
		}
	});

	it('Provides and accepts a buffer', () => {
		const TEST_BIT = 3;

		const bf1 = new BitField(SET_CLEAR_TEST_SIZE);
		bf1.set(TEST_BIT, true);

		for (let i = 0; i < SET_CLEAR_TEST_SIZE; i++) {
			expect(bf1.get(i)).toBe(i === TEST_BIT);
		}

		const bf2 = new BitField(bf1.buffer);

		for (let i = 0; i < SET_CLEAR_TEST_SIZE; i++) {
			expect(bf2.get(i)).toBe(i === TEST_BIT);
		}
	});
});
