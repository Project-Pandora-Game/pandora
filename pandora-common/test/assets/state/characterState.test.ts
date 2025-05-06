import { describe, expect, it } from '@jest/globals';
import { TestAssetsLoadAssetManager } from '../_testData/testAssetsDefinition.ts';
import { TestCreateCharacterState } from '../assetsTestingHelpers.ts';
import { TestCreateGameLogicCharacter } from '../../gameLogic/character/characterTestingHelpers.ts';

describe('TestCreateCharacterState', () => {
	it('Works and creates a valid state', () => {
		const assetManager = TestAssetsLoadAssetManager();

		const character = TestCreateGameLogicCharacter(1, 'c1');
		const state = TestCreateCharacterState(assetManager, character);

		expect(state.isValid(null)).toBe(true);
		expect(state.id).toBe('c1');
	});
});
