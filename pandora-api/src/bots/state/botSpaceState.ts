import type { Immutable } from 'immer';
import type {
	AssetFrameworkGlobalState,
	AssetManager,
	BotPrivateData,
	CharacterId,
	CurrentSpaceInfo,
	ITypedEventEmitter,
	SpaceCharacterModifierEffectData,
} from 'pandora-common';
import type { BotSpaceCharacter } from './botSpaceCharacter.ts';

export type BotSpaceStateEvents = {
	assetsChanged: AssetManager;
	spaceConfigChanged: CurrentSpaceInfo;
	privateBotDataChanged: Immutable<BotPrivateData>;
	globalStateChanged: {
		previousState: AssetFrameworkGlobalState;
		newState: AssetFrameworkGlobalState;
	};
	characterModifiersChanged: void;
	characterJoined: BotSpaceCharacter;
	characterLeft: CharacterId;
};

export interface BotSpaceState extends ITypedEventEmitter<BotSpaceStateEvents> {
	readonly assetManager: AssetManager;

	readonly currentSpace: CurrentSpaceInfo;
	readonly botPrivateData: Immutable<BotPrivateData>;
	readonly globalState: AssetFrameworkGlobalState;
	readonly characters: readonly BotSpaceCharacter[];
	readonly characterModifierEffects: Immutable<SpaceCharacterModifierEffectData>;
}
