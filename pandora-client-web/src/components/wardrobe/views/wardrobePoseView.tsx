import classNames from 'classnames';
import type { Immutable } from 'immer';
import { capitalize, isEqual, throttle } from 'lodash-es';
import {
	AppearanceActionProcessingContext,
	ArmRotationSchema,
	AssetFrameworkCharacterState,
	AssetsPosePreset,
	AssetsPosePresets,
	BONE_MAX,
	BONE_MIN,
	BoneDefinition,
	CharacterViewSchema,
	CloneDeepMutable,
	LegsPoseSchema,
	PartialAppearancePose,
	ProduceAppearancePose,
	type ArmPose,
	type AssetsPosePresetCategory,
	type ItemDisplayNameType,
} from 'pandora-common';
import React, { ReactElement, useCallback, useId, useMemo, useState } from 'react';
import * as z from 'zod';
import bodyIcon from '../../../assets/icons/body.svg';
import itemSettingIcon from '../../../assets/icons/item_setting.svg';
import starIcon from '../../../assets/icons/star.svg';
import { useBrowserStorage } from '../../../browserStorage.ts';
import { Character } from '../../../character/character.ts';
import type { ChildrenProps } from '../../../common/reactTypes.ts';
import { useDebouncedValue } from '../../../common/useDebounceValue.ts';
import { useEvent } from '../../../common/useEvent.ts';
import { useRemotelyUpdatedUserInput } from '../../../common/useRemotelyUpdatedUserInput.ts';
import { Checkbox } from '../../../common/userInteraction/checkbox.tsx';
import { NumberInput } from '../../../common/userInteraction/input/numberInput.tsx';
import { useUpdatedUserInput } from '../../../common/useSyncUserInput.ts';
import { LIVE_UPDATE_THROTTLE } from '../../../config/Environment.ts';
import { useAccountSettings } from '../../../services/accountLogic/accountManagerHooks.ts';
import { Button } from '../../common/button/button.tsx';
import { Column, Row } from '../../common/container/container.tsx';
import { FieldsetToggle } from '../../common/fieldsetToggle/index.tsx';
import { SelectionIndicator } from '../../common/selectionIndicator/selectionIndicator.tsx';
import { useCheckAddPermissions } from '../../gameContext/permissionCheckProvider.tsx';
import { ResolveItemDisplayName } from '../itemDetail/wardrobeItemName.tsx';
import { PoseButton, PoseButtonPreview } from '../poseDetail/poseButton.tsx';
import { WardrobeStoredPosePresets } from '../poseDetail/storedPosePresets.tsx';
import { useWardrobeActionContext, useWardrobeExecuteCallback, useWardrobePermissionRequestCallback } from '../wardrobeActionContext.tsx';
import { ActionButtonHoverInfo, ActionProblemsContent } from '../wardrobeActionProblems.tsx';
import { CheckResultToClassName } from '../wardrobeComponents.tsx';
import { useWardrobeContext } from '../wardrobeContext.tsx';
import { GetVisibleBoneName } from '../wardrobeUtils.ts';

const EMPTY_POSE = Object.freeze<PartialAppearancePose>({});

function GetFilteredAssetsPosePresets(characterState: AssetFrameworkCharacterState, itemDisplayNameType: ItemDisplayNameType): Immutable<AssetsPosePresets> {
	const assetManager = characterState.assetManager;
	const presets: Immutable<AssetsPosePresetCategory>[] = assetManager.posePresets.slice();
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

function WardrobePoseCategoryInternal({ poseCategory, setPose, characterState }: {
	poseCategory: Immutable<AssetsPosePresetCategory>;
	characterState: AssetFrameworkCharacterState;
	setPose: (pose: PartialAppearancePose) => void;
}): ReactElement {
	return (
		<FieldsetToggle legend={ poseCategory.category } persistent={ 'bone-ui-pose-' + poseCategory.category }>
			<div className='pose-row'>
				{
					poseCategory.poses.map((preset, presetIndex) => (
						<PoseButton key={ presetIndex }
							preset={ preset }
							preview={ preset.preview ?? poseCategory.preview }
							characterState={ characterState }
							setPose={ setPose }
						/>
					))
				}
			</div>
		</FieldsetToggle>
	);
}

export function WardrobePoseCategories({ characterState, setPose }: { characterState: AssetFrameworkCharacterState; setPose: (pose: PartialAppearancePose) => void; }): ReactElement {
	const { wardrobeItemDisplayNameType } = useAccountSettings();
	const poses = useMemo(() => GetFilteredAssetsPosePresets(characterState, wardrobeItemDisplayNameType), [characterState, wardrobeItemDisplayNameType]);
	return (
		<>
			{ poses.map((poseCategory, poseCategoryIndex) => (
				<WardrobePoseCategoryInternal key={ poseCategoryIndex }
					poseCategory={ poseCategory }
					characterState={ characterState }
					setPose={ setPose }
				/>
			)) }
		</>
	);
}

export function WardrobeViewPose({ setPose, characterState }: {
	characterState: AssetFrameworkCharacterState;
	setPose: (_: Omit<AssetsPosePreset, 'name'>) => void;
}) {
	return (
		<table className='armPositioningTable'>
			<tbody>
				<tr>
					<td>View</td>
					<td>
						<Row gap='tiny' wrap>
							{
								CharacterViewSchema.options.map((o) => (
									<PoseButton
										key={ o }
										preset={ {
											name: capitalize(o),
											view: o,
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
								name: capitalize(r),
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
												name: capitalize(r),
												legs: {
													pose: r,
												},
											} }
											characterState={ characterState }
											setPose={ setPose }
										/>
									))
								}
							</Row>
						</td>
					</tr>
					<tr>
						<td>Upper leg order</td>
						<td>
							<Row gap='tiny' wrap>
								<PoseButton
									preset={ {
										name: 'Left first',
										legs: {
											upper: 'left',
										},
									} }
									characterState={ characterState }
									setPose={ setPose }
								/>
								<PoseButton
									preset={ {
										name: 'Right first',
										legs: {
											upper: 'right',
										},
									} }
									characterState={ characterState }
									setPose={ setPose }
								/>
							</Row>
						</td>
					</tr>
				</tbody>
			</table>
		</>
	);
}

export function WardrobePoseGui({ character, characterState }: {
	character: Character;
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

	const { wardrobePosingCategoryDefault } = useAccountSettings();
	const [focusedCategory, setFocusedCategory] = useState<'custom' | 'basic' | 'manual' | number>(wardrobePosingCategoryDefault);

	const poses = useMemo(() => GetFilteredAssetsPosePresets(characterState, wardrobeItemDisplayNameType), [characterState, wardrobeItemDisplayNameType]);
	const setPose = useMemo(() => throttle(setPoseDirect, LIVE_UPDATE_THROTTLE), [setPoseDirect]);

	const actualPosePreset = useMemo((): PartialAppearancePose => {
		const bones: Record<string, number> = {};
		for (const bone of characterState.assetManager.getAllBones()) {
			if (bone.type === 'pose') {
				bones[bone.name] = characterState.getActualPoseBoneValue(bone.name);
			}
		}
		return {
			...characterState.actualPose,
			bones,
		};
	}, [characterState]);
	const actualPoseDiffers = useMemo(() => {
		return !isEqual(
			characterState.requestedPose,
			ProduceAppearancePose(
				characterState.requestedPose,
				{
					assetManager,
					boneTypeFilter: 'pose',
				},
				actualPosePreset,
			),
		);
	}, [actualPosePreset, assetManager, characterState.requestedPose]);

	return (
		<div className='inventoryView'>
			<div className='bone-ui'>
				<WardrobePoseGuiGate>
					<Column className='fill-x' padding='medium' gap='small'>
						<div className='pose-row category'>
							<Button
								theme={ focusedCategory === 'custom' ? 'defaultActive' : 'default' }
								onClick={ () => setFocusedCategory('custom') }
								className='IconButton PoseButton'
								slim
							>
								<img src={ starIcon } alt='Custom poses' />
								<span>&nbsp;Custom poses</span>
							</Button>
							<Button
								theme={ focusedCategory === 'basic' ? 'defaultActive' : 'default' }
								onClick={ () => setFocusedCategory('basic') }
								className='IconButton PoseButton'
								slim
							>
								<img src={ bodyIcon } alt='Quick posing' />
								<span>&nbsp;Quick posing</span>
							</Button>
							<Button
								theme={ focusedCategory === 'manual' ? 'defaultActive' : 'default' }
								onClick={ () => setFocusedCategory('manual') }
								className='IconButton PoseButton'
								slim
							>
								<img src={ itemSettingIcon } alt='Manual posing' />
								<span>&nbsp;Manual posing</span>
							</Button>
						</div>
						<div className='pose-row category'>
							{
								poses.map((poseCategory, poseCategoryIndex) => (poseCategory.preview != null ? (
									<Button
										key={ poseCategoryIndex }
										theme={ focusedCategory === poseCategoryIndex ? 'defaultActive' : 'default' }
										onClick={ () => setFocusedCategory(poseCategoryIndex) }
										className='IconButton PoseButton compact'
										slim
									>
										<PoseButtonPreview
											assetManager={ characterState.assetManager }
											preset={ EMPTY_POSE }
											preview={ poseCategory.preview }
										/>
										<span>{ poseCategory.category }</span>
									</Button>
								) : null))
							}
						</div>
					</Column>
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
								setPose(CloneDeepMutable(actualPosePreset));
							} }
						>
							Stay in it
						</Button>
					</Row>
					{
						focusedCategory === 'custom' ? (
							<WardrobeStoredPosePresets setPose={ setPose } characterState={ characterState } />
						) : focusedCategory === 'basic' ? (
							<>
								{
									poses
										.filter((category) => category.preview == null)
										.map((poseCategory, poseCategoryIndex) => (
											<WardrobePoseCategoryInternal key={ poseCategoryIndex }
												poseCategory={ poseCategory }
												characterState={ characterState }
												setPose={ setPose }
											/>
										))
								}
								<RoomManualYOffsetControl characterState={ characterState } />
							</>
						) : focusedCategory === 'manual' ? (
							<FieldsetToggle legend='Manual posing' persistent='bone-ui-dev-pose'>
								<Column>
									<WardrobeViewPose characterState={ characterState } setPose={ setPose } />
									<WardrobeArmPoses characterState={ characterState } setPose={ setPose } />
									<WardrobeLegsPose characterState={ characterState } setPose={ setPose } />
									<RoomManualYOffsetControl characterState={ characterState } />
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
						) : poses.length > focusedCategory ? (
							<WardrobePoseCategoryInternal key={ focusedCategory }
								poseCategory={ poses[focusedCategory] }
								characterState={ characterState }
								setPose={ setPose }
							/>
						) : null
					}
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
				<ActionProblemsContent problems={ checkResult.problems } prompt={ false } />
				<button
					ref={ setRef }
					className={ classNames(
						'wardrobeActionButton',
						CheckResultToClassName(checkResult, false),
					) }
					onClick={ onClick }
					disabled={ processing }
				>
					<ActionButtonHoverInfo checkResult={ checkResult } actionInProgress={ false } parent={ ref } />
					Request access
				</button>
			</Column>
		);
	}

	return (
		<>{ children }</>
	);
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

function RoomManualYOffsetControl({ characterState }: {
	characterState: AssetFrameworkCharacterState;
}): ReactElement {
	const [execute] = useWardrobeExecuteCallback({ allowMultipleSimultaneousExecutions: true });

	const [yOffset, setYOffsetLocal] = useUpdatedUserInput(characterState.position.position[2], [characterState.id]);

	const disableManualMove = characterState.position.following != null && characterState.position.following.followType !== 'leash';

	const setYOffset = useEvent((newYOffset: number) => {
		if (disableManualMove)
			return;

		const position = characterState.position.position;
		setYOffsetLocal(newYOffset);
		execute({
			type: 'moveCharacter',
			target: {
				type: 'character',
				characterId: characterState.id,
			},
			moveTo: {
				type: 'normal',
				room: characterState.currentRoom,
				position: [position[0], position[1], newYOffset],
				following: characterState.position.following,
			},
		});
	});

	return (
		<Row padding='small'>
			<Row alignY='center'>Character Y Offset:</Row>
			<NumberInput className='positioning-input' step={ 1 } value={ yOffset } onChange={ setYOffset } disabled={ disableManualMove } />
			<Button className='slim' onClick={ () => setYOffset(0) } disabled={ disableManualMove || yOffset === 0 }>
				↺
			</Button>
		</Row>
	);
}
