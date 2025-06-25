import type { CommandStepProcessor } from '../executor.ts';

export interface CommandSelectorNumberOptions {
	/**
	 * Inclusive minimum for allowed value.
	 * @default Number.MIN_SAFE_INTEGER
	 */
	min?: number;
	/**
	 * Inclusive maximum for allowed value.
	 * @default Number.MAX_SAFE_INTEGER
	 */
	max?: number;
	/**
	 * Whether to allow decimal (non-integer) values.
	 * @default false
	 */
	allowDecimals?: boolean;
}

export function CommandSelectorNumber({ min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER, allowDecimals = false }: CommandSelectorNumberOptions = {}): CommandStepProcessor<number> {
	return {
		preparse: 'quotedArgTrimmed',
		parse(selector) {
			if (!/^-?[0-9]+([.,][0-9]+)?$/.test(selector)) {
				return {
					success: false,
					error: 'Expected a number',
				};
			}

			const number = Number.parseFloat(selector.replace(',', '.'));

			if (number < min) {
				return {
					success: false,
					error: `Expected a number in range between ${min} and ${max}`,
				};
			}

			if (number > max) {
				return {
					success: false,
					error: `Expected a number in range between ${min} and ${max}`,
				};
			}

			if (!allowDecimals && !Number.isSafeInteger(number)) {
				return {
					success: false,
					error: 'Expected a whole number',
				};
			}

			return {
				success: true,
				value: number,
			};
		},
	};
}
