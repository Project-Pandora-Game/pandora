import type { Asset } from '../asset';
import { z } from 'zod';
import type { Satisfies } from '../../utility';
import { ConditionOperator } from '../graphics';
import { ItemInteractionType } from '../../character';
import { AssetProperties } from '../properties';

export interface IModuleConfigCommon<Type extends string> {
	type: Type;
	/** The display name of this module */
	name: string;
	/**
	 * The kind of interaction this module provides, affects prerequisites for changing it.
	 * @default ItemInteractionType.MODIFY
	 */
	interactionType?: ItemInteractionType;
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
	parseData(asset: Asset, moduleName: string, config: IModuleItemDataCommon<Type>, data: unknown): IModuleItemDataCommon<Type>;
	loadModule(asset: Asset, moduleName: string, config: IModuleItemDataCommon<Type>, data: unknown): IItemModule<Type>;
}

export interface IItemModule<Type extends string = string> {
	readonly type: Type;
	readonly config: IModuleConfigCommon<Type>;

	exportData(): IModuleItemDataCommon<Type>;

	getProperties(): AssetProperties;

	evalCondition(operator: ConditionOperator, value: string): boolean;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	doAction(action: any): IItemModule<Type> | null;
}
