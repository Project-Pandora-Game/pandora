import { describe, expect, it } from '@jest/globals';
import { AssertNotNullable } from '../../../../src/index.ts';
import { TestAssetsLoadAssetManager } from '../../../assets/_testData/testAssetsDefinition.ts';
import { TestCreateCharacterState, TestCreateGlobalState } from '../../../assets/assetsTestingHelpers.ts';
import { TestCreateGameLogicCharacter } from '../../character/characterTestingHelpers.ts';
import { TestActionExpectFail, TestActionExpectValidResult, TestCreateActionContext, TestDoImmediateAction, TestStateExtractAssets } from '../actionTestingHelpers.ts';

describe('ActionMoveItem', () => {
	it('Reorders item downwards', () => {
		const assetManager = TestAssetsLoadAssetManager();
		const character = TestCreateGameLogicCharacter(1, 'c1');
		const baseState = TestCreateGlobalState(assetManager, null, [
			(room) => TestCreateCharacterState(assetManager, character, room, [
				'a/panties/style1',
				'a/panties/style1',
				'a/headwear/top_hat',
			]),
		]);

		const topHatId = baseState.characters.get(character.id)?.items.find((i) => i.asset.id === 'a/headwear/top_hat')?.id;
		AssertNotNullable(topHatId);

		// Do the action
		const result = TestDoImmediateAction(
			{
				type: 'move',
				target: {
					type: 'character',
					characterId: character.id,
				},
				item: {
					container: [],
					itemId: topHatId,
				},
				shift: -1,
			},
			TestCreateActionContext(character),
			baseState,
		);

		// Check the result
		TestActionExpectValidResult(result);
		expect(TestStateExtractAssets(result.resultState.characters.get(character.id)?.items)).toMatchSnapshot();
	});

	it('Reorders item downwards by more than one', () => {
		const assetManager = TestAssetsLoadAssetManager();
		const character = TestCreateGameLogicCharacter(1, 'c1');
		const baseState = TestCreateGlobalState(assetManager, null, [
			(room) => TestCreateCharacterState(assetManager, character, room, [
				'a/panties/style1',
				'a/panties/style1',
				'a/headwear/top_hat',
			]),
		]);

		const topHatId = baseState.characters.get(character.id)?.items.find((i) => i.asset.id === 'a/headwear/top_hat')?.id;
		AssertNotNullable(topHatId);

		// Do the action
		const result = TestDoImmediateAction(
			{
				type: 'move',
				target: {
					type: 'character',
					characterId: character.id,
				},
				item: {
					container: [],
					itemId: topHatId,
				},
				shift: -2,
			},
			TestCreateActionContext(character),
			baseState,
		);

		// Check the result
		TestActionExpectValidResult(result);
		expect(TestStateExtractAssets(result.resultState.characters.get(character.id)?.items)).toMatchSnapshot();
	});

	it('Reorders item upwards', () => {
		const assetManager = TestAssetsLoadAssetManager();
		const character = TestCreateGameLogicCharacter(1, 'c1');
		const baseState = TestCreateGlobalState(assetManager, null, [
			(room) => TestCreateCharacterState(assetManager, character, room, [
				'a/headwear/top_hat',
				'a/panties/style1',
				'a/panties/style1',
			]),
		]);

		const topHatId = baseState.characters.get(character.id)?.items.find((i) => i.asset.id === 'a/headwear/top_hat')?.id;
		AssertNotNullable(topHatId);

		// Do the action
		const result = TestDoImmediateAction(
			{
				type: 'move',
				target: {
					type: 'character',
					characterId: character.id,
				},
				item: {
					container: [],
					itemId: topHatId,
				},
				shift: 1,
			},
			TestCreateActionContext(character),
			baseState,
		);

		// Check the result
		TestActionExpectValidResult(result);
		expect(TestStateExtractAssets(result.resultState.characters.get(character.id)?.items)).toMatchSnapshot();
	});

	it('Reorders item upwards by more than one', () => {
		const assetManager = TestAssetsLoadAssetManager();
		const character = TestCreateGameLogicCharacter(1, 'c1');
		const baseState = TestCreateGlobalState(assetManager, null, [
			(room) => TestCreateCharacterState(assetManager, character, room, [
				'a/headwear/top_hat',
				'a/panties/style1',
				'a/panties/style1',
			]),
		]);

		const topHatId = baseState.characters.get(character.id)?.items.find((i) => i.asset.id === 'a/headwear/top_hat')?.id;
		AssertNotNullable(topHatId);

		// Do the action
		const result = TestDoImmediateAction(
			{
				type: 'move',
				target: {
					type: 'character',
					characterId: character.id,
				},
				item: {
					container: [],
					itemId: topHatId,
				},
				shift: 2,
			},
			TestCreateActionContext(character),
			baseState,
		);

		// Check the result
		TestActionExpectValidResult(result);
		expect(TestStateExtractAssets(result.resultState.characters.get(character.id)?.items)).toMatchSnapshot();
	});

	it('Fails if reordering between bodyparts', () => {
		const assetManager = TestAssetsLoadAssetManager();
		const character = TestCreateGameLogicCharacter(1, 'c1');
		const baseState = TestCreateGlobalState(assetManager, null, [
			(room) => TestCreateCharacterState(assetManager, character, room, [
				'a/panties/style1',
				'a/panties/style1',
				'a/headwear/top_hat',
			]),
		]);

		const topHatId = baseState.characters.get(character.id)?.items.find((i) => i.asset.id === 'a/headwear/top_hat')?.id;
		AssertNotNullable(topHatId);

		// Do the action
		const result = TestDoImmediateAction(
			{
				type: 'move',
				target: {
					type: 'character',
					characterId: character.id,
				},
				item: {
					container: [],
					itemId: topHatId,
				},
				shift: -4,
			},
			TestCreateActionContext(character),
			baseState,
		);

		// Check the result
		TestActionExpectFail(result);
	});

	it('Fails if reordering out of bounds downwards', () => {
		const assetManager = TestAssetsLoadAssetManager();
		const character = TestCreateGameLogicCharacter(1, 'c1');
		const baseState = TestCreateGlobalState(assetManager, null, [
			(room) => TestCreateCharacterState(assetManager, character, room, [
				'a/panties/style1',
				'a/panties/style1',
				'a/headwear/top_hat',
			]),
		]);

		const topHatId = baseState.characters.get(character.id)?.items.find((i) => i.asset.id === 'a/headwear/top_hat')?.id;
		AssertNotNullable(topHatId);

		// Do the action
		const result = TestDoImmediateAction(
			{
				type: 'move',
				target: {
					type: 'character',
					characterId: character.id,
				},
				item: {
					container: [],
					itemId: topHatId,
				},
				shift: -1000,
			},
			TestCreateActionContext(character),
			baseState,
		);

		// Check the result
		TestActionExpectFail(result);
	});

	it('Fails if reordering out of bounds upwards', () => {
		const assetManager = TestAssetsLoadAssetManager();
		const character = TestCreateGameLogicCharacter(1, 'c1');
		const baseState = TestCreateGlobalState(assetManager, null, [
			(room) => TestCreateCharacterState(assetManager, character, room, [
				'a/headwear/top_hat',
				'a/panties/style1',
				'a/panties/style1',
			]),
		]);

		const topHatId = baseState.characters.get(character.id)?.items.find((i) => i.asset.id === 'a/headwear/top_hat')?.id;
		AssertNotNullable(topHatId);

		// Do the action
		const result = TestDoImmediateAction(
			{
				type: 'move',
				target: {
					type: 'character',
					characterId: character.id,
				},
				item: {
					container: [],
					itemId: topHatId,
				},
				shift: 1000,
			},
			TestCreateActionContext(character),
			baseState,
		);

		// Check the result
		TestActionExpectFail(result);
	});
});
