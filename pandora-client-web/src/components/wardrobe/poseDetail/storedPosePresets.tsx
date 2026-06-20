import { produce } from 'immer';
import { clamp, cloneDeep, omit } from 'lodash-es';
import { nanoid } from 'nanoid';
import {
	AssertNotNullable,
	AssetFrameworkPosePresetSchema,
	GetLogger,
	LIMIT_ACCOUNT_POSE_PRESET_STORAGE,
	LIMIT_POSE_PRESET_NAME_LENGTH,
	type AssetFrameworkCharacterState,
	type AssetFrameworkPosePreset,
	type AssetFrameworkPosePresetWithId,
	type PartialAppearancePose,
} from 'pandora-common';
import React, { useCallback, useMemo, type ReactElement, type ReactNode } from 'react';
import { toast } from 'react-toastify';
import { useAssetManager } from '../../../assets/assetManager.tsx';
import deleteIcon from '../../../assets/icons/delete.svg';
import diskIcon from '../../../assets/icons/disk.svg';
import editIcon from '../../../assets/icons/edit.svg';
import exportIcon from '../../../assets/icons/export.svg';
import importIcon from '../../../assets/icons/import.svg';
import triangleDown from '../../../assets/icons/triangle_down.svg';
import triangleUp from '../../../assets/icons/triangle_up.svg';
import { TextInput } from '../../../common/userInteraction/input/textInput.tsx';
import { useObservable } from '../../../observable.ts';
import { TOAST_OPTIONS_ERROR } from '../../../persistentToast.ts';
import { useServiceManager, useServiceOptional } from '../../../services/serviceProvider.tsx';
import { Button, IconButton } from '../../common/button/button.tsx';
import { Column, Row } from '../../common/container/container.tsx';
import { FieldsetToggle } from '../../common/fieldsetToggle/fieldsetToggle.tsx';
import { UsageMeter } from '../../common/usageMeter/usageMeter.tsx';
import { DraggableDialog } from '../../dialog/dialog.tsx';
import { ExportDialog, type ExportDialogTarget } from '../../exportImport/exportDialog.tsx';
import { ImportDialog } from '../../exportImport/importDialog.tsx';
import { FixupStoredPosePreset, StoredPosePresets } from './customPosePresetStorage.ts';
import { PoseButton } from './poseButton.tsx';
import { PosePresetEditTable } from './posePresetEdit.tsx';
import { GeneratePosePreview } from './posePreview.tsx';
import './storedPosePresets.scss';

type WardrobeStoredPosePresetsProps = {
	setPose: (pose: PartialAppearancePose) => void;
	characterState: AssetFrameworkCharacterState;
};

export function WardrobeStoredPosePresets(props: WardrobeStoredPosePresetsProps): ReactNode {
	return (
		<FieldsetToggle legend='Custom poses' persistent='bone-ui-pose-stored'>
			<PosePresetContextProvider { ...props }>
				<WardrobeStoredPosePresetsContent />
			</PosePresetContextProvider>
		</FieldsetToggle>
	);
}

function WardrobeStoredPosePresetsContent(): ReactNode {
	const [showEditSaved, setShowEditSaved] = React.useState(false);
	const openEditSaved = React.useCallback(() => setShowEditSaved(true), []);
	const closeEditSaved = React.useCallback(() => setShowEditSaved(false), []);

	const { presets } = usePosePresetContext();
	const empty = presets == null || presets.length === 0;

	return (
		<>
			<Row alignY={ empty ? 'center' : 'start' } padding={ empty ? 'small' : undefined } gap='small'>
				{
					presets == null ? (
						<span className='flex-1'>
							Loading...
						</span>
					) :
					empty ? (
						<>
							<span className='flex-1'>
								No custom poses stored. You can create one with the button on the right.
							</span>
							<IconButton
								src={ editIcon }
								alt='Edit'
								onClick={ openEditSaved }
							/>
						</>
					) : (
						<div className='pose-row flex-1'>
							{ presets.map((preset) => <PosePresetButton key={ preset.id } preset={ preset } />) }
							<IconButton
								className='editButton'
								src={ editIcon }
								alt='Edit'
								onClick={ openEditSaved }
							/>
						</div>
					)
				}
			</Row>
			{ (showEditSaved && presets != null) && <PosePresetEditDialog close={ closeEditSaved } /> }
			<PosePresetEditing />
		</>
	);
}

type PosePresetContextType = WardrobeStoredPosePresetsProps & {
	presets: AssetFrameworkPosePresetWithId[] | undefined;
	edit: AssetFrameworkPosePresetWithId | null;
	setEdit: (preset: AssetFrameworkPosePresetWithId | null) => void;
	reorder: (id: string, shift: number) => void;
	remove: (id: string) => void;
	update: (preset: AssetFrameworkPosePresetWithId) => void;
};

const PosePresetContext = React.createContext<PosePresetContextType | null>(null);

function usePosePresetContext(): PosePresetContextType {
	const context = React.useContext(PosePresetContext);
	AssertNotNullable(context);
	return context;
}

export function useSavedPosePresetsProvider(): {
	stored: AssetFrameworkPosePresetWithId[] | undefined;
	save: (newStorage: AssetFrameworkPosePresetWithId[], onSuccess?: () => void) => void;
} {
	const stored = useObservable(StoredPosePresets);
	const save = useSaveStoredOutfits();

	return {
		stored,
		save,
	};
}

function PosePresetContextProvider({ setPose, characterState, children }: WardrobeStoredPosePresetsProps & { children: React.ReactNode; }): ReactNode {
	const { stored, save } = useSavedPosePresetsProvider();

	const reorder = React.useCallback((id: string, shift: number) => {
		if (stored == null) {
			return;
		}

		const index = stored.findIndex((preset) => preset.id === id);
		if (index === -1) {
			toast('Failed to reorder pose preset: preset not found', TOAST_OPTIONS_ERROR);
			return;
		}

		const newStorage = [...stored];

		const moved = newStorage.splice(index, 1)[0];
		const newIndex = clamp(index + shift, 0, newStorage.length);
		newStorage.splice(newIndex, 0, moved);

		save(newStorage);
	}, [stored, save]);

	const remove = React.useCallback((id: string) => {
		if (stored == null) {
			return;
		}

		const index = stored.findIndex((preset) => preset.id === id);
		if (index === -1) {
			toast('Failed to remove pose preset: preset not found', TOAST_OPTIONS_ERROR);
			return;
		}

		const newStorage = [...stored];
		newStorage.splice(index, 1);

		save(newStorage);
	}, [stored, save]);

	const update = React.useCallback((preset: AssetFrameworkPosePresetWithId) => {
		if (stored == null) {
			return;
		}

		const index = stored.findIndex((p) => p.id === preset.id);
		if (index === -1) {
			save([...stored, preset]);
		} else {
			const newStorage = [...stored];
			newStorage[index] = preset;
			save(newStorage);
		}
	}, [stored, save]);

	const [edit, setEditRaw] = React.useState<AssetFrameworkPosePresetWithId | null>(null);

	const setEdit = useCallback((preset: AssetFrameworkPosePresetWithId | null) => {
		if (preset == null) {
			setEditRaw(preset);
		} else {
			setEditRaw(produce(preset, (d) => {
				if (d.pose.bones !== undefined && Object.keys(d.pose.bones).length === 0) {
					delete d.pose.bones;
				}
				if (d.pose.arms !== undefined && Object.keys(d.pose.arms).length === 0) {
					delete d.pose.arms;
				}
				if (d.pose.leftArm !== undefined && Object.keys(d.pose.leftArm).length === 0) {
					delete d.pose.leftArm;
				}
				if (d.pose.rightArm !== undefined && Object.keys(d.pose.rightArm).length === 0) {
					delete d.pose.rightArm;
				}
				if (d.pose.armsOrder !== undefined && Object.keys(d.pose.armsOrder).length === 0) {
					delete d.pose.armsOrder;
				}
				if (d.pose.legs !== undefined && Object.keys(d.pose.legs).length === 0) {
					delete d.pose.legs;
				}
			}));
		}
	}, []);

	const context = React.useMemo((): PosePresetContextType => ({
		presets: stored,
		reorder,
		remove,
		update,
		edit,
		setEdit,
		setPose,
		characterState,
	}), [stored, reorder, remove, update, edit, setEdit, setPose, characterState]);

	return (
		<PosePresetContext.Provider value={ context }>
			{ children }
		</PosePresetContext.Provider>
	);
}

function PosePresetImportButton(): ReactNode {
	const { update } = usePosePresetContext();
	const [show, setShow] = React.useState(false);
	const open = React.useCallback(() => setShow(true), []);
	const close = React.useCallback(() => setShow(false), []);
	const onImport = React.useCallback((data: AssetFrameworkPosePreset) => {
		update({
			...data,
			id: nanoid(),
		});
		close();
	}, [update, close]);

	return (
		<>
			<Button onClick={ open } slim>
				<img src={ importIcon } alt='Import' />
				<span>&nbsp;Import</span>
			</Button>
			{
				show && (
					<ImportDialog
						expectedType='PosePreset'
						expectedVersion={ 1 }
						dataSchema={ AssetFrameworkPosePresetSchema }
						onImport={ onImport }
						closeDialog={ close }
					/>
				)
			}
		</>
	);
}

function PosePresetButton({ preset }: { preset: AssetFrameworkPosePresetWithId; }): ReactNode {
	const { setPose, characterState } = usePosePresetContext();
	const assetManager = characterState.assetManager;

	const loadedPreset = useMemo(() => FixupStoredPosePreset(preset, assetManager), [assetManager, preset]);

	return (
		<PoseButton
			preset={ loadedPreset }
			preview={ loadedPreset.preview }
			characterState={ characterState }
			setPose={ setPose }
		/>
	);
}

function PosePresetEditing(): ReactNode {
	const { edit, setEdit } = usePosePresetContext();

	const close = React.useCallback(() => setEdit(null), [setEdit]);

	if (edit == null) {
		return null;
	}

	return (
		<PosePresetEditingDialog preset={ edit } close={ close } />
	);
}

function PosePresetCreateButton(): ReactNode {
	const { characterState, edit, setEdit } = usePosePresetContext();
	const onClick = React.useCallback(() => {
		if (edit != null) {
			return;
		}

		const bones: Record<string, number> = {};
		for (const bone of characterState.assetManager.getAllBones()) {
			if (bone.type === 'pose') {
				bones[bone.name] = characterState.getActualPoseBoneValue(bone.name);
			}
		}
		setEdit({
			id: nanoid(),
			name: 'New pose',
			pose: {
				...characterState.actualPose,
				bones,
			},
		});
	}, [characterState, edit, setEdit]);

	return (
		<Button onClick={ onClick } disabled={ edit != null } slim>
			<img src={ diskIcon } alt='Save current' />
			<span>&nbsp;Save current</span>
		</Button>
	);
}

function PosePresetEditingDialog({ preset, close }: { preset: AssetFrameworkPosePresetWithId; close: () => void; }): ReactNode {
	const { characterState, update, presets, setEdit } = usePosePresetContext();
	const onNameChange = React.useCallback((newValue: string) => {
		setEdit({ ...preset, name: newValue });
	}, [preset, setEdit]);

	const onSave = React.useCallback(() => {
		update(preset);
		close();
	}, [update, preset, close]);

	const title = React.useMemo(() => {
		if (presets?.some((p) => p.id === preset.id)) {
			return 'Edit saved pose';
		}
		return 'Save current pose';
	}, [presets, preset]);

	const [exported, setExported] = React.useState<AssetFrameworkPosePreset | null>(null);
	const onExport = React.useCallback(() => {
		setExported(omit(cloneDeep(preset), 'id'));
	}, [preset]);
	const closeExport = React.useCallback(() => {
		setExported(null);
	}, []);

	return (
		<DraggableDialog title={ title } close={ close }>
			<Column>
				<Row gap='small' alignY='center'>
					<label htmlFor='pose-preset-name'>Name:</label>
					<TextInput id='pose-preset-name' className='flex-1' value={ preset.name } onChange={ onNameChange } maxLength={ LIMIT_POSE_PRESET_NAME_LENGTH } />
				</Row>
				<br />
				<PosePresetEditTable
					preset={ preset.pose }
					update={ (newPose) => {
						setEdit({
							...preset,
							pose: newPose,
						});
					} }
					assetManager={ characterState.assetManager }
					sourcePose={ characterState.actualPose }
				/>
				<Row alignX='space-between'>
					<Button onClick={ close }>Cancel</Button>
					<Button onClick={ onExport }>Export</Button>
					<Button onClick={ onSave } disabled={ Object.keys(preset.pose).length === 0 }>Save</Button>
				</Row>
			</Column>
			{ exported == null ? null : (
				<PosePresetExportDialog exported={ exported } close={ closeExport } />
			) }
		</DraggableDialog>
	);
}

export function PosePresetExportDialog({ exported, close }: {
	exported: AssetFrameworkPosePreset;
	close: () => void;
}): ReactNode {
	const assetManager = useAssetManager();
	const serviceManager = useServiceManager();

	const loadedPreset = useMemo(() => FixupStoredPosePreset(exported, assetManager), [assetManager, exported]);

	const exportExtra = useMemo(async () => {
		if (!loadedPreset.preview)
			return [];

		const previewCanvas = await GeneratePosePreview(assetManager, loadedPreset.preview, loadedPreset, serviceManager, 256);

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
	}, [assetManager, loadedPreset, serviceManager]);

	return (
		<ExportDialog
			title={ 'pose preset' + (exported.name ? ` "${exported.name}"` : '') }
			exportType='PosePreset'
			exportVersion={ 1 }
			dataSchema={ AssetFrameworkPosePresetSchema }
			extraData={ exportExtra }
			data={ exported }
			closeDialog={ close }
		/>
	);
}

export function PosePresetButtons(): ReactElement {
	return (
		<Row alignX='end'>
			<PosePresetCreateButton />
			<PosePresetImportButton />
		</Row>
	);
}

function PosePresetEditDialog({ close }: { close: () => void; }): ReactNode {
	const { presets } = usePosePresetContext();
	return (
		<DraggableDialog title='Edit saved poses' close={ close }>
			<Row padding='large' alignX='space-between'>
				<UsageMeter
					title='Saved pose slots used'
					used={ presets ? presets?.length : 0 }
					limit={ LIMIT_ACCOUNT_POSE_PRESET_STORAGE }
				/>
				<PosePresetButtons />
			</Row>
			<table className='pose-presets-table'>
				<thead>
					<tr>
						<th>Name</th>
						<th>Actions</th>
					</tr>
				</thead>
				<tbody>
					{ presets?.map((preset) => <PosePresetEditRow key={ preset.id } preset={ preset } />) }
				</tbody>
			</table>
		</DraggableDialog>
	);
}

function PosePresetEditRow({ preset }: { preset: AssetFrameworkPosePresetWithId; }): ReactNode {
	const { reorder, remove, edit, setEdit } = usePosePresetContext();

	const onMoveUp = React.useCallback(() => reorder(preset.id, -1), [reorder, preset.id]);
	const onMoveDown = React.useCallback(() => reorder(preset.id, 1), [reorder, preset.id]);
	const onRemove = React.useCallback(() => remove(preset.id), [remove, preset.id]);
	const onEdit = React.useCallback(() => setEdit(cloneDeep(preset)), [setEdit, preset]);
	const [exported, setExported] = React.useState<AssetFrameworkPosePreset | null>(null);

	const onExport = React.useCallback(() => {
		setExported(omit(cloneDeep(preset), 'id'));
	}, [preset]);

	const closeExport = React.useCallback(() => {
		setExported(null);
	}, []);

	return (
		<tr key={ preset.id }>
			<td>{ preset.name }</td>
			<td>
				<Row>
					<Button onClick={ onMoveUp } slim>
						<img src={ triangleUp } alt='Move up' />
						<span>&nbsp;Move up</span>
					</Button>
					<Button onClick={ onMoveDown } slim>
						<img src={ triangleDown } alt='Move down' />
						<span>&nbsp;Move down</span>
					</Button>
					<Button theme={ edit?.id === preset.id ? 'defaultActive' : 'default' } onClick={ onEdit } disabled={ edit != null } slim>
						<img src={ editIcon } alt='Edit action' />
						<span>&nbsp;Edit</span>
					</Button>
					<Button onClick={ onRemove } slim>
						<img src={ deleteIcon } alt='Delete action' />
						<span>&nbsp;Delete</span>
					</Button>
					<Button onClick={ onExport } slim>
						<img src={ exportIcon } alt='Export action' />
						<span>&nbsp;Export</span>
					</Button>
				</Row>
			</td>
			{ exported == null ? null : (
				<PosePresetExportDialog exported={ exported } close={ closeExport } />
			) }
		</tr>
	);
}

/**
 * Provides a way to update pose preset storage
 * @returns A callback usable to overwrite pose preset storage, saving data to the server
 */
function useSaveStoredOutfits(): (newStorage: AssetFrameworkPosePresetWithId[], onSuccess?: () => void) => void {
	const directoryConnector = useServiceOptional('directoryConnector');

	return React.useCallback((newStorage: AssetFrameworkPosePresetWithId[], onSuccess?: () => void) => {
		if (directoryConnector == null) {
			toast(`Error saving changes:\nNot connected`, TOAST_OPTIONS_ERROR);
			return;
		}

		directoryConnector.awaitResponse('storedPosePresetsSave', {
			storedPosePresets: newStorage,
		})
			.then((result) => {
				if (result.result === 'ok') {
					onSuccess?.();
				} else {
					toast(`Failed to save outfit changes: \n${result.reason}`, TOAST_OPTIONS_ERROR);
				}
			})
			.catch((err) => {
				GetLogger('useSaveStoredOutfits').error('Error saving saved poses:', err);
				toast(`Failed to save changes: \n${String(err)}`, TOAST_OPTIONS_ERROR);
			});
	}, [directoryConnector]);
}
