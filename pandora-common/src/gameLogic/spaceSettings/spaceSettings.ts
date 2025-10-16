import * as z from 'zod';
import { KnownObject } from '../../utility/misc.ts';
import { ZodArrayWithInvalidDrop } from '../../validation.ts';

//#region Settings declarations

/* This file includes settings that apply to a whole space.
Contrary to space configuration, these settings are allowed to interact with IC aspects.
On the other hand these settings cannot affect things before a character enters a room, only after the fact.
If it makes sense for a setting to be different per-room, it should be a room setting instead.
*/

/** Minigames available inside a space. */
export const GameLogicSpaceMinigamesSchema = z.enum(['dice', 'rockpaperscissors', 'cards']);
/** Minigames available inside a space. */
export type GameLogicSpaceMinigames = z.infer<typeof GameLogicSpaceMinigamesSchema>;

export const GameLogicSpaceSettingsSchema = z.object({
	/**
	 * Whether to display space logic change messages or not (logic settings, room-specific changes).
	 */
	spaceChangeActionMessages: z.boolean(),
	/**
	 * Whether to display character movement messages - character follow state changes and character room device enter/leave
	 */
	characterMovementActionMessages: z.boolean(),
	/** List of minigames to disallow inside this space (default is to allow all, enabling new ones by default as well). */
	disabledMinigames: ZodArrayWithInvalidDrop(GameLogicSpaceMinigamesSchema, undefined, GameLogicSpaceMinigamesSchema.options.length),
});

export type GameLogicSpaceSettings = z.infer<typeof GameLogicSpaceSettingsSchema>;

export const GAME_LOGIC_SPACE_SETTINGS_DEFAULT = Object.freeze<GameLogicSpaceSettings>({
	spaceChangeActionMessages: true,
	characterMovementActionMessages: true,
	disabledMinigames: [],
});

//#endregion

export const GameLogicSpaceSettingsKeysSchema = z.enum(KnownObject.keys(GameLogicSpaceSettingsSchema.shape));
export type GameLogicSpaceSettingsKeys = z.infer<typeof GameLogicSpaceSettingsKeysSchema>;
