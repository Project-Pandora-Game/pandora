import { act, renderHook } from '@testing-library/react';
import {
	AssetFrameworkGlobalState,
	AssetFrameworkSpaceState,
	AssetManager,
} from 'pandora-common';
import type { GameState } from '../../../src/components/gameContext/gameStateContextProvider.tsx';
import { useGlobalStateFiltered } from '../../../src/services/gameLogic/gameStateHooks.ts';

const jest = import.meta.jest;

function CreateGlobalState(): AssetFrameworkGlobalState {
	const assetManager = new AssetManager('test');
	return AssetFrameworkGlobalState.createDefault(
		assetManager,
		AssetFrameworkSpaceState.createDefault(assetManager, null),
	);
}

function CreateGameState(initialState: AssetFrameworkGlobalState): {
	gameState: GameState;
	setGlobalState: (state: AssetFrameworkGlobalState) => void;
} {
	let onGlobalStateChange: (() => void) | undefined;
	const stateContainer = { currentState: initialState };
	const gameState = {
		globalState: stateContainer,
		on: jest.fn((_event, listener: () => void): (() => void) => {
			onGlobalStateChange = listener;
			return () => {
				onGlobalStateChange = undefined;
			};
		}),
	} as unknown as GameState;

	return {
		gameState,
		setGlobalState: (state) => {
			stateContainer.currentState = state;
			onGlobalStateChange?.();
		},
	};
}

describe('useGlobalStateFiltered', () => {
	it('keeps the previous snapshot when an update is irrelevant', () => {
		const initialState = CreateGlobalState();
		const nextState = CreateGlobalState();
		const { gameState, setGlobalState } = CreateGameState(initialState);
		let renderCount = 0;
		const { result } = renderHook(() => {
			renderCount++;
			return useGlobalStateFiltered(gameState, () => false);
		});

		act(() => setGlobalState(nextState));

		expect(result.current).toBe(initialState);
		expect(renderCount).toBe(1);
	});
});
