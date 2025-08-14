import { CommandStepProcessor, type AssetFrameworkGlobalState, type AssetFrameworkRoomState } from 'pandora-common';
import type { ICommandClientNeededContext } from '../commandsHelpers.ts';

export const CommandSelectorRoom = ({ filter }: {
	filter?: (room: AssetFrameworkRoomState, globalState: AssetFrameworkGlobalState) => boolean;
} = {}): CommandStepProcessor<AssetFrameworkRoomState, ICommandClientNeededContext<'globalState'>> => ({
	preparse: 'quotedArgTrimmed',
	parse(selector, { globalState }, _args) {
		const rooms = globalState.space.rooms;

		if (!selector) {
			return {
				success: false,
				error: 'Expected room name',
			};
		}

		// Prefer using id, if the input looks anything like an id
		// This allows writing a completely unambiguous input,
		// even preventing TOC-TOU-like problems
		if (/^room:/.test(selector)) {
			const target = rooms.find((r) => r.id === selector);
			if (!target) {
				return {
					success: false,
					error: `Room "${selector}" not found.`,
				};
			}
			if (filter != null && !filter(target, globalState)) {
				return {
					success: false,
					error: `Room "${target.displayName}" cannot be selected for this command.`,
				};
			}
			return {
				success: true,
				value: target,
			};
		}

		// If the input is not id-like treat it as a name
		let targets = rooms.filter((r) => r.displayName === selector);
		// If no name matches exactly, try name case-insensitively
		if (targets.length === 0)
			targets = rooms.filter((r) => r.displayName.toLowerCase() === selector.toLowerCase());

		if (targets.length === 1) {
			if (filter != null && !filter(targets[0], globalState)) {
				return {
					success: false,
					error: `Room "${targets[0].displayName}" cannot be selected for this command.`,
				};
			}
			return {
				success: true,
				value: targets[0],
			};
		} else if (targets.length === 0) {
			return {
				success: false,
				error: `Room "${selector}" not found.`,
			};
		} else {
			return {
				success: false,
				error: `Multiple rooms match "${selector}". Please use id instead.`,
			};
		}
	},
	autocomplete(selector, { globalState }, _args) {
		const rooms = globalState.space.rooms
			.filter((r) => {
				return filter == null || filter(r, globalState);
			});
		// Prefer using id, if the input looks anything like an id
		if (/^room:/.test(selector)) {
			return rooms
				.filter((r) => r.id.startsWith(selector))
				.map((r) => ({
					replaceValue: r.id,
					displayValue: r.name ? `${r.id} - ${r.name}` : r.id,
				}));
		}
		// Autocomplete names, always treating selector as case insensitive
		return rooms
			.filter((r) => r.displayName.toLowerCase().startsWith(selector.toLowerCase()))
			.map((r) => ({
				// Use ID for autocomplete if there are multiple rooms with matching name, or the room has no name
				replaceValue: (!r.name || rooms.filter((otherRoom) => otherRoom.displayName.toLowerCase() === r.displayName.toLowerCase()).length > 1) ? r.id : r.name,
				displayValue: r.name ? `${r.name} (${r.id})` : r.id,
			}));
	},
});
