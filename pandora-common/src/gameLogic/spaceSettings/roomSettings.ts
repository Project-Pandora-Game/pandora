import * as z from 'zod';
import { KnownObject } from '../../utility/misc.ts';

//#region Settings declarations

/* This file includes settings that apply differently to individual rooms per space.
There is also an option to specify settings globally instead of per-room. By default all rooms default to space-wide settings.
If an action cannot be narrowed down to a specific room, a space-wide setting might be used as well.
*/

export const GameLogicRoomSettingsSchema = z.object({
});

export type GameLogicRoomSettings = z.infer<typeof GameLogicRoomSettingsSchema>;

export const GAME_LOGIC_ROOM_SETTINGS_DEFAULT = Object.freeze<GameLogicRoomSettings>({
});

//#endregion

export const GameLogicRoomSettingsKeysSchema = z.enum(KnownObject.keys(GameLogicRoomSettingsSchema.shape));
export type GameLogicRoomSettingsKeys = z.infer<typeof GameLogicRoomSettingsKeysSchema>;
