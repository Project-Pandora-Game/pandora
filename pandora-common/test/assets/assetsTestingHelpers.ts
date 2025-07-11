import { expect } from '@jest/globals';
import { freeze, type Immutable } from 'immer';
import {
	Assert,
	AssertNotNullable,
	AssetFrameworkCharacterState,
	AssetFrameworkGlobalState,
	AssetFrameworkRoomState,
	GetDefaultAppearanceBundle,
	type AssetId,
	type AssetManager,
	type CharacterId,
	type GameLogicCharacter,
	type ItemTemplate,
	type SpaceId,
} from '../../src/index.ts';

/** Create a character state in a deterministic way */
export function TestCreateCharacterState(assetManager: AssetManager, logicCharacter: GameLogicCharacter, roomState: AssetFrameworkRoomState, additionalAssets?: (AssetId | Immutable<ItemTemplate>)[]): AssetFrameworkCharacterState {
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
	const characterState = AssetFrameworkCharacterState.loadFromBundle(assetManager, logicCharacter.id, baseBundle, roomState, undefined);

	// Check the character state actually matches the bundle
	expect(characterState.isValid(roomState)).toBe(true);
	expect(characterState.exportToBundle()).toEqual(baseBundle);

	return characterState;
}

export function TestCreateGlobalState(assetManager: AssetManager, spaceId: SpaceId | null = null, characters?: ((roomState: AssetFrameworkRoomState) => AssetFrameworkCharacterState)[]): AssetFrameworkGlobalState {
	let state = AssetFrameworkGlobalState.createDefault(
		assetManager,
		AssetFrameworkRoomState.createDefault(assetManager, spaceId),
	);

	const characterIds: CharacterId[] = [];
	if (characters != null) {
		for (const characterGenerator of characters) {
			const character = characterGenerator(state.room);
			characterIds.push(character.id);
			state = state.withCharacter(character.id, character);
		}
	}

	expect(Array.from(state.characters.keys())).toEqual(characterIds);

	// Check our bundle works as expected
	expect(state.isValid()).toBe(true);
	TestVerifyGlobalStateExportImport(state);

	return state;
}

export function TestVerifyGlobalStateExportImport(state: AssetFrameworkGlobalState): void {
	const spaceId = state.room.spaceId;

	// Do an export to server bundle and load a new appearance from it
	const bundle = state.exportToBundle();
	freeze(bundle, true);
	const loadedState = AssetFrameworkGlobalState.loadFromBundle(state.assetManager, bundle, spaceId, undefined);

	expect(loadedState.exportToBundle()).toStrictEqual(bundle);
	expect(loadedState).toStrictEqual(state);

	// Export the original state to a client bundle and load that.
	// The client bundle can be different from a server one and cannot reproduce it, but it must be able to reproduce itself
	const clientBundle = state.exportToClientBundle();
	freeze(clientBundle, true);
	const loadedClientState = AssetFrameworkGlobalState.loadFromBundle(state.assetManager, clientBundle, spaceId, undefined);

	expect(loadedClientState.exportToClientBundle()).toStrictEqual(clientBundle);
}

export function TestVerifyGlobalStateDelta(originalState: AssetFrameworkGlobalState, targetState: AssetFrameworkGlobalState): void {
	Assert(originalState.assetManager === targetState.assetManager);
	Assert(originalState.room.spaceId === targetState.room.spaceId);
	if (originalState === targetState)
		return;

	const spaceId = targetState.room.spaceId;

	// The states should have a different state id
	// (this is technically flaky, but the chance of a collission here is really small)
	expect(originalState.getStateId()).not.toBe(targetState.getStateId());

	// Create delta update
	const update = targetState.exportToClientDeltaBundle(originalState);
	freeze(update, true);

	// Get client equivalents for the states
	const originalClientState = AssetFrameworkGlobalState.loadFromBundle(originalState.assetManager, originalState.exportToClientBundle(), spaceId, undefined);
	const targetClientBundle = targetState.exportToClientBundle();
	const targetClientState = AssetFrameworkGlobalState.loadFromBundle(targetState.assetManager, targetClientBundle, spaceId, undefined);

	// Apply bundle to original client state
	const updatedClientState = originalClientState.applyClientDeltaBundle(update, undefined);

	// We must arrive at the same result
	expect(updatedClientState.exportToClientBundle()).toStrictEqual(targetClientBundle);
	expect(updatedClientState).toStrictEqual(targetClientState);
}
