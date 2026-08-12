import type { AssetFrameworkGlobalState, CharacterId } from 'pandora-common';

export function ShouldUpdateSpaceConfigurationState(
	previousState: AssetFrameworkGlobalState,
	currentState: AssetFrameworkGlobalState,
	playerId: CharacterId,
): boolean {
	return previousState.space !== currentState.space ||
		previousState.getCharacterState(playerId)?.currentRoom !== currentState.getCharacterState(playerId)?.currentRoom;
}
