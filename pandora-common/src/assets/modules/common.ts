import type { Immutable } from 'immer';
import type { ItemInteractionType } from '../../character/restrictionTypes.ts';
import type { AppearanceModuleActionContext } from '../../gameLogic/actionLogic/appearanceActions.ts';
import type { InteractionId } from '../../gameLogic/interactions/index.ts';
import type { AppearanceValidationResult } from '../appearanceValidation.ts';
import type { Asset } from '../asset.ts';
import type { ConditionEqOperator } from '../graphics/index.ts';
import type { AppearanceItems, IItemCreationContext, IItemLoadContext, IItemValidationContext } from '../item/index.ts';
import type { IAssetModuleTypes, ModuleType } from '../modules.ts';

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
	/**
	 * Name used for displaying this module in the expressions menu.
	 * If set to a non-empty string, then this module appears in the list of expressions.
	 *
	 * @note If this is a `typed` module without explicitly set `interactionType`, then this being set makes `interactionType` default to `ItemInteractionType.EXPRESSION_CHANGE`.
	 */
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
	makeDataFromTemplate<TProperties, TStaticData>(config: Immutable<IAssetModuleTypes<TProperties, TStaticData>[Type]['config']>, template: Immutable<IAssetModuleTypes<TProperties, TStaticData>[Type]['template']>, context: IItemCreationContext): IAssetModuleTypes<TProperties, TStaticData>[Type]['data'] | undefined;
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

	validate(context: IItemValidationContext, asset: Asset): AppearanceValidationResult;

	getProperties(): readonly Immutable<TProperties>[];

	evalCondition(operator: ConditionEqOperator, value: string): boolean;
	doAction(context: AppearanceModuleActionContext, action: IAssetModuleTypes<TProperties, TStaticData>[Type]['actions']): IItemModule<TProperties, TStaticData, Type> | null;
	getActionInteractionType?(action: IAssetModuleTypes<TProperties, TStaticData>[Type]['actions']): ItemInteractionType;

	/** If the contained items are physically equipped (meaning they are cheked for 'allow add/remove' when being added and removed) */
	readonly contentsPhysicallyEquipped: boolean;

	/** Gets content of this module */
	getContents(): AppearanceItems;

	/** Sets content of this module */
	setContents(items: AppearanceItems): IItemModule<TProperties, TStaticData, Type> | null;

	acceptedContentFilter?(asset: Asset): boolean;
}
