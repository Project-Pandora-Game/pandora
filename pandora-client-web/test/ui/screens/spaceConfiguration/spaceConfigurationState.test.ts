import {
	AssetFrameworkCharacterState,
	AssetFrameworkGlobalState,
	AssetFrameworkSpaceState,
	AssetManager,
	type CharacterId,
} from 'pandora-common';
import { ShouldUpdateSpaceConfigurationState } from '../../../../src/ui/screens/spaceConfiguration/spaceConfigurationState.ts';

function CreateGlobalState(characterCount: number): AssetFrameworkGlobalState {
	const assetManager = new AssetManager('test');
	const space = AssetFrameworkSpaceState.createDefault(assetManager, null);
	let state = AssetFrameworkGlobalState.createDefault(assetManager, space);

	for (let i = 0; i < characterCount; i++) {
		const id: CharacterId = `c${ i }`;
		state = state.withCharacter(id, AssetFrameworkCharacterState.createDefault(assetManager, id, space));
	}

	return state;
}

describe('ShouldUpdateSpaceConfigurationState', () => {
	it('ignores appearance-only updates from 100 other characters', () => {
		let state = CreateGlobalState(101);

		for (let i = 1; i <= 100; i++) {
			const id: CharacterId = `c${ i }`;
			const nextState = state.withCharacter(
				id,
				AssetFrameworkCharacterState.createDefault(state.assetManager, id, state.space),
			);

			expect(ShouldUpdateSpaceConfigurationState(state, nextState, 'c0')).toBe(false);
			state = nextState;
		}
	});
});
