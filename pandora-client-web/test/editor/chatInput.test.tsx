import { act, render, renderHook, screen } from '@testing-library/react';
import { ASSET_PREFERENCES_DEFAULT, AssetFrameworkGlobalState, AssetFrameworkGlobalStateContainer, AssetFrameworkSpaceState, AssetManager } from 'pandora-common';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router';
import { PlayerCharacterImpl } from '../../src/character/player.ts';
import type { ChildrenProps } from '../../src/common/reactTypes.ts';
import type { GameState } from '../../src/components/gameContext/gameStateContextProvider.tsx';
import { GenerateClientEditorServices } from '../../src/editor/services/editorServices.ts';
import { Observable, StaticObservable } from '../../src/observable.ts';
import { GenerateClientGameLogicServices } from '../../src/services/clientGameLogicServices.ts';
import { GenerateClientUsermodeServices, type ClientServices } from '../../src/services/clientServices.ts';
import { ServiceManagerContextProvider } from '../../src/services/serviceProvider.tsx';
import { ChatInputContextProvider, useChatCommandContextGenerator } from '../../src/ui/components/chat/chatInput.tsx';
import { useChatInput } from '../../src/ui/components/chat/chatInputContext.ts';
import { COMMANDS } from '../../src/ui/components/chat/commands.ts';
import { RunCommand } from '../../src/ui/components/chat/commandsProcessor.ts';
import { jest } from '../jest.ts';
import { MockConnectionInfo } from '../mocks/networking/mockShardConnector.ts';

describe('Editor chat input', () => {
	it('opens the simulated Pandora chat without a Directory connection', () => {
		const serviceManager = GenerateClientEditorServices();
		expect(serviceManager.services.directoryConnector).toBeUndefined();

		render(
			<MemoryRouter>
				<ServiceManagerContextProvider serviceManager={ serviceManager }>
					<ChatInputContextProvider>
						<ChatAvailability />
					</ChatInputContextProvider>
				</ServiceManagerContextProvider>
			</MemoryRouter>,
		);

		expect(screen.getByText('Simulated Pandora')).toBeVisible();
		expect(screen.getByText('Slash commands unavailable')).toBeVisible();
	});

	it('enables normal client commands when game state loads and reads the latest global state', async () => {
		const serviceManager = GenerateClientUsermodeServices();
		const gameLogicServices = GenerateClientGameLogicServices({
			...serviceManager.services as ClientServices,
			connectionInfo: MockConnectionInfo(),
		});
		const gameState = new Observable<GameState | null>(null);
		const gameStateSpy = jest.spyOn(gameLogicServices.services.gameState!, 'gameState', 'get').mockReturnValue(gameState);
		const gameLogicSpy = jest.spyOn(serviceManager.services.shardConnectionManager!, 'gameLogicServices', 'get')
			.mockReturnValue(new StaticObservable(gameLogicServices));
		const setChatMode = jest.fn();
		try {
			const { result } = renderHook(() => useChatCommandContextGenerator(null, setChatMode, jest.fn()), {
				wrapper: ({ children }: ChildrenProps) => (
					<MemoryRouter>
						<ServiceManagerContextProvider serviceManager={ serviceManager }>{ children }</ServiceManagerContextProvider>
					</MemoryRouter>
				),
			});
			expect(result.current).toBeNull();

			const assetManager = new AssetManager('test');
			const space = AssetFrameworkSpaceState.createDefault(assetManager, null);
			const stateContainer = { currentState: AssetFrameworkGlobalState.createDefault(assetManager, space) };
			const player = new PlayerCharacterImpl({
				id: 'c123', accountId: 0, accountDisplayName: 'Test account', name: 'Test character',
				created: 0, profileDescription: '', settings: {}, publicSettings: {},
				assetPreferences: ASSET_PREFERENCES_DEFAULT, onlineStatus: 'online',
			});
			const loadedState: Partial<GameState> = {
				globalState: stateContainer as AssetFrameworkGlobalStateContainer,
				player,
			};
			act(() => {
				gameState.value = loadedState as GameState;
			});
			const generateContext = result.current;
			if (generateContext == null)
				throw new Error('Expected commands to be available after loading game state');
			expect(generateContext().directoryConnector).toBe(serviceManager.services.directoryConnector);
			expect(generateContext().shardConnector).toBe(gameLogicServices.services.shardConnector);
			expect(await RunCommand('ooc', generateContext(), COMMANDS)).toBe(true);
			expect(setChatMode).toHaveBeenCalledWith({ type: 'ooc', raw: false });

			stateContainer.currentState = stateContainer.currentState.withSpaceState(AssetFrameworkSpaceState.createDefault(assetManager, null));
			expect(generateContext().globalState).toBe(stateContainer.currentState);
			act(() => {
				gameState.value = null;
			});
			expect(result.current).toBeNull();
		} finally {
			gameStateSpy.mockRestore();
			gameLogicSpy.mockRestore();
		}
	});
});

function ChatAvailability(): ReactElement {
	const { commandsRunner } = useChatInput();
	return <><span>Simulated Pandora</span>{ commandsRunner?.['/'] == null ? <span>Slash commands unavailable</span> : null }</>;
}
