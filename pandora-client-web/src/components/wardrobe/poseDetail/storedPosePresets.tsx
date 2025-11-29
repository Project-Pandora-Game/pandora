import { produce } from 'immer';
import { capitalize, clamp, cloneDeep, omit, upperFirst } from 'lodash-es';
import { nanoid } from 'nanoid';
import {
	AssertNotNullable,
	AssetFrameworkPosePresetSchema,
	GetLogger,
	LIMIT_ACCOUNT_POSE_PRESET_STORAGE,
	LIMIT_POSE_PRESET_NAME_LENGTH,
	type AppearanceArmPose,
	type AppearanceArmsOrder,
	type AssetFrameworkCharacterState,
	type AssetFrameworkPosePreset,
	type AssetFrameworkPosePresetWithId,
	type BoneDefinition,
	type PartialAppearancePose,
} from 'pandora-common';
import React, { useCallback, useMemo, type ReactElement, type ReactNode } from 'react';
import { toast } from 'react-toastify';
import { useAssetManager } from '../../../assets/assetManager.tsx';
import { Checkbox } from '../../../common/userInteraction/checkbox.tsx';
import { TextInput } from '../../../common/userInteraction/input/textInput.tsx';
import { useObservable } from '../../../observable.ts';
import { TOAST_OPTIONS_ERROR } from '../../../persistentToast.ts';
import { useServiceManager, useServiceOptional } from '../../../services/serviceProvider.tsx';
import { Button, IconButton } from '../../common/button/button.tsx';
import { Column, Row } from '../../common/container/container.tsx';
import { FieldsetToggle } from '../../common/fieldsetToggle/fieldsetToggle.tsx';
import { DraggableDialog } from '../../dialog/dialog.tsx';
import { ExportDialog, type ExportDialogTarget } from '../../exportImport/exportDialog.tsx';
import { ImportDialog } from '../../exportImport/importDialog.tsx';
import { GeneratePosePreview, PoseButton } from '../views/wardrobePoseView.tsx';
import { GetVisibleBoneName } from '../wardrobeUtils.ts';
import { FixupStoredPosePreset, StoredPosePresets } from './customPosePresetStorage.ts';

import deleteIcon from '../../../assets/icons/delete.svg';
import diskIcon from '../../../assets/icons/disk.svg';
import editIcon from '../../../assets/icons/edit.svg';
import exportIcon from '../../../assets/icons/export.svg';
import importIcon from '../../../assets/icons/import.svg';
import triangleDown from '../../../assets/icons/triangle_down.svg';
import triangleUp from '../../../assets/icons/triangle_up.svg';

import { StorageUsageMeter } from '../wardrobeComponents.tsx';
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

function PosePresetContextProvider({ setPose, characterState, children }: WardrobeStoredPosePresetsProps & { children: React.ReactNode; }): ReactNode {
	const stored = useObservable(StoredPosePresets);
	const save = useSaveStoredOutfits();

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
	const assetManager = characterState.assetManager;
	const allBones = React.useMemo(() => assetManager.getAllBones(), [assetManager]);
	const onNameChange = React.useCallback((newValue: string) => {
		setEdit({ ...preset, name: newValue });
	}, [preset, setEdit]);

	const onSave = React.useCallback(() => {
		update(preset);
		close();
	}, [update, preset, close]);

	const onCheckAll = React.useCallback(() => {
		const bones: Record<string, number> = {};
		for (const bone of allBones) {
			if (bone.type === 'pose') {
				bones[bone.name] = preset.pose.bones?.[bone.name] ?? characterState.getActualPoseBoneValue(bone.name);
			}
		}
		setEdit({
			...preset,
			pose: {
				...characterState.actualPose,
				bones,
			},
		});
	}, [preset, setEdit, allBones, characterState]);

	const onUncheckAll = React.useCallback(() => {
		setEdit({ ...preset, pose: {} });
	}, [preset, setEdit]);

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
				<table className='smallPadding'>
					<thead>
						<tr>
							<th>Include</th>
							<th>Name</th>
							<th>Value</th>
						</tr>
					</thead>
					<tbody>
						<tr>
							<td>
								<Button onClick={ Object.keys(preset.pose).length === 0 ? onCheckAll : onUncheckAll } slim>Toggle all</Button>
							</td>
							<td></td>
							<td></td>
						</tr>
						<PosePresetView preset={ preset } />
						<tr>
							<td className='noPadding' colSpan={ 3 }><hr /></td>
						</tr>
						<PosePresetArmPoses preset={ preset } />
						<PosePresetArmsOrder preset={ preset } />
						<tr>
							<td className='noPadding' colSpan={ 3 }><hr /></td>
						</tr>
						<PosePresetLegPoses preset={ preset } />
						<tr>
							<td className='noPadding' colSpan={ 3 }><hr /></td>
						</tr>
						{
							allBones
								.filter((bone) => bone.type === 'pose')
								.map((bone) => (
									<PosePresetBoneRow
										key={ bone.name }
										preset={ preset }
										bone={ bone }
										storedValue={ preset.pose.bones?.[bone.name] }
										currentValue={ characterState.getActualPoseBoneValue(bone.name) }
									/>
								))
						}
					</tbody>
				</table>
				<Row alignX='space-between'>
					<Button onClick={ close }>Cancel</Button>
					<Button onClick={ onExport }>Export</Button>
					<Button onClick={ onSave } disabled={ Object.keys(preset.pose).length === 0 }>Save</Button>
				</Row>
			</Column>
			{ exported == null ? null : (
				<PosePresetExport exported={ exported } close={ closeExport } />
			) }
		</DraggableDialog>
	);
}

function PosePresetExport({ exported, close }: {
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

function PosePresetView({ preset }: { preset: AssetFrameworkPosePresetWithId; }): ReactNode {
	const { characterState, setEdit } = usePosePresetContext();

	return (
		<tr>
			<td>
				<Checkbox
					checked={ preset.pose.view != null }
					onChange={ (checked) => {
						if (checked) {
							setEdit({ ...preset, pose: { ...preset.pose, view: characterState.actualPose.view } });
						} else {
							const newPose = { ...preset.pose };
							delete newPose.view;
							setEdit({ ...preset, pose: newPose });
						}
					} } />
			</td>
			<td>
				View
			</td>
			<td>
				{ upperFirst(preset.pose.view ?? characterState.actualPose.view) }
			</td>
		</tr>
	);
}

function PosePresetArmPoses({ preset }: { preset: AssetFrameworkPosePresetWithId; }): ReactNode {
	const { characterState, setEdit } = usePosePresetContext();

	const Arm = React.useCallback(<TArmKey extends keyof AppearanceArmPose>({ side, part }: { side: 'left' | 'right'; part: TArmKey; }): ReactNode => (
		<tr>
			<td>
				<Checkbox
					checked={ preset.pose[`${side}Arm`]?.[part] != null || preset.pose.arms?.[part] != null }
					onChange={ (checked) => {
						if (checked) {
							setEdit({ ...preset, pose: { ...preset.pose, [`${side}Arm`]: { ...preset.pose[`${side}Arm`], [part]: characterState.actualPose[`${side}Arm`][part] } } });
						} else {
							const newArm: Partial<AppearanceArmPose> = { ...preset.pose[`${side}Arm`] };
							delete newArm[part];
							const pose = { ...preset.pose, [`${side}Arm`]: newArm };
							delete pose.arms;
							setEdit({ ...preset, pose });
						}
					} } />
			</td>
			<td>
				{ capitalize(side) } arm { part }
			</td>
			<td>
				{ preset.pose[`${side}Arm`]?.[part] ?? preset.pose.arms?.[part] ?? characterState.actualPose[`${side}Arm`][part] ?? 'WUT' }
			</td>
		</tr>
	), [preset, setEdit, characterState]);

	return (
		<>
			<Arm side='right' part='position' />
			<Arm side='right' part='rotation' />
			<Arm side='right' part='fingers' />
			<Arm side='left' part='position' />
			<Arm side='left' part='rotation' />
			<Arm side='left' part='fingers' />
		</>
	);
}

function PosePresetArmsOrder({ preset }: { preset: AssetFrameworkPosePresetWithId; }): ReactNode {
	const { characterState, setEdit } = usePosePresetContext();

	const Arm = React.useCallback(({ part }: { part: keyof AppearanceArmsOrder; }): ReactNode => (
		<tr>
			<td>
				<Checkbox
					checked={ preset.pose.armsOrder?.[part] != null }
					onChange={ (checked) => {
						if (checked) {
							setEdit({ ...preset, pose: { ...preset.pose, armsOrder: { ...preset.pose.armsOrder, [part]: characterState.actualPose.armsOrder[part] } } });
						} else {
							const newOrder = { ...preset.pose.armsOrder };
							delete newOrder[part];
							setEdit({ ...preset, pose: { ...preset.pose, armsOrder: newOrder } });
						}
					} } />
			</td>
			<td>
				{ capitalize(part) } arm order
			</td>
			<td>
				{ preset.pose.armsOrder?.[part] ?? characterState.actualPose.armsOrder[part] }
			</td>
		</tr>
	), [preset, setEdit, characterState]);

	return (
		<Arm part='upper' />
	);
}

function PosePresetLegPoses({ preset }: { preset: AssetFrameworkPosePresetWithId; }): ReactNode {
	const { characterState, setEdit } = usePosePresetContext();

	return (
		<>
			<tr>
				<td>
					<Checkbox
						checked={ preset.pose.legs?.pose != null }
						onChange={ (checked) => {
							setEdit(produce(preset, (d) => {
								d.pose.legs ??= {};
								if (checked) {
									d.pose.legs.pose = characterState.actualPose.legs.pose;
								} else {
									delete d.pose.legs.pose;
								}
							}));
						} }
					/>
				</td>
				<td>Legs state</td>
				<td>{ preset.pose.legs?.pose ?? characterState.actualPose.legs.pose }</td>
			</tr>
			<tr>
				<td>
					<Checkbox
						checked={ preset.pose.legs?.upper != null }
						onChange={ (checked) => {
							setEdit(produce(preset, (d) => {
								d.pose.legs ??= {};
								if (checked) {
									d.pose.legs.upper = characterState.actualPose.legs.upper;
								} else {
									delete d.pose.legs.upper;
								}
							}));
						} }
					/>
				</td>
				<td>Upper leg order</td>
				<td>{ preset.pose.legs?.upper ?? characterState.actualPose.legs.upper }</td>
			</tr>
		</>
	);

}

function PosePresetBoneRow({ preset, bone, storedValue, currentValue }: { preset: AssetFrameworkPosePresetWithId; bone: BoneDefinition; storedValue?: number; currentValue: number; }): ReactNode {
	const { setEdit } = usePosePresetContext();
	const onChange = React.useCallback((checked: boolean) => {
		if (checked) {
			setEdit({ ...preset, pose: { ...preset.pose, bones: { ...preset.pose.bones, [bone.name]: currentValue } } });
		} else {
			const newBones = { ...preset.pose.bones };
			delete newBones[bone.name];
			setEdit({ ...preset, pose: { ...preset.pose, bones: newBones } });
		}
	}, [setEdit, preset, bone, currentValue]);

	return (
		<tr>
			<td>
				<Checkbox checked={ storedValue != null } onChange={ onChange } />
			</td>
			<td>
				{ GetVisibleBoneName(bone.name) }
			</td>
			<td>
				{ storedValue ?? currentValue }
			</td>
		</tr>
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
				<StorageUsageMeter
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
				<PosePresetExport exported={ exported } close={ closeExport } />
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
