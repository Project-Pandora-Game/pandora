import { Asset } from '../asset';
import { IAssetModuleDefinition, IItemModule, IModuleItemDataCommon, IModuleConfigCommon } from './common';
import { z } from 'zod';
import { AssetDefinitionExtraArgs } from '../definitions';
import { ConditionOperator } from '../graphics';
import { AssetProperties } from '../properties';

export interface IModuleTypedOption<A extends AssetDefinitionExtraArgs = AssetDefinitionExtraArgs> extends AssetProperties<A> {
	/** ID if this variant, must be unique */
	id: string;

	/** The display name of this varint */
	name: string;

	/** If this variant should be autoselected as default; otherwise first one is used */
	default?: true;
}

export interface IModuleConfigTyped<A extends AssetDefinitionExtraArgs = AssetDefinitionExtraArgs> extends IModuleConfigCommon<'typed'> {
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

	loadModule(_asset: Asset, _moduleName: string, config: IModuleConfigTyped, data: IModuleItemDataTyped): ItemModuleTyped {
		return new ItemModuleTyped(config, data);
	}
}

export class ItemModuleTyped implements IItemModule<'typed'> {
	public readonly type = 'typed';

	public readonly config: IModuleConfigTyped;
	public readonly activeVariant: Readonly<IModuleTypedOption>;

	constructor(config: IModuleConfigTyped, data: IModuleItemDataTyped) {
		this.config = config;
		// Get currently selected module
		let activeVariant: IModuleTypedOption | undefined = data.variant != null ? config.variants.find((v) => v.id === data.variant) : undefined;
		// Get the variant marked as default if not found
		if (!activeVariant) {
			activeVariant = config.variants.find((v) => v.default);
		}
		// Use the first variant as last option
		this.activeVariant = activeVariant ?? config.variants[0];
	}

	exportData(): IModuleItemDataTyped {
		return {
			type: 'typed',
			variant: this.activeVariant.id,
		};
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
		}) : null;
	}
}
