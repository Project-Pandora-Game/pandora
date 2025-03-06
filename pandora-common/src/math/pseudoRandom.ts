import { Assert } from '../utility';

/* eslint-disable no-bitwise */
export class PseudoRandom {
	private hash: [number, number, number, number];
	constructor(seed: string) {
		this.hash = this.cyrb128(seed);
	}

	private cyrb128(str: string): [number, number, number, number] {
		let h1 = 1779033703; let h2 = 3144134277;
		let h3 = 1013904242; let h4 = 2773480762;
		for (let i = 0, k; i < str.length; i++) {
			k = str.charCodeAt(i);
			h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
			h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
			h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
			h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
		}
		h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
		h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
		h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
		h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
		return [(h1 ^ h2 ^ h3 ^ h4) >>> 0, (h2 ^ h1) >>> 0, (h3 ^ h1) >>> 0, (h4 ^ h1) >>> 0];
	}

	/** random between 0 -> 1 and uses xoshiro128ss under the hood */
	public random(): number {
		const h = this.cyrb128(this.hash.toString());

		let a = h[0];
		let b = h[1];
		let c = h[2];
		let d = h[3];
		this.hash = h;

		const t = b << 9; let r = a * 5; r = (r << 7 | r >>> 25) * 9;
		c ^= a; d ^= b;
		b ^= c; a ^= d; c ^= t;
		d = d << 11 | d >>> 21;
		return (r >>> 0) / 4294967296;
	}

	/**
	 * Returns a random float in the range [min, max)
	 * @param min - Minimum value, inclusive
	 * @param max - Maximum value, exclusive
	 * @returns
	 */
	public between(min: number, max: number): number {
		if (min > max) throw Error(`min(${min}) cannot be larger than max(${max})`);

		return (max - min) * this.random() + min;
	}

	/**
	 * Generate boolean that is truthy with certain probability.
	 * @param probability - Probability of the result being truthy, must be in range [0, 1].
	 */
	public prob(probability: number): boolean {
		Assert(probability >= 0 && probability <= 1, `Probability needs to be between 0 and 1 (inclusive), got ${probability}`);

		return this.random() < probability;
	}

	public randomElement<T>(array: ArrayLike<T>): T {
		return array[Math.round(this.between(0, array.length - 1))];
	}

	private quickHash(s: string): number {
		let hash = 0;
		if (s.length === 0) return hash;
		for (let i = 0; i < s.length; i++) {
			const char = s.charCodeAt(i);

			hash = ((hash << 5) - hash) + char;

			hash &= hash; // Convert to 32bit integer
		}
		return hash;
	}
}
