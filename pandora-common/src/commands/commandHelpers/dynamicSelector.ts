import type { IEmpty } from '../../networking/empty.ts';
import type { CommandStepProcessor, ICommandExecutionContext } from '../executor.ts';

/**
 * Creates a selector that forwards requests to another selector that is generated freshly for each request.
 * This allows reusing existing selector infrastructure even if the actual options for those selectors change during runtime or even based on previous arguments.
 * @param options - Options that must be always available and valid for all selectors
 * @param generate - A function to generate the selector that will be used
 * @returns A wrapper for command system to use the inner selector
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function CommandSelectorDynamic<TOut, Context extends ICommandExecutionContext = ICommandExecutionContext, EntryArguments extends Record<string, any> = IEmpty>(
	options: Omit<CommandStepProcessor<TOut, Context>, 'parse' | 'autocomplete'>,
	generate: (context: Context, args: EntryArguments) => Pick<CommandStepProcessor<TOut, Context>, 'parse' | 'autocomplete'>,
): CommandStepProcessor<TOut, Context, EntryArguments> {
	return {
		preparse: options.preparse,
		autocompleteShowValue: options.autocompleteShowValue,
		autocompleteCustomName: options.autocompleteCustomName,
		parse(input, context, args) {
			const generated = generate(context, args);
			return generated.parse(input, context, args);
		},
		autocomplete(input, context, args) {
			const generated = generate(context, args);
			return generated.autocomplete?.(input, context, args) ?? [];
		},
	};
}
