import classNames from 'classnames';
import {
	AppearanceArmPose,
	AppearanceItemProperties,
	AppearanceItems,
	AppearanceLimitTree,
	ArmRotationSchema,
	AssetFrameworkCharacterState,
	AssetsPosePreset,
	BONE_MAX,
	BONE_MIN,
	BoneState,
	CharacterArmsPose,
	LegsPose,
	LegsPoseSchema,
	MergePartialAppearancePoses,
	PartialAppearancePose,
} from 'pandora-common';
import React, { ReactElement, useCallback, useId, useMemo } from 'react';
import { AppearanceContainer, useCharacterAppearanceArmsPose, useCharacterAppearancePose, useCharacterAppearanceView } from '../../../character/character';
import { FieldsetToggle } from '../../common/fieldsetToggle';
import { Button } from '../../common/button/button';
import _ from 'lodash';
import { useEvent } from '../../../common/useEvent';
import { Select } from '../../common/select/select';
import { useWardrobeContext, useWardrobeExecuteCallback } from '../wardrobeContext';

type CheckedPosePreset = {
	active: boolean;
	available: boolean;
	pose: PartialAppearancePose;
	name: string;
};
type CheckedAssetsPosePresets = {
	category: string;
	poses: CheckedPosePreset[];
}[];

function GetFilteredAssetsPosePresets(characterState: AssetFrameworkCharacterState, roomItems: AppearanceItems): {
	poses: CheckedAssetsPosePresets;
	limits: AppearanceLimitTree;
} {
	const { leftArm, rightArm } = characterState.arms;
	const assetManager = characterState.assetManager;
	const presets = assetManager.getPosePresets();
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

	const limits = AppearanceItemProperties(characterState.items).limits;

	const isActive = (preset: PartialAppearancePose) => {
		if (preset.legs != null && preset.legs !== characterState.legs)
			return false;

		const left = { ...preset.arms, ...preset.leftArm };
		const right = { ...preset.arms, ...preset.rightArm };
		for (const name of ['position', 'rotation', 'fingers'] as const) {
			if (left[name] != null && left[name] !== leftArm[name])
				return false;
			if (right[name] != null && right[name] !== rightArm[name])
				return false;
		}

		for (const [boneName, value] of Object.entries(preset.bones ?? {})) {
			if (value === undefined)
				continue;

			if (characterState.pose.get(boneName)?.rotation !== value)
				return false;
		}

		return true;
	};

	const poses = presets.map<CheckedAssetsPosePresets[number]>((preset) => ({
		category: preset.category,
		poses: preset.poses.map((pose) => {
			const available = limits.validate(pose);
			const mergedPose = MergePartialAppearancePoses(pose, pose.optional);
			return {
				pose: mergedPose,
				active: available && isActive(mergedPose),
				available,
				name: pose.name,
			};
		}),
	}));

	return { poses, limits };
}

function WardrobePoseCategoriesInternal({ poses, setPose }: { poses: CheckedAssetsPosePresets; setPose: (pose: PartialAppearancePose) => void; }): ReactElement {
	return (
		<>
			{ poses.map((poseCategory, poseCategoryIndex) => (
				<React.Fragment key={ poseCategoryIndex }>
					<h4>{ poseCategory.category }</h4>
					<div className='pose-row'>
						{
							poseCategory.poses.map((preset, presetIndex) => (
								<PoseButton key={ presetIndex } preset={ preset } setPose={ setPose } />
							))
						}
					</div>
				</React.Fragment>
			)) }
		</>
	);
}

export function WardrobePoseCategories({ characterState, setPose }: { characterState: AssetFrameworkCharacterState; setPose: (pose: PartialAppearancePose) => void; }): ReactElement {
	const roomItems = useWardrobeContext().globalState.getItems({ type: 'roomInventory' });
	const { poses } = useMemo(() => GetFilteredAssetsPosePresets(characterState, roomItems ?? []), [characterState, roomItems]);
	return (
		<WardrobePoseCategoriesInternal poses={ poses } setPose={ setPose } />
	);
}

function WardrobeArmPoseSection<K extends 'position' | 'fingers'>({
	armsPose,
	limits,
	setPose,
	label,
	arm,
	type,
	checked,
	unchecked,
}: {
	armsPose: CharacterArmsPose;
	label: string;
	setPose: (_: Omit<AssetsPosePreset, 'name'>) => void;
	limits?: AppearanceLimitTree;
	arm: 'leftArm' | 'rightArm' | 'arms';
	type: K;
	checked: AppearanceArmPose[K];
	unchecked: AppearanceArmPose[K];
}): ReactElement {
	const id = useId();

	const currentlyChecked = arm !== 'arms'
		? armsPose[arm][type] === checked
		: armsPose.leftArm[type] === checked && armsPose.rightArm[type] === checked;

	return (
		<div>
			<label htmlFor={ `pose-selection-${id}` }>{ label }</label>
			<input
				id={ `pose-selection-${id}` }
				type='checkbox'
				checked={ currentlyChecked }
				disabled={ limits != null && !limits.validate({ [arm]: { [type]: currentlyChecked ? unchecked : checked } }) }
				onChange={ (e) => {
					setPose({
						[arm]: { [type]: e.target.checked ? checked : unchecked },
					});
				} }
			/>
		</div>
	);
}

export function WardrobeArmPoses({ setPose, armsPose, limits }: {
	armsPose: CharacterArmsPose;
	limits?: AppearanceLimitTree;
	setPose: (_: Omit<AssetsPosePreset, 'name'>) => void;
}): ReactElement {
	const ArmToggle = useCallback(({ arm, title }: { arm: 'leftArm' | 'rightArm' | 'arms'; title: string; }): ReactElement => (
		<WardrobeArmPoseSection
			armsPose={ armsPose }
			limits={ limits }
			setPose={ setPose }
			label={ title }
			arm={ arm }
			type='position'
			checked='front'
			unchecked='back'
		/>
	), [armsPose, limits, setPose]);
	const FingersToggle = useCallback(({ arm, title }: { arm: 'leftArm' | 'rightArm' | 'arms'; title: string; }): ReactElement => (
		<WardrobeArmPoseSection
			armsPose={ armsPose }
			limits={ limits }
			setPose={ setPose }
			label={ title }
			arm={ arm }
			type='fingers'
			checked={ 'fist' }
			unchecked={ 'spread' }
		/>
	), [armsPose, limits, setPose]);
	const HandRotation = useCallback(({ arm, title }: { arm: 'leftArm' | 'rightArm'; title: string; }): ReactElement => {
		return (
			<div>
				<label htmlFor={ `pose-hand-rotation-${arm}` }>{ title }</label>
				<Select value={ armsPose[arm].rotation } onChange={ (e) => {
					setPose({
						[arm]: {
							rotation: ArmRotationSchema.parse(e.target.value),
						},
					});
				} }>
					{
						ArmRotationSchema.options
							.filter((r) => armsPose[arm].rotation === r || limits == null || limits.validate({ [arm]: { rotation: r } }))
							.map((r) => (
								<option key={ r } value={ r }>{ _.capitalize(r) }</option>
							))
					}
				</Select>
			</div>
		);
	}, [armsPose, limits, setPose]);
	return (
		<>
			<ArmToggle arm='arms' title='Arms are in front of the body' />
			<ArmToggle arm='leftArm' title='Left arm is in front of the body' />
			<ArmToggle arm='rightArm' title='Right arm is in front of the body' />
			<FingersToggle arm='arms' title='Hands are closed into fists' />
			<FingersToggle arm='leftArm' title='Left hand is closed into a fist' />
			<FingersToggle arm='rightArm' title='Right hand is closed into a fist' />
			<HandRotation arm='leftArm' title='Left hand rotation' />
			<HandRotation arm='rightArm' title='Right hand rotation' />
		</>
	);
}

export function WardrobeLegsPose({ setPose, legs, limits }: {
	limits?: AppearanceLimitTree;
	legs: LegsPose;
	setPose: (_: Omit<AssetsPosePreset, 'name'>) => void;
}) {
	return (
		<div>
			<label htmlFor='pose-legs'>Legs pose</label>
			<Select value={ legs } id='pose-legs' onChange={ (e) => {
				setPose({
					legs: LegsPoseSchema.parse(e.target.value),
				});
			} }>
				{
					LegsPoseSchema.options
						.map((r) => (
							<option
								key={ r }
								value={ r }
								disabled={ limits != null && !limits.validate({ legs: r }) }
							>
								{ _.capitalize(r) }
							</option>
						))
				}
			</Select>
		</div>
	);
}

export function WardrobePoseGui({ character, characterState }: {
	character: AppearanceContainer;
	characterState: AssetFrameworkCharacterState;
}): ReactElement {
	const [execute, processing] = useWardrobeExecuteCallback();
	const roomItems = useWardrobeContext().globalState.getItems({ type: 'roomInventory' });

	const currentBones = useCharacterAppearancePose(characterState);
	const armsPose = useCharacterAppearanceArmsPose(characterState);
	const view = useCharacterAppearanceView(characterState);

	const setPoseDirect = useEvent(({ bones, arms, leftArm, rightArm, legs }: PartialAppearancePose) => {
		execute({
			type: 'pose',
			target: character.id,
			bones,
			leftArm: { ...arms, ...leftArm },
			rightArm: { ...arms, ...rightArm },
			legs,
		});
	});

	const { poses, limits } = useMemo(() => GetFilteredAssetsPosePresets(characterState, roomItems ?? []), [characterState, roomItems]);

	const setPose = useMemo(() => _.throttle(setPoseDirect, 100), [setPoseDirect]);

	return (
		<div className='inventoryView'>
			<div className='bone-ui'>
				<div>
					<label htmlFor='back-view-toggle'>Show back view</label>
					<input
						id='back-view-toggle'
						type='checkbox'
						checked={ view === 'back' }
						onChange={ (e) => {
							execute({
								type: 'setView',
								target: character.id,
								view: e.target.checked ? 'back' : 'front',
							});
						} }
						disabled={ processing }
					/>
				</div>
				<WardrobePoseCategoriesInternal poses={ poses } setPose={ setPose } />
				<FieldsetToggle legend='Manual pose' persistent='bone-ui-dev-pose'>
					<WardrobeArmPoses armsPose={ armsPose } limits={ limits } setPose={ setPose } />
					<WardrobeLegsPose legs={ characterState.legs } limits={ limits } setPose={ setPose } />
					<br />
					{
						currentBones
							.filter((bone) => bone.definition.type === 'pose')
							.map((bone) => (
								<BoneRowElement key={ bone.definition.name } bone={ bone } limits={ limits } onChange={ (value) => {
									setPose({
										bones: {
											[bone.definition.name]: value,
										},
									});
								} } />
							))
					}
				</FieldsetToggle>
			</div>
		</div>
	);
}

function PoseButton({ preset, setPose }: { preset: CheckedPosePreset; setPose: (pose: PartialAppearancePose) => void; }): ReactElement {
	const { name, available, active, pose } = preset;
	return (
		<Button className={ classNames('slim', { ['pose-unavailable']: !available }) } disabled={ active || !available } onClick={ () => setPose(pose) }>
			{ name }
		</Button>
	);
}

export function GetVisibleBoneName(name: string): string {
	return name
		.replace(/^\w/, (c) => c.toUpperCase())
		.replace(/_r$/, () => ' Right')
		.replace(/_l$/, () => ' Left')
		.replace(/_\w/g, (c) => ' ' + c.charAt(1).toUpperCase());
}

export function BoneRowElement({ bone, onChange, limits }: { bone: BoneState; onChange: (value: number) => void; limits?: AppearanceLimitTree; }): ReactElement {
	const name = useMemo(() => GetVisibleBoneName(bone.definition.name), [bone]);
	const canReset = useMemo(() => limits == null || limits.validate({ bones: { bone: 0 } }), [limits]);

	const onInput = useEvent((event: React.ChangeEvent<HTMLInputElement>) => {
		const value = Math.round(parseFloat(event.target.value));
		if (Number.isInteger(value) && value !== bone.rotation && (limits == null || limits.validate({ bones: { bone: value } }))) {
			onChange(value);
		}
	});

	return (
		<FieldsetToggle legend={ name } persistent={ 'bone-ui-' + bone.definition.name }>
			<div className='bone-rotation'>
				<input type='range' min={ BONE_MIN } max={ BONE_MAX } step='1' value={ bone.rotation } onChange={ onInput } />
				<input type='number' min={ BONE_MIN } max={ BONE_MAX } step='1' value={ bone.rotation } onChange={ onInput } />
				<Button className='slim' onClick={ () => onChange(0) } disabled={ bone.rotation === 0 || !canReset }>
					↺
				</Button>
			</div>
		</FieldsetToggle>
	);
}
