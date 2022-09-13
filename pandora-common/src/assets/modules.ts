import { AssertNever, Satisfies } from '../utility';
import { IAssetModuleDefinition, IModuleItemDataCommon, IModuleConfigCommon, IItemModule } from './modules/common';
import { IModuleItemDataTyped, IModuleConfigTyped, TypedModuleDefinition, ItemModuleTypedActionSchema } from './modules/typed';
import { z } from 'zod';
import { ZodMatcher } from '../validation';
import { Asset } from './asset';
import { BoneName } from './appearance';

//#region Module definitions

export type IAssetModuleTypes<Bones extends BoneName = BoneName> = {
	typed: {
		config: IModuleConfigTyped<Bones>;
		data: IModuleItemDataTyped;
	};
};

export const MODULE_TYPES: { [Type in ModuleType]: IAssetModuleDefinition<Type>; } = {
	typed: new TypedModuleDefinition(),
};

export const ItemModuleActionSchema = ItemModuleTypedActionSchema;
// TODO: When we have more module types
// export const ItemModuleActionSchema = z.discriminatedUnion('moduleType', [
// 	ItemModuleTypedActionSchema,
// ]);
export type ItemModuleAction = z.infer<typeof ItemModuleActionSchema>;

//#endregion

export type ModuleType = keyof IAssetModuleTypes;
export const ModuleTypeSchema = z.enum(Object.keys(MODULE_TYPES) as [ModuleType, ...ModuleType[]]);
export const IsModuleType = ZodMatcher(ModuleTypeSchema);

// eslint-disable-next-line @typescript-eslint/naming-convention, @typescript-eslint/no-unused-vars
type __satisfies__IAssetModuleTypes = Satisfies<IAssetModuleTypes, {
	[Type in ModuleType]: {
		config: IModuleConfigCommon<Type>;
		data: IModuleItemDataCommon<Type>;
	}
}>;

export type AssetModuleDefinition<Bones extends BoneName = BoneName> = IAssetModuleTypes<Bones>[ModuleType]['config'];

export function LoadItemModule(asset: Asset, moduleName: string, data: IModuleItemDataCommon<string> | undefined): IItemModule {
	const moduleDefinition = asset.definition.modules?.[moduleName];
	if (!moduleDefinition) {
		throw new Error('LoadItemModule called with invalid module for asset');
	}

	if (data?.type !== moduleDefinition.type) {
		data = undefined;
	}

	switch (moduleDefinition.type) {
		case 'typed':
			return MODULE_TYPES.typed.loadModule(
				asset,
				moduleName,
				moduleDefinition,
				MODULE_TYPES.typed.parseData(
					asset,
					moduleName,
					moduleDefinition,
					data,
				),
			);
		default:
			AssertNever(moduleDefinition.type);
	}
}
