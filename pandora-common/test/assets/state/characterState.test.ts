import { describe, expect, it } from '@jest/globals';
import { AssetFrameworkGlobalState, AssetFrameworkSpaceState } from '../../../src/index.ts';
import { TestCreateGameLogicCharacter } from '../../gameLogic/character/characterTestingHelpers.ts';
import { TestAssetsLoadAssetManager } from '../_testData/testAssetsDefinition.ts';
import { TestCreateCharacterState } from '../assetsTestingHelpers.ts';

describe('TestCreateCharacterState', () => {
	it('Works and creates a valid state', () => {
		const assetManager = TestAssetsLoadAssetManager();

		const character = TestCreateGameLogicCharacter(1, 'c1');
		const spaceState = AssetFrameworkSpaceState.createDefault(assetManager, null);
		const globalState = AssetFrameworkGlobalState.createDefault(assetManager, spaceState);
		const state = TestCreateCharacterState(assetManager, character, globalState);

		expect(state.isValid(globalState.space)).toBe(true);
		expect(state.id).toBe('c1');
	});
});
