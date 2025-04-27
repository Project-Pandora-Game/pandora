import { describe, expect, it } from '@jest/globals';
import { AssertNotNullable } from '../../../../src/index.ts';
import { TestAssetsLoadAssetManager } from '../../../assets/_testData/testAssetsDefinition.ts';
import { TestCreateCharacterState, TestCreateGlobalState } from '../../../assets/assetsTestingHelpers.ts';
import { TestCreateGameLogicCharacter } from '../../character/characterTestingHelpers.ts';
import { TestActionExpectFail, TestActionExpectValidResult, TestCreateActionContext, TestDoImmediateAction, TestStateExtractAssets } from '../actionTestingHelpers.ts';

describe('ActionDelete', () => {
	it('Deletes worn item', () => {
		const assetManager = TestAssetsLoadAssetManager();
		const character = TestCreateGameLogicCharacter(1, 'c1');
		const baseState = TestCreateGlobalState(assetManager, [
			TestCreateCharacterState(assetManager, character, [
				'a/panties/style1',
				'a/panties/style1',
				'a/headwear/top_hat',
			]),
		]);

		const secondPantiesId = baseState.characters.get(character.id)?.items.findLast((i) => i.asset.id === 'a/headwear/top_hat')?.id;
		AssertNotNullable(secondPantiesId);

		// Do the action
		const result = TestDoImmediateAction(
			{
				type: 'delete',
				target: {
					type: 'character',
					characterId: character.id,
				},
				item: {
					container: [],
					itemId: secondPantiesId,
				},
			},
			TestCreateActionContext(character),
			baseState,
		);

		// Check the result
		TestActionExpectValidResult(result);
		expect(TestStateExtractAssets(result.resultState.characters.get(character.id)?.items)).toMatchSnapshot();
	});

	it('Deletes optional bodypart item', () => {
		const assetManager = TestAssetsLoadAssetManager();
		const character = TestCreateGameLogicCharacter(1, 'c1');
		const baseState = TestCreateGlobalState(assetManager, [
			TestCreateCharacterState(assetManager, character, [
				'a/body/front_hair1',
				'a/headwear/top_hat',
			]),
		]);

		const hairId = baseState.characters.get(character.id)?.items.findLast((i) => i.asset.id === 'a/body/front_hair1')?.id;
		AssertNotNullable(hairId);

		// Do the action
		const result = TestDoImmediateAction(
			{
				type: 'delete',
				target: {
					type: 'character',
					characterId: character.id,
				},
				item: {
					container: [],
					itemId: hairId,
				},
			},
			TestCreateActionContext(character),
			baseState,
		);

		// Check the result
		TestActionExpectValidResult(result);
		expect(TestStateExtractAssets(result.resultState.characters.get(character.id)?.items)).toMatchSnapshot();
	});

	it('Fails if manipulating bodypart in space that does not allow it', () => {
		const assetManager = TestAssetsLoadAssetManager();
		const character = TestCreateGameLogicCharacter(1, 'c1');
		const baseState = TestCreateGlobalState(assetManager, [
			TestCreateCharacterState(assetManager, character, [
				'a/headwear/top_hat',
			]),
		]);

		const eyesId = baseState.characters.get(character.id)?.items.find((i) => i.asset.id === 'a/body/eyes')?.id;
		AssertNotNullable(eyesId);

		// Do the action
		const result = TestDoImmediateAction(
			{
				type: 'delete',
				target: {
					type: 'character',
					characterId: character.id,
				},
				item: {
					container: [],
					itemId: eyesId,
				},
			},
			TestCreateActionContext(character),
			baseState,
		);

		// Check the result
		TestActionExpectFail(result);
	});

	it('Fails if deleting required bodypart', () => {
		const assetManager = TestAssetsLoadAssetManager();
		const character = TestCreateGameLogicCharacter(1, 'c1');
		const baseState = TestCreateGlobalState(assetManager, [
			TestCreateCharacterState(assetManager, character, [
				'a/headwear/top_hat',
			]),
		]);

		const eyesId = baseState.characters.get(character.id)?.items.find((i) => i.asset.id === 'a/body/eyes')?.id;
		AssertNotNullable(eyesId);

		// Do the action
		const result = TestDoImmediateAction(
			{
				type: 'delete',
				target: {
					type: 'character',
					characterId: character.id,
				},
				item: {
					container: [],
					itemId: eyesId,
				},
			},
			TestCreateActionContext(character, { spaceFeatures: ['allowBodyChanges'] }),
			baseState,
		);

		// Check the result
		TestActionExpectFail(result);
	});

	it('Fails if deleting nonexistent item', () => {
		const assetManager = TestAssetsLoadAssetManager();
		const character = TestCreateGameLogicCharacter(1, 'c1');
		const baseState = TestCreateGlobalState(assetManager, [
			TestCreateCharacterState(assetManager, character),
		]);

		// Do the action
		const result = TestDoImmediateAction(
			{
				type: 'delete',
				target: {
					type: 'character',
					characterId: character.id,
				},
				item: {
					container: [],
					itemId: 'i/i-definitely-do-not-exist',
				},
			},
			TestCreateActionContext(character),
			baseState,
		);

		// Check the result
		TestActionExpectFail(result);
	});
});
