import { act, renderHook } from '@testing-library/react';
import {
	AssetFrameworkCharacterState,
	AssetFrameworkGlobalState,
	AssetFrameworkSpaceState,
	AssetManager,
	type AssetFrameworkGlobalStateContainer,
	type CharacterId,
} from 'pandora-common';
import type { GameState } from '../../../src/components/gameContext/gameStateContextProvider.tsx';
import { useCharacterCurrentRoom, useSpaceState } from '../../../src/services/gameLogic/gameStateHooks.ts';
import { jest } from '../../jest.ts';

function CreateGlobalState(characterCount: number = 0): AssetFrameworkGlobalState {
	const assetManager = new AssetManager('test');
	const space = AssetFrameworkSpaceState.createDefault(assetManager, null);
	let state = AssetFrameworkGlobalState.createDefault(
		assetManager,
		space,
	);
	for (let i = 0; i < characterCount; i++) {
		const id: CharacterId = `c${ i }`;
		state = state.withCharacter(id, AssetFrameworkCharacterState.createDefault(assetManager, id, space));
	}
	return state;
}

function CreateGameState(initialState: AssetFrameworkGlobalState): {
	gameState: GameState;
	setGlobalState: (state: AssetFrameworkGlobalState) => void;
} {
	let onGlobalStateChange: (() => void) | undefined;
	const stateContainer = { currentState: initialState };
	const gameState: Partial<GameState> = {
		globalState: stateContainer as AssetFrameworkGlobalStateContainer,
		on: jest.fn((_event, listener: () => void): (() => void) => {
			onGlobalStateChange = listener;
			return () => {
				onGlobalStateChange = undefined;
			};
		}),
	};

	return {
		gameState: gameState as GameState,
		setGlobalState: (state) => {
			stateContainer.currentState = state;
			onGlobalStateChange?.();
		},
	};
}

describe('global state selectors', () => {
	it('does not update the selected space for character-only changes', () => {
		const initialState = CreateGlobalState(101);
		const { gameState, setGlobalState } = CreateGameState(initialState);
		let renderCount = 0;
		const { result } = renderHook(() => {
			renderCount++;
			return useSpaceState(gameState);
		});

		let state = initialState;
		for (let i = 1; i <= 100; i++) {
			const id: CharacterId = `c${ i }`;
			state = state.withCharacter(
				id,
				AssetFrameworkCharacterState.createDefault(state.assetManager, id, state.space),
			);
			act(() => setGlobalState(state));
		}

		expect(result.current).toBe(initialState.space);
		expect(renderCount).toBe(1);
	});

	it('updates the selected space when the space changes', () => {
		const initialState = CreateGlobalState();
		const nextSpace = AssetFrameworkSpaceState.createDefault(initialState.assetManager, null);
		const { gameState, setGlobalState } = CreateGameState(initialState);
		const { result } = renderHook(() => useSpaceState(gameState));

		act(() => setGlobalState(initialState.withSpaceState(nextSpace)));

		expect(result.current).toBe(nextSpace);
	});

	it('updates the selected character room without exposing other character state', () => {
		const initialState = CreateGlobalState(2);
		const playerState = initialState.getCharacterState('c0');
		expect(playerState?.position.type).toBe('normal');
		if (playerState == null || playerState.position.type !== 'normal')
			throw new Error('Expected player state with normal position');

		const { gameState, setGlobalState } = CreateGameState(initialState);
		let renderCount = 0;
		const { result } = renderHook(() => {
			renderCount++;
			return useCharacterCurrentRoom(gameState, 'c0');
		});

		const unrelatedState = initialState.withCharacter(
			'c1',
			AssetFrameworkCharacterState.createDefault(initialState.assetManager, 'c1', initialState.space),
		);
		act(() => setGlobalState(unrelatedState));
		expect(renderCount).toBe(1);

		const nextState = unrelatedState.withCharacter('c0', playerState.produceWithSpacePosition({
			...playerState.position,
			room: 'room:other',
		}));
		act(() => setGlobalState(nextState));

		expect(result.current).toBe('room:other');
		expect(renderCount).toBe(2);
	});
});
