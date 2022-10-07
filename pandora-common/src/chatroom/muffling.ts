import { PseudoRandom } from '../math/pseudoRandom';

enum Difficulty {
	HARDEST = 1,
	HARD = 0.8,
	NORMAL = 0.5,
	EASY = 0.3,
	NONE = 0,
}

type MufflerSetting = {
	lipsTouch?: Difficulty,
	jawMove?: Difficulty,
	tongueRoof?: Difficulty,
	mouthBreath?: Difficulty,
	throatBreath?: Difficulty,
	coherency?: Difficulty,
	stimulus?: number,
};

export class Muffler {
	private seed: string;
	private setting: MufflerSetting;

	constructor(seed: string, setting?: Partial<MufflerSetting>) {
		this.seed = seed;
		this.setting = setting ?? {
			lipsTouch: Difficulty.EASY,
			jawMove: Difficulty.EASY,
			tongueRoof: Difficulty.EASY,
			coherency: Difficulty.EASY,
			mouthBreath: Difficulty.NONE,
			throatBreath: Difficulty.NONE,
			stimulus: Difficulty.NONE,
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
		const r = new PseudoRandom(word + this.seed);
		const { lipsTouch, jawMove, tongueRoof, coherency, mouthBreath, throatBreath } = this.setting;
		let muffled: string[] = word.split('').map((c) => {
			if (c.match(/[t]/ig)) {
				return this.roll(['th', 'tph'], ['Th', 'TH', 'Tph'], tongueRoof ?? Difficulty.EASY, r, c);
			} else if (c.match(/[kc]/ig)) {
				return this.roll(['ch', 'gh'], ['Ch', 'Gh', 'gh'], tongueRoof ?? Difficulty.EASY, r, c);
			} else if (c.match(/[z]/ig)) {
				return this.roll(['gi'], ['Gi'], jawMove ?? 1, r, c);
			} else if (c.match(/[bdgp]/ig)) {
				return this.roll(['ch', 'gh'], ['Gh', 'Ch'], lipsTouch ?? Difficulty.EASY, r, c);
			} else if (c.match(/[s]/ig)) {
				return this.roll(['sh', 'ss'], ['Sh', 'Ss'], jawMove ?? Difficulty.EASY, r, c);
			} else if (c.match(/[f]/ig)) {
				return this.roll(['ph'], ['Ph'], lipsTouch ?? 1, r, c);
			} else if (c.match(/[hjlrwxyq]/ig)) {
				return this.roll(['w', 'm', 'h', 'n'], ['W', 'M', 'N'], coherency ?? 0, r, c);
			} else if (c.match(/[aeiou]/ig)) {
				return this.roll(['m', 'n', 'w', 'h'], ['M', 'N', 'H', 'W'], jawMove ?? Difficulty.EASY, r, c);
			} else {
				return c;
			}
		});

		if (mouthBreath) {
			muffled = muffled.map((c) => {
				if (c.match(/(th|tph|ch|c)/ig)) {
					return this.roll(['gh'], ['Gh'], mouthBreath, r, c);
				} else if (c.match(/(ph)/ig)) {
					return this.roll(['mh', 'nh'], ['Mh', 'Nh'], mouthBreath, r, c);
				} else if (c.match(/(ss|sh)/ig)) {
					return this.roll(['hh', 'hm'], ['Hh', 'Hm'], mouthBreath, r, c);
				} else if (c.match(/[aeiou]/ig)) {
					return this.roll(['m', 'n', 'w'], ['M', 'N', 'W'], mouthBreath, r, c);
				} else if (c.match(/[hjlrvwxyq]/ig)) {
					return this.roll(['w', 'm', 'n'], ['W', 'M', 'N'], mouthBreath, r, c);
				} else if (c.match(/h/ig)) {
					return this.roll(['m', 'n'], ['M', 'N'], mouthBreath, r, c);
				} else if (c.match(/gi/ig)) {
					return this.roll(['gm', 'gn'], ['Gm', 'Gn'], mouthBreath, r, c);
				} else {
					return c;
				}
			});
		}

		if (throatBreath) {
			muffled = muffled.map((c) => {
				if (c.match(/(mh|nh|hm|hh)/ig)) {
					return this.roll(['mm', 'nn', 'mn', 'nm'], ['Mm', 'Nn', 'Mn', 'Nm'], throatBreath, r, c);
				} else if (c.match(/gh|c|ch/ig)) {
					return this.roll(['gm', 'gn'], ['Gm', 'Gn'], throatBreath, r, c);
				} else if (c.match(/w/ig)) {
					return this.roll(['m', 'n'], ['M', 'N'], throatBreath, r, c);
				} else if (c.match(/[aeiou]/ig)) {
					return this.roll(['m', 'n'], ['M', 'N'], throatBreath, r, c);
				} else if (c.match(/[hjlrvwxyq]/ig)) {
					return this.roll(['m', 'n'], ['M', 'N'], throatBreath, r, c);
				} else if (c.match(/h/ig)) {
					return this.roll(['m', 'n'], ['M', 'N'], throatBreath, r, c);
				} else if (c.match(/gi/ig)) {
					return this.roll(['gm', 'gn'], ['Gm', 'Gn'], throatBreath, r, c);
				} else {
					return c;
				}
			});
		}

		return muffled.join('').replace(/hh/ig, 'h').replace(/ww/ig, 'w');
	}

	private isUpper(char: string) {
		return char.charAt(0) === char.charAt(0).toUpperCase();
	}

	private roll(muf: string[], mufUpper: string[], probMuf: number, random: PseudoRandom, c: string): string {
		if (random.rand() <= probMuf) {
			return this.isUpper(c) ? mufUpper[Math.round(random.between(0, mufUpper.length - 1))] : muf[Math.round(random.between(0, muf.length - 1))];
		}
		return c;
	}
}
