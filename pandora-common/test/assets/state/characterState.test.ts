import { describe, expect, it } from '@jest/globals';
import { AssetFrameworkSpaceState } from '../../../src/index.ts';
import { TestCreateGameLogicCharacter } from '../../gameLogic/character/characterTestingHelpers.ts';
import { TestAssetsLoadAssetManager } from '../_testData/testAssetsDefinition.ts';
import { TestCreateCharacterState } from '../assetsTestingHelpers.ts';

describe('TestCreateCharacterState', () => {
	it('Works and creates a valid state', () => {
		const assetManager = TestAssetsLoadAssetManager();

		const character = TestCreateGameLogicCharacter(1, 'c1');
		const roomState = AssetFrameworkSpaceState.createDefault(assetManager, null);
		const state = TestCreateCharacterState(assetManager, character, roomState);

		expect(state.isValid(roomState)).toBe(true);
		expect(state.id).toBe('c1');
	});
});
