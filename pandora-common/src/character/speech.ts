import _ from 'lodash';
import { EFFECTS_DEFAULT } from '../assets/effects';
import { PseudoRandom } from '../math/pseudoRandom';

export type MuffleSettings = {
	/**
	 * Muffle lips related sounds (`b`, `d`, `g`, `p`,...)
	 *
	 * Effective value range:
	 * - 0 = no effect
	 * - 10 = completely muffled
	 */
	lipsTouch: number,

	/**
	 * Muffle jaws related sounds (`z`, `s`)
	 *
	 * Effective value range:
	 * - 0 = no effect
	 * - 10 = completely muffled
	 */
	jawMove: number,

	/**
	 * Muffle tongue related sounds (`r`, `re`, `k`, `c`,...)
	 *
	 * Effective value range:
	 * - 0 = no effect
	 * - 10 = completely muffled
	 */
	tongueRoof: number,
	/**
	 * Muffle air breath sounds (`th`, `tph`, `ch`,...)
	 *
	 * Effective value range:
	 * - 0 = no effect
	 * - 10 = completely muffled
	 */
	mouthBreath: number,
	/**
	 * Muffle strong throat vibration sounds (`gh`, `c`, `ch`, `gi`,...)
	 *
	 * Effective value range:
	 * - 0 = no effect
	 * - 10 = completely muffled
	 */
	throatBreath: number,
	/**
	 * Muffle hinting letters (h, j, l, r, v, w, x, y, q)
	 *
	 * Effective value range:
	 * - 0 = no effect
	 * - 10 = completely muffled
	 */
	coherency: number,
	/**
	 * Create stutter effects for the sentence.
	 *
	 * Effective value range:
	 * - 0 = no effect
	 * - 10 = high amounts of stutter
	 */
	stimulus: number,
};

export class Muffler {
	private salt: string;
	private setting: MuffleSettings;

	constructor(salt: string, setting?: Partial<MuffleSettings>) {
		this.salt = salt;
		this.setting = {
			...EFFECTS_DEFAULT,
			...setting,
		};
	}

	isActive(): boolean {
		const { lipsTouch, jawMove, tongueRoof, mouthBreath, throatBreath, coherency, stimulus } = this.setting;
		return (lipsTouch + jawMove + tongueRoof + mouthBreath + throatBreath + coherency + stimulus) > 0;
	}

	muffle(input: string): string {
		let list = input.split(' ');
		list = list.map((word) => {
			return this.muffleWord(word);
		});
		return list.join(' ');
	}

	private muffleWord(word: string): string {
		const r = new PseudoRandom(word.trim().toLowerCase() + this.salt);
		const { lipsTouch, jawMove, tongueRoof, coherency, mouthBreath, throatBreath } = this.setting;

		let muffled: string[] = word.split('').map((c) => {
			if (/t/ig.test(c)) {
				return this.roll(['th', 'tph'], tongueRoof, r, c);
			} else if (/[kc]/ig.test(c)) {
				return this.roll(['ch', 'gh'], tongueRoof, r, c);
			} else if (/[z]/ig.test(c)) {
				return this.roll(['gi'], jawMove, r, c);
			} else if (/[bdgp]/ig.test(c)) {
				return this.roll(['ch', 'gh'], lipsTouch, r, c);
			} else if (/[s]/ig.test(c)) {
				return this.roll(['sh', 'ss'], jawMove, r, c);
			} else if (/[f]/ig.test(c)) {
				return this.roll(['ph'], lipsTouch, r, c);
			} else if (/[hjlrwxyq]/ig.test(c)) {
				return this.roll(['w', 'm', 'h', 'n'], coherency, r, c);
			} else if (/[aeiou]/ig.test(c)) {
				return this.roll(['m', 'n', 'w', 'h'], jawMove, r, c);
			} else {
				return c;
			}
		});

		if (mouthBreath > 0) {
			muffled = muffled.map((c) => {
				if (/(th|tph|ch|c)/ig.test(c)) {
					return this.roll(['gh'], mouthBreath, r, c);
				} else if (/(ph)/ig.test(c)) {
					return this.roll(['mh', 'nh'], mouthBreath, r, c);
				} else if (/(ss|sh)/ig.test(c)) {
					return this.roll(['hh', 'hm'], mouthBreath, r, c);
				} else if (/[aeiou]/ig.test(c)) {
					return this.roll(['m', 'n', 'w'], mouthBreath, r, c);
				} else if (/[hjlrvwxyq]/ig.test(c)) {
					return this.roll(['w', 'm', 'n'], mouthBreath, r, c);
				} else if (/h/ig.test(c)) {
					return this.roll(['m', 'n'], mouthBreath, r, c);
				} else if (/gi/ig.test(c)) {
					return this.roll(['gm', 'gn'], mouthBreath, r, c);
				} else {
					return c;
				}
			});
		}

		if (throatBreath > 0) {
			muffled = muffled.map((c) => {
				if (/(mh|nh|hm|hh)/ig.test(c)) {
					return this.roll(['mm', 'nn', 'mn', 'nm'], throatBreath, r, c);
				} else if (/gh|c|ch/ig.test(c)) {
					return this.roll(['gm', 'gn'], throatBreath, r, c);
				} else if (/w/ig.test(c)) {
					return this.roll(['m', 'n'], throatBreath, r, c);
				} else if (/[aeiou]/ig.test(c)) {
					return this.roll(['m', 'n'], throatBreath, r, c);
				} else if (/[hjlrvwxyq]/ig.test(c)) {
					return this.roll(['m', 'n'], throatBreath, r, c);
				} else if (/h/ig.test(c)) {
					return this.roll(['m', 'n'], throatBreath, r, c);
				} else if (/gi/ig.test(c)) {
					return this.roll(['gm', 'gn'], throatBreath, r, c);
				} else {
					return c;
				}
			});
		}

		return muffled.join('');
	}

	private isUpper(char: string) {
		return char.charAt(0) === char.charAt(0).toUpperCase();
	}

	private roll(muf: string[], probMuf: number, random: PseudoRandom, c: string): string {
		if (random.rand() <= _.clamp(probMuf, 0, 10) / 10) {
			const ran = random.randomElement(muf);
			return this.isUpper(c) ? ran.toUpperCase() : ran;
		}
		return c;
	}
}
