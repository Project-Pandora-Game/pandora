import { Immutable } from 'immer';
import { z } from 'zod';
import { CharacterIdSchema } from '../../character/characterTypes';
import { ItemInteractionType } from '../../character/restrictionTypes';
import type { InteractionId } from '../../gameLogic/interactions';
import { Satisfies } from '../../utility/misc';
import type { AppearanceModuleActionContext } from '../appearanceActions';
import type { AppearanceItems, AppearanceValidationResult } from '../appearanceValidation';
import type { AssetManager } from '../assetManager';
import type { ConditionOperator } from '../graphics';
import type { IItemCreationContext, IItemLoadContext, IItemValidationContext } from '../item';
import { IAssetModuleDefinition, IItemModule, IModuleActionCommon, IModuleConfigCommon, IModuleItemDataCommon } from './common';

export interface IModuleTypedOption<TProperties> {
	/** ID if this variant, must be unique */
	id: string;

	/** The display name of this variant */
	name: string;

	/** The properties this option applies */
	properties?: TProperties;

	/** If this variant should be autoselected as default; otherwise first one is used */
	default?: true;

	/**
	 * Message to show when switching to this variant.
	 * Can be either:
	 * - string, which is shown always
	 * - Object which maps previous setting to message to switch from it (with `_` usable as default)
	 */
	switchMessage?: string | Partial<Record<string | '_', string>>;

	/** Variant will store the time it was selected */
	storeTime?: true;
	/** Variant will store the the character that selected it */
	storeCharacter?: true;

	/**
	 * Custom text to show when this variant is selected.
	 *
	 * Each element of the array is displayed on a separate line.
	 *
	 * Replacements:
	 *  - CHARACTER_NAME is replaced with the name of the character
	 *  - CHARACTER_ID is replaced with the ID of the character
	 *  - CHARACTER is replaced with `CHARACTER_NAME (CHARACTER_ID)`
	 *  - TIME is replaced with the time the variant was selected
	 *  - TIME_PASSED is replaced with the time passed since the variant was selected
	 */
	customText?: string[];
}

export type IModuleConfigTyped<TProperties, TStaticData> = IModuleConfigCommon<'typed', TProperties, TStaticData> & {
	/**
	 * The kind of interaction this module provides, affects prerequisites for changing it.
	 * @default ItemInteractionType.MODIFY
	 */
	interactionType?: ItemInteractionType;

	/** List of variants this typed module has */
	variants: [IModuleTypedOption<TProperties>, ...IModuleTypedOption<TProperties>[]];
};

export const ModuleItemDataTypedSchema = z.object({
	type: z.literal('typed'),
	variant: z.string().optional(),
	selectedAt: z.number().optional(),
	selectedBy: z.object({
		name: z.string(),
		id: CharacterIdSchema,
	}).optional(),
});
export type IModuleItemDataTyped = Satisfies<z.infer<typeof ModuleItemDataTypedSchema>, IModuleItemDataCommon<'typed'>>;

export const ModuleItemTemplateTypedSchema = z.object({
	type: z.literal('typed'),
	variant: z.string().optional(),
});
export type IModuleItemTemplateTyped = z.infer<typeof ModuleItemTemplateTypedSchema>;

export const ItemModuleTypedActionSchema = z.object({
	moduleType: z.literal('typed'),
	setVariant: z.string(),
});
export type ItemModuleTypedAction = Satisfies<z.infer<typeof ItemModuleTypedActionSchema>, IModuleActionCommon<'typed'>>;

export class TypedModuleDefinition implements IAssetModuleDefinition<'typed'> {
	public makeDefaultData<TProperties, TStaticData>(_config: Immutable<IModuleConfigTyped<TProperties, TStaticData>>): IModuleItemDataTyped {
		return {
			type: 'typed',
		};
	}

	public makeDataFromTemplate<TProperties, TStaticData>(config: Immutable<IModuleConfigTyped<TProperties, TStaticData>>, template: IModuleItemTemplateTyped, context: IItemCreationContext): IModuleItemDataTyped | undefined {
		// Find which variant would be selected
		const variant = config.variants.find((v) => v.id === template.variant);
		if (variant == null)
			return undefined;

		// Create result data
		const result: IModuleItemDataTyped = {
			type: 'typed',
			variant: variant.id,
		};

		if (variant.storeTime) {
			result.selectedAt = Date.now();
		}

		if (variant.storeCharacter) {
			result.selectedBy = {
				id: context.creator.id,
				name: context.creator.name,
			};
		}

		return result;
	}

	public loadModule<TProperties, TStaticData>(config: Immutable<IModuleConfigTyped<TProperties, TStaticData>>, data: IModuleItemDataTyped, context: IItemLoadContext): ItemModuleTyped<TProperties, TStaticData> {
		return ItemModuleTyped.loadFromData(config, data, context);
	}

	public getStaticAttributes<TProperties, TStaticData>(config: Immutable<IModuleConfigTyped<TProperties, TStaticData>>, staticAttributesExtractor: (properties: Immutable<TProperties>) => ReadonlySet<string>): ReadonlySet<string> {
		const result = new Set<string>();
		for (const option of config.variants) {
			if (option.properties != null) {
				staticAttributesExtractor(option.properties)
					.forEach((a) => result.add(a));
			}
		}
		return result;
	}
}

interface ItemModuleTypedProps<TProperties, TStaticData> {
	readonly assetManager: AssetManager;
	readonly config: Immutable<IModuleConfigTyped<TProperties, TStaticData>>;
	readonly activeVariant: Immutable<IModuleTypedOption<TProperties>>;
	readonly data: Readonly<Pick<IModuleItemDataTyped, 'selectedAt' | 'selectedBy'>>;
}

export class ItemModuleTyped<out TProperties = unknown, out TStaticData = unknown> implements IItemModule<TProperties, TStaticData, 'typed'>, ItemModuleTypedProps<TProperties, TStaticData> {
	public readonly type = 'typed';

	public readonly assetManager: AssetManager;
	public readonly config: Immutable<IModuleConfigTyped<TProperties, TStaticData>>;
	public readonly activeVariant: Immutable<IModuleTypedOption<TProperties>>;
	public readonly data: Readonly<Pick<IModuleItemDataTyped, 'selectedAt' | 'selectedBy'>>;

	public get interactionType(): ItemInteractionType {
		// Interaction can be overridden by config, but defaults to modify (unless this is an expression, then to expression)
		return this.config.interactionType ??
			(this.config.expression != null ? ItemInteractionType.EXPRESSION_CHANGE : ItemInteractionType.MODIFY);
	}

	public readonly interactionId: InteractionId = 'useTypedModule';

	protected constructor(props: ItemModuleTypedProps<TProperties, TStaticData>, overrideProps?: Partial<ItemModuleTypedProps<TProperties, TStaticData>>) {
		this.assetManager = overrideProps?.assetManager ?? props.assetManager;
		this.config = overrideProps?.config ?? props.config;
		this.activeVariant = overrideProps?.activeVariant ?? props.activeVariant;
		this.data = overrideProps?.data ?? props.data;
	}

	protected withProps(overrideProps: Partial<ItemModuleTypedProps<TProperties, TStaticData>>): ItemModuleTyped<TProperties, TStaticData> {
		return new ItemModuleTyped(this, overrideProps);
	}

	public static loadFromData<TProperties, TStaticData>(config: Immutable<IModuleConfigTyped<TProperties, TStaticData>>, data: IModuleItemDataTyped, context: IItemLoadContext): ItemModuleTyped<TProperties, TStaticData> {
		// Get currently selected module
		const activeVariant: Immutable<IModuleTypedOption<TProperties>> | undefined = data.variant != null ? config.variants.find((v) => v.id === data.variant) : undefined;
		// Warn if we were trying to find variant
		if (!activeVariant && data.variant != null) {
			context.logger?.warning(`Unknown typed module variant '${data.variant}'`);
		}

		return new ItemModuleTyped({
			assetManager: context.assetManager,
			config,
			// Use the default variant if not found
			activeVariant: activeVariant ?? ItemModuleTyped._getDefaultVariant<TProperties, TStaticData>(config),
			data: {
				selectedAt: activeVariant?.storeTime ? data.selectedAt : undefined,
				selectedBy: activeVariant?.storeCharacter ? data.selectedBy : undefined,
			},
		});
	}

	public exportToTemplate(): IModuleItemTemplateTyped {
		return {
			type: 'typed',
			variant: this.activeVariant.id,
		};
	}

	public exportData(): IModuleItemDataTyped {
		const variant = this.activeVariant;
		return {
			type: 'typed',
			variant: variant.id,
			selectedAt: variant.storeTime ? this.data.selectedAt : undefined,
			selectedBy: variant.storeCharacter ? this.data.selectedBy : undefined,
		};
	}

	public validate(_context: IItemValidationContext): AppearanceValidationResult {
		return { success: true };
	}

	public getProperties(): readonly Immutable<TProperties>[] {
		if (this.activeVariant.properties != null)
			return [this.activeVariant.properties];

		return [];
	}

	public evalCondition(operator: ConditionOperator, value: string): boolean {
		return operator === '=' ? this.activeVariant.id === value :
			operator === '!=' ? this.activeVariant.id !== value :
				false;
	}

	public doAction({ messageHandler, processingContext }: AppearanceModuleActionContext, action: ItemModuleTypedAction): ItemModuleTyped<TProperties, TStaticData> | null {
		const newVariant = this.config.variants.find((v) => v.id === action.setVariant);
		if (!newVariant)
			return null;

		// Get chat message about switching to this variant
		const switchMessage = newVariant.switchMessage == null ? undefined :
			// If switch message is a string, use it
			typeof newVariant.switchMessage === 'string' ? newVariant.switchMessage :
				// Otherwise try to get message for previous variant, falling back to default
				(newVariant.switchMessage[this.activeVariant.id] ?? newVariant.switchMessage._);

		// If we have non-empty switch message, queue it
		if (switchMessage) {
			messageHandler({
				id: 'custom',
				customText: switchMessage,
			});
		}

		return this.withProps({
			activeVariant: newVariant,
			data: {
				selectedAt: Date.now(),
				selectedBy: {
					id: processingContext.player.id,
					name: processingContext.player.name,
				},
			},
		});
	}

	// Doesn't matter as typed module doesn't support nested content
	public readonly contentsPhysicallyEquipped: boolean = true;

	public getContents(): AppearanceItems {
		return [];
	}

	public setContents(_items: AppearanceItems): ItemModuleTyped<TProperties, TStaticData> | null {
		return null;
	}

	private static _getDefaultVariant<TProperties, TStaticData>(config: Immutable<IModuleConfigTyped<TProperties, TStaticData>>): Immutable<IModuleTypedOption<TProperties>> {
		return config.variants.find((v) => v.default) ?? config.variants[0];
	}
}
