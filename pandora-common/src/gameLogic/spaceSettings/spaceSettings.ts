import * as z from 'zod';
import { KnownObject } from '../../utility/misc.ts';

//#region Settings declarations

/* This file includes settings that apply to a whole space.
Contrary to space configuration, these settings are allowed to interact with IC aspects.
On the other hand these settings cannot affect things before a character enters a room, only after the fact.
If it makes sense for a setting to be different per-room, it should be a room setting instead.
*/

export const GameLogicSpaceSettingsSchema = z.object({
});

export type GameLogicSpaceSettings = z.infer<typeof GameLogicSpaceSettingsSchema>;

export const GAME_LOGIC_SPACE_SETTINGS_DEFAULT = Object.freeze<GameLogicSpaceSettings>({
});

//#endregion

export const GameLogicSpaceSettingsKeysSchema = z.enum(KnownObject.keys(GameLogicSpaceSettingsSchema.shape));
export type GameLogicSpaceSettingsKeys = z.infer<typeof GameLogicSpaceSettingsKeysSchema>;
