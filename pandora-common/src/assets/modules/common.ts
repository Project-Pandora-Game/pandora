import type { Asset } from '../asset';
import { z } from 'zod';
import type { Satisfies } from '../../utility';
import { ConditionOperator } from '../graphics';
import { ItemInteractionType } from '../../character';
import { AssetProperties } from '../properties';
import type { AppearanceItems, AppearanceValidationResult } from '../appearanceValidation';
import type { AssetManager } from '../assetManager';
import type { IItemLoadContext } from '../item';

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
export const IModuleItemDataCommonSchema = z.object({
	type: z.string(),
}).passthrough();
// eslint-disable-next-line @typescript-eslint/naming-convention, @typescript-eslint/no-unused-vars
type __satisfies__IModuleItemDataCommonSchema = Satisfies<z.infer<typeof IModuleItemDataCommonSchema>, IModuleItemDataCommon<string>>;

export interface IAssetModuleDefinition<Type extends string> {
	parseData(asset: Asset, moduleName: string, config: IModuleConfigCommon<Type>, data: unknown, assetMananger: AssetManager): IModuleItemDataCommon<Type>;
	loadModule(asset: Asset, moduleName: string, config: IModuleConfigCommon<Type>, data: unknown, context: IItemLoadContext): IItemModule<Type>;
	getStaticAttributes(config: IModuleConfigCommon<Type>): ReadonlySet<string>;
}

export interface IItemModule<Type extends string = string> {
	readonly type: Type;
	readonly config: IModuleConfigCommon<Type>;

	/** The module specifies what kind of interaction type interacting with it is */
	readonly interactionType: ItemInteractionType;

	exportData(): IModuleItemDataCommon<Type>;

	validate(isWorn: boolean): AppearanceValidationResult;

	getProperties(): AssetProperties;

	evalCondition(operator: ConditionOperator, value: string): boolean;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	doAction(action: any): IItemModule<Type> | null;

	/** If the contained items are physically equipped (meaning they are cheked for 'allow add/remove' when being added and removed) */
	readonly contentsPhysicallyEquipped: boolean;

	/** Gets content of this module */
	getContents(): AppearanceItems;

	/** Sets content of this module */
	setContents(items: AppearanceItems): IItemModule<Type> | null;

	acceptedContentFilter?(asset: Asset): boolean;
}
