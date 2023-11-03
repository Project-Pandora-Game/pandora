import type { Asset } from '../asset';
import type { ConditionOperator } from '../graphics';
import type { ItemInteractionType } from '../../character';
import type { AppearanceItems, AppearanceValidationResult } from '../appearanceValidation';
import type { AssetManager } from '../assetManager';
import type { IItemLoadContext, IItemValidationContext } from '../item';
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
	parseData(config: IModuleConfigCommon<Type>, data: unknown, assetManager: AssetManager): IAssetModuleTypes<unknown>[Type]['data'];
	loadModule<TProperties>(config: IModuleConfigCommon<Type>, data: IAssetModuleTypes<unknown>[Type]['data'], context: IItemLoadContext): IItemModule<TProperties, Type>;
	getStaticAttributes<TProperties>(config: IModuleConfigCommon<Type>, staticAttributesExtractor: (properties: TProperties) => ReadonlySet<string>): ReadonlySet<string>;
}

export interface IExportOptions {
	clientOnly?: true;
}

export interface IItemModule<out TProperties = unknown, Type extends ModuleType = ModuleType> {
	readonly type: Type;
	readonly config: IAssetModuleTypes<TProperties>[Type]['config'];

	/** The module specifies what kind of interaction type interacting with it is */
	readonly interactionType: ItemInteractionType;

	exportData(options: IExportOptions): IAssetModuleTypes<TProperties>[Type]['data'];

	validate(context: IItemValidationContext): AppearanceValidationResult;

	getProperties(): readonly TProperties[];

	evalCondition(operator: ConditionOperator, value: string): boolean;
	doAction(context: AppearanceModuleActionContext, action: IAssetModuleTypes<TProperties>[Type]['actions']): IItemModule<TProperties, Type> | null;

	/** If the contained items are physically equipped (meaning they are cheked for 'allow add/remove' when being added and removed) */
	readonly contentsPhysicallyEquipped: boolean;

	/** Gets content of this module */
	getContents(): AppearanceItems;

	/** Sets content of this module */
	setContents(items: AppearanceItems): IItemModule<TProperties, Type> | null;

	acceptedContentFilter?(asset: Asset): boolean;
}
