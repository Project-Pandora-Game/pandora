import type { Immutable } from 'immer';
import { isEqual } from 'lodash-es';
import * as z from 'zod';
import { AppearanceActionSchema, type AppearanceAction, type AppearanceActionType } from '../gameLogic/actionLogic/actions/_index.ts';
import { RedactSensitiveActionData } from '../gameLogic/actionLogic/actionUtils.ts';
import { Assert } from '../utility/misc.ts';
import { ChatReceivedMessageBaseSchema, IChatMessageActionTargetCharacterSchema, type IChatMessageActionTargetCharacter } from './chatCommon.ts';

const GAME_LOGIC_ACTIONS_ENTRY_COOLDOWN = {
	moveCharacter: 30_000,
	moveItem: 30_000,
	roomDeviceDeploy: 30_000,
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

export const ChatMessageActionLogSchema = ChatReceivedMessageBaseSchema.extend({
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

		const logicAction = action[1].action;
		const lastLogicAction = lastAction[1].action;

		// Check basic match
		if (logicAction.type !== lastLogicAction.type ||
			// Check coooldown
			!Object.hasOwn(GAME_LOGIC_ACTIONS_ENTRY_COOLDOWN, logicAction.type) ||
			!(lastActionTime + (GAME_LOGIC_ACTIONS_ENTRY_COOLDOWN[logicAction.type as keyof typeof GAME_LOGIC_ACTIONS_ENTRY_COOLDOWN] ?? 0) >= time)
		) {
			return false;
		}

		switch (logicAction.type) {
			case 'moveCharacter':
				return lastLogicAction.type === 'moveCharacter' &&
					isEqual(logicAction.target, lastLogicAction.target) &&
					logicAction.moveTo.type === lastLogicAction.moveTo.type &&
					logicAction.moveTo.following?.followType === lastLogicAction.moveTo.following?.followType &&
					isEqual(logicAction.moveTo.following?.target, lastLogicAction.moveTo.following?.target);

			case 'moveItem':
				return lastLogicAction.type === 'moveItem' &&
					// Target item must match
					isEqual(logicAction.target, lastLogicAction.target) &&
					isEqual(logicAction.item, lastLogicAction.item) &&
					// Do not deduplicate shifts, only room position changes
					(logicAction.shift ?? 0) === 0 &&
					(lastLogicAction.shift ?? 0) === 0 &&
					// Deployment state cannot have changed
					logicAction.personalItemDeployment?.deployed === lastLogicAction.personalItemDeployment?.deployed;

			case 'roomDeviceDeploy':
				return lastLogicAction.type === 'roomDeviceDeploy' &&
					// Target item must match
					isEqual(logicAction.target, lastLogicAction.target) &&
					isEqual(logicAction.item, lastLogicAction.item) &&
					// Deployment state cannot have changed
					logicAction.deployment.deployed === lastLogicAction.deployment.deployed;

			case 'color':
				return lastLogicAction.type === 'color' &&
					isEqual(logicAction.target, lastLogicAction.target) &&
					isEqual(logicAction.item, lastLogicAction.item);

			case 'pose':
			case 'body':
				return (lastLogicAction.type === 'pose' || lastLogicAction.type === 'body') &&
					isEqual(logicAction.target, lastLogicAction.target);
		}
	}

	return false;
}
