import type { Immutable } from 'immer';
import { isEqual } from 'lodash-es';
import * as z from 'zod';
import { AppearanceActionSchema, type AppearanceAction, type AppearanceActionType } from '../gameLogic/actionLogic/actions/_index.ts';
import { RedactSensitiveActionData } from '../gameLogic/actionLogic/actionUtils.ts';
import { Assert } from '../utility/misc.ts';
import { IChatMessageActionTargetCharacterSchema, type IChatMessageActionTargetCharacter } from './chat.ts';

const GAME_LOGIC_ACTIONS_ENTRY_COOLDOWN = {
	moveCharacter: 30_000,
	color: 30_000,
	pose: 30_000,
	body: 30_000,
} as const satisfies Partial<Record<AppearanceActionType, number>>;

export const ChatMessageActionLogGameLogicActionSchema = z.tuple([
	z.literal('gameLogic'),
	z.object({
		action: AppearanceActionSchema,
		actor: IChatMessageActionTargetCharacterSchema,
	}),
]);
export type ChatMessageActionLogGameLogicAction = z.infer<typeof ChatMessageActionLogGameLogicActionSchema>;

export const ChatMessageActionLogEntrySchema = z.union([
	ChatMessageActionLogGameLogicActionSchema,
]);
export type ChatMessageActionLogEntry = z.infer<typeof ChatMessageActionLogEntrySchema>;

export const ChatMessageActionLogSchema = z.object({
	type: z.literal('actionLog'),
	entry: ChatMessageActionLogEntrySchema,
});
export type ChatMessageActionLog = z.infer<typeof ChatMessageActionLogSchema>;

export function CreateActionLogFromGameLogicAction(action: Immutable<AppearanceAction>, actor: Immutable<IChatMessageActionTargetCharacter>): Immutable<ChatMessageActionLogEntry> {
	return ['gameLogic', {
		action: RedactSensitiveActionData(action),
		actor,
	}];
}

export function ActionLogShouldDeduplicate(action: Immutable<ChatMessageActionLogEntry>, time: number, lastAction: Immutable<ChatMessageActionLogEntry>, lastActionTime: number): boolean {
	if (action[0] === 'gameLogic') {
		if (lastAction[0] !== 'gameLogic')
			return false;
		// This should only be called for same source
		Assert(action[1].actor.id === lastAction[1].actor.id);

		switch (action[1].action.type) {
			case 'moveCharacter':
				return lastAction[1].action.type === 'moveCharacter' &&
					isEqual(action[1].action.target, lastAction[1].action.target) &&
					action[1].action.moveTo.type === lastAction[1].action.moveTo.type &&
					action[1].action.moveTo.following?.followType === lastAction[1].action.moveTo.following?.followType &&
					isEqual(action[1].action.moveTo.following?.target, lastAction[1].action.moveTo.following?.target) &&
					(lastActionTime + GAME_LOGIC_ACTIONS_ENTRY_COOLDOWN.moveCharacter >= time);

			case 'color':
				return lastAction[1].action.type === 'color' &&
					isEqual(action[1].action.target, lastAction[1].action.target) &&
					isEqual(action[1].action.item, lastAction[1].action.item) &&
					(lastActionTime + GAME_LOGIC_ACTIONS_ENTRY_COOLDOWN.moveCharacter >= time);

			case 'pose':
			case 'body':
				return (lastAction[1].action.type === 'pose' || lastAction[1].action.type === 'body') &&
					isEqual(action[1].action.target, lastAction[1].action.target) &&
					(lastActionTime + GAME_LOGIC_ACTIONS_ENTRY_COOLDOWN.moveCharacter >= time);
		}
	}

	return false;
}
