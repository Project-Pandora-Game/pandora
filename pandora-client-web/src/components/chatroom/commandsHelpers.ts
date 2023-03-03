import { CommandStepProcessor, ICharacterRoomData, ICommandExecutionContext } from 'pandora-common';
import type { Character } from '../../character/character';
import type { ICommandExecutionContextClient } from './commandsProcessor';

type ICommandClientNeededContext<RequiredKeys extends Exclude<keyof ICommandExecutionContextClient, keyof ICommandExecutionContext>> =
	Pick<ICommandExecutionContextClient, (keyof ICommandExecutionContext) | RequiredKeys>;

export type SelfSelect = 'none' | 'otherCharacter' | 'any';

export const CommandSelectorCharacter = ({ allowSelf }: {
	allowSelf: SelfSelect;
}): CommandStepProcessor<Character<ICharacterRoomData>, ICommandClientNeededContext<'chatRoom'>> => ({
	preparse: 'quotedArgTrimmed',
	parse(selector, { chatRoom }, _args) {
		const characters = chatRoom.characters.value;

		if (!selector) {
			return {
				success: false,
				error: 'Expected character name',
			};
		}

		if (/^[0-9]+$/.test(selector)) {
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
			if (allowSelf === 'none' && target.data.accountId === chatRoom.player?.data.accountId) {
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
		let targets = characters.filter((c) => c.data.name === selector);
		if (targets.length === 0)
			targets = characters.filter((c) => c.data.name.toLowerCase() === selector.toLowerCase());

		if (targets.length === 1) {
			if (allowSelf !== 'any' && targets[0].isPlayer()) {
				return {
					success: false,
					error: `This command doesn't allow targeting yourself.`,
				};
			}
			if (allowSelf === 'none' && targets[0].data.accountId === chatRoom.player?.data.accountId) {
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
	autocomplete(selector, { chatRoom }, _args) {
		const characters = chatRoom.characters.value
			.filter((c) => allowSelf === 'any' || !c.isPlayer())
			.filter((c) => allowSelf !== 'none' || c.data.accountId !== chatRoom.player?.data.accountId);
		if (/^[0-9]+$/.test(selector)) {
			return characters
				.filter((c) => c.data.id.startsWith(`c${selector}`))
				.map((c) => ({
					replaceValue: c.data.id.slice(1),
					displayValue: `${c.data.id.slice(1)} - ${c.data.name}`,
				}));
		}
		return characters
			.filter((c) => c.data.name.toLowerCase().startsWith(selector.toLowerCase()))
			.map((c) => ({
				// Use ID for autocomplete if there are multiple characters with matching name
				replaceValue: characters.filter((otherChar) => otherChar.data.name.toLowerCase() === c.data.name.toLowerCase()).length > 1 ? c.data.id.slice(1) : c.data.name,
				displayValue: `${c.data.name} (${c.data.id})`,
			}));
	},
});
