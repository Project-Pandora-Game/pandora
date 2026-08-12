import {
	AssetFrameworkCharacterState,
	AssetFrameworkGlobalState,
	AssetFrameworkSpaceState,
	AssetManager,
	type CharacterId,
} from 'pandora-common';
import {
	ShouldUpdateSpaceConfigurationActionState,
	ShouldUpdateSpaceConfigurationState,
} from '../../../../src/ui/screens/spaceConfiguration/spaceConfigurationState.ts';

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

	it('updates when the player appearance changes', () => {
		const state = CreateGlobalState(2);
		const nextState = state.withCharacter(
			'c0',
			AssetFrameworkCharacterState.createDefault(state.assetManager, 'c0', state.space),
		);

		expect(ShouldUpdateSpaceConfigurationActionState(state, nextState, 'c0')).toBe(true);
	});

	it('updates when room occupancy changes', () => {
		const state = CreateGlobalState(2);
		const character = state.getCharacterState('c1');
		expect(character).not.toBeNull();
		if (character == null || character.position.type !== 'normal') {
			throw new Error('Expected a character with normal position');
		}
		const nextState = state.withCharacter('c1', character.produceWithSpacePosition({
			...character.position,
			room: 'room:other',
		}));

		expect(ShouldUpdateSpaceConfigurationActionState(state, nextState, 'c0')).toBe(true);
	});
});

describe('ShouldUpdateSpaceConfigurationActionState', () => {
	it('ignores appearance-only updates from 100 other characters', () => {
		let state = CreateGlobalState(101);

		for (let i = 1; i <= 100; i++) {
			const id: CharacterId = `c${ i }`;
			const nextState = state.withCharacter(
				id,
				AssetFrameworkCharacterState.createDefault(state.assetManager, id, state.space),
			);

			expect(ShouldUpdateSpaceConfigurationActionState(state, nextState, 'c0')).toBe(false);
			state = nextState;
		}
	});
});
