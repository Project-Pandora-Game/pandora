import type { Asset } from '../asset';
import type { ConditionOperator } from '../graphics';
import type { ItemInteractionType } from '../../character/restrictionTypes';
import type { AppearanceItems, AppearanceValidationResult } from '../appearanceValidation';
import type { IItemCreationContext, IItemLoadContext, IItemValidationContext } from '../item';
import type { AppearanceModuleActionContext } from '../appearanceActions';
import type { IAssetModuleTypes, ModuleType } from '../modules';
import type { Immutable } from 'immer';
import type { InteractionId } from '../../gameLogic/interactions';

type StaticConfigDataHelper<TStaticData> = TStaticData extends undefined ? {
	staticConfig?: TStaticData;
} : {
	staticConfig: TStaticData;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export type IModuleConfigCommon<Type extends ModuleType, TProperties = unknown, TStaticData = unknown> = StaticConfigDataHelper<TStaticData> & {
	type: Type;
	/** The display name of this module */
	name: string;
	/** If this module is hoisted to expressions */
	expression?: string;
};

export interface IModuleItemDataCommon<Type extends ModuleType> {
	type: Type;
}

export interface IModuleActionCommon<Type extends ModuleType> {
	moduleType: Type;
}

export interface IAssetModuleDefinition<Type extends ModuleType> {
	makeDefaultData<TProperties, TStaticData>(config: Immutable<IAssetModuleTypes<TProperties, TStaticData>[Type]['config']>): IAssetModuleTypes<TProperties, TStaticData>[Type]['data'];
	makeDataFromTemplate<TProperties, TStaticData>(config: Immutable<IAssetModuleTypes<TProperties, TStaticData>[Type]['config']>, template: IAssetModuleTypes<TProperties, TStaticData>[Type]['template'], context: IItemCreationContext): IAssetModuleTypes<TProperties, TStaticData>[Type]['data'] | undefined;
	loadModule<TProperties, TStaticData>(config: Immutable<IAssetModuleTypes<TProperties, TStaticData>[Type]['config']>, data: IAssetModuleTypes<TProperties, TStaticData>[Type]['data'], context: IItemLoadContext): IItemModule<TProperties, TStaticData, Type>;
	getStaticAttributes<TProperties, TStaticData>(config: Immutable<IAssetModuleTypes<TProperties, TStaticData>[Type]['config']>, staticAttributesExtractor: (properties: Immutable<TProperties>) => ReadonlySet<string>): ReadonlySet<string>;
}

export interface IExportOptions {
	clientOnly?: true;
}

export interface IItemModule<out TProperties = unknown, out TStaticData = unknown, Type extends ModuleType = ModuleType> {
	readonly type: Type;
	readonly config: Immutable<IAssetModuleTypes<TProperties, TStaticData>[Type]['config']>;

	/** The module specifies what kind of interaction type interacting with it is */
	readonly interactionType: ItemInteractionType;
	/** The interaction id for the required permission, ignored when type is ACCESS_ONLY  */
	readonly interactionId: InteractionId;

	exportToTemplate(): IAssetModuleTypes<TProperties, TStaticData>[Type]['template'];
	exportData(options: IExportOptions): IAssetModuleTypes<TProperties, TStaticData>[Type]['data'];

	validate(context: IItemValidationContext): AppearanceValidationResult;

	getProperties(): readonly Immutable<TProperties>[];

	evalCondition(operator: ConditionOperator, value: string): boolean;
	doAction(context: AppearanceModuleActionContext, action: IAssetModuleTypes<TProperties, TStaticData>[Type]['actions']): IItemModule<TProperties, TStaticData, Type> | null;

	/** If the contained items are physically equipped (meaning they are cheked for 'allow add/remove' when being added and removed) */
	readonly contentsPhysicallyEquipped: boolean;

	/** Gets content of this module */
	getContents(): AppearanceItems;

	/** Sets content of this module */
	setContents(items: AppearanceItems): IItemModule<TProperties, TStaticData, Type> | null;

	acceptedContentFilter?(asset: Asset): boolean;
}
