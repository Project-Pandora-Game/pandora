import classNames from 'classnames';
import type { Immutable } from 'immer';
import { capitalize, isEqual, throttle } from 'lodash-es';
import {
	AppearanceActionProcessingContext,
	AppearanceItemProperties,
	ArmRotationSchema,
	Assert,
	AssetFrameworkCharacterState,
	AssetFrameworkRoomState,
	AssetsPosePreset,
	AssetsPosePresets,
	BONE_MAX,
	BONE_MIN,
	BoneDefinition,
	CharacterSize,
	CharacterViewSchema,
	CloneDeepMutable,
	GetLogger,
	LegsPoseSchema,
	MergePartialAppearancePoses,
	PartialAppearancePose,
	ProduceAppearancePose,
	type AppearanceLimitTree,
	type ArmPose,
	type AssetManager,
	type AssetsPosePresetCategory,
	type AssetsPosePresetPreview,
	type ItemDisplayNameType,
	type ServiceManager,
} from 'pandora-common';
import React, { ReactElement, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { z } from 'zod';
import bodyIcon from '../../../assets/icons/body.svg';
import itemSettingIcon from '../../../assets/icons/item_setting.svg';
import starIcon from '../../../assets/icons/star.svg';
import { useBrowserStorage } from '../../../browserStorage.ts';
import { IChatroomCharacter } from '../../../character/character.ts';
import type { ChildrenProps } from '../../../common/reactTypes.ts';
import { useDebouncedValue } from '../../../common/useDebounceValue.ts';
import { useEvent } from '../../../common/useEvent.ts';
import { useRemotelyUpdatedUserInput } from '../../../common/useRemotelyUpdatedUserInput.ts';
import { Checkbox } from '../../../common/userInteraction/checkbox.tsx';
import { NumberInput } from '../../../common/userInteraction/input/numberInput.tsx';
import { useUpdatedUserInput } from '../../../common/useSyncUserInput.ts';
import { LIVE_UPDATE_THROTTLE } from '../../../config/Environment.ts';
import { GraphicsCharacter, type GraphicsCharacterLayerFilter, type LayerStateOverrideGetter } from '../../../graphics/graphicsCharacter.tsx';
import { RenderGraphicsTreeInBackground } from '../../../graphics/utility/renderInBackground.tsx';
import { useAccountSettings } from '../../../services/accountLogic/accountManagerHooks.ts';
import type { ClientServices } from '../../../services/clientServices.ts';
import { serviceManagerContext, useServiceManager } from '../../../services/serviceProvider.tsx';
import { Button } from '../../common/button/button.tsx';
import { Column, Row } from '../../common/container/container.tsx';
import { FieldsetToggle } from '../../common/fieldsetToggle/index.tsx';
import { SelectionIndicator } from '../../common/selectionIndicator/selectionIndicator.tsx';
import { useCheckAddPermissions } from '../../gameContext/permissionCheckProvider.tsx';
import { ResolveItemDisplayName } from '../itemDetail/wardrobeItemName.tsx';
import { WardrobeStoredPosePresets } from '../poseDetail/storedPosePresets.tsx';
import { useWardrobeActionContext, useWardrobeExecuteCallback, useWardrobePermissionRequestCallback } from '../wardrobeActionContext.tsx';
import { ActionWarning, ActionWarningContent, CheckResultToClassName } from '../wardrobeComponents.tsx';
import { useWardrobeContext } from '../wardrobeContext.tsx';

type CheckedPosePreset = {
	active: boolean;
	requested: boolean;
	available: boolean;
	pose: PartialAppearancePose;
	name: string;
};

const EMPTY_POSE = Object.freeze<PartialAppearancePose>({});

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
		requested: isEqual(
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
		active: isEqual(
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

	const { wardrobePosingCategoryDefault } = useAccountSettings();
	const [focusedCategory, setFocusedCategory] = useState<'custom' | 'basic' | 'manual' | number>(wardrobePosingCategoryDefault);

	const poses = useMemo(() => GetFilteredAssetsPosePresets(characterState, wardrobeItemDisplayNameType), [characterState, wardrobeItemDisplayNameType]);
	const setPose = useMemo(() => throttle(setPoseDirect, LIVE_UPDATE_THROTTLE), [setPoseDirect]);

	const actualPoseDiffers = !isEqual(characterState.requestedPose, characterState.actualPose);

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
								setPose(CloneDeepMutable(characterState.actualPose));
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

export function PoseButton({ preset, preview, setPose, characterState }: {
	preset: Immutable<AssetsPosePreset>;
	preview?: Immutable<AssetsPosePresetPreview>;
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
				className={ preview != null ? 'IconButton PoseButton flex-1' : 'flex-1 PoseButton' }
			>
				{
					preview != null ? (
						<>
							<PoseButtonPreview
								assetManager={ characterState.assetManager }
								preset={ preset }
								preview={ preview }
							/>
							<span>{ name }</span>
						</>
					) : (
						<>{ name }</>
					)
				}
			</Button>
		</SelectionIndicator>
	);
}

const PREVIEW_COLOR = 0xcccccc;
const PREVIEW_COLOR_DIM = 0x666666;
const PREVIEW_SIZE = 128 * (window.devicePixelRatio || 1);

const PREVIEW_CACHE = new WeakMap<
	AssetManager,
	WeakMap<
		Immutable<AssetsPosePresetPreview>,
		WeakMap<
			Omit<Immutable<AssetsPosePreset>, 'name' | 'preview'>,
			HTMLCanvasElement
		>
	>
>();

async function GeneratePosePreview(
	assetManager: AssetManager,
	preview: Immutable<AssetsPosePresetPreview>,
	preset: Omit<Immutable<AssetsPosePreset>, 'name' | 'preview'>,
	serviceManager: ServiceManager<ClientServices>,
): Promise<HTMLCanvasElement> {
	// Get a cache
	let managerCache = PREVIEW_CACHE.get(assetManager);
	if (managerCache == null) {
		PREVIEW_CACHE.set(assetManager, (managerCache = new WeakMap()));
	}

	let previewCache = managerCache.get(preview);
	if (previewCache == null) {
		managerCache.set(preview, (previewCache = new WeakMap()));
	}

	let result = previewCache.get(preset);
	if (result != null) {
		return result;
	}

	const layerStateOverrideGetter: LayerStateOverrideGetter = (layer) => {
		if (layer.type === 'mesh' && layer.previewOverrides != null) {
			return {
				color: (preview.highlight == null || preview.highlight.includes(layer.priority)) ? PREVIEW_COLOR : PREVIEW_COLOR_DIM,
				alpha: layer.previewOverrides.alpha,
			};
		}
		return undefined;
	};

	const layerFilter: GraphicsCharacterLayerFilter = (layer) => {
		return layer.layer.type === 'mesh' && layer.layer.previewOverrides != null;
	};

	const pose = MergePartialAppearancePoses(preset, preset.optional);

	const spaceState = AssetFrameworkRoomState.createDefault(assetManager, null);
	const previewCharacterState = AssetFrameworkCharacterState
		.createDefault(assetManager, 'c0', spaceState)
		.produceWithPose(preview.basePose ?? {}, 'pose')
		.produceWithPose(pose, 'pose');

	const previewSize = 128 * (window.devicePixelRatio || 1);
	const scale = previewSize / preview.size;

	result = await RenderGraphicsTreeInBackground(
		<serviceManagerContext.Provider value={ serviceManager }>
			<GraphicsCharacter
				position={ { x: previewSize / 2, y: previewSize / 2 } }
				pivot={ { x: (preview.x ?? ((CharacterSize.WIDTH - preview.size) / 2)) + preview.size / 2, y: preview.y + preview.size / 2 } }
				scale={ { x: scale * (previewCharacterState.actualPose.view === 'back' ? -1 : 1), y: scale } }
				angle={ previewCharacterState.actualPose.bones.character_rotation || 0 }
				characterState={ previewCharacterState }
				layerStateOverrideGetter={ layerStateOverrideGetter }
				layerFilter={ layerFilter }
			/>
		</serviceManagerContext.Provider>,
		{ x: 0, y: 0, width: previewSize, height: previewSize },
		0,
		0,
	);
	previewCache.set(preset, result);

	return result;
}

function PoseButtonPreview({ assetManager, preset, preview }: {
	assetManager: AssetManager;
	preset: Omit<Immutable<AssetsPosePreset>, 'name' | 'preview'>;
	preview: Immutable<AssetsPosePresetPreview>;
}): ReactElement | null {
	const serviceManager = useServiceManager();
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const { wardrobePosePreview } = useAccountSettings();

	useEffect(() => {
		if (!wardrobePosePreview)
			return;

		let valid = true;

		GeneratePosePreview(assetManager, preview, preset, serviceManager)
			.then((result) => {
				if (!valid || canvasRef.current == null)
					return;

				const { width, height } = canvasRef.current;
				const ctx = canvasRef.current.getContext('2d');
				Assert(ctx != null);
				ctx.clearRect(0, 0, width, height);
				ctx.drawImage(result, 0, 0, width, height);
			})
			.catch((err) => {
				GetLogger('PoseButtonPreview')
					.error('Error generating preview:', err);
			});

		return () => {
			valid = false;
		};
	}, [assetManager, preset, preview, serviceManager, wardrobePosePreview]);

	if (!wardrobePosePreview)
		return null;

	return (
		<canvas
			ref={ canvasRef }
			width={ PREVIEW_SIZE }
			height={ PREVIEW_SIZE }
		/>
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

function RoomManualYOffsetControl({ characterState }: {
	characterState: AssetFrameworkCharacterState;
}): ReactElement {
	const [execute] = useWardrobeExecuteCallback({ allowMultipleSimultaneousExecutions: true });

	const [yOffset, setYOffsetLocal] = useUpdatedUserInput(characterState.position.position[2], [characterState.id]);

	const setYOffset = useEvent((newYOffset: number) => {
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
				position: [position[0], position[1], newYOffset],
			},
		});
	});

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
