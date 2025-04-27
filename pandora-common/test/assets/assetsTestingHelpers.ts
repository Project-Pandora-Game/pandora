import { expect } from '@jest/globals';
import { freeze, type Immutable } from 'immer';
import {
	AssertNotNullable,
	AssetFrameworkCharacterState,
	AssetFrameworkGlobalState,
	AssetFrameworkRoomState,
	GetDefaultAppearanceBundle,
	type AssetId,
	type AssetManager,
	type GameLogicCharacter,
	type ItemTemplate,
} from '../../src/index.ts';

/** Create a character state in a deterministic way */
export function TestCreateCharacterState(assetManager: AssetManager, logicCharacter: GameLogicCharacter, additionalAssets?: (AssetId | Immutable<ItemTemplate>)[]): AssetFrameworkCharacterState {
	const TEST_ASSETS: AssetId[] = [
		'a/body/base',
		'a/body/head',
		'a/body/eyes',
		'a/body/lips',
	];

	const baseBundle = GetDefaultAppearanceBundle();
	expect(baseBundle.items.length).toBe(0);

	// Add some assets by default to make a valid character
	baseBundle.items = TEST_ASSETS.map((a, i) => {
		const asset = assetManager.getAssetById(a);
		AssertNotNullable(asset);
		const item = assetManager.createItem(`i/${logicCharacter.id}:${i}`, asset, logicCharacter);
		return item.exportToBundle({});
	});
	if (additionalAssets != null) {
		for (let add of additionalAssets) {
			if (typeof add === 'string') {
				add = { asset: add };
			}
			const item = assetManager.createItemFromTemplate(add, logicCharacter);
			AssertNotNullable(item);
			baseBundle.items.push(item.exportToBundle({}));
		}
	}

	// Update bones as base bundle doesn't define them explicitly, but we expect that in the character bundle
	baseBundle.requestedPose.bones = {};
	for (const bone of assetManager.getAllBones()) {
		baseBundle.requestedPose.bones[bone.name] = 0;
	}

	// Freeze to make sure bundle is not modified during load
	freeze(baseBundle, true);

	// Load the state
	const characterState = AssetFrameworkCharacterState.loadFromBundle(assetManager, logicCharacter.id, baseBundle, null, undefined);

	// Check the character state actually matches the bundle
	expect(characterState.isValid(null)).toBe(true);
	expect(characterState.exportToBundle()).toEqual(baseBundle);

	return characterState;
}

export function TestCreateGlobalState(assetManager: AssetManager, characters?: AssetFrameworkCharacterState[]): AssetFrameworkGlobalState {
	let state = AssetFrameworkGlobalState.createDefault(
		assetManager,
		AssetFrameworkRoomState.createDefault(assetManager),
	);

	if (characters != null) {
		for (const character of characters) {
			state = state.withCharacter(character.id, character);
		}
	}

	expect(Array.from(state.characters.keys())).toEqual(characters?.map((c) => c.id) ?? []);

	// Check our bundle works as expected
	expect(state.isValid()).toBe(true);
	TestVerifyGlobalStateExportImport(state);

	return state;
}

export function TestVerifyGlobalStateExportImport(state: AssetFrameworkGlobalState): void {
	// Do an export to server bundle and load a new appearance from it
	const bundle = state.exportToBundle();
	freeze(bundle, true);
	const loadedState = AssetFrameworkGlobalState.loadFromBundle(state.assetManager, bundle, undefined);

	expect(loadedState.exportToBundle()).toStrictEqual(bundle);
	expect(loadedState).toStrictEqual(state);

	// Export the original state to a client bundle and load that.
	// The client bundle can be different from a server one and cannot reproduce it, but it must be able to reproduce itself
	const clientBundle = state.exportToClientBundle();
	freeze(clientBundle, true);
	const loadedClientState = AssetFrameworkGlobalState.loadFromBundle(state.assetManager, clientBundle, undefined);

	expect(loadedClientState.exportToClientBundle()).toStrictEqual(clientBundle);
}
