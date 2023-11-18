import { Assert, AssertNever, ParseArrayNotEmpty, Satisfies } from '../utility';
import { IAssetModuleDefinition, IModuleConfigCommon, IItemModule } from './modules/common';
import { IModuleConfigTyped, TypedModuleDefinition, ItemModuleTypedActionSchema, ModuleItemDataTypedSchema } from './modules/typed';
import { IModuleConfigStorage, StorageModuleDefinition, ItemModuleStorageActionSchema, ModuleItemDataStorageSchema } from './modules/storage';
import { IModuleConfigLockSlot, ItemModuleLockSlotActionSchema, LockSlotModuleDefinition, ModuleItemDataLockSlotSchema } from './modules/lockSlot';
import { ZodDiscriminatedUnionOption, z } from 'zod';
import { RecordUnpackSubobjectProperties } from '../validation';
import { AssetId } from './definitions';
import { IItemLoadContext } from './item';
import { Immutable } from 'immer';

//#region Module definitions

export const IAssetModuleTypesSchemas = {
	typed: {
		data: ModuleItemDataTypedSchema,
		actions: ItemModuleTypedActionSchema,
	},
	storage: {
		data: ModuleItemDataStorageSchema,
		actions: ItemModuleStorageActionSchema,
	},
	lockSlot: {
		data: ModuleItemDataLockSlotSchema,
		actions: ItemModuleLockSlotActionSchema,
	},
} as const satisfies Readonly<Record<string, IModuleTypeBaseSchema>>;

export type IAssetModuleConfigs<TProperties> = Satisfies<{
	typed: IModuleConfigTyped<TProperties>;
	storage: IModuleConfigStorage;
	lockSlot: IModuleConfigLockSlot<TProperties>;
}, { [Type in ModuleType]: IModuleConfigCommon<Type> }>;

export const MODULE_TYPES: { [Type in ModuleType]: IAssetModuleDefinition<Type>; } = {
	typed: new TypedModuleDefinition(),
	storage: new StorageModuleDefinition(),
	lockSlot: new LockSlotModuleDefinition(),
};

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

export type ModuleType = keyof typeof IAssetModuleTypesSchemas;
export const ModuleTypeSchema = z.enum(Object.keys(MODULE_TYPES) as [ModuleType, ...ModuleType[]]);

export type IAssetModuleTypes<TProperties> = {
	[Type in ModuleType]: {
		config: IAssetModuleConfigs<TProperties>[Type];
		data: z.infer<(typeof IAssetModuleTypesSchemas)[Type]['data']>;
		actions: z.infer<(typeof IAssetModuleTypesSchemas)[Type]['actions']>;
	};
};

type IModuleTypeBaseSchema = {
	readonly data: ZodDiscriminatedUnionOption<'type'>;
	readonly actions: ZodDiscriminatedUnionOption<'moduleType'>;
};

export const ItemModuleDataSchema = z.discriminatedUnion('type', ParseArrayNotEmpty(
	Object.values(
		RecordUnpackSubobjectProperties('data', IAssetModuleTypesSchemas),
	),
));
export type ItemModuleData = z.infer<typeof ItemModuleDataSchema>;

export const ItemModuleActionSchema = z.discriminatedUnion('moduleType', ParseArrayNotEmpty(
	Object.values(
		RecordUnpackSubobjectProperties('actions', IAssetModuleTypesSchemas),
	),
));
export type ItemModuleAction = z.infer<typeof ItemModuleActionSchema>;

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

export function LoadItemModule<TProperties>(moduleDefinition: Immutable<AssetModuleDefinition<TProperties>>, rawData: unknown, context: IItemLoadContext): IItemModule<TProperties> {
	let data: ItemModuleData | undefined;
	if (rawData != null) {
		const parsedData = ItemModuleDataSchema.safeParse(rawData);
		if (parsedData.success) {
			data = parsedData.data;
		} else {
			context.logger?.warning(`Invalid module data, ignoring`);
		}
	}

	if (data !== undefined && data.type !== moduleDefinition.type) {
		data = undefined;
	}

	switch (moduleDefinition.type) {
		case 'typed':
			data ??= MODULE_TYPES.typed.makeDefaultData(moduleDefinition);
			Assert(data.type === 'typed');
			return MODULE_TYPES.typed.loadModule(
				moduleDefinition,
				data,
				context,
			);
		case 'storage':
			data ??= MODULE_TYPES.storage.makeDefaultData(moduleDefinition);
			Assert(data.type === 'storage');
			return MODULE_TYPES.storage.loadModule(
				moduleDefinition,
				data,
				context,
			);
		case 'lockSlot':
			data ??= MODULE_TYPES.lockSlot.makeDefaultData(moduleDefinition);
			Assert(data.type === 'lockSlot');
			return MODULE_TYPES.lockSlot.loadModule(
				moduleDefinition,
				data,
				context,
			);
		default:
			AssertNever(moduleDefinition);
	}
}
