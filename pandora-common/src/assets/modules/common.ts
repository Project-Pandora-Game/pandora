import type { Asset } from '../asset';
import type { ConditionOperator } from '../graphics';
import type { ItemInteractionType } from '../../character/restrictionTypes';
import type { AppearanceItems, AppearanceValidationResult } from '../appearanceValidation';
import type { IItemCreationContext, IItemLoadContext, IItemValidationContext } from '../item';
import type { AppearanceModuleActionContext } from '../appearanceActions';
import type { IAssetModuleTypes, ModuleType } from '../modules';
import type { Immutable } from 'immer';
import type { InteractionId } from '../../gameLogic/interactions';

export interface IModuleConfigCommon<Type extends ModuleType, TProperties = unknown> {
	type: Type;
	/** The display name of this module */
	name: string;
	/** If this module is hoisted to expressions */
	expression?: string;
	/**
	 * The name of the room device slot to bind character permission
	 * When a character occupies this slot permission checks will be performed against the character
	 */
	slotName: TProperties extends { slotProperties: { /**/ } | undefined; } ? (string | null) : never;
}

export interface IModuleItemDataCommon<Type extends ModuleType> {
	type: Type;
}

export interface IModuleActionCommon<Type extends ModuleType> {
	moduleType: Type;
}

export interface IAssetModuleDefinition<Type extends ModuleType> {
	makeDefaultData<TProperties>(config: Immutable<IAssetModuleTypes<TProperties>[Type]['config']>): IAssetModuleTypes<TProperties>[Type]['data'];
	makeDataFromTemplate<TProperties>(config: Immutable<IAssetModuleTypes<TProperties>[Type]['config']>, template: IAssetModuleTypes<TProperties>[Type]['template'], context: IItemCreationContext): IAssetModuleTypes<TProperties>[Type]['data'] | undefined;
	loadModule<TProperties>(config: Immutable<IAssetModuleTypes<TProperties>[Type]['config']>, data: IAssetModuleTypes<TProperties>[Type]['data'], context: IItemLoadContext): IItemModule<TProperties, Type>;
	getStaticAttributes<TProperties>(config: Immutable<IAssetModuleTypes<TProperties>[Type]['config']>, staticAttributesExtractor: (properties: Immutable<TProperties>) => ReadonlySet<string>): ReadonlySet<string>;
}

export interface IExportOptions {
	clientOnly?: true;
}

export interface IItemModule<out TProperties = unknown, Type extends ModuleType = ModuleType> {
	readonly type: Type;
	readonly config: Immutable<IAssetModuleTypes<TProperties>[Type]['config']>;

	/** The module specifies what kind of interaction type interacting with it is */
	readonly interactionType: ItemInteractionType;
	/** The interaction id for the required permission, ignored when type is ACCESS_ONLY  */
	readonly interactionId: InteractionId;

	exportToTemplate(): IAssetModuleTypes<TProperties>[Type]['template'];
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
