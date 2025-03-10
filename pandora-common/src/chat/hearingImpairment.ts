import { clamp } from 'lodash-es';
import { EFFECTS_DEFAULT } from '../assets/effects.ts';
import { PseudoRandom } from '../math/pseudoRandom.ts';
import type { IChatSegment } from './chat.ts';
import type { ChatMessageFilter } from './chatMessageFilter.ts';

export type HearingImpairmentSettings = {
	/**
	 * Hearing: Distort words by replacing letters with similar-sounding but incorrect letters (m <-> n, b <-> p)
	 *
	 * Effective value range:
	 * - 0 = no effect
	 * - 10 = completely distorted
	 */
	distortion: number;
	/**
	 * Hearing: Frequency loss, replaces high-frequency sounds (s, f, t, h) with replacement character
	 *
	 * Effective value range:
	 * - 0 = no effect
	 * - 10 = completely replaced
	 */
	frequencyLoss: number;
	/**
	 * Hearing: Vowel hiding, replaces vowels (a, e, i, o, u) with replacement character
	 *
	 * Effective value range:
	 * - 0 = no effect
	 * - 10 = completely replaced
	 */
	vowelLoss: number;
	/**
	 * Hearing: Middle loss, randomly replace characters with replacement character inside words keeping the first and last character intact
	 * only the first letter is preserved for words with 3 or less characters
	 *
	 * Effective value range:
	 * - 0 = no effect
	 * - 10 = completely replaced
	 */
	middleLoss: number;
};

export class HearingImpairment implements ChatMessageFilter {
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

	public processMessage(content: IChatSegment[]): IChatSegment[] {
		if (!this.isActive())
			return content;

		for (const part of content) {
			part[1] = this.distort(part[1]);
		}
		return content;
	}

	public isActive(): boolean {
		const { distortion, frequencyLoss, vowelLoss, middleLoss } = this.setting;
		return (distortion + frequencyLoss + vowelLoss + middleLoss) > 0;
	}

	public distort(input: string): string {
		return input.replace(/\b(\p{L}+)\b/igu, (match) => this.distortWord(match));
	}

	public distortWord(word: string): string {
		const r = new PseudoRandom(word.trim().toLowerCase() + this.salt);
		const { distortion, frequencyLoss, vowelLoss, middleLoss } = this.setting;

		let output = word;
		if (distortion > 0) {
			output = output.replace(/(m|n|b|p)/ig, (match) => {
				if (r.random() <= clamp(distortion, 0, 10) / 10) {
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
				if (r.random() <= clamp(frequencyLoss, 0, 10) / 10) {
					return this.replacement;
				}
				return match;
			});
		}
		if (vowelLoss > 0) {
			output = output.replace(/(a|e|i|o|u)/ig, (match) => {
				if (r.random() <= clamp(vowelLoss, 0, 10) / 10) {
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
			if (r.random() <= clamp(level, 0, 10) / 10) {
				return this.replacement;
			}
			return match;
		});
	}
}
