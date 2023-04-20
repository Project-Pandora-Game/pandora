import type { Asset } from '../asset';
import { ConditionOperator } from '../graphics';
import { ItemInteractionType } from '../../character';
import { AssetProperties } from '../properties';
import type { AppearanceItems, AppearanceValidationResult } from '../appearanceValidation';
import type { AssetManager } from '../assetManager';
import type { IItemLoadContext, IItemLocationDescriptor } from '../item';
import type { ActionMessageTemplateHandler } from '../appearanceTypes';
import type { AppearanceActionContext } from '../appearanceActions';

export interface IModuleConfigCommon<Type extends string> {
	type: Type;
	/** The display name of this module */
	name: string;
	/** If this module is hoisted to expressions */
	expression?: string;
}

export interface IModuleItemDataCommon<Type extends string> {
	type: Type;
}

export interface IAssetModuleDefinition<Type extends string> {
	parseData(asset: Asset, moduleName: string, config: IModuleConfigCommon<Type>, data: unknown, assetManager: AssetManager): IModuleItemDataCommon<Type>;
	loadModule(asset: Asset, moduleName: string, config: IModuleConfigCommon<Type>, data: unknown, context: IItemLoadContext): IItemModule<Type>;
	getStaticAttributes(config: IModuleConfigCommon<Type>): ReadonlySet<string>;
}

export interface IItemModule<Type extends string = string> {
	readonly type: Type;
	readonly config: IModuleConfigCommon<Type>;

	/** The module specifies what kind of interaction type interacting with it is */
	readonly interactionType: ItemInteractionType;

	exportData(): IModuleItemDataCommon<Type>;

	validate(location: IItemLocationDescriptor): AppearanceValidationResult;

	getProperties(): AssetProperties;

	evalCondition(operator: ConditionOperator, value: string): boolean;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	doAction(context: AppearanceActionContext, action: any, messageHandler: ActionMessageTemplateHandler): IItemModule<Type> | null;

	/** If the contained items are physically equipped (meaning they are cheked for 'allow add/remove' when being added and removed) */
	readonly contentsPhysicallyEquipped: boolean;

	/** Gets content of this module */
	getContents(): AppearanceItems;

	/** Sets content of this module */
	setContents(items: AppearanceItems): IItemModule<Type> | null;

	acceptedContentFilter?(asset: Asset): boolean;
}
