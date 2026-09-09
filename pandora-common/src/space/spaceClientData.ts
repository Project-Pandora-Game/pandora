import * as z from 'zod';
import { AssetFrameworkGlobalStateClientDeltaBundleSchema } from '../assets/state/globalState.ts';
import { BotIdSchema, type BotId } from '../bots/botBaseTypes.ts';
import { CharacterIdSchema } from '../character/characterTypes.ts';
import { ChatCharacterStatusSchema } from '../chat/chat.ts';
import { CharacterRoomDataDeltaSchema, CharacterRoomDataSchema } from '../gameLogic/character/characterClient.ts';
import { SpaceCharacterModifierEffectDataSchema, SpaceCharacterModifierEffectDataUpdateSchema } from '../gameLogic/characterModifiers/characterModifierClientData.ts';
import type { ZodObjectShape } from '../validation.ts';
import { SpaceIdSchema } from './space.ts';
import { SpaceClientInfoSchema } from './spaceData.ts';

/** Data about bot visible to everyone */
export interface BotPublicData {
	bot: BotId;
}
/** Data about bot visible to everyone */
export const BotPublicDataSchema: z.ZodObject<ZodObjectShape<BotPublicData>> = z.object({
	bot: BotIdSchema,
});

export const SpaceLoadDataSchema = z.object({
	id: SpaceIdSchema.nullable(),
	info: SpaceClientInfoSchema,
	characters: CharacterRoomDataSchema.array(),
	characterModifierEffects: SpaceCharacterModifierEffectDataSchema,
	bot: BotPublicDataSchema.nullable(),
	chatStatus: z.partialRecord(CharacterIdSchema, ChatCharacterStatusSchema.optional()),
});
export type SpaceLoadData = z.infer<typeof SpaceLoadDataSchema>;

export const GameStateUpdateSchema = z.object({
	globalState: AssetFrameworkGlobalStateClientDeltaBundleSchema.optional(),
	info: SpaceClientInfoSchema.partial().optional(),
	leave: CharacterIdSchema.optional(),
	join: CharacterRoomDataSchema.optional(),
	characters: z.record(CharacterIdSchema, CharacterRoomDataDeltaSchema).optional(),
	characterModifierEffects: SpaceCharacterModifierEffectDataUpdateSchema.optional(),
	bot: BotPublicDataSchema.nullable().optional(),
});
export type GameStateUpdate = z.infer<typeof GameStateUpdateSchema>;

export type IShardClientChangeEvents = 'permissions' | 'characterModifiers';

/** Data about space that only the space's bot sees */
export interface BotPrivateData extends BotPublicData {
	// Nothing here yet
	_botPrivateData?: undefined;
}
/** Data about space that only the space's bot sees */
export const BotPrivateDataSchema: z.ZodObject<ZodObjectShape<BotPrivateData>> = BotPublicDataSchema.extend({
	_botPrivateData: z.undefined().optional(),
});
