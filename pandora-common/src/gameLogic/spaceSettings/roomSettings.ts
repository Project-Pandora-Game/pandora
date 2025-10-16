import * as z from 'zod';
import { SpaceRoleOrNoneSchema } from '../../space/spaceRoles.ts';
import { KnownObject } from '../../utility/misc.ts';

//#region Settings declarations

/* This file includes settings that apply differently to individual rooms per space.
There is also an option to specify settings globally instead of per-room. By default all rooms default to space-wide settings.
If an action cannot be narrowed down to a specific room, a space-wide setting might be used as well.
*/

export const GameLogicRoomSettingsSchema = z.object({
	/**
	 * Whether to display messages about interacting with items (move, spawn, delete, ...)
	 */
	itemActionMessages: z.boolean(),
	/**
	 * Whether to display messages about interacting with locks
	 */
	lockActionMessages: z.boolean(),
	/**
	 * What role is required to change room device deployment
	 */
	roomDeviceDeploymentMinimumRole: SpaceRoleOrNoneSchema,
	/**
	 * What role is required to spawn or delete items
	 */
	itemSpawnMinimumRole: SpaceRoleOrNoneSchema,
});

export type GameLogicRoomSettings = z.infer<typeof GameLogicRoomSettingsSchema>;

export const GAME_LOGIC_ROOM_SETTINGS_DEFAULT = Object.freeze<GameLogicRoomSettings>({
	itemActionMessages: true,
	lockActionMessages: true,
	roomDeviceDeploymentMinimumRole: 'admin',
	itemSpawnMinimumRole: 'everyone',
});

//#endregion

export const GameLogicRoomSettingsKeysSchema = z.enum(KnownObject.keys(GameLogicRoomSettingsSchema.shape));
export type GameLogicRoomSettingsKeys = z.infer<typeof GameLogicRoomSettingsKeysSchema>;
