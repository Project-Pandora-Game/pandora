import {
	RoomTemplateSchema,
	type AssetFrameworkGlobalState,
	type AssetFrameworkRoomState,
	type RoomTemplate,
} from 'pandora-common';
import { useState, type ReactElement } from 'react';
import exportIcon from '../../../assets/icons/export.svg';
import { ExportDialog, type ExportDialogTarget } from '../../../components/exportImport/exportDialog.tsx';
import { useServiceManager } from '../../../services/serviceProvider.tsx';
import { CreateRoomPhoto } from '../room/roomPhoto.tsx';

type RoomExportSnapshot = {
	roomTemplate: RoomTemplate;
	extraData: Promise<readonly ExportDialogTarget[]>;
};

export function RoomExportButton({ roomState, globalState }: {
	roomState: AssetFrameworkRoomState;
	globalState: AssetFrameworkGlobalState;
}): ReactElement {
	const serviceManager = useServiceManager();
	const [exportSnapshot, setExportSnapshot] = useState<RoomExportSnapshot | null>(null);

	return (
		<>
			<button
				className='wardrobeActionButton allowed'
				onClick={ () => {
					setExportSnapshot({
						roomTemplate: roomState.exportToTemplate({ includeAllItems: true }),
						extraData: CreateRoomExportExtra(roomState, globalState, serviceManager),
					});
				} }
			>
				<img src={ exportIcon } alt='Export room' />&nbsp;Export
			</button>
			{
				exportSnapshot != null ? (
					<ExportDialog
						title={ 'room template' + (exportSnapshot.roomTemplate.name ? ` "${ exportSnapshot.roomTemplate.name }"` : '') }
						exportType='RoomTemplate'
						exportVersion={ 1 }
						dataSchema={ RoomTemplateSchema }
						data={ exportSnapshot.roomTemplate }
						extraData={ exportSnapshot.extraData }
						closeDialog={ () => setExportSnapshot(null) }
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
