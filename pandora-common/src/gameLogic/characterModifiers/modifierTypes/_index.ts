import * as z from 'zod';
import { Assert, KnownObject, ParseArrayNotEmpty, type Satisfies } from '../../../utility/index.ts';
import type { CharacterModifierTemplate } from '../characterModifierData.ts';
import type { CharacterModifierConditionChain } from '../conditions/index.ts';
import type { CharacterModifierTypeDefinitionBase } from '../helpers/modifierDefinition.ts';

import { block_adding_new_modifiers } from './block_adding_new_modifiers.ts';
import { block_changing_following_state } from './block_changing_following_state.ts';
import { block_changing_pose_self } from './block_changing_pose_self.ts';
import { block_creating_items } from './block_creating_items.ts';
import { block_deleting_items } from './block_deleting_items.ts';
import { block_entering_specific_rooms } from './block_entering_specific_rooms.ts';
import { block_equipping_items_others } from './block_equipping_items_others.ts';
import { block_equipping_items_self } from './block_equipping_items_self.ts';
import { block_lock_unlock_others } from './block_lock_unlock_others.ts';
import { block_lock_unlock_self } from './block_lock_unlock_self.ts';
import { block_managing_room_map } from './block_managing_room_map.ts';
import { block_removing_items_others } from './block_removing_items_others.ts';
import { block_removing_items_self } from './block_removing_items_self.ts';
import { effect_blind } from './effect_blind.ts';
import { effect_block_hands } from './effect_block_hands.ts';
import { effect_block_room_movement } from './effect_block_room_movement.ts';
import { effect_block_space_leaving } from './effect_block_space_leaving.ts';
import { effect_blur_vision } from './effect_blur_vision.ts';
import { effect_delayed_bound_usage } from './effect_delayed_bound_usage.ts';
import { effect_hearing } from './effect_hearing.ts';
import { effect_slow_wardrobe_actions } from './effect_slow_wardrobe_actions.ts';
import { effect_speech_garble } from './effect_speech_garble.ts';
import { hearing_selective_deprivation } from './hearing_selective_deprivation.ts';
import { misc_space_switch_auto_approve } from './misc_space_switch_auto_approve.ts';
import { setting_chat_action_log } from './setting_chat_action_log.ts';
import { setting_room_focus } from './setting_room_focus.ts';
import { speech_ban_words } from './speech_ban_words.ts';
import { speech_doll_talk } from './speech_doll_talk.ts';
import { speech_faltering_voice } from './speech_faltering_voice.ts';
import { speech_forbid_talking_openly } from './speech_forbid_talking_openly.ts';
import { speech_require_defined_words } from './speech_require_defined_words.ts';
import { speech_restrict_whispering } from './speech_restrict_whispering.ts';
import { speech_specific_sounds_only } from './speech_specific_sounds_only.ts';

//#region Character modifier types catalogue

/** Catalogue of all character modifier types */
export const CHARACTER_MODIFIER_TYPE_DEFINITION = {
	block_adding_new_modifiers,
	block_changing_following_state,
	block_changing_pose_self,
	block_creating_items,
	block_deleting_items,
	block_entering_specific_rooms,
	block_equipping_items_others,
	block_equipping_items_self,
	block_lock_unlock_others,
	block_lock_unlock_self,
	block_managing_room_map,
	block_removing_items_others,
	block_removing_items_self,
	effect_blind,
	effect_block_hands,
	effect_block_room_movement,
	effect_block_space_leaving,
	effect_blur_vision,
	effect_delayed_bound_usage,
	effect_hearing,
	effect_slow_wardrobe_actions,
	effect_speech_garble,
	hearing_selective_deprivation,
	misc_space_switch_auto_approve,
	setting_chat_action_log,
	setting_room_focus,
	speech_ban_words,
	speech_doll_talk,
	speech_faltering_voice,
	speech_forbid_talking_openly,
	speech_require_defined_words,
	speech_restrict_whispering,
	speech_specific_sounds_only,
} as const satisfies Readonly<Record<string, CharacterModifierTypeDefinitionBase>>;

//#endregion

/** List of all character modifier types */
export const CHARACTER_MODIFIER_TYPES = ParseArrayNotEmpty(
	KnownObject.keys(CHARACTER_MODIFIER_TYPE_DEFINITION),
);

/** Identifier of a character modifier type */
export const CharacterModifierTypeSchema = z.enum(CHARACTER_MODIFIER_TYPES);
/** Identifier of a character modifier type */
export type CharacterModifierType = (keyof typeof CHARACTER_MODIFIER_TYPE_DEFINITION) & string;

/** Definition of a character modifier type, optionally filterable to a specific type */
export type CharacterModifierTypeDefinition<TType extends CharacterModifierType = CharacterModifierType> =
	(typeof CHARACTER_MODIFIER_TYPE_DEFINITION)[TType];

// Check integrity
type __satisfies__ModiferTypeIds = Satisfies<typeof CHARACTER_MODIFIER_TYPE_DEFINITION, {
	[k in CharacterModifierType]: CharacterModifierTypeDefinitionBase & { typeId: k; };
}>;
Assert(KnownObject.entries(CHARACTER_MODIFIER_TYPE_DEFINITION).every(([k, v]) => k === v.typeId));

/** Configuration for specific modifier type */
export type CharacterModifierSpecificConfig<TType extends CharacterModifierType> = z.infer<CharacterModifierTypeDefinition<TType>['configSchema']>;

/** Character modifier template, built to fully match a specific modifier */
export type CharacterModifierSpecificTemplate = Satisfies<{
	[Type in CharacterModifierType]: {
		type: Type;
		name: string;
		config: CharacterModifierSpecificConfig<Type>;
		conditions: CharacterModifierConditionChain;
	};
}[CharacterModifierType], CharacterModifierTemplate>;
