import type { Immutable } from 'immer';
import { ZodDiscriminatedUnionOption, z } from 'zod';
import type { LockActionLockProblem, LockActionShowPasswordProblem, LockActionUnlockProblem, LockActionUpdateFingerprintProblem } from '../gameLogic/locks/lockLogic.ts';
import { Assert, AssertNever, ParseArrayNotEmpty, Satisfies } from '../utility/misc.ts';
import { RecordUnpackSubobjectProperties } from '../validation.ts';
import type { AssetId } from './base.ts';
import type { IItemCreationContext, IItemLoadContext } from './item/index.ts';
import type { IAssetModuleDefinition, IItemModule, IModuleConfigCommon } from './modules/common.ts';
import { IModuleConfigLockSlot, ItemModuleLockSlotActionSchema, LockSlotModuleDefinition, ModuleItemDataLockSlotSchema, ModuleItemTemplateLockSlotSchema } from './modules/lockSlot.ts';
import { IModuleConfigStorage, ItemModuleStorageActionSchema, ModuleItemDataStorageSchema, ModuleItemTemplateStorageSchema, StorageModuleDefinition } from './modules/storage.ts';
import { ItemModuleTextActionSchema, ModuleItemDataTextSchema, ModuleItemTemplateTextSchema, TextModuleDefinition, type ModuleConfigText } from './modules/text.ts';
import { IModuleConfigTyped, ItemModuleTypedActionSchema, ModuleItemDataTypedSchema, ModuleItemTemplateTypedSchema, TypedModuleDefinition } from './modules/typed.ts';

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
	text: {
		data: ModuleItemDataTextSchema,
		template: ModuleItemTemplateTextSchema,
		actions: ItemModuleTextActionSchema,
	},
} as const satisfies Readonly<Record<string, IModuleTypeBaseSchema>>;

export type IAssetModuleConfigs<out TProperties, out TStaticData> = Satisfies<{
	typed: IModuleConfigTyped<TProperties, TStaticData>;
	storage: IModuleConfigStorage<TProperties, TStaticData>;
	lockSlot: IModuleConfigLockSlot<TProperties, TStaticData>;
	text: ModuleConfigText<TProperties, TStaticData>;
}, { [Type in ModuleType]: IModuleConfigCommon<Type, TProperties, TStaticData> }>;

export const MODULE_TYPES: { [Type in ModuleType]: IAssetModuleDefinition<Type>; } = {
	typed: new TypedModuleDefinition(),
	storage: new StorageModuleDefinition(),
	lockSlot: new LockSlotModuleDefinition(),
	text: new TextModuleDefinition(),
};

/** Problems performing actions on modules */
export type ModuleActionProblem =
	| {
		type: 'lockInteractionPrevented';
		moduleAction: 'lock';
		reason: LockActionLockProblem;
		asset: AssetId;
		itemName: string;
	}
	| {
		type: 'lockInteractionPrevented';
		moduleAction: 'unlock';
		reason: LockActionUnlockProblem;
		asset: AssetId;
		itemName: string;
	} | {
		type: 'lockInteractionPrevented';
		moduleAction: 'showPassword';
		reason: LockActionShowPasswordProblem;
		asset: AssetId;
		itemName: string;
	} | {
		type: 'lockInteractionPrevented';
		moduleAction: 'updateFingerprint';
		reason: LockActionUpdateFingerprintProblem;
		asset: AssetId;
		itemName: string;
	}
	// Generic catch-all problem, supposed to be used when something simply went wrong (like bad data, target not found, and so on...)
	| {
		type: 'invalid';
	};

export type ModuleActionData =
	| {
		moduleAction: 'showPassword';
		password: string;
	};

//#endregion

export type ModuleType = keyof typeof IAssetModuleTypesSchemas;
export const ModuleTypeSchema = z.enum(Object.keys(MODULE_TYPES) as [ModuleType, ...ModuleType[]]);

export type IAssetModuleTypes<out TProperties, out TStaticData> = {
	[Type in ModuleType]: {
		config: IAssetModuleConfigs<TProperties, TStaticData>[Type];
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

export type AssetModuleDefinition<TProperties, TStaticData> = IAssetModuleTypes<TProperties, TStaticData>[ModuleType]['config'];

export function GetModuleStaticAttributes<TProperties, TStaticData>(moduleDefinition: Immutable<AssetModuleDefinition<TProperties, TStaticData>>, staticAttributesExtractor: (properties: Immutable<TProperties>) => ReadonlySet<string>): ReadonlySet<string> {
	switch (moduleDefinition.type) {
		case 'typed':
			return MODULE_TYPES.typed.getStaticAttributes(moduleDefinition, staticAttributesExtractor);
		case 'storage':
			return MODULE_TYPES.storage.getStaticAttributes(moduleDefinition, staticAttributesExtractor);
		case 'lockSlot':
			return MODULE_TYPES.lockSlot.getStaticAttributes(moduleDefinition, staticAttributesExtractor);
		case 'text':
			return MODULE_TYPES.text.getStaticAttributes(moduleDefinition, staticAttributesExtractor);
		default:
			AssertNever(moduleDefinition);
	}
}

export function CreateModuleDataFromTemplate<TProperties, TStaticData>(moduleDefinition: Immutable<AssetModuleDefinition<TProperties, TStaticData>>, template: Immutable<ItemModuleTemplate>, context: IItemCreationContext): ItemModuleData | undefined {
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
		case 'text':
			Assert(template.type === 'text');
			return MODULE_TYPES.text.makeDataFromTemplate(
				moduleDefinition,
				template,
				context,
			);
		default:
			AssertNever(moduleDefinition);
	}
}

export function LoadItemModule<TProperties, TStaticData>(moduleDefinition: Immutable<AssetModuleDefinition<TProperties, TStaticData>>, data: ItemModuleData | undefined, context: IItemLoadContext): IItemModule<TProperties, TStaticData> {
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
		case 'text':
			data ??= MODULE_TYPES.text.makeDefaultData(moduleDefinition);
			Assert(data.type === 'text');
			return MODULE_TYPES.text.loadModule(
				moduleDefinition,
				data,
				context,
			);
		default:
			AssertNever(moduleDefinition);
	}
}
