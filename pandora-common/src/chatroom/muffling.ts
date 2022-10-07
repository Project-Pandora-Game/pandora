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
		const random = new PseudoRandom(word + this.seed);
		const lowerCase = word.toLowerCase();
		const result = '';

		const { mouthBlocked, throatBlocked } = this.setting;
		if (mouthBlocked || throatBlocked) {
			return this.matchCaseSameLen(result, word);

		} else {
			const mid = Math.floor(result.length / 2);
			return result.substring(random.between(0, mid),
				random.between(mid, result.length));
		}
	}

	matchCaseSameLen(text: string, pattern: string): string {
		let result = '';
		text = text.toLowerCase();

		for (let i = 0; i < text.length; i++) {
			const c = text.charAt(i);
			const p = pattern.charCodeAt(i);

			if (p >= 65 && p < 65 + 26) {
				result += c.toUpperCase();
			} else {
				result += c.toLowerCase();
			}
		}

		return result;
	}
}
