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
	lipsTouch: number;

	/**
	 * Muffle jaws related sounds (`z`, `s`)
	 *
	 * Effective value range:
	 * - 0 = no effect
	 * - 10 = completely muffled
	 */
	jawMove: number;

	/**
	 * Muffle tongue related sounds (`r`, `re`, `k`, `c`,...)
	 *
	 * Effective value range:
	 * - 0 = no effect
	 * - 10 = completely muffled
	 */
	tongueRoof: number;
	/**
	 * Muffle air breath sounds (`th`, `tph`, `ch`,...)
	 *
	 * Effective value range:
	 * - 0 = no effect
	 * - 10 = completely muffled
	 */
	mouthBreath: number;
	/**
	 * Muffle strong throat vibration sounds (`gh`, `c`, `ch`, `gi`,...)
	 *
	 * Effective value range:
	 * - 0 = no effect
	 * - 10 = completely muffled
	 */
	throatBreath: number;
	/**
	 * Muffle hinting letters (h, j, l, r, v, w, x, y, q)
	 *
	 * Effective value range:
	 * - 0 = no effect
	 * - 10 = completely muffled
	 */
	coherency: number;
	/**
	 * Create stutter effects for the sentence.
	 *
	 * Effective value range:
	 * - 0 = no effect
	 * - 10 = high amounts of stutter
	 */
	stimulus: number;
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
		if (random.random() <= _.clamp(probMuf, 0, 10) / 10) {
			const ran = random.randomElement(muf);
			return this.isUpper(c) ? ran.toUpperCase() : ran;
		}
		return c;
	}
}

export type HearingImpairmentSettings = {
	/**
	 * Distort words by replacing letters with similar-sounding but incorrect letters (m <-> n, b <-> p)
	 *
	 * Effective value range:
	 * - 0 = no effect
	 * - 10 = completely distorted
	 */
	distortion: number;
	/**
	 * Frequency loss, replaces high-frequency sounds (s, f, t, h) with replacement character
	 *
	 * Effective value range:
	 * - 0 = no effect
	 * - 10 = completely replaced
	 */
	frequencyLoss: number;
	/**
	 * Vowel hiding, replaces vowels (a, e, i, o, u) with replacement character
	 *
	 * Effective value range:
	 * - 0 = no effect
	 * - 10 = completely replaced
	 */
	vowelLoss: number;
	/**
	 * Middle loss, randomly replace characters with replacement character inside words keeping the first and last character intact
	 * only the first letter is preserved for words with 3 or less characters
	 *
	 * Effective value range:
	 * - 0 = no effect
	 * - 10 = completely replaced
	 */
	middleLoss: number;
};

export class HearingImpairment {
	private salt: string;
	private setting: HearingImpairmentSettings;
	private readonly replacement = '~';

	constructor(salt: string, setting?: Partial<HearingImpairmentSettings>) {
		this.salt = salt;
		this.setting = {
			...EFFECTS_DEFAULT,
			...setting,
		};
	}

	public isActive(): boolean {
		const { distortion, frequencyLoss, vowelLoss, middleLoss } = this.setting;
		return (distortion + frequencyLoss + vowelLoss + middleLoss) > 0;
	}

	public distort(input: string): string {
		return input.replace(/\b(\w+)\b/ig, (match) => this.distortWord(match));
	}

	private distortWord(word: string): string {
		const r = new PseudoRandom(word.trim().toLowerCase() + this.salt);
		const { distortion, frequencyLoss, vowelLoss, middleLoss } = this.setting;

		let output = word;
		if (distortion > 0) {
			output = output.replace(/(m|n|b|p)/ig, (match) => {
				if (r.random() <= _.clamp(distortion, 0, 10) / 10) {
					const lower = match.toLowerCase();
					const isUpper = lower !== match;
					const result = match === 'm' ? 'n' : match === 'n' ? 'm' : match === 'b' ? 'p' : 'b';
					return isUpper ? result.toUpperCase() : result;
				}
				return match;
			});
		}
		if (frequencyLoss > 0) {
			output = output.replace(/(s|f|t|h)/ig, (match) => {
				if (r.random() <= _.clamp(frequencyLoss, 0, 10) / 10) {
					return this.replacement;
				}
				return match;
			});
		}
		if (vowelLoss > 0) {
			output = output.replace(/(a|e|i|o|u)/ig, (match) => {
				if (r.random() <= _.clamp(vowelLoss, 0, 10) / 10) {
					return this.replacement;
				}
				return match;
			});
		}
		if (middleLoss > 0) {
			switch (output.length) {
				case 0:
				case 1:
					break;
				case 2:
				case 3:
					output = output.charAt(0) + this.distortWordPart(r, output.substring(1, output.length), middleLoss);
					break;
				default:
					output = output.charAt(0) + this.distortWordPart(r, output.substring(1, output.length - 1), middleLoss) + output.charAt(output.length - 1);
					break;
			}
		}
		return output;
	}

	private distortWordPart(r: PseudoRandom, word: string, level: number): string {
		return word.replace(/./ig, (match) => {
			if (r.random() <= _.clamp(level, 0, 10) / 10) {
				return this.replacement;
			}
			return match;
		});
	}
}
