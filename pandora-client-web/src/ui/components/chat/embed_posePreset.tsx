import classNames from 'classnames';
import { nanoid } from 'nanoid';
import { AssetFrameworkPosePresetSchema, type AssetFrameworkPosePreset } from 'pandora-common';
import { CreateMoveCharacterAction, type MoveCharacterActionParams } from 'pandora-common/gameLogic/actionLogic/actions/moveCharacter';
import { useCallback, useState, type ReactElement } from 'react';
import bodyIcon from '../../../assets/icons/body.svg';
import diskIcon from '../../../assets/icons/disk.svg';
import exportIcon from '../../../assets/icons/export.svg';
import { useEvent } from '../../../common/useEvent.ts';
import { Button } from '../../../components/common/button/button.tsx';
import { Column, Row } from '../../../components/common/container/container.tsx';
import { DraggableDialog } from '../../../components/dialog/dialog.tsx';
import { usePlayerState } from '../../../components/gameContext/playerContextProvider.tsx';
import { FixupStoredPosePreset } from '../../../components/wardrobe/poseDetail/customPosePresetStorage.ts';
import { PoseButton } from '../../../components/wardrobe/poseDetail/poseButton.tsx';
import { PosePresetEditTable } from '../../../components/wardrobe/poseDetail/posePresetEdit.tsx';
import { PosePresetExportDialog, useSavedPosePresetsProvider } from '../../../components/wardrobe/poseDetail/storedPosePresets.tsx';
import { useWardrobeExecuteCallback } from '../../../components/wardrobe/wardrobeActionContext.tsx';
import { RenderedPandoraImportEmbed } from './embeds.tsx';

/**
 * A component for rendering a pose preset
 */

export function RenderedPosePreset({ value }: {
	value: string;
}): ReactElement {
	return (
		<RenderedPandoraImportEmbed
			value={ value }
			visibleName='pose preset'
			expectedType='PosePreset'
			expectedVersion={ 1 }
			dataSchema={ AssetFrameworkPosePresetSchema }
			Embed={ RenderedPosePresetInner } />
	);
}

function RenderedPosePresetInner({ data }: {
	data: AssetFrameworkPosePreset;
}): ReactElement {
	const [open, setOpen] = useState(false);

	return (
		<>
			<button
				className={ classNames(
					'ChatEmbed',
					open ? 'selected' : null,
				) }
				onClick={ () => setOpen(true) }
			>
				<img className='icon' src={ bodyIcon } alt='Quick posing' />
				Pose preset "{ data.name }"
			</button>
			{ open ? (
				<PosePresetEmbedDialog
					data={ data }
					close={ () => {
						setOpen(false);
					} }
				/>
			) : null }
		</>
	);
}

function PosePresetEmbedDialog({ data, close }: {
	data: AssetFrameworkPosePreset;
	close: () => void;
}) {
	const { playerState } = usePlayerState();
	const { stored: customPosePresets, save: updateCustomPosePresets } = useSavedPosePresetsProvider();

	const [exporting, setExporting] = useState(false);

	const saveToPosePresets = useCallback(() => {
		if (customPosePresets == null)
			return;

		updateCustomPosePresets([
			...customPosePresets,
			{
				id: nanoid(),
				name: data.name,
				pose: data.pose,
				rotation: data.rotation,
				yOffset: data.yOffset,
			},
		], () => {
			close();
		});
	}, [customPosePresets, updateCustomPosePresets, data, close]);

	const [execute] = useWardrobeExecuteCallback();
	const setPoseDirect = useEvent((params: MoveCharacterActionParams) => {
		execute(CreateMoveCharacterAction(params, playerState));
	});

	if (exporting) {
		return (
			<PosePresetExportDialog
				exported={ data }
				close={ () => {
					setExporting(false);
					close();
				} }
			/>
		);
	}

	return (
		<DraggableDialog
			title={ `Pose preset "${data.name}"` }
			close={ close }
			allowShade
		>
			<Column>
				<Row gap='small' alignY='center'>
					<span>Name:</span>
					<span>{ data.name }</span>
				</Row>
				<br />
				<PosePresetEditTable
					preset={ data }
					update={ null }
					assetManager={ playerState.assetManager }
					sourcePose={ playerState.actualPose }
					sourceRotation={ playerState.getActualCharacterRotation() }
					sourceYOffset={ playerState.position.position[2] }
				/>
				<PoseButton
					preset={ {
						...FixupStoredPosePreset(data, playerState.assetManager),
						name: 'Use this pose',
					} }
					setPose={ setPoseDirect }
					characterState={ playerState }
				/>
				<Row alignX='space-between'>
					<Button onClick={ () => {
						setExporting(true);
					} }>
						<img src={ exportIcon } alt='Export' />
						<span>&nbsp;Export</span>
					</Button>
					<Button onClick={ saveToPosePresets } disabled={ (Object.keys(data.pose).length === 0 && data.rotation == null && data.yOffset == null) || customPosePresets == null }>
						<img src={ diskIcon } alt='Save' />
						<span>&nbsp;Save</span>
					</Button>
				</Row>
			</Column>
		</DraggableDialog>
	);
}

