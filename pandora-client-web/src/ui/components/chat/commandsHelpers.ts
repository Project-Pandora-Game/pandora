import { CommandStepProcessor, ICharacterRoomData, ICommandExecutionContext, ItemIdSchema, type ActionTargetSelector, type ItemPath } from 'pandora-common';
import type { Character } from '../../../character/character';
import { ResolveItemDisplayNameType } from '../../../components/wardrobe/itemDetail/wardrobeItemName';
import type { ICommandExecutionContextClient } from './commandsProcessor';

type ICommandClientNeededContext<RequiredKeys extends Exclude<keyof ICommandExecutionContextClient, keyof ICommandExecutionContext>> =
	Pick<ICommandExecutionContextClient, (keyof ICommandExecutionContext) | RequiredKeys>;

export type SelfSelect = 'none' | 'otherCharacter' | 'any';

export const CommandSelectorCharacter = ({ allowSelf }: {
	allowSelf: SelfSelect;
}): CommandStepProcessor<Character<ICharacterRoomData>, ICommandClientNeededContext<'gameState'>> => ({
	preparse: 'quotedArgTrimmed',
	parse(selector, { gameState }, _args) {
		const characters = gameState.characters.value;

		if (!selector) {
			return {
				success: false,
				error: 'Expected character name',
			};
		}

		// Prefer using id, if the input looks anything like an id
		// This allows writing a character ID to be completely unambiguous,
		// even preventing TOC-TOU-like problems during characters leaving and entering
		if (/^c?[0-9]+$/.test(selector)) {
			if (selector.startsWith('c')) {
				selector = selector.substring(1);
			}
			const id = Number.parseInt(selector, 10);
			const target = characters.find((c) => c.data.id === `c${id}`);
			if (!target) {
				return {
					success: false,
					error: `Character #${id} not found in the room.`,
				};
			}
			if (allowSelf !== 'any' && target.isPlayer()) {
				return {
					success: false,
					error: `This command doesn't allow targeting yourself.`,
				};
			}
			if (allowSelf === 'none' && target.data.accountId === gameState.player?.data.accountId) {
				return {
					success: false,
					error: `This command doesn't allow targeting your account.`,
				};
			}
			return {
				success: true,
				value: target,
			};
		}

		// If the input is not id-like treat it as a name
		let targets = characters.filter((c) => c.data.name === selector);
		// If no name matches exactly, try name case-insensitively
		if (targets.length === 0)
			targets = characters.filter((c) => c.data.name.toLowerCase() === selector.toLowerCase());

		if (targets.length === 1) {
			if (allowSelf !== 'any' && targets[0].isPlayer()) {
				return {
					success: false,
					error: `This command doesn't allow targeting yourself.`,
				};
			}
			if (allowSelf === 'none' && targets[0].data.accountId === gameState.player?.data.accountId) {
				return {
					success: false,
					error: `This command doesn't allow targeting your account.`,
				};
			}
			return {
				success: true,
				value: targets[0],
			};
		} else if (targets.length === 0) {
			return {
				success: false,
				error: `Character "${selector}" not found in the room.`,
			};
		} else {
			return {
				success: false,
				error: `Multiple characters match "${selector}". Please use id instead.`,
			};
		}
	},
	autocomplete(selector, { gameState }, _args) {
		const characters = gameState.characters.value
			.filter((c) => allowSelf === 'any' || !c.isPlayer())
			.filter((c) => allowSelf !== 'none' || c.data.accountId !== gameState.player?.data.accountId);
		// Prefer using id, if the input looks anything like an id
		if (/^c?[0-9]+$/.test(selector)) {
			if (selector.startsWith('c')) {
				selector = selector.substring(1);
			}
			return characters
				.filter((c) => c.data.id.startsWith(`c${selector}`))
				.map((c) => ({
					replaceValue: c.data.id,
					displayValue: `${c.data.id} - ${c.data.name}`,
				}));
		}
		// Autocomplete names, always treating selector as case insensitive
		return characters
			.filter((c) => c.data.name.toLowerCase().startsWith(selector.toLowerCase()))
			.map((c) => ({
				// Use ID for autocomplete if there are multiple characters with matching name
				replaceValue: characters.filter((otherChar) => otherChar.data.name.toLowerCase() === c.data.name.toLowerCase()).length > 1 ? c.data.id : c.data.name,
				displayValue: `${c.data.name} (${c.data.id})`,
			}));
	},
});

export function CommandSelectorGameLogicActionTarget(): CommandStepProcessor<ActionTargetSelector, ICommandClientNeededContext<'gameState'>> {
	const characterSubprocessor = CommandSelectorCharacter({ allowSelf: 'any' });

	return ({
		preparse: 'quotedArgTrimmed',
		parse(selector, context, args) {
			if (!selector) {
				return {
					success: false,
					error: 'Expected character name or "room"',
				};
			}

			if (selector === 'room') {
				return {
					success: true,
					value: { type: 'roomInventory' },
				};
			}

			const characterParse = characterSubprocessor.parse(selector, context, args);
			if (characterParse.success) {
				return {
					success: true,
					value: {
						type: 'character',
						characterId: characterParse.value.id,
					},
				};
			}
			return characterParse;
		},
		autocomplete(input, context, args) {
			const characterResult = characterSubprocessor.autocomplete?.(input, context, args) ?? [];
			if ('room'.startsWith(input.toLowerCase())) {
				return [{
					displayValue: 'Room',
					replaceValue: 'room',
					longDescription: 'Room inventory',
				}, ...characterResult];
			}
			return characterResult;
		},
	});
}

export function CommandSelectorItem<const TTargetKey extends string>(targetKey: TTargetKey): CommandStepProcessor<ItemPath, ICommandClientNeededContext<'globalState' | 'accountSettings'>, { [key in TTargetKey]: ActionTargetSelector; }> {
	return ({
		preparse: 'quotedArgTrimmed',
		parse(selector, { globalState }, args) {
			const targetSelector = args[targetKey];
			const items = globalState.getItems(targetSelector);

			if (items == null) {
				return {
					success: false,
					error: 'Target not found',
				};
			}

			// Prefer using id, if the input looks anything like an id
			// This allows writing an item ID to be completely unambiguous,
			// even preventing TOC-TOU-like problems during other people doing stuff
			if (/^i\//.test(selector)) {
				const parsedId = ItemIdSchema.safeParse(selector);
				if (parsedId.success) {
					const id = parsedId.data;
					const item = items.find((i) => i.id === id);
					if (!item) {
						return {
							success: false,
							error: `Item "${id}" not found.`,
						};
					}
					return {
						success: true,
						value: {
							container: [],
							itemId: item.id,
						},
					};
				}
			}

			// If the input is not id-like treat it as a name
			let targets = items.filter((i) => i.name === selector || i.asset.definition.name === selector);
			// If no name matches exactly, try name case-insensitively
			if (targets.length === 0)
				targets = items.filter((i) => i.name?.toLowerCase() === selector.toLowerCase() || i.asset.definition.name.toLowerCase() === selector.toLowerCase());

			if (targets.length === 1) {
				return {
					success: true,
					value: {
						container: [],
						itemId: targets[0].id,
					},
				};
			} else if (targets.length === 0) {
				return {
					success: false,
					error: `Item "${selector}" not found.`,
				};
			} else {
				return {
					success: false,
					error: `Multiple items match "${selector}". Please use id instead (with the help of autocomplete).`,
				};
			}
		},
		autocomplete(selector, { globalState, accountSettings }, args) {
			const targetSelector = args[targetKey];
			const items = globalState.getItems(targetSelector);

			if (items == null)
				return [];

			// Prefer using id, if the input looks anything like an id
			if (/^i\//.test(selector)) {
				return items
					.filter((i) => i.id.startsWith(selector))
					.map((i) => ({
						replaceValue: i.id,
						displayValue: `${i.id} - ${ResolveItemDisplayNameType(i.asset.definition.name, i.name, accountSettings.wardrobeItemDisplayNameType)}`,
					}));
			}
			// Autocomplete names, always treating selector as case insensitive
			return items
				.filter((i) => i.name?.toLowerCase().startsWith(selector.toLowerCase()) || i.asset.definition.name.toLowerCase().startsWith(selector.toLowerCase()))
				.map((i) => {
					const nameValue = i.name || i.asset.definition.name;
					// Use ID for autocomplete if there are multiple items with matching name
					const needsId = items.filter((otherItem) => otherItem.name === nameValue || otherItem.asset.definition.name === nameValue).length > 1;
					return ({
						replaceValue: needsId ? i.id : nameValue,
						displayValue: `${ResolveItemDisplayNameType(i.asset.definition.name, i.name, accountSettings.wardrobeItemDisplayNameType)}` +
							(needsId ? ` (${i.id})` : ''),
					});
				});
		},
	});
}

/**
 * Create argument selector that expects one of given options.
 * @param options - List of allowed options. Each option can either be the value or pair `[value, description]`
 */
export function CommandSelectorEnum<const TOption extends string>(options: readonly (TOption | readonly [value: TOption, description: string])[]): CommandStepProcessor<TOption> {
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
	};
}
