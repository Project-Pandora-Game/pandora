import { Immutable } from 'immer';
import { z } from 'zod';
import { ItemInteractionType } from '../../character/restrictionTypes.ts';
import type { AppearanceModuleActionContext } from '../../gameLogic/actionLogic/appearanceActions.ts';
import type { InteractionId } from '../../gameLogic/interactions/index.ts';
import { LIMIT_ITEM_MODULE_TEXT_LENGTH } from '../../inputLimits.ts';
import { PandoraFontTypeSchema, type PandoraFontType } from '../../utility/fonts.ts';
import { Satisfies } from '../../utility/misc.ts';
import { AppearanceValidationResult } from '../appearanceValidation.ts';
import type { Asset } from '../asset.ts';
import type { AssetManager } from '../assetManager.ts';
import { ConditionOperator } from '../graphics/index.ts';
import { IItemCreationContext, IItemLoadContext, IItemValidationContext } from '../item/base.ts';
import type { AppearanceItems } from '../item/index.ts';
import { IAssetModuleDefinition, IExportOptions, IItemModule, IModuleActionCommon, IModuleConfigCommon, IModuleItemDataCommon } from './common.ts';

export type ModuleConfigText<TProperties, TStaticData> = IModuleConfigCommon<'text', TProperties, TStaticData> & {
	maxLength: number;
};

export const ModuleItemDataTextTextSchema = z.string()
	.max(LIMIT_ITEM_MODULE_TEXT_LENGTH)
	.regex(/^(?:[^\p{C}]|\n)*$/gu);

export const ModuleItemDataTextAlignSchema = z.enum(['left', 'center', 'right']);
export type ModuleItemDataTextAlign = z.infer<typeof ModuleItemDataTextAlignSchema>;

export const ModuleItemDataTextSchema = z.object({
	type: z.literal('text'),
	text: ModuleItemDataTextTextSchema.catch(''),
	font: PandoraFontTypeSchema.catch('inter'),
	align: ModuleItemDataTextAlignSchema.catch('center'),
});
export type ModuleItemDataText = Satisfies<z.infer<typeof ModuleItemDataTextSchema>, IModuleItemDataCommon<'text'>>;

export const ModuleItemTemplateTextSchema = z.object({
	type: z.literal('text'),
	text: ModuleItemDataTextTextSchema.catch(''),
	font: PandoraFontTypeSchema.catch('inter'),
	align: ModuleItemDataTextAlignSchema.catch('center'),
});
export type ModuleItemTemplateText = z.infer<typeof ModuleItemTemplateTextSchema>;

export const ItemModuleTextActionSchema = z.object({
	moduleType: z.literal('text'),
	setText: ModuleItemDataTextTextSchema,
	setFont: PandoraFontTypeSchema,
	setAlign: ModuleItemDataTextAlignSchema,
});
export type ItemModuleTextAction = Satisfies<z.infer<typeof ItemModuleTextActionSchema>, IModuleActionCommon<'text'>>;

export class TextModuleDefinition implements IAssetModuleDefinition<'text'> {
	public makeDefaultData<TProperties, TStaticData>(_config: Immutable<ModuleConfigText<TProperties, TStaticData>>): ModuleItemDataText {
		return {
			type: 'text',
			text: '',
			font: 'inter',
			align: 'center',
		};
	}

	public makeDataFromTemplate<TProperties, TStaticData>(_config: Immutable<ModuleConfigText<TProperties, TStaticData>>, template: ModuleItemTemplateText, _context: IItemCreationContext): ModuleItemDataText {
		return {
			type: 'text',
			text: template.text,
			font: template.font,
			align: template.align,
		};
	}

	public loadModule<TProperties, TStaticData>(config: Immutable<ModuleConfigText<TProperties, TStaticData>>, data: ModuleItemDataText, context: IItemLoadContext): ItemModuleText<TProperties, TStaticData> {
		return ItemModuleText.loadFromData<TProperties, TStaticData>(config, data, context);
	}

	public getStaticAttributes<TProperties, TStaticData>(_config: Immutable<ModuleConfigText<TProperties, TStaticData>>): ReadonlySet<string> {
		return new Set<string>();
	}
}

interface ItemModuleTextProps<TProperties, TStaticData> {
	readonly assetManager: AssetManager;
	readonly config: Immutable<ModuleConfigText<TProperties, TStaticData>>;
	readonly text: string;
	readonly font: PandoraFontType;
	readonly align: ModuleItemDataTextAlign;
}

export class ItemModuleText<TProperties = unknown, TStaticData = unknown> implements IItemModule<TProperties, TStaticData, 'text'>, ItemModuleTextProps<TProperties, TStaticData> {
	public readonly type = 'text';

	public readonly assetManager: AssetManager;
	public readonly config: Immutable<ModuleConfigText<TProperties, TStaticData>>;
	public readonly text: string;
	public readonly font: PandoraFontType;
	public readonly align: ModuleItemDataTextAlign;

	public get interactionType(): ItemInteractionType {
		return ItemInteractionType.STYLING;
	}

	public readonly interactionId: InteractionId = 'useTextModule';

	protected constructor(props: ItemModuleTextProps<TProperties, TStaticData>, overrideProps?: Partial<ItemModuleTextProps<TProperties, TStaticData>>) {
		this.assetManager = overrideProps?.assetManager ?? props.assetManager;
		this.config = overrideProps?.config ?? props.config;
		this.text = overrideProps?.text ?? props.text;
		this.font = overrideProps?.font ?? props.font;
		this.align = overrideProps?.align ?? props.align;
	}

	protected withProps(overrideProps: Partial<ItemModuleTextProps<TProperties, TStaticData>>): ItemModuleText<TProperties, TStaticData> {
		return new ItemModuleText(this, overrideProps);
	}

	public static loadFromData<TProperties, TStaticData>(config: Immutable<ModuleConfigText<TProperties, TStaticData>>, data: ModuleItemDataText, context: IItemLoadContext): ItemModuleText<TProperties, TStaticData> {
		const limit = Math.min(LIMIT_ITEM_MODULE_TEXT_LENGTH, config.maxLength);

		return new ItemModuleText({
			assetManager: context.assetManager,
			config,
			text: (context.doLoadTimeCleanup && data.text.length > limit) ? (data.text.trim().slice(0, limit)) : data.text,
			font: data.font,
			align: data.align,
		});
	}

	public exportToTemplate(): ModuleItemTemplateText {
		return {
			type: 'text',
			text: this.text,
			font: this.font,
			align: this.align,
		};
	}

	public exportData(_options: IExportOptions): ModuleItemDataText {
		return {
			type: 'text',
			text: this.text,
			font: this.font,
			align: this.align,
		};
	}

	public validate(_context: IItemValidationContext, asset: Asset): AppearanceValidationResult {
		// Text must be valid
		const validation = ModuleItemDataTextTextSchema.safeParse(this.text);
		if (!validation.success || validation.data !== this.text) {
			return {
				success: false,
				error: {
					problem: 'invalidText',
					asset: asset.id,
				},
			};
		}

		// Text must have correct length
		if (this.text.length > Math.min(LIMIT_ITEM_MODULE_TEXT_LENGTH, this.config.maxLength)) {
			return {
				success: false,
				error: {
					problem: 'invalidText',
					asset: asset.id,
				},
			};
		}

		return { success: true };
	}

	public getProperties(): readonly Immutable<TProperties>[] {
		return [];
	}

	public evalCondition(_operator: ConditionOperator, _value: string): boolean {
		return false;
	}

	public doAction(_ctx: AppearanceModuleActionContext, action: ItemModuleTextAction): ItemModuleText<TProperties, TStaticData> | null {
		return this.withProps({
			text: action.setText,
			font: action.setFont,
			align: action.setAlign,
		});
	}

	// Doesn't matter as text module doesn't support nested content
	public readonly contentsPhysicallyEquipped: boolean = true;

	public getContents(): AppearanceItems {
		return [];
	}

	public setContents(_items: AppearanceItems): ItemModuleText<TProperties, TStaticData> | null {
		return null;
	}
}
