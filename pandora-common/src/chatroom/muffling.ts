import { EffectScale } from '../assets/effects';
import { PseudoRandom } from '../math/pseudoRandom';

export type MuffleSetting = {
	lipsTouch: EffectScale,
	jawMove: EffectScale,
	tongueRoof: EffectScale,
	mouthBreath: EffectScale,
	throatBreath: EffectScale,
	coherency: EffectScale,
	stimulus: EffectScale,
};

export class Muffler {
	private salt: string;
	private setting: MuffleSetting;

	constructor(salt: string, setting?: Partial<MuffleSetting>) {
		this.salt = salt;
		this.setting = {
			lipsTouch: setting ? setting.lipsTouch ?? 0 : 0,
			jawMove: setting ? setting.jawMove ?? 0 : 0,
			tongueRoof: setting ? setting.tongueRoof ?? 0 : 0,
			mouthBreath: setting ? setting.mouthBreath ?? 0 : 0,
			throatBreath: setting ? setting.throatBreath ?? 0 : 0,
			coherency: setting ? setting.coherency ?? 0 : 0,
			stimulus: setting ? setting.stimulus ?? 0 : 0,
		};
	}

	muffle(input: string): string {
		let list = input.split(' ');
		list = list.map((word) => {
			return this.muffleWord(word);
		});
		return list.join(' ');
	}

	private muffleWord(word: string): string {
		const r = new PseudoRandom(word + this.salt);
		const { lipsTouch, jawMove, tongueRoof, coherency, mouthBreath, throatBreath } = this.setting;
		let muffled: string[] = word.split('').map((c) => {
			if (c.match(/[t]/ig)) {
				return this.roll(['th', 'tph'], tongueRoof, r, c);
			} else if (c.match(/[kc]/ig)) {
				return this.roll(['ch', 'gh'], tongueRoof, r, c);
			} else if (c.match(/[z]/ig)) {
				return this.roll(['gi'], jawMove, r, c);
			} else if (c.match(/[bdgp]/ig)) {
				return this.roll(['ch', 'gh'], lipsTouch, r, c);
			} else if (c.match(/[s]/ig)) {
				return this.roll(['sh', 'ss'], jawMove, r, c);
			} else if (c.match(/[f]/ig)) {
				return this.roll(['ph'], lipsTouch, r, c);
			} else if (c.match(/[hjlrwxyq]/ig)) {
				return this.roll(['w', 'm', 'h', 'n'], coherency, r, c);
			} else if (c.match(/[aeiou]/ig)) {
				return this.roll(['m', 'n', 'w', 'h'], jawMove, r, c);
			} else {
				return c;
			}
		});

		if (mouthBreath > 0) {
			muffled = muffled.map((c) => {
				if (c.match(/(th|tph|ch|c)/ig)) {
					return this.roll(['gh'], mouthBreath, r, c);
				} else if (c.match(/(ph)/ig)) {
					return this.roll(['mh', 'nh'], mouthBreath, r, c);
				} else if (c.match(/(ss|sh)/ig)) {
					return this.roll(['hh', 'hm'], mouthBreath, r, c);
				} else if (c.match(/[aeiou]/ig)) {
					return this.roll(['m', 'n', 'w'], mouthBreath, r, c);
				} else if (c.match(/[hjlrvwxyq]/ig)) {
					return this.roll(['w', 'm', 'n'], mouthBreath, r, c);
				} else if (c.match(/h/ig)) {
					return this.roll(['m', 'n'], mouthBreath, r, c);
				} else if (c.match(/gi/ig)) {
					return this.roll(['gm', 'gn'], mouthBreath, r, c);
				} else {
					return c;
				}
			});
		}

		if (throatBreath > 0) {
			muffled = muffled.map((c) => {
				if (c.match(/(mh|nh|hm|hh)/ig)) {
					return this.roll(['mm', 'nn', 'mn', 'nm'], throatBreath, r, c);
				} else if (c.match(/gh|c|ch/ig)) {
					return this.roll(['gm', 'gn'], throatBreath, r, c);
				} else if (c.match(/w/ig)) {
					return this.roll(['m', 'n'], throatBreath, r, c);
				} else if (c.match(/[aeiou]/ig)) {
					return this.roll(['m', 'n'], throatBreath, r, c);
				} else if (c.match(/[hjlrvwxyq]/ig)) {
					return this.roll(['m', 'n'], throatBreath, r, c);
				} else if (c.match(/h/ig)) {
					return this.roll(['m', 'n'], throatBreath, r, c);
				} else if (c.match(/gi/ig)) {
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
		if (random.rand() <= probMuf / 10) {
			const ran = random.randomElement(muf);
			return this.isUpper(c) ? ran.toUpperCase() : ran;
		}
		return c;
	}
}
