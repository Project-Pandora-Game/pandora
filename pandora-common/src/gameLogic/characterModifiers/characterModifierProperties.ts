import type { Immutable } from 'immer';
import type { AssetFrameworkGlobalState } from '../../assets';
import type { EffectsDefinition } from '../../assets/effects';
import type { CharacterRestrictionsManager } from '../../character';
import type { BlockableChatMessage, ChatMessageBlockingResult } from '../../chat';
import type { IChatSegment } from '../../chat/chat';
import type { AppearanceAction } from '../actionLogic';
import type { CharacterModifierEffectData } from './characterModifierData';

/**
 * Properties (effects) that can be applied by modifiers.
 *
 * Modifier instance config __must__ always be the first argument.
 */
export interface CharacterModifierProperties<TConfig> {
	/**
	 * Apply additional effects to the character.
	 * Higher priority modifiers are applied first.
	 *
	 * @param config - Config of this modifier
	 * @param currentEffects - Effects that are currently applied to the character (either by items or by higher-priority modifiers)
	 * @returns _Additional_ effects to apply. These get merged with `currentEffects`.
	 */
	applyCharacterEffects?(config: TConfig, currentEffects: EffectsDefinition): Readonly<Partial<EffectsDefinition>>;

	/**
	 * Run additional checks on action the character tries to perform.
	 * Order of modifiers does not matter.
	 *
	 * Note, that some actions (such as entering/leaving safemode) are "protected" and cannot be caught this way.
	 *
	 * @param config - Config of this modifier
	 * @param action - The action the character is attempting to do
	 * @param player - Restriction manager of player before the action
	 * @param originalState - State of the space before the action
	 * @param resultState - State of the space after the action
	 * @returns Whether to `allow` or `block` this action.
	 */
	checkCharacterAction?(
		config: TConfig,
		action: Immutable<AppearanceAction>,
		player: CharacterRestrictionsManager,
		originalState: AssetFrameworkGlobalState,
		resultState: AssetFrameworkGlobalState
	): ('allow' | 'block');

	/**
	 * Run additional checks on chat message the character tries to say.
	 * Order of modifiers matters only w.r.t. to what "blocked" message is shown in case at least one modifier blocks the message.
	 *
	 * @param config - Config of this modifier
	 * @param message - The message character is trying to say
	 * @returns Whether to allow or block this message, and explanation.
	 */
	checkChatMessage?(
		config: TConfig,
		message: BlockableChatMessage
	): ChatMessageBlockingResult;

	/**
	 * Process a chat message, before the usual muffling.
	 * Higher priority modifiers are applied first.
	 *
	 * Applies to normal chat messages and normal whispers.
	 *
	 * @param config - Config of this modifier
	 * @param content - Content of the message to process, can be mutated in-place
	 * @returns New content of the message
	 */
	processChatMessageBeforeMuffle?(
		config: TConfig,
		content: IChatSegment[]
	): IChatSegment[];

	/**
	 * Process a chat message, applied after the usual muffling.
	 * Higher priority modifiers are applied last.
	 *
	 * Applies to normal chat messages and normal whispers.
	 *
	 * @param config - Config of this modifier
	 * @param content - Content of the message to process, can be mutated in-place
	 * @returns New content of the message
	 */
	processChatMessageAfterMuffle?(
		config: TConfig,
		content: IChatSegment[]
	): IChatSegment[];

	/**
	 * Process a received chat message, before the usual heiring impairment effects.
	 * Higher priority modifiers are applied first.
	 *
	 * Applies to normal chat messages and normal whispers.
	 *
	 * @param config - Config of this modifier
	 * @param content - Content of the message to process, can be mutated in-place
	 * @returns New content of the message
	 */
	processReceivedChatMessageBeforeFilters?(
		config: TConfig,
		content: IChatSegment[]
	): IChatSegment[];

	/**
	 * Process a received chat message, after the usual heiring impairment effects.
	 * Higher priority modifiers are applied last.
	 *
	 * Applies to normal chat messages and normal whispers.
	 *
	 * @param config - Config of this modifier
	 * @param content - Content of the message to process, can be mutated in-place
	 * @returns New content of the message
	 */
	processReceivedChatMessageAfterFilters?(
		config: TConfig,
		content: IChatSegment[]
	): IChatSegment[];
}

/** A helper type that contains all of modifier properties hooks without their config argument. */
export type CharacterModifierPropertiesApplier = {
	readonly [t in keyof CharacterModifierProperties<unknown>]-?:
	NonNullable<CharacterModifierProperties<unknown>[t]> extends (config: infer TConfig, ...args: infer Args) => infer Return ?
	(((...args: Args) => Return) | null) : never;
	// We intentionally make it non-optional and use `null` to avoid forgetting about linking things in `createPropertiesApplier`
} & {
	// In addition applier links to the original effect
	readonly effect: CharacterModifierEffectData;
};
