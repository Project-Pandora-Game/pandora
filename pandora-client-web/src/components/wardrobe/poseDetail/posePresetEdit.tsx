import { produce, type Immutable } from 'immer';
import { capitalize, upperFirst } from 'lodash-es';
import type { AppearanceArmPose, AppearanceArmsOrder, AppearancePose, AssetFrameworkPosePreset, AssetManager, BoneDefinition, CenteredDegrees, PartialAppearancePose } from 'pandora-common';
import { useCallback, useMemo, type ReactElement, type ReactNode } from 'react';
import { Checkbox } from '../../../common/userInteraction/checkbox.tsx';
import { Button } from '../../common/button/button.tsx';
import { GetVisibleBoneName } from '../wardrobeUtils.ts';

interface PosePresetEditTableProps {
	preset: AssetFrameworkPosePreset;
	update: ((newPreset: Partial<AssetFrameworkPosePreset>) => void) | null;
	assetManager: AssetManager;
	sourcePose: Immutable<AppearancePose>;
	sourceRotation: CenteredDegrees;
	sourceYOffset: number;
}

export function PosePresetEditTable({ preset, update, assetManager, sourcePose, sourceRotation, sourceYOffset }: PosePresetEditTableProps): ReactElement {
	const allBones = useMemo(() => assetManager.getAllBones(), [assetManager]);

	const onCheckAll = useCallback(() => {
		const bones: Record<string, number> = {};
		for (const bone of allBones) {
			if (bone.type === 'pose') {
				bones[bone.name] = preset.pose.bones?.[bone.name] ?? (sourcePose.bones[bone.name] || 0);
			}
		}
		update?.({
			pose: {
				...sourcePose,
				bones,
			},
			rotation: sourceRotation,
			yOffset: sourceYOffset,
		});
	}, [preset, update, allBones, sourcePose, sourceRotation, sourceYOffset]);

	const onUncheckAll = useCallback(() => {
		update?.({
			pose: {},
			rotation: undefined,
			yOffset: undefined,
		});
	}, [update]);

	const updatePose = useMemo((): PosePresetPoseEditRowProps['update'] => {
		if (update == null)
			return null;

		return (pose) => update({ pose });
	}, [update]);

	return (
		<table className='smallPadding'>
			<thead>
				<tr>
					<th>Include</th>
					<th>Name</th>
					<th>Value</th>
				</tr>
			</thead>
			<tbody>
				{ update != null ? (
					<tr>
						<td>
							<Button onClick={ (Object.keys(preset.pose).length === 0 && preset.rotation == null && preset.yOffset == null) ? onCheckAll : onUncheckAll } slim>Toggle all</Button>
						</td>
						<td></td>
						<td></td>
					</tr>
				) : null }
				<PosePresetView
					preset={ preset.pose }
					update={ updatePose }
					sourcePose={ sourcePose }
				/>
				<tr>
					<td className='noPadding' colSpan={ 3 }><hr /></td>
				</tr>
				<PosePresetArmPoses
					preset={ preset.pose }
					update={ updatePose }
					sourcePose={ sourcePose }
				/>
				<PosePresetArmsOrder
					preset={ preset.pose }
					update={ updatePose }
					sourcePose={ sourcePose }
				/>
				<tr>
					<td className='noPadding' colSpan={ 3 }><hr /></td>
				</tr>
				<PosePresetLegPoses
					preset={ preset.pose }
					update={ updatePose }
					sourcePose={ sourcePose }
				/>
				<tr>
					<td className='noPadding' colSpan={ 3 }><hr /></td>
				</tr>
				{
					allBones
						.filter((bone) => bone.type === 'pose')
						.map((bone) => (
							<PosePresetBoneRow
								key={ bone.name }
								preset={ preset.pose }
								update={ updatePose }
								sourcePose={ sourcePose }
								bone={ bone }
							/>
						))
				}
				<tr>
					<td className='noPadding' colSpan={ 3 }><hr /></td>
				</tr>
				<PosePresetExtras
					preset={ preset }
					update={ update }
					assetManager={ assetManager }
					sourcePose={ sourcePose }
					sourceRotation={ sourceRotation }
					sourceYOffset={ sourceYOffset }
				/>
			</tbody>
		</table>
	);
}

interface PosePresetPoseEditRowProps {
	preset: PartialAppearancePose;
	update: ((newPreset: PartialAppearancePose) => void) | null;
	sourcePose: Immutable<AppearancePose>;
}

function PosePresetView({ preset, update, sourcePose }: PosePresetPoseEditRowProps): ReactNode {
	return (
		<tr>
			<td>
				<Checkbox
					checked={ preset.view != null }
					disabled={ update == null }
					onChange={ (checked) => {
						if (checked) {
							update?.({ ...preset, view: sourcePose.view });
						} else {
							const newPose = { ...preset };
							delete newPose.view;
							update?.(newPose);
						}
					} } />
			</td>
			<td>
				View
			</td>
			<td>
				{ upperFirst(preset.view ?? (update != null ? sourcePose.view : '')) }
			</td>
		</tr>
	);
}

function PosePresetArmPoses({ preset, update, sourcePose }: PosePresetPoseEditRowProps): ReactNode {

	const Arm = useCallback(<TArmKey extends keyof AppearanceArmPose>({ side, part }: { side: 'left' | 'right'; part: TArmKey; }): ReactNode => (
		<tr>
			<td>
				<Checkbox
					checked={ preset[`${side}Arm`]?.[part] != null || preset.arms?.[part] != null }
					disabled={ update == null }
					onChange={ (checked) => {
						if (checked) {
							update?.({ ...preset, [`${side}Arm`]: { ...preset[`${side}Arm`], [part]: sourcePose[`${side}Arm`][part] } });
						} else {
							const newArm: Partial<AppearanceArmPose> = { ...preset[`${side}Arm`] };
							delete newArm[part];
							const pose = { ...preset, [`${side}Arm`]: newArm };
							delete pose.arms;
							update?.(pose);
						}
					} } />
			</td>
			<td>
				{ capitalize(side) } arm { part }
			</td>
			<td>
				{ preset[`${side}Arm`]?.[part] ?? preset.arms?.[part] ?? (update != null ? sourcePose[`${side}Arm`][part] : '') ?? 'ERROR' }
			</td>
		</tr>
	), [preset, update, sourcePose]);

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

function PosePresetArmsOrder({ preset, update, sourcePose }: PosePresetPoseEditRowProps): ReactNode {

	const Arm = useCallback(({ part }: { part: keyof AppearanceArmsOrder; }): ReactNode => (
		<tr>
			<td>
				<Checkbox
					checked={ preset.armsOrder?.[part] != null }
					disabled={ update == null }
					onChange={ (checked) => {
						if (checked) {
							update?.({ ...preset, armsOrder: { ...preset.armsOrder, [part]: sourcePose.armsOrder[part] } });
						} else {
							const newOrder = { ...preset.armsOrder };
							delete newOrder[part];
							update?.({ ...preset, armsOrder: newOrder });
						}
					} } />
			</td>
			<td>
				{ capitalize(part) } arm order
			</td>
			<td>
				{ preset.armsOrder?.[part] ?? (update != null ? sourcePose.armsOrder[part] : '') }
			</td>
		</tr>
	), [preset, update, sourcePose]);

	return (
		<Arm part='upper' />
	);
}

function PosePresetLegPoses({ preset, update, sourcePose }: PosePresetPoseEditRowProps): ReactNode {
	return (
		<>
			<tr>
				<td>
					<Checkbox
						checked={ preset.legs?.pose != null }
						disabled={ update == null }
						onChange={ (checked) => {
							update?.(produce(preset, (d) => {
								d.legs ??= {};
								if (checked) {
									d.legs.pose = sourcePose.legs.pose;
								} else {
									delete d.legs.pose;
								}
							}));
						} }
					/>
				</td>
				<td>Legs state</td>
				<td>{ preset.legs?.pose ?? (update != null ? sourcePose.legs.pose : '') }</td>
			</tr>
			<tr>
				<td>
					<Checkbox
						checked={ preset.legs?.upper != null }
						disabled={ update == null }
						onChange={ (checked) => {
							update?.(produce(preset, (d) => {
								d.legs ??= {};
								if (checked) {
									d.legs.upper = sourcePose.legs.upper;
								} else {
									delete d.legs.upper;
								}
							}));
						} }
					/>
				</td>
				<td>Upper leg order</td>
				<td>{ preset.legs?.upper ?? (update != null ? sourcePose.legs.upper : '') }</td>
			</tr>
		</>
	);
}

function PosePresetBoneRow({ preset, update, bone, sourcePose }: PosePresetPoseEditRowProps & { bone: BoneDefinition; }): ReactNode {
	const storedValue = preset.bones?.[bone.name];
	const currentValue = sourcePose.bones[bone.name] || 0;

	const onChange = useCallback((checked: boolean) => {
		if (checked) {
			update?.({ ...preset, bones: { ...preset.bones, [bone.name]: currentValue } });
		} else {
			const newBones = { ...preset.bones };
			delete newBones[bone.name];
			update?.({ ...preset, bones: newBones });
		}
	}, [update, preset, bone, currentValue]);

	return (
		<tr>
			<td>
				<Checkbox checked={ storedValue != null } disabled={ update == null } onChange={ onChange } />
			</td>
			<td>
				{ GetVisibleBoneName(bone.name) }
			</td>
			<td>
				{ storedValue ?? (update != null ? currentValue : '') }
			</td>
		</tr>
	);
}

function PosePresetExtras({ preset, update, sourceRotation, sourceYOffset }: PosePresetEditTableProps): ReactNode {
	return (
		<>
			<tr>
				<td>
					<Checkbox
						checked={ preset.rotation != null }
						disabled={ update == null }
						onChange={ (checked) => {
							update?.({
								rotation: checked ? sourceRotation : undefined,
							});
						} }
					/>
				</td>
				<td>Character rotation</td>
				<td>{ preset.rotation ?? (update != null ? sourceRotation : '') }</td>
			</tr>
			<tr>
				<td>
					<Checkbox
						checked={ preset.yOffset != null }
						disabled={ update == null }
						onChange={ (checked) => {
							update?.({
								yOffset: checked ? sourceYOffset : undefined,
							});
						} }
					/>
				</td>
				<td>Y Offset</td>
				<td>{ preset.yOffset ?? (update != null ? sourceYOffset : '') }</td>
			</tr>
		</>
	);
}
