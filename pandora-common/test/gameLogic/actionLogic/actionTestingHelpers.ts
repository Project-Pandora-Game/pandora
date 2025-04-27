import { expect } from '@jest/globals';
import {
	Assert,
	DoImmediateAction,
	EMPTY_ARRAY,
	type AccountId,
	type AppearanceAction,
	type AppearanceActionContext,
	type AppearanceActionProcessingResult,
	type AppearanceActionProcessingResultInvalid,
	type AppearanceActionProcessingResultValid,
	type AppearanceItems,
	type AssetFrameworkGlobalState,
	type AssetId,
	type CharacterId,
	type GameLogicCharacter,
	type SpaceFeature,
} from '../../../src/index.ts';
import { TestVerifyGlobalStateDelta, TestVerifyGlobalStateExportImport } from '../../assets/assetsTestingHelpers.ts';

export function TestCreateActionContext(player: GameLogicCharacter, options?: {
	executionContext?: AppearanceActionContext['executionContext'];
	additionalCharacters?: GameLogicCharacter[];
	spaceFeatures?: readonly SpaceFeature[];
	admins?: readonly AccountId[];
}): AppearanceActionContext {
	if (options?.additionalCharacters != null) {
		// Additional characters are unique
		Assert(options.additionalCharacters.every((c) => c.id !== player.id || c === player));
		Assert(new Set(options.additionalCharacters.map((c) => c.id)).size === options.additionalCharacters.length);
	}

	return {
		executionContext: options?.executionContext ?? 'act',
		player,
		spaceContext: {
			features: options?.spaceFeatures ?? EMPTY_ARRAY,
			development: undefined,
			isAdmin(account) {
				return options?.admins?.includes(account) ?? false;
			},
			getCharacterModifierEffects(_character, _gameState) {
				return EMPTY_ARRAY;
			},
		},
		getCharacter(id: CharacterId): GameLogicCharacter | null {
			if (player.id === id)
				return player;

			return options?.additionalCharacters?.find((c) => c.id === id) ?? null;
		},
	};
}

export function TestDoImmediateAction(
	action: AppearanceAction,
	context: AppearanceActionContext,
	initialState: AssetFrameworkGlobalState,
): AppearanceActionProcessingResult {
	const result = DoImmediateAction(action, context, initialState);
	expect(result.originalState).toBe(initialState);

	if (result.valid) {
		// If result is valid, run some common checks on the resulting state
		expect(result.resultState.isValid()).toBe(true);
		TestVerifyGlobalStateExportImport(result.resultState);
		TestVerifyGlobalStateDelta(result.originalState, result.resultState);
	}

	return result;
}

export function TestActionExpectValidResult(result: AppearanceActionProcessingResult): asserts result is AppearanceActionProcessingResultValid {
	if (!result.valid) {
		expect(result.problems).toEqual([]);
		expect(result.valid).toBe(true);
		Assert(false);
	}
}

export function TestActionExpectFail(result: AppearanceActionProcessingResult): asserts result is AppearanceActionProcessingResultInvalid {
	if (result.valid) {
		expect(result.valid).toBe(false);
		Assert(false);
	}

	expect(result.problems).toMatchSnapshot('problems');
}

type TestSimpleItemDescriptor = {
	asset: AssetId;
	modules?: Record<string, TestSimpleItemDescriptor[]>;
};

export function TestStateExtractAssets(items: AppearanceItems | undefined): TestSimpleItemDescriptor[] | undefined {
	return items?.map((i) => {
		const result: TestSimpleItemDescriptor = {
			asset: i.asset.id,
		};
		for (const [moduleName] of i.getModules()) {
			const moduleItems = TestStateExtractAssets(i.getModuleItems(moduleName));
			if (moduleItems != null && moduleItems.length > 0) {
				result.modules ??= {};
				result.modules[moduleName] = moduleItems;
			}
		}
		return result;
	});
}
