import { Asset } from '../asset';
import { IAssetModuleDefinition, IItemModule, IModuleItemDataCommon, IModuleConfigCommon } from './common';
import { z } from 'zod';
import { AssetDefinitionExtraArgs } from '../definitions';
import { ConditionOperator } from '../graphics';
import { AssetProperties } from '../properties';
import { ItemInteractionType } from '../../character/restrictionsManager';
import { AppearanceValidationResult } from '../appearanceValidation';
import { IItemLoadContext } from '../item';
import { AssetManager } from '../assetManager';

export interface IModuleTypedOption<A extends AssetDefinitionExtraArgs = AssetDefinitionExtraArgs> extends AssetProperties<A> {
	/** ID if this variant, must be unique */
	id: string;

	/** The display name of this varint */
	name: string;

	/** If this variant should be autoselected as default; otherwise first one is used */
	default?: true;
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
}
const ModuleItemDataTypedScheme = z.object({
	type: z.literal('typed'),
	variant: z.string().optional(),
});

export const ItemModuleTypedActionSchema = z.object({
	moduleType: z.literal('typed'),
	setVariant: z.string(),
});
type ItemModuleTypedAction = z.infer<typeof ItemModuleTypedActionSchema>;

export class TypedModuleDefinition implements IAssetModuleDefinition<'typed'> {

	parseData(_asset: Asset, _moduleName: string, _config: IModuleConfigTyped, data: unknown): IModuleItemDataTyped {
		const parsed = ModuleItemDataTypedScheme.safeParse(data);
		return parsed.success ? parsed.data : {
			type: 'typed',
		};
	}

	loadModule(_asset: Asset, _moduleName: string, config: IModuleConfigTyped, data: IModuleItemDataTyped, context: IItemLoadContext): ItemModuleTyped {
		return new ItemModuleTyped(config, data, context);
	}
}

export class ItemModuleTyped implements IItemModule<'typed'> {
	public readonly type = 'typed';

	private readonly assetMananger: AssetManager;
	public readonly config: IModuleConfigTyped;
	public readonly activeVariant: Readonly<IModuleTypedOption>;

	public get interactionType(): ItemInteractionType {
		return this.config.interactionType ?? ItemInteractionType.MODIFY;
	}

	constructor(config: IModuleConfigTyped, data: IModuleItemDataTyped, context: IItemLoadContext) {
		this.assetMananger = context.assetMananger;
		this.config = config;
		// Get currently selected module
		const activeVariant: IModuleTypedOption | undefined = data.variant != null ? config.variants.find((v) => v.id === data.variant) : undefined;
		// Warn if we were trying to find variant
		if (!activeVariant && data.variant != null) {
			context.logger?.warning(`Unknown typed module variant '${data.variant}'`);
		}
		// Use the default variant if not found
		this.activeVariant = activeVariant ??
			// First variant marked as 'default'
			config.variants.find((v) => v.default) ??
			// The first variant as last resort
			config.variants[0];
	}

	exportData(): IModuleItemDataTyped {
		return {
			type: 'typed',
			variant: this.activeVariant.id,
		};
	}

	validate(_isWorn: boolean): AppearanceValidationResult {
		return true;
	}

	getProperties(): AssetProperties {
		return this.activeVariant;
	}

	evalCondition(operator: ConditionOperator, value: string): boolean {
		return operator === '=' ? this.activeVariant.id === value :
			operator === '!=' ? this.activeVariant.id !== value :
				false;
	}

	doAction(action: ItemModuleTypedAction): ItemModuleTyped | null {
		const setVariant = this.config.variants.find((v) => v.id === action.setVariant);
		return setVariant ? new ItemModuleTyped(this.config, {
			type: 'typed',
			variant: setVariant.id,
		}, {
			assetMananger: this.assetMananger,
			doLoadTimeCleanup: false,
		}) : null;
	}
}
