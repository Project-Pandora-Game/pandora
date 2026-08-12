import {
	RoomTemplateSchema,
	type AssetFrameworkGlobalState,
	type AssetFrameworkRoomState,
} from 'pandora-common';
import { useMemo, useState, type ReactElement } from 'react';
import exportIcon from '../../../assets/icons/export.svg';
import { ExportDialog, type ExportDialogTarget } from '../../../components/exportImport/exportDialog.tsx';
import { useServiceManager } from '../../../services/serviceProvider.tsx';
import { CreateRoomPhoto } from '../room/roomPhoto.tsx';

export function RoomExportButton({ roomState, globalState }: {
	roomState: AssetFrameworkRoomState;
	globalState: AssetFrameworkGlobalState;
}): ReactElement {
	const serviceManager = useServiceManager();
	const [showExportDialog, setShowExportDialog] = useState(false);
	const roomTemplate = useMemo(() => roomState.exportToTemplate({ includeAllItems: true }), [roomState]);
	const exportExtra = useMemo(
		() => CreateRoomExportExtra(roomState, globalState, serviceManager),
		[globalState, roomState, serviceManager],
	);

	return (
		<>
			<button
				className='wardrobeActionButton allowed'
				onClick={ () => {
					setShowExportDialog(true);
				} }
			>
				<img src={ exportIcon } alt='Export room' />&nbsp;Export
			</button>
			{
				showExportDialog ? (
					<ExportDialog
						title={ 'room template' + (roomTemplate.name ? ` "${ roomTemplate.name }"` : '') }
						exportType='RoomTemplate'
						exportVersion={ 1 }
						dataSchema={ RoomTemplateSchema }
						data={ roomTemplate }
						extraData={ exportExtra }
						closeDialog={ () => setShowExportDialog(false) }
					/>
				) : null
			}
		</>
	);
}

async function CreateRoomExportExtra(
	roomState: AssetFrameworkRoomState,
	globalState: AssetFrameworkGlobalState,
	serviceManager: ReturnType<typeof useServiceManager>,
): Promise<readonly ExportDialogTarget[]> {
	const previewCanvas = await CreateRoomPhoto({
		roomState,
		globalState,
		serviceManager,
		quality: '720p',
		trim: true,
		noGhost: true,
		characters: [],
		characterNames: false,
	});

	const previewBlob = await new Promise<Blob>((resolve, reject) => {
		previewCanvas.toBlob((blob) => {
			if (!blob) {
				reject(new Error('Canvas.toBlob failed!'));
				return;
			}

			resolve(blob);
		}, 'image/jpeg', 0.8);
	}).catch(() => new Promise<Blob>((resolve, reject) => {
		previewCanvas.toBlob((blob) => {
			if (!blob) {
				reject(new Error('Canvas.toBlob failed!'));
				return;
			}

			resolve(blob);
		}, 'image/png');
	}));

	const preview: ExportDialogTarget = {
		content: previewBlob,
		suffix: `-preview.${ previewBlob.type.split('/').at(-1) }`,
		type: previewBlob.type,
	};

	return [preview];
}
