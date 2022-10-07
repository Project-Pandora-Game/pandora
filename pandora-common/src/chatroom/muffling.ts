import { PseudoRandom } from '../math/pseudoRandom';

type MufflerSetting = {
	lipsTouch?: boolean,
	jawMove?: boolean,
	tongueRoof?: boolean,
	mouthBlocked?: boolean,
	throatBlocked?: boolean,
	strength?: number,
	stimulus?: number,
};

export class Muffler {
	private seed: string;
	private setting: MufflerSetting;

	constructor(seed: string, setting?: MufflerSetting) {
		this.seed = seed;
		this.setting = setting ?? {};
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
		const list: string[] = word.split('').map((c) => {
			if (c.match(/[t]/ig)) {
				return this.isUpper(c) ? this.roll(['T', 'Th', 'TH', 'Tph'], 0.5, r) ?? c : this.roll(['Th', 'th', 'tph'], 0.5, r) ?? c;
			} else if (c.match(/[kqc]/ig)) {
				return this.isUpper(c) ? this.roll(['Ch', 'Gh', 'gh'], 0.5, r) ?? c : this.roll(['ch', 'gh'], 0.5, r) ?? c;
			} else if (c.match(/[gdbp]/ig)) {
				return this.isUpper(c) ? this.roll(['Gh', 'gm'], 0.5, r) ?? c : this.roll(['ch', 'gh'], 0.5, r) ?? c;
			} else if (c.match(/[s]/ig)) {
				return this.isUpper(c) ? this.roll(['Sh', 'sh'], 0.5, r) ?? c : 'sh';
			} else if (c.match(/[f]/ig)) {
				return this.isUpper(c) ? this.roll(['Ph', 'ph'], 0.5, r) ?? c : 'ph';
			} else if (c.match(/[lyr]/ig)) {
				return this.isUpper(c) ? this.roll(['W'], 0.5, r) ?? c : this.roll(['w'], 0.5, r) ?? c;
			} else if (c.match(/[aeiou]/ig)) {
				return this.isUpper(c) ? this.roll(['M'], 0.5, r) ?? c : this.roll(['n'], 0.5, r) ?? c;
			} else {
				return c;
			}
		});

		return list.join('');
	}

	private isUpper(char: string) {
		return char === char.toUpperCase();
	}

	private roll(muf: string[], probMuf: number, random: PseudoRandom): string | null {
		if (random.rand() <= probMuf) {
			return muf[Math.round(random.between(0, muf.length - 1))];
		}
		return null;
	}
}
