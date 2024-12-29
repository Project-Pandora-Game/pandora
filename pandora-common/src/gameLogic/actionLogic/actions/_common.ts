import type { Immutable } from 'immer';
import type { AssetManager } from '../../../assets';
import type { AppearanceActionProcessingContext } from '../appearanceActionProcessingContext';
import type { AppearanceAction } from './_index';

export interface AppearanceActionHandlerArg<Action extends AppearanceAction = AppearanceAction> {
	action: Immutable<Action>;
	assetManager: AssetManager;
	processingContext: AppearanceActionProcessingContext;
}
