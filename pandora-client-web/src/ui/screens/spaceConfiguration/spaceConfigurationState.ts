import type { AssetFrameworkGlobalState, CharacterId } from 'pandora-common';

export function ShouldUpdateSpaceConfigurationState(
	previousState: AssetFrameworkGlobalState,
	currentState: AssetFrameworkGlobalState,
	playerId: CharacterId,
): boolean {
	return previousState.space !== currentState.space ||
		previousState.getCharacterState(playerId)?.currentRoom !== currentState.getCharacterState(playerId)?.currentRoom;
}

export function ShouldUpdateSpaceConfigurationActionState(
	previousState: AssetFrameworkGlobalState,
	currentState: AssetFrameworkGlobalState,
	playerId: CharacterId,
): boolean {
	if (
		previousState.space !== currentState.space ||
		previousState.getCharacterState(playerId) !== currentState.getCharacterState(playerId) ||
		previousState.characters.size !== currentState.characters.size
	) {
		return true;
	}

	for (const [id, previousCharacter] of previousState.characters) {
		if (previousCharacter.currentRoom !== currentState.getCharacterState(id)?.currentRoom) {
			return true;
		}
	}

	return false;
}
