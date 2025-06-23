import type { CommandStepProcessor } from '../executor.ts';

/**
 * Create argument selector that expects one of given options.
 * @param options - List of allowed options. Each option can either be the value or pair `[value, description]`
 */
export function CommandSelectorEnum<const TOption extends string>(options: readonly (TOption | readonly [value: TOption, description: string])[], autocompleteShowValues: boolean = false): CommandStepProcessor<TOption> {
	return {
		preparse: 'quotedArgTrimmed',
		parse(selector) {
			let matches = options.filter((o) => (typeof o === 'string' ? o : o[0]) === selector);
			if (matches.length === 0)
				matches = options.filter((o) => (typeof o === 'string' ? o : o[0]).toLowerCase() === selector.toLowerCase());
			if (matches.length === 0)
				matches = options.filter((o) => (typeof o === 'string' ? o : o[0]).toLowerCase().startsWith(selector.toLowerCase()));

			if (matches.length === 1) {
				const match = matches[0];
				return {
					success: true,
					value: typeof match === 'string' ? match : match[0],
				};
			} else if (matches.length === 0) {
				return {
					success: false,
					error: `Invalid option "${selector}". Allowed values: ${options.map((o) => (typeof o === 'string' ? o : o[0])).join('|')}`,
				};
			} else {
				return {
					success: false,
					error: `Multiple options match "${selector}". Please specify more precise value (one of: ${matches.map((o) => typeof o === 'string' ? o : o[0]).join('|')}).`,
				};
			}
		},
		autocomplete(selector) {
			return options
				.filter((o) => (typeof o === 'string' ? o : o[0]).toLowerCase().startsWith(selector.toLowerCase()))
				.map((o) => ({
					replaceValue: (typeof o === 'string' ? o : o[0]),
					displayValue: (typeof o === 'string' ? o : `${o[0]} - ${o[1]}`),
				}));
		},
		autocompleteShowValue: autocompleteShowValues,
		autocompleteCustomName: autocompleteShowValues ? options.map(([k]) => k).join(' | ') : undefined,
	};
}
