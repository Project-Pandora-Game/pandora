import { Assert, AssertNever, ParseArrayNotEmpty, Satisfies } from '../utility';
import type { IAssetModuleDefinition, IModuleConfigCommon, IItemModule } from './modules/common';
import { IModuleConfigTyped, TypedModuleDefinition, ItemModuleTypedActionSchema, ModuleItemDataTypedSchema, ModuleItemTemplateTypedSchema } from './modules/typed';
import { IModuleConfigStorage, StorageModuleDefinition, ItemModuleStorageActionSchema, ModuleItemDataStorageSchema, ModuleItemTemplateStorageSchema } from './modules/storage';
import { IModuleConfigLockSlot, ItemModuleLockSlotActionSchema, LockSlotModuleDefinition, ModuleItemDataLockSlotSchema, ModuleItemTemplateLockSlotSchema } from './modules/lockSlot';
import { ZodDiscriminatedUnionOption, z } from 'zod';
import { RecordUnpackSubobjectProperties } from '../validation';
import type { AssetId } from './base';
import type { IItemCreationContext, IItemLoadContext } from './item';
import type { Immutable } from 'immer';

// Fix for pnpm resolution weirdness
import type { } from './item/base';

//#region Module definitions

export const IAssetModuleTypesSchemas = {
	typed: {
		data: ModuleItemDataTypedSchema,
		template: ModuleItemTemplateTypedSchema,
		actions: ItemModuleTypedActionSchema,
	},
	storage: {
		data: ModuleItemDataStorageSchema,
		template: ModuleItemTemplateStorageSchema,
		actions: ItemModuleStorageActionSchema,
	},
	lockSlot: {
		data: ModuleItemDataLockSlotSchema,
		template: ModuleItemTemplateLockSlotSchema,
		actions: ItemModuleLockSlotActionSchema,
	},
} as const satisfies Readonly<Record<string, IModuleTypeBaseSchema>>;

export type IAssetModuleConfigs<TProperties> = Satisfies<{
	typed: IModuleConfigTyped<TProperties>;
	storage: IModuleConfigStorage<TProperties>;
	lockSlot: IModuleConfigLockSlot<TProperties>;
}, { [Type in ModuleType]: IModuleConfigCommon<Type, TProperties> }>;

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
		template: z.infer<(typeof IAssetModuleTypesSchemas)[Type]['template']>;
		actions: z.infer<(typeof IAssetModuleTypesSchemas)[Type]['actions']>;
	};
};

type IModuleTypeBaseSchema = {
	readonly data: ZodDiscriminatedUnionOption<'type'>;
	readonly template: ZodDiscriminatedUnionOption<'type'>;
	readonly actions: ZodDiscriminatedUnionOption<'moduleType'>;
};

export const ItemModuleDataSchema = z.discriminatedUnion('type', ParseArrayNotEmpty(
	Object.values(
		RecordUnpackSubobjectProperties('data', IAssetModuleTypesSchemas),
	),
));
export type ItemModuleData = z.infer<typeof ItemModuleDataSchema>;

export const ItemModuleTemplateSchema = z.discriminatedUnion('type', ParseArrayNotEmpty(
	Object.values(
		RecordUnpackSubobjectProperties('template', IAssetModuleTypesSchemas),
	),
));
export type ItemModuleTemplate = z.infer<typeof ItemModuleTemplateSchema>;

export const ItemModuleActionSchema = z.discriminatedUnion('moduleType', ParseArrayNotEmpty(
	Object.values(
		RecordUnpackSubobjectProperties('actions', IAssetModuleTypesSchemas),
	),
));
export type ItemModuleAction = z.infer<typeof ItemModuleActionSchema>;

export type AssetModuleDefinition<TProperties> = IAssetModuleTypes<TProperties>[ModuleType]['config'];

export function GetModuleStaticAttributes<TProperties>(moduleDefinition: Immutable<AssetModuleDefinition<TProperties>>, staticAttributesExtractor: (properties: Immutable<TProperties>) => ReadonlySet<string>): ReadonlySet<string> {
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

export function CreateModuleDataFromTemplate(moduleDefinition: Immutable<AssetModuleDefinition<unknown>>, template: ItemModuleTemplate, context: IItemCreationContext): ItemModuleData | undefined {
	if (moduleDefinition.type !== template.type) {
		// Fail if the types don't match
		return undefined;
	}

	switch (moduleDefinition.type) {
		case 'typed':
			Assert(template.type === 'typed');
			return MODULE_TYPES.typed.makeDataFromTemplate(
				moduleDefinition,
				template,
				context,
			);
		case 'storage':
			Assert(template.type === 'storage');
			return MODULE_TYPES.storage.makeDataFromTemplate(
				moduleDefinition,
				template,
				context,
			);
		case 'lockSlot':
			Assert(template.type === 'lockSlot');
			return MODULE_TYPES.lockSlot.makeDataFromTemplate(
				moduleDefinition,
				template,
				context,
			);
		default:
			AssertNever(moduleDefinition);
	}
}

export function LoadItemModule<TProperties>(moduleDefinition: Immutable<AssetModuleDefinition<TProperties>>, data: ItemModuleData | undefined, context: IItemLoadContext): IItemModule<TProperties> {
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
