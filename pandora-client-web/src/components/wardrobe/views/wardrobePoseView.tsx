import classNames from 'classnames';
import _ from 'lodash';
import {
	AppearanceActionProcessingContext,
	AppearanceItemProperties,
	ArmRotationSchema,
	AssetFrameworkCharacterState,
	AssetsPosePreset,
	AssetsPosePresets,
	BONE_MAX,
	BONE_MIN,
	BoneDefinition,
	CloneDeepMutable,
	LegsPoseSchema,
	MergePartialAppearancePoses,
	PartialAppearancePose,
	ProduceAppearancePose,
	type AppearanceLimitTree,
	type ArmPose,
	type ItemDisplayNameType,
} from 'pandora-common';
import React, { ReactElement, useCallback, useId, useMemo, useState } from 'react';
import { z } from 'zod';
import { useBrowserStorage } from '../../../browserStorage';
import { IChatroomCharacter, useCharacterData } from '../../../character/character';
import type { ChildrenProps } from '../../../common/reactTypes';
import { useDebouncedValue } from '../../../common/useDebounceValue';
import { useEvent } from '../../../common/useEvent';
import { useRemotelyUpdatedUserInput } from '../../../common/useRemotelyUpdatedUserInput';
import { Checkbox } from '../../../common/userInteraction/checkbox';
import { NumberInput } from '../../../common/userInteraction/input/numberInput';
import { useUpdatedUserInput } from '../../../common/useSyncUserInput';
import { LIVE_UPDATE_THROTTLE } from '../../../config/Environment';
import { useAccountSettings } from '../../../services/accountLogic/accountManagerHooks';
import { Button } from '../../common/button/button';
import { Column, Row } from '../../common/container/container';
import { FieldsetToggle } from '../../common/fieldsetToggle';
import { SelectionIndicator } from '../../common/selectionIndicator/selectionIndicator';
import { useCheckAddPermissions } from '../../gameContext/permissionCheckProvider';
import { useShardConnector } from '../../gameContext/shardConnectorContextProvider';
import { ResolveItemDisplayName } from '../itemDetail/wardrobeItemName';
import { WardrobeStoredPosePresets } from '../poseDetail/storedPosePresets';
import { useWardrobeActionContext, useWardrobeExecuteCallback, useWardrobePermissionRequestCallback } from '../wardrobeActionContext';
import { ActionWarning, ActionWarningContent, CheckResultToClassName } from '../wardrobeComponents';
import { useWardrobeContext } from '../wardrobeContext';

type CheckedPosePreset = {
	active: boolean;
	requested: boolean;
	available: boolean;
	pose: PartialAppearancePose;
	name: string;
};

const CHARACTER_STATE_LIMITS_CACHE = new WeakMap<AssetFrameworkCharacterState, AppearanceLimitTree>();
function CheckPosePreset(pose: AssetsPosePreset, characterState: AssetFrameworkCharacterState): CheckedPosePreset {
	const assetManager = characterState.assetManager;
	const mergedPose = MergePartialAppearancePoses(pose, pose.optional);
	// Cache the limits calculation as we have many buttons that can reuse this
	let limits: AppearanceLimitTree | undefined = CHARACTER_STATE_LIMITS_CACHE.get(characterState);
	if (limits === undefined) {
		limits = AppearanceItemProperties(characterState.items).limits;
		CHARACTER_STATE_LIMITS_CACHE.set(characterState, limits);
	}
	return {
		pose: mergedPose,
		requested: _.isEqual(
			characterState.requestedPose,
			ProduceAppearancePose(
				characterState.requestedPose,
				{
					assetManager,
					boneTypeFilter: 'pose',
				},
				mergedPose,
			),
		),
		active: _.isEqual(
			characterState.actualPose,
			ProduceAppearancePose(
				characterState.actualPose,
				{
					assetManager,
					boneTypeFilter: 'pose',
				},
				mergedPose,
			),
		),
		available: limits.validate(pose),
		name: pose.name,
	};
}

function GetFilteredAssetsPosePresets(characterState: AssetFrameworkCharacterState, itemDisplayNameType: ItemDisplayNameType): AssetsPosePresets {
	const assetManager = characterState.assetManager;
	const presets: AssetsPosePresets = assetManager.getPosePresets();
	for (const item of characterState.items) {
		// Collect custom pose presets from room device and personal items that provide them
		if (!item.isType('bodypart') && !item.isType('personal') && !item.isType('roomDeviceWearablePart'))
			continue;

		const baseItem = item.isType('roomDeviceWearablePart') ? item.roomDevice : null;

		if (!item.asset.definition.posePresets && !baseItem?.asset.definition.posePresets)
			continue;

		presets.unshift({
			category: `${item.isType('roomDeviceWearablePart') ? 'Device' : 'Item'}: ${ResolveItemDisplayName(baseItem ?? item, itemDisplayNameType)}`,
			poses: [
				...(baseItem?.asset.definition.posePresets ?? []),
				...(item.asset.definition.posePresets ?? []),
			],
		});
	}

	return presets;
}

function WardrobePoseCategoriesInternal({ poses, setPose, characterState }: {
	poses: AssetsPosePresets;
	characterState: AssetFrameworkCharacterState;
	setPose: (pose: PartialAppearancePose) => void;
}): ReactElement {
	return (
		<>
			{ poses.map((poseCategory, poseCategoryIndex) => (
				<React.Fragment key={ poseCategoryIndex }>
					<FieldsetToggle legend={ poseCategory.category } persistent={ 'bone-ui-pose-' + poseCategory.category }>
						<Row
							className='pose-row'
							gap='tiny'
							wrap
						>
							{
								poseCategory.poses.map((preset, presetIndex) => (
									<PoseButton key={ presetIndex } preset={ preset } characterState={ characterState } setPose={ setPose } />
								))
							}
						</Row>
					</FieldsetToggle>
				</React.Fragment>
			)) }
		</>
	);
}

export function WardrobePoseCategories({ characterState, setPose }: { characterState: AssetFrameworkCharacterState; setPose: (pose: PartialAppearancePose) => void; }): ReactElement {
	const { wardrobeItemDisplayNameType } = useAccountSettings();
	const poses = useMemo(() => GetFilteredAssetsPosePresets(characterState, wardrobeItemDisplayNameType), [characterState, wardrobeItemDisplayNameType]);
	return (
		<WardrobePoseCategoriesInternal poses={ poses } characterState={ characterState } setPose={ setPose } />
	);
}

export function WardrobeArmPoses({ setPose, characterState }: {
	characterState: AssetFrameworkCharacterState;
	setPose: (_: Omit<AssetsPosePreset, 'name'>) => void;
}): ReactElement {
	const [controlIndividually, setControlIndividually] = useBrowserStorage<boolean>('posing.arms-control-individually', false, z.boolean());

	const ArmPosition = useCallback(({ arm }: { arm: 'leftArm' | 'rightArm' | 'arms'; }): ReactElement => (
		<td>
			<Row gap='tiny' wrap>
				{
					([
						['front_above_hair', 'Front [experimental]'],
						['front', 'Under front hair'],
						['back', 'Under back hair'],
						['back_below_hair', 'Back [experimental]'],
					] satisfies [ArmPose, string][]).map(([position, name]) => (
						<PoseButton
							key={ position }
							preset={ {
								name,
								[arm]: {
									position,
								},
							} }
							characterState={ characterState }
							setPose={ setPose }
						/>
					))
				}
			</Row>
		</td>
	), [characterState, setPose]);
	const ArmFingers = useCallback(({ arm }: { arm: 'leftArm' | 'rightArm' | 'arms'; }): ReactElement => (
		<td>
			<Row gap='tiny' wrap>
				<PoseButton
					preset={ {
						name: 'Spread',
						[arm]: {
							fingers: 'spread',
						},
					} }
					characterState={ characterState }
					setPose={ setPose }
				/>
				<PoseButton
					preset={ {
						name: 'Fist',
						[arm]: {
							fingers: 'fist',
						},
					} }
					characterState={ characterState }
					setPose={ setPose }
				/>
			</Row>
		</td>
	), [characterState, setPose]);
	const ArmRotation = useCallback(({ arm }: { arm: 'leftArm' | 'rightArm' | 'arms'; }): ReactElement => (
		<td>
			<Row gap='tiny' wrap>
				{
					ArmRotationSchema.options.map((r) => (
						<PoseButton
							key={ r }
							preset={ {
								name: _.capitalize(r),
								[arm]: {
									rotation: r,
								},
							} }
							characterState={ characterState }
							setPose={ setPose }
						/>
					))
				}
			</Row>
		</td>
	), [characterState, setPose]);
	const ArmSegmentOrder = useCallback(({ segment, colSpan }: { segment: 'upper'; colSpan?: number; }): ReactElement => (
		<td colSpan={ colSpan }>
			<Row gap='tiny' wrap>
				<PoseButton
					preset={ {
						name: 'Left first',
						armsOrder: {
							[segment]: 'left',
						},
					} }
					characterState={ characterState }
					setPose={ setPose }
				/>
				<PoseButton
					preset={ {
						name: 'Right first',
						armsOrder: {
							[segment]: 'right',
						},
					} }
					characterState={ characterState }
					setPose={ setPose }
				/>
			</Row>
		</td>
	), [characterState, setPose]);
	return (
		<>
			<strong>Arms</strong>
			<Row>
				<Checkbox
					id='pose-arms-individual'
					checked={ controlIndividually }
					onChange={ setControlIndividually }
				/>
				<label htmlFor='pose-arms-individual'>Control arms individually</label>
			</Row>
			{
				!controlIndividually ? (
					<table className='armPositioningTable'>
						<thead>
							<tr>
								<td></td>
								<td>Both arms</td>
							</tr>
						</thead>
						<tbody>
							<tr>
								<td>Position</td>
								<ArmPosition arm='arms' />
							</tr>
							<tr>
								<td>Fingers</td>
								<ArmFingers arm='arms' />
							</tr>
							<tr>
								<td>Rotation</td>
								<ArmRotation arm='arms' />
							</tr>
							<tr>
								<td>Upper arm order</td>
								<ArmSegmentOrder segment='upper' />
							</tr>
						</tbody>
					</table>
				) : (
					<table className='armPositioningTable'>
						<thead>
							<tr>
								<td></td>
								<td>Left arm</td>
								<td>Right arm</td>
							</tr>
						</thead>
						<tbody>
							<tr>
								<td>Position</td>
								<ArmPosition arm='leftArm' />
								<ArmPosition arm='rightArm' />
							</tr>
							<tr>
								<td>Fingers</td>
								<ArmFingers arm='leftArm' />
								<ArmFingers arm='rightArm' />
							</tr>
							<tr>
								<td>Rotation</td>
								<ArmRotation arm='leftArm' />
								<ArmRotation arm='rightArm' />
							</tr>
							<tr>
								<td>Upper arm order</td>
								<ArmSegmentOrder segment='upper' colSpan={ 2 } />
							</tr>
						</tbody>
					</table>
				)
			}
		</>
	);
}

export function WardrobeLegsPose({ setPose, characterState }: {
	characterState: AssetFrameworkCharacterState;
	setPose: (_: Omit<AssetsPosePreset, 'name'>) => void;
}) {
	return (
		<>
			<strong>Legs</strong>
			<table className='armPositioningTable'>
				<tbody>
					<tr>
						<td>State</td>
						<td>
							<Row gap='tiny' wrap>
								{
									LegsPoseSchema.options.map((r) => (
										<PoseButton
											key={ r }
											preset={ {
												name: _.capitalize(r),
												legs: r,
											} }
											characterState={ characterState }
											setPose={ setPose }
										/>
									))
								}
							</Row>
						</td>
					</tr>
				</tbody>
			</table>
		</>
	);
}

export function WardrobePoseGui({ character, characterState }: {
	character: IChatroomCharacter;
	characterState: AssetFrameworkCharacterState;
}): ReactElement {
	const [execute] = useWardrobeExecuteCallback({ allowMultipleSimultaneousExecutions: true });
	const { wardrobeItemDisplayNameType } = useAccountSettings();
	const assetManager = characterState.assetManager;
	const allBones = useMemo(() => assetManager.getAllBones(), [assetManager]);

	const setPoseDirect = useEvent(({ arms, leftArm, rightArm, ...copy }: PartialAppearancePose) => {
		execute({
			type: 'pose',
			target: character.id,
			leftArm: { ...arms, ...leftArm },
			rightArm: { ...arms, ...rightArm },
			...copy,
		});
	});

	const poses = useMemo(() => GetFilteredAssetsPosePresets(characterState, wardrobeItemDisplayNameType), [characterState, wardrobeItemDisplayNameType]);

	const setPose = useMemo(() => _.throttle(setPoseDirect, LIVE_UPDATE_THROTTLE), [setPoseDirect]);

	const actualPoseDiffers = !_.isEqual(characterState.requestedPose, characterState.actualPose);

	return (
		<div className='inventoryView'>
			<div className='bone-ui'>
				<WardrobePoseGuiGate>
					<Row
						className={ actualPoseDiffers ? '' : 'invisible' }
						alignX='center'
						alignY='stretch'
					>
						<SelectionIndicator
							active
							padding='tiny'
							justify='center'
							align='center'
							className='requestedPoseIndicatorText'
						>
							Items are forcing this character into a different pose.
						</SelectionIndicator>
						<Button
							slim
							onClick={ () => {
								setPose(CloneDeepMutable(characterState.actualPose));
							} }
						>
							Stay in it
						</Button>
					</Row>
					<WardrobePoseCategoriesInternal poses={ poses } characterState={ characterState } setPose={ setPose } />
					<WardrobeStoredPosePresets setPose={ setPose } characterState={ characterState } />
					<RoomManualYOffsetControl character={ character } />
					<FieldsetToggle legend='Manual pose' persistent='bone-ui-dev-pose'>
						<Column>
							<WardrobeArmPoses characterState={ characterState } setPose={ setPose } />
							<WardrobeLegsPose characterState={ characterState } setPose={ setPose } />
							<br />
							{
								allBones
									.filter((bone) => bone.type === 'pose')
									.map((bone) => (
										<BoneRowElement key={ bone.name } definition={ bone } characterState={ characterState } onChange={ (value) => {
											setPose({
												bones: {
													[bone.name]: value,
												},
											});
										} } />
									))
							}
						</Column>
					</FieldsetToggle>
				</WardrobePoseGuiGate>
			</div>
		</div>
	);
}

export function WardrobePoseGuiGate({ children }: ChildrenProps): ReactElement {
	const { actions, globalState } = useWardrobeActionContext();
	const { targetSelector } = useWardrobeContext();
	const [requestPermission, processing] = useWardrobePermissionRequestCallback();
	const [ref, setRef] = useState<HTMLElement | null>(null);

	const checkResultInitial = useMemo(() => {
		const processingContext = new AppearanceActionProcessingContext(actions, globalState);
		const actionTarget = processingContext.getTarget(targetSelector);
		if (actionTarget == null || actionTarget.type !== 'character')
			return processingContext.invalid();

		processingContext.checkInteractWithTarget(actionTarget);
		return processingContext.finalize();
	}, [actions, globalState, targetSelector]);
	const checkResult = useCheckAddPermissions(checkResultInitial);

	const onClick = useCallback((ev: React.MouseEvent) => {
		ev.stopPropagation();
		if (!checkResult.valid) {
			if (checkResult.prompt != null) {
				requestPermission(checkResult.prompt, Array.from(checkResult.requiredPermissions).map((p) => [p.group, p.id]));
			}
			return;
		}
	}, [requestPermission, checkResult]);

	if (checkResult != null && !checkResult.valid) {
		return (
			<Column padding='medium'>
				<span>You cannot pose this character.</span>
				<ActionWarningContent problems={ checkResult.problems } prompt={ false } />
				<button
					ref={ setRef }
					className={ classNames(
						'wardrobeActionButton',
						CheckResultToClassName(checkResult, false),
					) }
					onClick={ onClick }
					disabled={ processing }
				>
					<ActionWarning checkResult={ checkResult } actionInProgress={ false } parent={ ref } />
					Request access
				</button>
			</Column>
		);
	}

	return (
		<>{ children }</>
	);
}

function PoseButton({ preset, setPose, characterState }: {
	preset: AssetsPosePreset;
	characterState: AssetFrameworkCharacterState;
	setPose: (pose: PartialAppearancePose) => void;
}): ReactElement {
	const { name, available, requested, active, pose } = CheckPosePreset(preset, characterState);
	return (
		<SelectionIndicator
			selected={ requested }
			active={ active }
			padding='tiny'
			className={ classNames(
				'pose',
				{
					['pose-unavailable']: !available,
				},
			) }
		>
			<Button
				slim
				onClick={ () => setPose(pose) }
				className='flex-1'
			>
				{ name }
			</Button>
		</SelectionIndicator>
	);
}

export function GetVisibleBoneName(name: string): string {
	return name
		.replace(/^\w/, (c) => c.toUpperCase())
		.replace(/_r$/, () => ' Right')
		.replace(/_l$/, () => ' Left')
		.replace(/_\w/g, (c) => ' ' + c.charAt(1).toUpperCase());
}

export function BoneRowElement({ definition, onChange, characterState }: {
	definition: BoneDefinition;
	characterState: AssetFrameworkCharacterState;
	onChange: (value: number) => void;
}): ReactElement {
	const id = 'bone-input-' + useId();

	const visibleName = useMemo(() => GetVisibleBoneName(definition.name), [definition]);
	const requestedRotation = characterState.getRequestedPoseBoneValue(definition.name);
	const actualRotation = characterState.getActualPoseBoneValue(definition.name);
	const markerPosition = useDebouncedValue(actualRotation, 1000);

	const [value, setValue] = useRemotelyUpdatedUserInput(requestedRotation, [characterState.id, definition], {
		updateCallback: onChange,
	});

	return (
		<FieldsetToggle legend={ visibleName } persistent={ 'bone-ui-' + definition.name }>
			<div className='bone-rotation'>
				<NumberInput
					id={ id }
					rangeSlider
					min={ BONE_MIN }
					max={ BONE_MAX }
					step={ 1 }
					value={ value }
					onChange={ setValue }
					list={ id + '-markers' }
				/>
				<datalist id={ id + '-markers' }>
					<option value={ markerPosition }></option>
				</datalist>
				<NumberInput
					min={ BONE_MIN }
					max={ BONE_MAX }
					step={ 1 }
					value={ value }
					onChange={ setValue }
				/>
				<Button className='slim' onClick={ () => setValue(0) } disabled={ value === 0 }>
					↺
				</Button>
			</div>
		</FieldsetToggle>
	);
}

function RoomManualYOffsetControl({ character }: {
	character: IChatroomCharacter;
}): ReactElement {

	const {
		id,
		position,
	} = useCharacterData(character);

	const [yOffset, setYOffsetLocal] = useUpdatedUserInput(position[2], [character]);

	const shard = useShardConnector();

	const setYOffset = useCallback((newYOffset: number) => {
		setYOffsetLocal(newYOffset);
		shard?.sendMessage('roomCharacterMove', {
			id,
			position: [position[0], position[1], newYOffset],
		});
	}, [setYOffsetLocal, shard, id, position]);

	return (
		<Row padding='small'>
			<Row alignY='center'>Character Y Offset:</Row>
			<NumberInput className='positioning-input' step={ 1 } value={ yOffset } onChange={ setYOffset } />
			<Button className='slim' onClick={ () => setYOffset(0) } disabled={ yOffset === 0 }>
				↺
			</Button>
		</Row>
	);
}
