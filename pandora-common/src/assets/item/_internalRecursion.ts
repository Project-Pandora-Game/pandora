// This file is meant to be internal to pandora-common
// It is only a helper to achieve recursion of items inside modules without introducing cyclic dependencies

import { z, type ZodTypeDef } from 'zod';
import type { ItemBundle, ItemTemplate } from './base.ts';
import { Assert } from '../../utility/misc.ts';

let ItemBundleSchemaReference: z.ZodType<ItemBundle, ZodTypeDef, unknown> | undefined;
// eslint-disable-next-line @typescript-eslint/naming-convention
export const __internal_ItemBundleSchemaRecursive = z.lazy(() => {
	if (ItemBundleSchemaReference == null) {
		throw new Error('Attempt to use _ItemBundleSchemaRecursive before initialization');
	}
	return ItemBundleSchemaReference;
});

let ItemTemplateSchemaReference: z.ZodType<ItemTemplate, ZodTypeDef, unknown> | undefined;
// eslint-disable-next-line @typescript-eslint/naming-convention
export const __internal_ItemTemplateSchemaRecursive = z.lazy(() => {
	if (ItemTemplateSchemaReference == null) {
		throw new Error('Attempt to use _ItemTemplateSchemaRecursive before initialization');
	}
	return ItemTemplateSchemaReference;
});

// eslint-disable-next-line @typescript-eslint/naming-convention
export function __internal_InitRecursiveItemSchemas(
	itemBundleSchema: z.ZodType<ItemBundle, ZodTypeDef, unknown>,
	itemTemplateSchema: z.ZodType<ItemTemplate, ZodTypeDef, unknown>,
): void {
	Assert(ItemBundleSchemaReference === undefined);
	Assert(ItemTemplateSchemaReference === undefined);

	ItemBundleSchemaReference = itemBundleSchema;
	ItemTemplateSchemaReference = itemTemplateSchema;
}
