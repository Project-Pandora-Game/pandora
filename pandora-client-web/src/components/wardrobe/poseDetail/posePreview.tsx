import type { Immutable } from 'immer';
import {
	AssetFrameworkCharacterState,
	AssetFrameworkSpaceState,
	AssetsPosePreset,
	CharacterSize,
	MergePartialAppearancePoses,
	type AssetManager,
	type AssetsPosePresetPreview,
	type ServiceProvider,
} from 'pandora-common';
import { GraphicsCharacter, type GraphicsCharacterLayerFilter, type LayerStateOverrideGetter } from '../../../graphics/graphicsCharacter.tsx';
import { RenderGraphicsTreeInBackground } from '../../../graphics/utility/renderInBackground.tsx';
import type { ClientServices } from '../../../services/clientServices.ts';
import { serviceManagerContext } from '../../../services/serviceProvider.tsx';

const PREVIEW_COLOR = 0xcccccc;
const PREVIEW_COLOR_DIM = 0x666666;

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

export async function GeneratePosePreview(
	assetManager: AssetManager,
	preview: Immutable<AssetsPosePresetPreview>,
	preset: Omit<Immutable<AssetsPosePreset>, 'name' | 'preview'>,
	serviceManager: ServiceProvider<ClientServices>,
	previewSize: number,
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
	if (result != null && result.width === previewSize && result.height === previewSize) {
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

	const spaceState = AssetFrameworkSpaceState.createDefault(assetManager, null);
	const previewCharacterState = AssetFrameworkCharacterState
		.createDefault(assetManager, 'c0', spaceState)
		.produceWithPose(preview.basePose ?? {}, 'pose')
		.produceWithPose(pose, 'pose');

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

