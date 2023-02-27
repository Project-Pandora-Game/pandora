import { Asset } from '../asset';
import { IAssetModuleDefinition, IItemModule, IModuleItemDataCommon, IModuleConfigCommon } from './common';
import { z } from 'zod';
import { AssetDefinitionExtraArgs } from '../definitions';
import { ConditionOperator } from '../graphics';
import { AssetProperties } from '../properties';
import { ItemInteractionType } from '../../character/restrictionsManager';
import { AppearanceItems, AppearanceValidationResult } from '../appearanceValidation';
import { IItemLoadContext } from '../item';
import { AssetManager } from '../assetManager';
import type { ActionMessageTemplateHandler } from '../appearanceTypes';
import type { AppearanceActionContext } from '../appearanceActions';
import { CharacterId, CharacterIdSchema } from '../../character/characterTypes';

export interface IModuleTypedOption<A extends AssetDefinitionExtraArgs = AssetDefinitionExtraArgs> extends AssetProperties<A> {
	/** ID if this variant, must be unique */
	id: string;

	/** The display name of this variant */
	name: string;

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
	storeTime?: true,
	/** Variant will store the the character that selected it */
	storeCharacter?: true,

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

export interface IModuleConfigTyped<A extends AssetDefinitionExtraArgs = AssetDefinitionExtraArgs> extends IModuleConfigCommon<'typed'> {
	/**
	 * The kind of interaction this module provides, affects prerequisites for changing it.
	 * @default ItemInteractionType.MODIFY
	 */
	interactionType?: ItemInteractionType;

	/** List of variants this typed module has */
	variants: [IModuleTypedOption<A>, ...IModuleTypedOption<A>[]];
}

export interface IModuleItemDataTyped extends IModuleItemDataCommon<'typed'> {
	variant?: string;
	selectedAt?: number;
	selectedBy?: { name: string; id: CharacterId; };
}
const ModuleItemDataTypedScheme = z.object({
	type: z.literal('typed'),
	variant: z.string().optional(),
	selectedAt: z.number().optional(),
	selectedBy: z.object({
		name: z.string(),
		id: CharacterIdSchema,
	}).optional(),
});

export const ItemModuleTypedActionSchema = z.object({
	moduleType: z.literal('typed'),
	setVariant: z.string(),
});
type ItemModuleTypedAction = z.infer<typeof ItemModuleTypedActionSchema>;

export class TypedModuleDefinition implements IAssetModuleDefinition<'typed'> {

	public parseData(_asset: Asset, _moduleName: string, _config: IModuleConfigTyped, data: unknown): IModuleItemDataTyped {
		const parsed = ModuleItemDataTypedScheme.safeParse(data);
		return parsed.success ? parsed.data : {
			type: 'typed',
		};
	}

	public loadModule(_asset: Asset, _moduleName: string, config: IModuleConfigTyped, data: IModuleItemDataTyped, context: IItemLoadContext): ItemModuleTyped {
		return new ItemModuleTyped(config, data, context);
	}

	public getStaticAttributes(config: IModuleConfigTyped): ReadonlySet<string> {
		const result = new Set<string>();
		for (const option of config.variants) {
			option.attributes?.forEach((a) => result.add(a));
		}
		return result;
	}
}

export class ItemModuleTyped implements IItemModule<'typed'> {
	public readonly type = 'typed';

	private readonly assetManager: AssetManager;
	public readonly config: IModuleConfigTyped;
	public readonly activeVariant: Readonly<IModuleTypedOption>;
	public readonly data: Readonly<IModuleItemDataTyped>;

	public get interactionType(): ItemInteractionType {
		// Interaction can be overridden by config, but defaults to modify (unless this is an expression, then to expression)
		return this.config.interactionType ??
			(this.config.expression != null ? ItemInteractionType.EXPRESSION_CHANGE : ItemInteractionType.MODIFY);
	}

	constructor(config: IModuleConfigTyped, data: IModuleItemDataTyped, context: IItemLoadContext) {
		this.assetManager = context.assetManager;
		this.config = config;
		// Get currently selected module
		const activeVariant: IModuleTypedOption | undefined = data.variant != null ? config.variants.find((v) => v.id === data.variant) : undefined;
		// Warn if we were trying to find variant
		if (!activeVariant && data.variant != null) {
			context.logger?.warning(`Unknown typed module variant '${data.variant}'`);
		}
		// Use the default variant if not found
		this.activeVariant = activeVariant ?? this._getDefaultVariant();

		this.data = {
			...data,
			variant: this.activeVariant.id,
			selectedAt: activeVariant?.storeTime ? data.selectedAt : undefined,
			selectedBy: activeVariant?.storeCharacter ? data.selectedBy : undefined,
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

	public validate(_isWorn: boolean): AppearanceValidationResult {
		return { success: true };
	}

	public getProperties(): AssetProperties {
		return this.activeVariant;
	}

	public evalCondition(operator: ConditionOperator, value: string): boolean {
		return operator === '=' ? this.activeVariant.id === value :
			operator === '!=' ? this.activeVariant.id !== value :
				false;
	}

	public doAction(context: AppearanceActionContext, action: ItemModuleTypedAction, messageHandler: ActionMessageTemplateHandler): ItemModuleTyped | null {
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

		const selectedBy = context.getCharacter(context.player);

		return new ItemModuleTyped(this.config, {
			type: 'typed',
			variant: newVariant.id,
			selectedAt: Date.now(),
			selectedBy: selectedBy == null ? undefined : {
				id: selectedBy.character.id,
				name: selectedBy.character.name,
			},
		}, {
			assetManager: this.assetManager,
			doLoadTimeCleanup: false,
		});
	}

	// Doesn't matter as typed module doesn't support nested content
	public readonly contentsPhysicallyEquipped: boolean = true;

	public getContents(): AppearanceItems {
		return [];
	}

	public setContents(_items: AppearanceItems): ItemModuleTyped | null {
		return null;
	}

	private _getDefaultVariant(): Readonly<IModuleTypedOption> {
		return this.config.variants.find((v) => v.default) ?? this.config.variants[0];
	}
}
