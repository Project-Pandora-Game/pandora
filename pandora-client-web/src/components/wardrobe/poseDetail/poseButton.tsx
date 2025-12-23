import classNames from 'classnames';
import type { Immutable } from 'immer';
import { isEqual } from 'lodash-es';
import {
	AppearanceItemProperties,
	Assert,
	AssetFrameworkCharacterState,
	AssetsPosePreset,
	GetLogger,
	MergePartialAppearancePoses,
	PartialAppearancePose,
	ProduceAppearancePose,
	type AssetManager,
	type AssetsPosePresetPreview,
	type ReadonlyAppearanceLimitTree,
} from 'pandora-common';
import { ReactElement, useEffect, useRef } from 'react';
import { useAccountSettings } from '../../../services/accountLogic/accountManagerHooks.ts';
import { useDevicePixelRatio } from '../../../services/screenResolution/screenResolutionHooks.ts';
import { useServiceManager } from '../../../services/serviceProvider.tsx';
import { Button } from '../../common/button/button.tsx';
import { SelectionIndicator } from '../../common/selectionIndicator/selectionIndicator.tsx';
import { GeneratePosePreview } from './posePreview.tsx';

type CheckedPosePreset = {
	active: boolean;
	requested: boolean;
	available: boolean;
	pose: PartialAppearancePose;
	name: string;
};

const CHARACTER_STATE_LIMITS_CACHE = new WeakMap<AssetFrameworkCharacterState, ReadonlyAppearanceLimitTree>();
function CheckPosePreset(pose: AssetsPosePreset, characterState: AssetFrameworkCharacterState): CheckedPosePreset {
	const assetManager = characterState.assetManager;
	// Always specifying extends allows us to strip any non-pose properties
	const mergedPose = MergePartialAppearancePoses(pose, pose.optional ?? {});
	// Cache the limits calculation as we have many buttons that can reuse this
	let limits: ReadonlyAppearanceLimitTree | undefined = CHARACTER_STATE_LIMITS_CACHE.get(characterState);
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

const PREVIEW_SIZE = 128;

export function PoseButtonPreview({ assetManager, preset, preview }: {
	assetManager: AssetManager;
	preset: Omit<Immutable<AssetsPosePreset>, 'name' | 'preview'>;
	preview: Immutable<AssetsPosePresetPreview>;
}): ReactElement | null {
	const serviceManager = useServiceManager();
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const { wardrobePosePreview } = useAccountSettings();

	const dpr = useDevicePixelRatio();

	useEffect(() => {
		if (!wardrobePosePreview)
			return;

		let valid = true;

		GeneratePosePreview(assetManager, preview, preset, serviceManager, PREVIEW_SIZE * dpr)
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
	}, [assetManager, preset, preview, serviceManager, wardrobePosePreview, dpr]);

	if (!wardrobePosePreview)
		return null;

	return (
		<canvas
			ref={ canvasRef }
			width={ PREVIEW_SIZE * dpr }
			height={ PREVIEW_SIZE * dpr }
		/>
	);
}
