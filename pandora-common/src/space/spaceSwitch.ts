import * as z from 'zod';
import { CharacterIdSchema } from '../character/characterTypes.ts';
import { AssertNever } from '../utility/misc.ts';
import { SpaceIdSchema } from './space.ts';

/**
 * The state of resolving initiator's permission to invite this character along; can change over time.
 * Possible values:
 * - `rejected` - The permission was retracted or initiator was blocked after initial start of the switch
 * - `prompt` - The target needs to be prompted first before switch
 * - `accept` - The target pre-agreed to the switch, but can still cancel their agreement
 * - `accept-enforce` - The target is being forced to agree by a modifier
 */
export const SpaceSwitchCharacterStatusPermissionSchema = z.literal(['rejected', 'prompt', 'accept', 'accept-enforce']);
export type SpaceSwitchCharacterStatusPermission = z.infer<typeof SpaceSwitchCharacterStatusPermissionSchema>;

/**
 * The state of resolving target character's ability to leave current space.
 */
export const SpaceSwitchCharacterStatusRestrictionSchema = z.literal(['ok', 'restricted', 'inRoomDevice']);
export type SpaceSwitchCharacterStatusRestriction = z.infer<typeof SpaceSwitchCharacterStatusRestrictionSchema>;

/**
 * The state of a target character, as seen by servers, when switching spaces.
 */
export const SpaceSwitchCharacterStatusSchema = z.object({
	/** Whether user accepted switch - set by client */
	accepted: z.boolean(),
	/** The resolved switch permission - set by shard automatically; `null` while still not resolved */
	permission: SpaceSwitchCharacterStatusPermissionSchema.nullable(),
	/** The resolved switch restriction - set by shard automatically; `null` while still not resolved */
	restriction: SpaceSwitchCharacterStatusRestrictionSchema.nullable(),
});
export type SpaceSwitchCharacterStatus = z.infer<typeof SpaceSwitchCharacterStatusSchema>;

/**
 * The summary status of a space switch group, as seen by servers.
 */
export const SpaceSwitchStatusSchema = z.object({
	/** The space we are switching to; cannot change. */
	targetSpace: SpaceIdSchema,
	/** The character that started this switch. Also acts as unique identifier of this switch group. */
	initiator: CharacterIdSchema,
	/** Characters involved in this switch. Must include `initiator` as well. */
	characters: z.record(CharacterIdSchema, SpaceSwitchCharacterStatusSchema),
});
export type SpaceSwitchStatus = z.infer<typeof SpaceSwitchStatusSchema>;

/**
 * Status of each individual character when switching spaces, seen by client.
 */
export const SpaceSwitchCharacterClientStatusSchema = z.literal([
	'loading',
	'leaveRestricted',
	'inRoomDevice',
	'rejected',
	'wait',
	'ready',
]);
export type SpaceSwitchCharacterClientStatus = z.infer<typeof SpaceSwitchCharacterClientStatusSchema>;

/**
 * The summary status of a space switch group, seen by client.
 */
export const SpaceSwitchClientStatusSchema = SpaceSwitchStatusSchema;
export type SpaceSwitchClientStatus = z.infer<typeof SpaceSwitchClientStatusSchema>;

/** Translates server per-character status to simpler client-visible status. */
export function SpaceSwitchResolveCharacterStatusToClientStatus(serverStatus: SpaceSwitchCharacterStatus): SpaceSwitchCharacterClientStatus {
	if (serverStatus.restriction == null) {
		return 'loading';
	} else if (serverStatus.restriction === 'restricted') {
		return 'leaveRestricted';
	} else if (serverStatus.restriction === 'inRoomDevice') {
		return 'inRoomDevice';
	} else if (serverStatus.restriction === 'ok') {
		// Good to continue
	} else {
		AssertNever(serverStatus.restriction);
	}

	if (serverStatus.permission == null) {
		return 'loading';
	} else if (serverStatus.permission === 'rejected') {
		return 'rejected';
	} else if (serverStatus.permission === 'prompt' || serverStatus.permission === 'accept') {
		if (!serverStatus.accepted) {
			return 'wait';
		} else {
			// Good to continue
		}
	} else if (serverStatus.permission === 'accept-enforce') {
		// Good to continue
	}

	return 'ready';
}

export const SpaceSwitchCommandSchema = z.discriminatedUnion('command', [
	z.object({
		/** Abort the switch, used by initiator */
		command: z.literal('abort'),
	}),
	z.object({
		/** Remove a specified character, used by initiator */
		command: z.literal('removeCharacter'),
		character: CharacterIdSchema,
	}),
	z.object({
		/** Set own accept state, not possible by initiator or if permission status not `prompt` or `accept` (i.e. if still loading, `rejected`, or `accept-enforce`d). */
		command: z.literal('setAccepted'),
		accepted: z.boolean(),
	}),
	z.object({
		/** Leave the switch group; cannot be done by initiator */
		command: z.literal('reject'),
	}),
]);
export type SpaceSwitchCommand = z.infer<typeof SpaceSwitchCommandSchema>;

/** Space switch update sent by shard to Directory when some status of some character changes */
export const SpaceSwitchShardStatusUpdateSchema = z.object({
	/** Initiator of switch, used to identify this switch group */
	initiator: CharacterIdSchema,
	/** Updates to individual characters; can be sparse compared to original character list, only including updated characters. */
	characters: z.record(CharacterIdSchema, SpaceSwitchCharacterStatusSchema.pick({ permission: true, restriction: true })),
});
export type SpaceSwitchShardStatusUpdate = z.infer<typeof SpaceSwitchShardStatusUpdateSchema>;
