import { APPEARANCE_POSE_DEFAULT, AssetManager, type LayerImageOverride, type LayerImageSetting } from 'pandora-common';
import { ResolveLayerImageSource } from '../../src/assets/assetGraphicsImageSource.ts';

function Manager(): AssetManager {
	return new AssetManager('image-source-test', { bones: { root: { type: 'pose' } } });
}

describe('resolved layer image sources', () => {
	it('retains the UV pose identity while an image stays selected and when returning to it', () => {
		const manager = Manager();
		const setting: LayerImageSetting = { image: 'base.png', overrides: [], uvPose: { bones: { root: 30 } } };
		const override: LayerImageOverride = { image: 'back.png', condition: [[{ view: 'back' }]], uvPose: { bones: { root: -40 } } };
		const base = ResolveLayerImageSource(manager, setting, setting);
		expect(base.imageUvPose.bones.root).toBe(30);
		expect(ResolveLayerImageSource(manager, setting, setting)).toBe(base);
		const selected = ResolveLayerImageSource(manager, setting, override);
		expect(selected.image).toBe('back.png');
		expect(selected.imageUvPose.bones.root).toBe(-40);
		expect(selected).not.toBe(base);
		expect(ResolveLayerImageSource(manager, setting, setting)).toBe(base);
		expect(ResolveLayerImageSource(manager, setting, override)).toBe(selected);
	});

	it('isolates assets/definitions and keeps the original setting when an override is selected', () => {
		const setting: LayerImageSetting = { image: 'base.png', overrides: [] };
		const override: LayerImageOverride = { image: 'override.png', condition: [] };
		const manager = Manager();
		const result = ResolveLayerImageSource(manager, setting, override);
		expect(result.setting).toBe(setting);
		expect(result.imageUvPose).toBe(APPEARANCE_POSE_DEFAULT);
		expect(ResolveLayerImageSource(Manager(), setting, override)).not.toBe(result);
		expect(ResolveLayerImageSource(manager, { ...setting }, override)).not.toBe(result);
		expect(ResolveLayerImageSource(manager, setting, { ...override })).not.toBe(result);
	});
});
