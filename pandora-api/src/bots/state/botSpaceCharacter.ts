import type { ActionTargetSelector, AssetFrameworkGlobalState, CharacterAppearance, CharacterId, GameLogicCharacter, ICharacterRoomData, ITypedEventEmitter } from 'pandora-common';

export type BotSpaceCharacterData = ICharacterRoomData;

export type BotSpaceCharacterEvents = {
	'update': Partial<BotSpaceCharacterData>;
};

export interface BotSpaceCharacter extends ITypedEventEmitter<BotSpaceCharacterEvents> {
	readonly id: CharacterId;
	readonly name: string;
	readonly data: Readonly<BotSpaceCharacterData>;
	readonly actionSelector: ActionTargetSelector;
	readonly gameLogicCharacter: GameLogicCharacter;

	getAppearance(globalState: AssetFrameworkGlobalState): CharacterAppearance;
}
