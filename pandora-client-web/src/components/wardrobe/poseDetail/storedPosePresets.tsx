import { capitalize, clamp, cloneDeep, noop, omit } from 'lodash';
import { nanoid } from 'nanoid';
import {
	AssertNotNullable,
	AssetFrameworkPosePresetSchema,
	GetLogger,
	LIMIT_POSE_PRESET_NAME_LENGTH,
	type AppearanceArmPose,
	type AppearanceArmsOrder,
	type AssetFrameworkCharacterState,
	type AssetFrameworkPosePreset,
	type AssetFrameworkPosePresetWithId,
	type BoneDefinition,
	type PartialAppearancePose,
} from 'pandora-common';
import React, { type ReactNode } from 'react';
import { toast } from 'react-toastify';
import { Checkbox } from '../../../common/userInteraction/checkbox';
import { TextInput } from '../../../common/userInteraction/input/textInput';
import { TOAST_OPTIONS_ERROR } from '../../../persistentToast';
import { Button } from '../../common/button/button';
import { Column, DivContainer, Row } from '../../common/container/container';
import { FieldsetToggle } from '../../common/fieldsetToggle/fieldsetToggle';
import { DraggableDialog } from '../../dialog/dialog';
import { ExportDialog } from '../../exportImport/exportDialog';
import { ImportDialog } from '../../exportImport/importDialog';
import { useDirectoryChangeListener, useDirectoryConnector } from '../../gameContext/directoryConnectorContextProvider';
import { GetVisibleBoneName } from '../views/wardrobePoseView';

import deleteIcon from '../../../assets/icons/delete.svg';
import editIcon from '../../../assets/icons/edit.svg';
import exportIcon from '../../../assets/icons/export.svg';
import triangleDown from '../../../assets/icons/triangle_down.svg';
import triangleUp from '../../../assets/icons/triangle_up.svg';

import './storedPosePresets.scss';

type WardrobeStoredPosePresetsProps = {
	setPose: (pose: PartialAppearancePose) => void;
	characterState: AssetFrameworkCharacterState;
};

export function WardrobeStoredPosePresets(props: WardrobeStoredPosePresetsProps): ReactNode {
	const [showEditSaved, setShowEditSaved] = React.useState(false);
	const openEditSaved = React.useCallback(() => setShowEditSaved(true), []);
	const closeEditSaved = React.useCallback(() => setShowEditSaved(false), []);

	return (
		<FieldsetToggle legend='Stored poses' persistent='bone-ui-pose-stored'>
			<PosePresetContextProvider { ...props }>
				<Column>
					<Row className='pose-row' gap='tiny' wrap>
						<PosePresetCreateButton />
						<Button slim className='flex-1' onClick={ openEditSaved }>Edit saved</Button>
						<PosePresetImportButton />
					</Row>
					<PosePresetButtons />
				</Column>
				{ showEditSaved && <PosePresetEditDialog close={ closeEditSaved } /> }
				<PosePresetEditing />
			</PosePresetContextProvider>
		</FieldsetToggle>
	);
}

type PosePresetContextType = WardrobeStoredPosePresetsProps & {
	presets: AssetFrameworkPosePresetWithId[];
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
	const stored = useStoredPosePresets();
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

	const [edit, setEdit] = React.useState<AssetFrameworkPosePresetWithId | null>(null);

	const context = React.useMemo(() => ({
		presets: stored ?? [],
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
			<Button slim className='flex-1' onClick={ open }>Import</Button>
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

function PosePresetButtons(): ReactNode {
	const { presets } = usePosePresetContext();

	return (
		<Row className='pose-row' gap='tiny' wrap>
			{ presets.map((preset) => <PosePresetButton key={ preset.id } preset={ preset } />) }
		</Row>
	);
}

function PosePresetButton({ preset }: { preset: AssetFrameworkPosePresetWithId; }): ReactNode {
	const { setPose, characterState } = usePosePresetContext();

	const onClick = React.useCallback(() => {
		const pose = { ...preset.pose };
		if (pose.bones != null) {
			const bones: Record<string, number> = {};
			const allBones = characterState.assetManager.getAllBones();
			for (const [bone, value] of Object.entries(pose.bones)) {
				if (value == null)
					continue;

				const def = allBones.find((b) => b.name === bone);
				if (def == null || def.type !== 'pose')
					continue;

				bones[bone] = value;
			}
			pose.bones = bones;
		}
		setPose(preset.pose);
	}, [preset, setPose, characterState.assetManager]);

	return (
		<DivContainer padding='tiny' className='pose'>
			<Button slim className='flex-1' onClick={ onClick }>
				{ preset.name }
			</Button>
		</DivContainer>
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
	const { edit, setEdit } = usePosePresetContext();
	const onClick = React.useCallback(() => {
		if (edit != null) {
			return;
		}
		setEdit({
			id: nanoid(),
			name: 'New pose',
			pose: {},
		});
	}, [edit, setEdit]);

	return (
		<Button slim className='flex-1' onClick={ onClick } disabled={ edit != null } >
			Save current
		</Button>
	);
}

function PosePresetEditingDialog({ preset, close }: { preset: AssetFrameworkPosePresetWithId; close: () => void; }): ReactNode {
	const { characterState, update, presets } = usePosePresetContext();
	const assetManager = characterState.assetManager;
	const allBones = React.useMemo(() => assetManager.getAllBones(), [assetManager]);
	const { setEdit } = usePosePresetContext();
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
			...preset, pose: {
				bones,
				leftArm: {
					...characterState.actualPose.leftArm,
					...preset.pose.arms,
					...preset.pose.leftArm,
				},
				rightArm: {
					...characterState.actualPose.rightArm,
					...preset.pose.arms,
					...preset.pose.rightArm,
				},
				legs: preset.pose.legs ?? characterState.actualPose.legs,
			},
		});
	}, [preset, setEdit, allBones, characterState]);

	const onUncheckAll = React.useCallback(() => {
		setEdit({ ...preset, pose: {} });
	}, [preset, setEdit]);

	const title = React.useMemo(() => {
		if (presets.some((p) => p.id === preset.id)) {
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
			<Column gap='small'>
				<label htmlFor='pose-preset-name'>Name:</label>
				<TextInput id='pose-preset-name' value={ preset.name } onChange={ onNameChange } maxLength={ LIMIT_POSE_PRESET_NAME_LENGTH } />
			</Column>
			<br />
			<table>
				<thead>
					<tr>
						<th>Include</th>
						<th>Name</th>
						<th>Value</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<td colSpan={ 3 }><hr /></td>
					</tr>
					<PosePresetArmPoses preset={ preset } />
					<tr>
						<td colSpan={ 3 }><hr /></td>
					</tr>
					<PosePresetArmsOrder preset={ preset } />
					<tr>
						<td colSpan={ 3 }><hr /></td>
					</tr>
					<PosePresetLegPoses preset={ preset } />
					<tr>
						<td colSpan={ 3 }><hr /></td>
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
					<tr>
						<td colSpan={ 3 }><hr /></td>
					</tr>
				</tbody>
			</table>
			<br />
			<Row alignX='center'>
				<Button onClick={ onUncheckAll }>Uncheck all</Button>
				<Button onClick={ onCheckAll }>Check all</Button>
			</Row>
			<br />
			<Row alignX='center'>
				<Button onClick={ close }>Cancel</Button>
				<Button onClick={ onExport }>Export</Button>
				<Button onClick={ onSave }>Save</Button>
			</Row>
			{
				exported == null ? null : (
					<ExportDialog
						exportType='PosePreset'
						exportVersion={ 1 }
						dataSchema={ AssetFrameworkPosePresetSchema }
						data={ exported }
						closeDialog={ closeExport }
					/>
				)
			}
		</DraggableDialog>
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
			<Arm side='left' part='position' />
			<Arm side='right' part='position' />
			<Arm side='left' part='rotation' />
			<Arm side='right' part='rotation' />
			<Arm side='left' part='fingers' />
			<Arm side='right' part='fingers' />
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
	const onChange = React.useCallback((checked: boolean) => {
		if (checked) {
			setEdit({ ...preset, pose: { ...preset.pose, legs: characterState.actualPose.legs } });
		} else {
			const pose = { ...preset.pose };
			delete pose.legs;
			setEdit({ ...preset, pose });
		}
	}, [preset, setEdit, characterState]);

	return (
		<tr>
			<td>
				<Checkbox checked={ preset.pose.legs != null } onChange={ onChange } />
			</td>
			<td>Legs</td>
			<td>{ preset.pose.legs ?? characterState.actualPose.legs }</td>
		</tr>
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

function PosePresetEditDialog({ close }: { close: () => void; }): ReactNode {
	const { presets } = usePosePresetContext();
	return (
		<DraggableDialog title='Edit saved poses' close={ close }>
			<table className='pose-presets-table'>
				<thead>
					<tr>
						<th>Name</th>
						<th>Actions</th>
					</tr>
				</thead>
				<tbody>
					{ presets.map((preset) => <PosePresetEditRow key={ preset.id } preset={ preset } />) }
				</tbody>
			</table>
		</DraggableDialog>
	);
}

function PosePresetEditRow({ preset }: { preset: AssetFrameworkPosePresetWithId; }): ReactNode {
	const { reorder, remove, setEdit } = usePosePresetContext();

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
					<Button onClick={ onEdit } slim>
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
			{
				exported == null ? null : (
					<ExportDialog
						exportType='PosePreset'
						exportVersion={ 1 }
						dataSchema={ AssetFrameworkPosePresetSchema }
						data={ exported }
						closeDialog={ closeExport }
					/>
				)
			}
		</tr>
	);
}

/**
 * Provides a way to update pose preset storage
 * @returns A callback usable to overwrite pose preset storage, saving data to the server
 */
function useSaveStoredOutfits(): (newStorage: AssetFrameworkPosePresetWithId[], onSuccess?: () => void) => void {
	const directoryConnector = useDirectoryConnector();

	return React.useCallback((newStorage: AssetFrameworkPosePresetWithId[], onSuccess?: () => void) => {
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

/**
 * Loads the saved pose presets from server
 * @returns The saved pose presets or `undefined` if data is not yet ready
 */
function useStoredPosePresets(): AssetFrameworkPosePresetWithId[] | undefined {
	const [storedPosePresets, setStoredPosePresets] = React.useState<AssetFrameworkPosePresetWithId[] | undefined>();
	const directoryConnector = useDirectoryConnector();

	const fetchStoredPosePresets = React.useCallback(async () => {
		const result = await directoryConnector.awaitResponse('storedPosePresetsGetAll', {});
		setStoredPosePresets(result.storedPosePresets);
	}, [directoryConnector]);

	useDirectoryChangeListener('storedPosePresets', () => {
		fetchStoredPosePresets().catch(noop);
	}, true);

	return storedPosePresets;
}
