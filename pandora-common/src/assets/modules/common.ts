import type { Asset } from '../asset';
import type { ConditionOperator } from '../graphics';
import type { ItemInteractionType } from '../../character';
import type { AppearanceItems, AppearanceValidationResult } from '../appearanceValidation';
import type { IItemCreationContext, IItemLoadContext, IItemValidationContext } from '../item';
import type { AppearanceModuleActionContext } from '../appearanceActions';
import type { IAssetModuleTypes, ModuleType } from '../modules';
import type { Immutable } from 'immer';

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
	makeDefaultData(config: Immutable<IAssetModuleTypes<unknown>[Type]['config']>): IAssetModuleTypes<unknown>[Type]['data'];
	makeDataFromTemplate<TProperties>(config: Immutable<IAssetModuleTypes<TProperties>[Type]['config']>, template: IAssetModuleTypes<TProperties>[Type]['template'], context: IItemCreationContext): IAssetModuleTypes<TProperties>[Type]['data'] | undefined;
	loadModule<TProperties>(config: Immutable<IAssetModuleTypes<TProperties>[Type]['config']>, data: IAssetModuleTypes<TProperties>[Type]['data'], context: IItemLoadContext): IItemModule<TProperties, Type>;
	getStaticAttributes<TProperties>(config: Immutable<IAssetModuleTypes<unknown>[Type]['config']>, staticAttributesExtractor: (properties: TProperties) => ReadonlySet<string>): ReadonlySet<string>;
}

export interface IExportOptions {
	clientOnly?: true;
}

export interface IItemModule<out TProperties = unknown, Type extends ModuleType = ModuleType> {
	readonly type: Type;
	readonly config: Immutable<IAssetModuleTypes<TProperties>[Type]['config']>;

	/** The module specifies what kind of interaction type interacting with it is */
	readonly interactionType: ItemInteractionType;

	exportData(options: IExportOptions): IAssetModuleTypes<TProperties>[Type]['data'];

	validate(context: IItemValidationContext): AppearanceValidationResult;

	getProperties(): readonly Immutable<TProperties>[];

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
