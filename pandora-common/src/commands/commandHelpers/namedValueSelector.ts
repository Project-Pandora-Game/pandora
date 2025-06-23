import type { CommandStepProcessor } from '../executor.ts';

/**
 * Create argument selector that expects one of given complex options, presenting them to the user by their name.
 * Duplicate options are given numeric suffixes.
 * @param options - List of allowed options. Each option contains value, name, and optionally an description
 */
export function CommandSelectorNamedValue<const TOption>(
	options: readonly { value: TOption; name: string; description?: string; }[],
	autocompleteShowValues: boolean = false,
): CommandStepProcessor<TOption> {
	// Filter out duplicate options
	{
		const seenNames = new Set<string>();
		options = options.map(({ value, name, description }) => {
			const originalName = name;
			let nextSuffix = 1;
			while (seenNames.has(name)) {
				name = originalName + nextSuffix.toString(10);
				nextSuffix++;
			}
			seenNames.add(name);
			return { value, name, description };
		});
	}

	return {
		preparse: 'quotedArgTrimmed',
		parse(selector) {
			let matches = options.filter(({ name }) => name === selector);
			if (matches.length === 0)
				matches = options.filter(({ name }) => name.toLowerCase() === selector.toLowerCase());
			if (matches.length === 0)
				matches = options.filter(({ name }) => name.toLowerCase().startsWith(selector.toLowerCase()));

			if (matches.length === 1) {
				const match = matches[0];
				return {
					success: true,
					value: match.value,
				};
			} else if (matches.length === 0) {
				return {
					success: false,
					error: `Invalid option "${selector}". Allowed values: ${options.map(({ name }) => name).join('|')}`,
				};
			} else {
				return {
					success: false,
					error: `Multiple options match "${selector}". Please specify more precise value (one of: ${matches.map(({ name }) => name).join('|')}).`,
				};
			}
		},
		autocomplete(selector) {
			return options
				.filter(({ name }) => name.toLowerCase().startsWith(selector.toLowerCase()))
				.map(({ name, description }) => ({
					replaceValue: name,
					displayValue: (!description ? name : `${name} - ${description}`),
				}));
		},
		autocompleteShowValue: autocompleteShowValues,
		autocompleteCustomName: autocompleteShowValues ? options.map(({ name }) => name).join(' | ') : undefined,
	};
}
