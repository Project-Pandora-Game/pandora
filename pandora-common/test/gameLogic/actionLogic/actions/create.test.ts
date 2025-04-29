import { describe, expect, it } from '@jest/globals';
import { Assert, ParseNotNullable } from '../../../../src/index.ts';
import { TestAssetsLoadAssetManager } from '../../../assets/_testData/testAssetsDefinition.ts';
import { TestCreateCharacterState, TestCreateGlobalState } from '../../../assets/assetsTestingHelpers.ts';
import { TestCreateGameLogicCharacter } from '../../character/characterTestingHelpers.ts';
import { TestActionExpectValidResult, TestCreateActionContext, TestDoImmediateAction, TestStateExtractAssets } from '../actionTestingHelpers.ts';

describe('ActionCreate', () => {
	it('Creates a non-unique bodypart', () => {
		const assetManager = TestAssetsLoadAssetManager();
		const character = TestCreateGameLogicCharacter(1, 'c1');
		const baseState = TestCreateGlobalState(assetManager, null, [
			(room) => TestCreateCharacterState(assetManager, character, room),
		]);

		// Do the action
		const result = TestDoImmediateAction(
			{
				type: 'create',
				target: {
					type: 'character',
					characterId: character.id,
				},
				container: [],
				itemTemplate: {
					asset: 'a/body/front_hair1',
				},
			},
			TestCreateActionContext(character, { spaceFeatures: ['allowBodyChanges'] }),
			baseState,
		);

		// Check the result
		TestActionExpectValidResult(result);
		expect(TestStateExtractAssets(result.resultState.characters.get(character.id)?.items)).toMatchSnapshot();
	});

	it('Creates a non-unique bodypart and reorders it in place', () => {
		const assetManager = TestAssetsLoadAssetManager();
		const character = TestCreateGameLogicCharacter(1, 'c1');

		// Add front hair, as back hair should be inserted below front hair
		const frontHair = assetManager.createItem(
			`i/${character.id}:front_hair1`,
			ParseNotNullable(assetManager.getAssetById('a/body/front_hair1')),
			character,
		);
		Assert(frontHair.isType('bodypart'));
		const baseState = TestCreateGlobalState(assetManager, null, [
			(room) => {
				const baseCharacterState = TestCreateCharacterState(assetManager, character, room);
				return baseCharacterState.produceWithItems([
					...baseCharacterState.items,
					frontHair,
				]);
			},
		]);

		// Do the action
		const result = TestDoImmediateAction(
			{
				type: 'create',
				target: {
					type: 'character',
					characterId: character.id,
				},
				container: [],
				itemTemplate: {
					asset: 'a/body/back_hair_normal',
				},
			},
			TestCreateActionContext(character, { spaceFeatures: ['allowBodyChanges'] }),
			baseState,
		);

		// Check the result
		TestActionExpectValidResult(result);
		expect(TestStateExtractAssets(result.resultState.characters.get(character.id)?.items)).toMatchSnapshot();
	});

	it('Creates a unique bodypart and replaces the old one', () => {
		const assetManager = TestAssetsLoadAssetManager();
		const character = TestCreateGameLogicCharacter(1, 'c1');
		const baseState = TestCreateGlobalState(assetManager, null, [
			(room) => TestCreateCharacterState(assetManager, character, room),
		]);

		// Do the action
		const result = TestDoImmediateAction(
			{
				type: 'create',
				target: {
					type: 'character',
					characterId: character.id,
				},
				container: [],
				itemTemplate: {
					asset: 'a/body/eyes2',
				},
			},
			TestCreateActionContext(character, { spaceFeatures: ['allowBodyChanges'] }),
			baseState,
		);

		// Check the result
		TestActionExpectValidResult(result);
		expect(TestStateExtractAssets(result.resultState.characters.get(character.id)?.items)).toMatchSnapshot();
	});

	it('Creates a wearable asset', () => {
		const assetManager = TestAssetsLoadAssetManager();
		const character = TestCreateGameLogicCharacter(1, 'c1');
		const baseState = TestCreateGlobalState(assetManager, null, [
			(room) => TestCreateCharacterState(assetManager, character, room),
		]);

		// Do the action
		const result = TestDoImmediateAction(
			{
				type: 'create',
				target: {
					type: 'character',
					characterId: character.id,
				},
				container: [],
				itemTemplate: {
					asset: 'a/panties/style1',
				},
			},
			TestCreateActionContext(character),
			baseState,
		);

		// Check the result
		TestActionExpectValidResult(result);
		expect(TestStateExtractAssets(result.resultState.characters.get(character.id)?.items)).toMatchSnapshot();
	});

	it('Creates a wearable asset and another one ordered before it', () => {
		const assetManager = TestAssetsLoadAssetManager();
		const character = TestCreateGameLogicCharacter(1, 'c1');
		const baseState = TestCreateGlobalState(assetManager, null, [
			(room) => TestCreateCharacterState(assetManager, character, room),
		]);

		// Do the actions
		const intermediateResult = TestDoImmediateAction(
			{
				type: 'create',
				target: {
					type: 'character',
					characterId: character.id,
				},
				container: [],
				itemTemplate: {
					asset: 'a/panties/style1',
				},
			},
			TestCreateActionContext(character),
			baseState,
		);

		// Check the intermediate result
		TestActionExpectValidResult(intermediateResult);

		const items = intermediateResult.resultState.getItems({
			type: 'character',
			characterId: character.id,
		});

		const result = TestDoImmediateAction(
			{
				type: 'create',
				target: {
					type: 'character',
					characterId: character.id,
				},
				container: [],
				itemTemplate: {
					asset: 'a/headwear/top_hat',
				},
				insertBefore: items?.[items.length - 1].id,
			},
			TestCreateActionContext(character),
			intermediateResult.resultState,
		);

		// Check the final result
		TestActionExpectValidResult(result);
		expect(TestStateExtractAssets(result.resultState.characters.get(character.id)?.items)).toMatchSnapshot();
	});
});
