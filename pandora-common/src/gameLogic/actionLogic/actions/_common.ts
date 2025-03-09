import type { Immutable } from 'immer';
import type { AssetManager } from '../../../assets/index.ts';
import type { AppearanceActionProcessingContext } from '../appearanceActionProcessingContext.ts';
import type { AppearanceAction } from './_index.ts';

export interface AppearanceActionHandlerArg<Action extends AppearanceAction = AppearanceAction> {
	action: Immutable<Action>;
	assetManager: AssetManager;
	processingContext: AppearanceActionProcessingContext;
}
