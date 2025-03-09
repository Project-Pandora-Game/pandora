import _ from 'lodash';
import { EFFECTS_DEFAULT } from '../assets/effects.ts';
import { PseudoRandom } from '../math/pseudoRandom.ts';
import type { ChatMessageFilter } from './chatMessageFilter.ts';
import type { IChatSegment } from './chat.ts';

export type MuffleSettings = {
	/**
	 * Speaking: Muffle lips related sounds (`b`, `d`, `g`, `p`,...)
	 *
	 * Effective value range:
	 * - 0 = no effect
	 * - 10 = completely muffled
	 */
	lipsTouch: number;

	/**
	 * Speaking: Muffle jaws related sounds (`z`, `s`)
	 *
	 * Effective value range:
	 * - 0 = no effect
	 * - 10 = completely muffled
	 */
	jawMove: number;

	/**
	 * Speaking: Muffle tongue related sounds (`r`, `re`, `k`, `c`, `q`, ...)
	 *
	 * Effective value range:
	 * - 0 = no effect
	 * - 10 = completely muffled
	 */
	tongueRoof: number;
	/**
	 * Speaking: Muffle air breath sounds (`th`, `ch`,...)
	 *
	 * Effective value range:
	 * - 0 = no effect
	 * - 10 = completely muffled
	 */
	mouthBreath: number;
	/**
	 * Speaking: Muffle strong throat vibration sounds (`gh`, `c`, `ch`, `gi`,...)
	 *
	 * Effective value range:
	 * - 0 = no effect
	 * - 10 = completely muffled
	 */
	throatBreath: number;
	/**
	 * Speaking: Muffle hinting letters (h, j, l, r, v, w, x, y)
	 *
	 * Effective value range:
	 * - 0 = no effect
	 * - 10 = completely muffled
	 */
	coherency: number;
	/**
	 * Speaking: Create stutter effects for the sentence.
	 *
	 * Effective value range:
	 * - 0 = no effect
	 * - 10 = high amounts of stutter
	 */
	stimulus: number;
};

export class Muffler implements ChatMessageFilter {
	private salt: string;
	private setting: MuffleSettings;

	constructor(salt: string, setting?: Partial<MuffleSettings>) {
		this.salt = salt;
		this.setting = {
			...EFFECTS_DEFAULT,
			...setting,
		};
	}

	public processMessage(content: IChatSegment[]): IChatSegment[] {
		if (!this.isActive())
			return content;

		for (const part of content) {
			part[1] = this.muffle(part[1]);
		}
		return content;
	}

	public isActive(): boolean {
		const { lipsTouch, jawMove, tongueRoof, mouthBreath, throatBreath, coherency, stimulus } = this.setting;
		return (lipsTouch + jawMove + tongueRoof + mouthBreath + throatBreath + coherency + stimulus) > 0;
	}

	public muffle(input: string): string {
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
				return this.roll(['th'], tongueRoof, r, c);
			} else if (/[kcq]/ig.test(c)) {
				return this.roll(['ch', 'gh'], tongueRoof, r, c);
			} else if (/[z]/ig.test(c)) {
				return this.roll(['gi'], jawMove, r, c);
			} else if (/[bdgp]/ig.test(c)) {
				return this.roll(['gh'], lipsTouch, r, c);
			} else if (/[s]/ig.test(c)) {
				return this.roll(['sh'], jawMove, r, c);
			} else if (/[f]/ig.test(c)) {
				return this.roll(['ph'], lipsTouch, r, c);
			} else if (/[hjlrwxy]/ig.test(c)) {
				return this.roll(['w', 'm', 'h', 'n'], coherency, r, c);
			} else if (/[aeiou]/ig.test(c)) {
				return this.roll(['m', 'n', 'w'], jawMove, r, c);
			} else {
				return c;
			}
		});

		if (mouthBreath > 0) {
			muffled = muffled.map((c) => {
				if (/(th|ch|c)/ig.test(c)) {
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
		if (random.random() <= _.clamp(probMuf, 0, 10) / 10) {
			const ran = random.randomElement(muf);
			return this.isUpper(c) ? ran.toUpperCase() : ran;
		}
		return c;
	}
}
