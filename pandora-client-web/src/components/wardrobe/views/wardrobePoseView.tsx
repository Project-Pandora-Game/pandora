import classNames from 'classnames';
import {
	AppearanceItemProperties,
	AppearanceItems,
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
} from 'pandora-common';
import React, { ReactElement, useCallback, useId, useMemo, useState } from 'react';
import { IChatroomCharacter, useCharacterData } from '../../../character/character';
import { FieldsetToggle } from '../../common/fieldsetToggle';
import { Button } from '../../common/button/button';
import _ from 'lodash';
import { useEvent } from '../../../common/useEvent';
import { useWardrobeContext, useWardrobeExecuteCallback } from '../wardrobeContext';
import { useCharacterIsInChatroom } from '../../gameContext/chatRoomContextProvider';
import { Column, Row } from '../../common/container/container';
import { useShardConnector } from '../../gameContext/shardConnectorContextProvider';
import { useUpdatedUserInput } from '../../../common/useSyncUserInput';
import { SelectionIndicator } from '../../common/selectionIndicator/selectionIndicator';
import { useRemotelyUpdatedUserInput } from '../../../common/useRemotelyUpdatedUserInput';
import { useDebouncedValue } from '../../../common/useDebounceValue';

type CheckedPosePreset = {
	active: boolean;
	requested: boolean;
	available: boolean;
	pose: PartialAppearancePose;
	name: string;
};

function CheckPosePreset(pose: AssetsPosePreset, characterState: AssetFrameworkCharacterState): CheckedPosePreset {
	const assetManager = characterState.assetManager;
	const mergedPose = MergePartialAppearancePoses(pose, pose.optional);
	// TODO: Optimize this
	const limits = AppearanceItemProperties(characterState.items).limits;
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

function GetFilteredAssetsPosePresets(characterState: AssetFrameworkCharacterState, roomItems: AppearanceItems): AssetsPosePresets {
	const assetManager = characterState.assetManager;
	const presets: AssetsPosePresets = assetManager.getPosePresets();
	for (const item of characterState.items) {
		if (!item.isType('roomDeviceWearablePart') || item.roomDeviceLink == null)
			continue;

		const deviceId = item.roomDeviceLink.device;
		const roomItem = roomItems.find((i) => i.id === deviceId);
		if (!roomItem?.isType('roomDevice'))
			continue;

		if (!item.asset.definition.posePresets && !roomItem.asset.definition.posePresets)
			continue;

		presets.unshift({
			category: `Device: ${roomItem.asset.definition.name}`,
			poses: [
				...roomItem.asset.definition.posePresets ?? [],
				...item.asset.definition.posePresets ?? [],
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
					<h4>{ poseCategory.category }</h4>
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
				</React.Fragment>
			)) }
		</>
	);
}

export function WardrobePoseCategories({ characterState, setPose }: { characterState: AssetFrameworkCharacterState; setPose: (pose: PartialAppearancePose) => void; }): ReactElement {
	const roomItems = useWardrobeContext().globalState.getItems({ type: 'roomInventory' });
	const poses = useMemo(() => GetFilteredAssetsPosePresets(characterState, roomItems ?? []), [characterState, roomItems]);
	return (
		<WardrobePoseCategoriesInternal poses={ poses } characterState={ characterState } setPose={ setPose } />
	);
}

export function WardrobeArmPoses({ setPose, characterState }: {
	characterState: AssetFrameworkCharacterState;
	setPose: (_: Omit<AssetsPosePreset, 'name'>) => void;
}): ReactElement {
	const [controlIndividually, setControlIndividually] = useState<boolean>(false);

	const ArmPosition = useCallback(({ arm }: { arm: 'leftArm' | 'rightArm' | 'arms'; }): ReactElement => (
		<td>
			<Row gap='tiny' wrap>
				<PoseButton
					preset={ {
						name: 'Front',
						[arm]: {
							position: 'front',
						},
					} }
					characterState={ characterState }
					setPose={ setPose }
				/>
				<PoseButton
					preset={ {
						name: 'Back',
						[arm]: {
							position: 'back',
						},
					} }
					characterState={ characterState }
					setPose={ setPose }
				/>
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
	return (
		<>
			<strong>Arms</strong>
			<Row>
				<input
					id='pose-arms-individual'
					type='checkbox'
					checked={ controlIndividually }
					onChange={ (e) => {
						setControlIndividually(e.target.checked);
					} }
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
	const [execute] = useWardrobeExecuteCallback();
	const roomItems = useWardrobeContext().globalState.getItems({ type: 'roomInventory' });
	const assetManager = characterState.assetManager;
	const allBones = useMemo(() => assetManager.getAllBones(), [assetManager]);

	const setPoseDirect = useEvent(({ bones, arms, leftArm, rightArm, legs, view }: PartialAppearancePose) => {
		execute({
			type: 'pose',
			target: character.id,
			bones,
			leftArm: { ...arms, ...leftArm },
			rightArm: { ...arms, ...rightArm },
			legs,
			view,
		});
	});

	const poses = useMemo(() => GetFilteredAssetsPosePresets(characterState, roomItems ?? []), [characterState, roomItems]);

	const setPose = useMemo(() => _.throttle(setPoseDirect, 100), [setPoseDirect]);

	const actualPoseDiffers = !_.isEqual(characterState.requestedPose, characterState.actualPose);

	return (
		<div className='inventoryView'>
			<div className='bone-ui'>
				<Row
					className={ actualPoseDiffers ? '' : 'invisible' }
					alignX='center'
					alignY='stretch'
				>
					<SelectionIndicator
						active
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
				<ChatroomManualYOffsetControl character={ character } />
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
			</div>
		</div>
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

	const onInput = useEvent((event: React.ChangeEvent<HTMLInputElement>) => {
		const newValue = Math.round(parseFloat(event.target.value));
		if (Number.isInteger(newValue)) {
			setValue(newValue);
		}
	});

	return (
		<FieldsetToggle legend={ visibleName } persistent={ 'bone-ui-' + definition.name }>
			<div className='bone-rotation'>
				<input
					id={ id }
					type='range'
					min={ BONE_MIN }
					max={ BONE_MAX }
					step='1'
					value={ value }
					onChange={ onInput }
					list={ id + '-markers' }
				/>
				<datalist id={ id + '-markers' }>
					<option value={ markerPosition }></option>
				</datalist>
				<input
					type='number'
					min={ BONE_MIN }
					max={ BONE_MAX }
					step='1'
					value={ value }
					onChange={ onInput }
				/>
				<Button className='slim' onClick={ () => setValue(0) } disabled={ value === 0 }>
					↺
				</Button>
			</div>
		</FieldsetToggle>
	);
}

function ChatroomManualYOffsetControl({ character }: {
	character: IChatroomCharacter;
}): ReactElement {

	const {
		id,
		position,
	} = useCharacterData(character);

	const [yOffset, setYOffsetLocal] = useUpdatedUserInput(position[2], [character]);

	const shard = useShardConnector();
	const inRoom = useCharacterIsInChatroom();

	const setYOffset = useCallback((newYOffset: number) => {
		setYOffsetLocal(newYOffset);
		shard?.sendMessage('chatRoomCharacterMove', {
			id,
			position: [position[0], position[1], newYOffset],
		});
	}, [setYOffsetLocal, shard, id, position]);

	const onInput = useEvent((event: React.ChangeEvent<HTMLInputElement>) => {
		const value = Math.round(parseFloat(event.target.value));
		if (Number.isInteger(value) && value !== yOffset) {
			setYOffset(value);
		}
	});

	if (shard == null || !inRoom) {
		return (
			<Row alignY='center' padding='small'>
				Y Offset is only available while inside a room.
			</Row>
		);
	}

	return (
		<Row padding='small'>
			<Row alignY='center'>Character Y Offset:</Row>
			<input type='number' id='positioning-input' step='1' value={ yOffset } onChange={ onInput } />
			<Button className='slim' onClick={ () => setYOffset(0) } disabled={ yOffset === 0 }>
				↺
			</Button>
		</Row>
	);
}
