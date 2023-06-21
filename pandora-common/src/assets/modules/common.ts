import type { Asset } from '../asset';
import type { ConditionOperator } from '../graphics';
import type { ItemInteractionType } from '../../character';
import type { AssetProperties } from '../properties';
import type { AppearanceItems, AppearanceValidationResult } from '../appearanceValidation';
import type { AssetManager } from '../assetManager';
import type { IItemLoadContext, IItemLocationDescriptor } from '../item';
import type { AppearanceModuleActionContext } from '../appearanceActions';
import type { IAssetModuleTypes, ModuleType } from '../modules';

export interface IModuleConfigCommon<Type extends ModuleType> {
	type: Type;
	/** The display name of this module */
	name: string;
	/** If this module is hoisted to expressions */
	expression?: string;
}

export interface IModuleItemDataCommon<Type extends ModuleType> {
	type: Type;
}

export interface IModuleActionCommon<Type extends ModuleType> {
	moduleType: Type;
}

export interface IAssetModuleDefinition<Type extends ModuleType> {
	parseData(config: IModuleConfigCommon<Type>, data: unknown, assetManager: AssetManager): IAssetModuleTypes[Type]['data'];
	loadModule(config: IModuleConfigCommon<Type>, data: IAssetModuleTypes[Type]['data'], context: IItemLoadContext): IItemModule<Type>;
	getStaticAttributes(config: IModuleConfigCommon<Type>): ReadonlySet<string>;
}

export interface IExportOptions {
	clientOnly?: true;
}

export interface IItemModule<Type extends ModuleType = ModuleType> {
	readonly type: Type;
	readonly config: IAssetModuleTypes[Type]['config'];

	/** The module specifies what kind of interaction type interacting with it is */
	readonly interactionType: ItemInteractionType;

	exportData(options: IExportOptions): IAssetModuleTypes[Type]['data'];

	validate(location: IItemLocationDescriptor): AppearanceValidationResult;

	getProperties(): AssetProperties;

	evalCondition(operator: ConditionOperator, value: string): boolean;
	doAction(context: AppearanceModuleActionContext, action: IAssetModuleTypes[Type]['actions']): IItemModule<Type> | null;

	/** If the contained items are physically equipped (meaning they are cheked for 'allow add/remove' when being added and removed) */
	readonly contentsPhysicallyEquipped: boolean;

	/** Gets content of this module */
	getContents(): AppearanceItems;

	/** Sets content of this module */
	setContents(items: AppearanceItems): IItemModule<Type> | null;

	acceptedContentFilter?(asset: Asset): boolean;
}
