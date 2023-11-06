import { AssertNever, Satisfies } from '../utility';
import { IAssetModuleDefinition, IModuleItemDataCommon, IModuleConfigCommon, IItemModule, IModuleActionCommon } from './modules/common';
import { IModuleItemDataTyped, IModuleConfigTyped, TypedModuleDefinition, ItemModuleTypedActionSchema, ItemModuleTypedAction } from './modules/typed';
import { IModuleItemDataStorage, IModuleConfigStorage, StorageModuleDefinition, ItemModuleStorageActionSchema, ItemModuleStorageAction } from './modules/storage';
import { IModuleConfigLockSlot, IModuleItemDataLockSlot, ItemModuleLockSlotAction, ItemModuleLockSlotActionSchema, LockSlotModuleDefinition } from './modules/lockSlot';
import { z } from 'zod';
import { IsObject, ZodMatcher } from '../validation';
import { AssetId } from './definitions';
import { IItemLoadContext } from './item';
import { Immutable } from 'immer';

//#region Module definitions

export type IAssetModuleTypes<TProperties> = {
	typed: {
		config: IModuleConfigTyped<TProperties>;
		data: IModuleItemDataTyped;
		actions: ItemModuleTypedAction;
	};
	storage: {
		config: IModuleConfigStorage;
		data: IModuleItemDataStorage;
		actions: ItemModuleStorageAction;
	};
	lockSlot: {
		config: IModuleConfigLockSlot<TProperties>;
		data: IModuleItemDataLockSlot;
		actions: ItemModuleLockSlotAction;
	};
};

export const MODULE_TYPES: { [Type in ModuleType]: IAssetModuleDefinition<Type>; } = {
	typed: new TypedModuleDefinition(),
	storage: new StorageModuleDefinition(),
	lockSlot: new LockSlotModuleDefinition(),
};

export const ItemModuleActionSchema = z.discriminatedUnion('moduleType', [
	ItemModuleTypedActionSchema,
	ItemModuleStorageActionSchema,
	ItemModuleLockSlotActionSchema,
]);
export type ItemModuleAction = z.infer<typeof ItemModuleActionSchema>;

export type ModuleActionError =
	| {
		type: 'lockInteractionPrevented';
		moduleAction: 'lock' | 'unlock';
		reason: 'blockSelf';
		asset: AssetId;
	}
	| {
		type: 'lockInteractionPrevented';
		moduleAction: 'lock';
		reason: 'noStoredPassword';
		asset: AssetId;
	}
	// Generic catch-all problem, supposed to be used when something simply went wrong (like bad data, target not found, and so on...)
	| {
		type: 'invalid';
	};

export type ModuleActionFailure =
	| {
		type: 'lockInteractionPrevented';
		moduleAction: 'unlock';
		reason: 'wrongPassword';
		asset: AssetId;
	};

//#endregion

export type ModuleType = keyof IAssetModuleTypes<unknown>;
export const ModuleTypeSchema = z.enum(Object.keys(MODULE_TYPES) as [ModuleType, ...ModuleType[]]);
export const IsModuleType = ZodMatcher(ModuleTypeSchema);

type __satisfies__IAssetModuleTypes = Satisfies<IAssetModuleTypes<unknown>, {
	[Type in ModuleType]: {
		config: IModuleConfigCommon<Type>;
		data: IModuleItemDataCommon<Type>;
		actions: IModuleActionCommon<Type>;
	}
}>;

export type AssetModuleDefinition<TProperties> = IAssetModuleTypes<TProperties>[ModuleType]['config'];

export function GetModuleStaticAttributes<TProperties>(moduleDefinition: Immutable<AssetModuleDefinition<TProperties>>, staticAttributesExtractor: (properties: TProperties) => ReadonlySet<string>): ReadonlySet<string> {
	switch (moduleDefinition.type) {
		case 'typed':
			return MODULE_TYPES.typed.getStaticAttributes(moduleDefinition, staticAttributesExtractor);
		case 'storage':
			return MODULE_TYPES.storage.getStaticAttributes(moduleDefinition, staticAttributesExtractor);
		case 'lockSlot':
			return MODULE_TYPES.lockSlot.getStaticAttributes(moduleDefinition, staticAttributesExtractor);
		default:
			AssertNever(moduleDefinition);
	}
}

export function LoadItemModule<TProperties>(moduleDefinition: Immutable<AssetModuleDefinition<TProperties>>, data: unknown, context: IItemLoadContext): IItemModule<TProperties> {
	if (!IsObject(data) || data?.type !== moduleDefinition.type) {
		data = undefined;
	}

	switch (moduleDefinition.type) {
		case 'typed':
			return MODULE_TYPES.typed.loadModule(
				moduleDefinition,
				MODULE_TYPES.typed.parseData(
					moduleDefinition,
					data,
					context.assetManager,
				),
				context,
			);
		case 'storage':
			return MODULE_TYPES.storage.loadModule(
				moduleDefinition,
				MODULE_TYPES.storage.parseData(
					moduleDefinition,
					data,
					context.assetManager,
				),
				context,
			);
		case 'lockSlot':
			return MODULE_TYPES.lockSlot.loadModule(
				moduleDefinition,
				MODULE_TYPES.lockSlot.parseData(
					moduleDefinition,
					data,
					context.assetManager,
				),
				context,
			);
		default:
			AssertNever(moduleDefinition);
	}
}
