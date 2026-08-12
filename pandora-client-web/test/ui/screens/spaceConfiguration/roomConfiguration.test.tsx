import { fireEvent, render, screen } from '@testing-library/react';
import {
	AssetFrameworkGlobalState,
	AssetFrameworkSpaceState,
	AssetManager,
	type AssetFrameworkRoomState,
	type ServiceProvider,
} from 'pandora-common';
import type { ReactElement } from 'react';
import type { ClientServices } from '../../../../src/services/clientServices.ts';
import { serviceManagerContext } from '../../../../src/services/serviceProvider.tsx';

const jest = import.meta.jest;
const unstableMockModule = (jest as typeof jest & Record<
	'unstable_mockModule',
	(moduleName: string, moduleFactory: () => unknown) => typeof jest
>).unstable_mockModule;

const createRoomPhoto = jest.fn(() => new Promise<HTMLCanvasElement>(() => { /* Intentionally pending. */ }));
const renderExportDialog = jest.fn(({ data }: { data: { name?: string; }; }): ReactElement => (
	<div data-testid='export-dialog'>{ data.name }</div>
));

unstableMockModule('../../../../src/ui/screens/room/roomPhoto.tsx', () => ({
	CreateRoomPhoto: createRoomPhoto,
}));

unstableMockModule('../../../../src/components/exportImport/exportDialog.tsx', () => ({
	ExportDialog: renderExportDialog,
}));

const { RoomExportButton } = await import('../../../../src/ui/screens/spaceConfiguration/roomExportButton.tsx');

describe('RoomExportButton', () => {
	const roomState = {
		exportToTemplate: () => ({ name: 'Test room' }),
	} as unknown as AssetFrameworkRoomState;
	const serviceManager = { services: {} } as unknown as ServiceProvider<ClientServices>;
	const createGlobalState = (): AssetFrameworkGlobalState => {
		const assetManager = new AssetManager('test');
		return AssetFrameworkGlobalState.createDefault(
			assetManager,
			AssetFrameworkSpaceState.createDefault(assetManager, null),
		);
	};
	const renderButton = (state: AssetFrameworkRoomState, globalState: AssetFrameworkGlobalState): ReactElement => (
		<serviceManagerContext.Provider value={ serviceManager }>
			<RoomExportButton roomState={ state } globalState={ globalState } />
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
		const updatedRoomState = {
			exportToTemplate: () => ({ name: 'Updated room' }),
		} as unknown as AssetFrameworkRoomState;
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
