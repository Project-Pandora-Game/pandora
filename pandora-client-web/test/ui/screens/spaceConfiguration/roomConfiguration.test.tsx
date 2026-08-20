import { fireEvent, render, screen } from '@testing-library/react';
import {
	AssetFrameworkGlobalState,
	AssetFrameworkRoomState,
	AssetFrameworkSpaceState,
	AssetManager,
	DEFAULT_PLAIN_BACKGROUND,
	ResolveBackground,
	ROOM_BUNDLE_DEFAULT_PUBLIC_SPACE,
	ServiceManager,
} from 'pandora-common';
import type { ReactElement } from 'react';
import type { ClientServices } from '../../../../src/services/clientServices.ts';
import { serviceManagerContext } from '../../../../src/services/serviceProvider.tsx';
import { jest, MockClientModule } from '../../../jest.ts';

const createRoomPhoto = jest.fn(() => new Promise<HTMLCanvasElement>(() => { /* Intentionally pending. */ }));
const renderExportDialog = jest.fn(({ data }: { data: { name?: string; }; }): ReactElement => (
	<div data-testid='export-dialog'>{ data.name }</div>
));
const renderBackground = jest.fn((): null => null);

MockClientModule('ui/screens/room/roomPhoto.tsx', () => ({
	CreateRoomPhoto: createRoomPhoto,
}));

MockClientModule('components/exportImport/exportDialog.tsx', () => ({
	ExportDialog: renderExportDialog,
}));

MockClientModule('graphics/graphicsSceneRenderer.tsx', () => ({
	GraphicsSceneBackgroundRenderer: renderBackground,
}));

MockClientModule('graphics/baseComponents/container.ts', () => ({
	Container: (): null => null,
}));

MockClientModule('graphics/graphicsBackground.tsx', () => ({
	GraphicsBackground: (): null => null,
}));

MockClientModule('graphics/useTexture.ts', async () => {
	const { createContext } = await import('react');
	return { UseTextureGetterOverride: createContext(null) };
});

MockClientModule('services/screenResolution/screenResolutionHooks.ts', () => ({
	useDevicePixelRatio: (): number => 1,
}));

const { RoomExportButton } = await import('../../../../src/ui/screens/spaceConfiguration/roomExportButton.tsx');
const { RoomConfigurationBackgroundPreview } = await import('../../../../src/ui/screens/spaceConfiguration/roomConfigurationBackgroundPreview.tsx');

describe('RoomExportButton', () => {
	const assetManager = new AssetManager('test');
	const roomState = AssetFrameworkRoomState.loadFromBundle(assetManager, {
		...ROOM_BUNDLE_DEFAULT_PUBLIC_SPACE,
		name: 'Test room',
	}, null, undefined);
	const serviceManager = new ServiceManager<ClientServices>({});
	const createGlobalState = (): AssetFrameworkGlobalState => {
		return AssetFrameworkGlobalState.createDefault(
			assetManager,
			AssetFrameworkSpaceState.createDefault(assetManager, null),
		);
	};
	const renderButton = (state: AssetFrameworkRoomState, globalState: AssetFrameworkGlobalState): ReactElement => (
		<serviceManagerContext.Provider value={ serviceManager }>
			<RoomExportButton roomState={ state } getCurrentGlobalState={ () => globalState } />
		</serviceManagerContext.Provider>
	);

	beforeEach(() => {
		createRoomPhoto.mockClear();
		renderExportDialog.mockClear();
	});

	it('only creates the room preview after export is requested', () => {
		const { rerender } = render(renderButton(roomState, createGlobalState()));

		for (let i = 0; i < 20; i++) {
			rerender(renderButton(roomState, createGlobalState()));
		}

		expect(createRoomPhoto).not.toHaveBeenCalled();

		fireEvent.click(screen.getByRole('button', { name: /export/i }));

		expect(createRoomPhoto).toHaveBeenCalledTimes(1);
		expect(screen.getByTestId('export-dialog')).toBeInTheDocument();
	});

	it('keeps the template and preview from the same snapshot while open', () => {
		const originalGlobalState = createGlobalState();
		const updatedGlobalState = createGlobalState();
		const updatedRoomState = roomState.withName('Updated room');
		const { rerender } = render(renderButton(roomState, originalGlobalState));

		fireEvent.click(screen.getByRole('button', { name: /export/i }));
		expect(screen.getByTestId('export-dialog')).toHaveTextContent('Test room');

		rerender(renderButton(updatedRoomState, updatedGlobalState));

		expect(screen.getByTestId('export-dialog')).toHaveTextContent('Test room');
		expect(createRoomPhoto).toHaveBeenCalledTimes(1);
		expect(createRoomPhoto).toHaveBeenCalledWith(expect.objectContaining({
			roomState,
			globalState: originalGlobalState,
		}));
	});
});

describe('RoomConfigurationBackgroundPreview', () => {
	it('does not redraw an unchanged background during parent updates', () => {
		const assetManager = new AssetManager('test');
		const background = ResolveBackground(assetManager, DEFAULT_PLAIN_BACKGROUND);
		const renderPreview = (): ReactElement => (
			<RoomConfigurationBackgroundPreview background={ background } previewSize={ 256 } />
		);
		const { rerender } = render(renderPreview());
		const initialRenderCount = renderBackground.mock.calls.length;

		for (let i = 0; i < 100; i++) {
			rerender(renderPreview());
		}

		expect(renderBackground).toHaveBeenCalledTimes(initialRenderCount);
	});
});
