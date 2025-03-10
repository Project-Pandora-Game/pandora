import type { Immutable } from 'immer';
import { first } from 'lodash-es';

import type { AppearanceModuleActionContext } from '../../gameLogic/actionLogic/appearanceActions.ts';
import type { HexRGBAColorString } from '../../validation.ts';
import type { AppearanceItems } from '../appearanceValidation.ts';
import type { Asset } from '../asset.ts';
import type { AssetColorization } from '../definitions.ts';
import type { IItemModule } from '../modules/common.ts';
import type { AssetProperties } from '../properties.ts';
import type { ColorGroupResult, IItemLoadContext, ItemBundle } from './base.ts';

import { MemoizeNoArg } from '../../utility/misc.ts';
import { ItemModuleAction, LoadItemModule } from '../modules.ts';

import { ItemBase, ItemBaseProps } from './_internal.ts';

declare module './_internal.ts' {
	interface InternalItemTypeMap {
		bodypart: ItemBodypart;
	}
}

interface ItemBodypartProps extends ItemBaseProps<'bodypart'> {
	readonly modules: ReadonlyMap<string, IItemModule<AssetProperties, undefined>>;
}

export class ItemBodypart extends ItemBase<'bodypart'> implements ItemBodypartProps {
	public readonly modules: ReadonlyMap<string, IItemModule<AssetProperties, undefined>>;

	protected constructor(props: ItemBodypartProps, overrideProps?: Partial<ItemBodypartProps>) {
		super(props, overrideProps);
		this.modules = overrideProps?.modules ?? props.modules;
	}

	protected override withProps(overrideProps: Partial<ItemBodypartProps>): ItemBodypart {
		return new ItemBodypart(this, overrideProps);
	}

	public static loadFromBundle(asset: Asset<'bodypart'>, bundle: ItemBundle, context: IItemLoadContext): ItemBodypart {
		// Load modules
		const modules = new Map<string, IItemModule<AssetProperties, undefined>>();
		for (const [moduleName, moduleConfig] of Object.entries(asset.definition.modules ?? {})) {
			modules.set(moduleName, LoadItemModule<AssetProperties, undefined>(moduleConfig, bundle.moduleData?.[moduleName], context));
		}

		return new ItemBodypart({
			...(ItemBase._parseBundle(asset, bundle, context)),
			modules,
		});
	}

	public resolveColor(items: AppearanceItems, colorizationKey: string): HexRGBAColorString | undefined {
		const colorization = this.asset.definition.colorization?.[colorizationKey];
		if (!colorization)
			return undefined;

		const color = this.color[colorizationKey];
		if (color)
			return color;

		return this._resolveColorGroup(items, colorizationKey, colorization)?.color ?? colorization.default;
	}

	public override getColorOverrides(items: AppearanceItems): null | Partial<Record<string, ColorGroupResult>> {
		const colorization = this.asset.definition.colorization;
		if (!colorization)
			return null;

		const { overrideColorKey } = this.getProperties();
		if (overrideColorKey.size === 0)
			return null;

		let hasGroup = false;
		const result: Record<string, ColorGroupResult> = {};
		for (const key of Object.keys(this.color)) {
			const def = colorization[key];
			if (!def || def.name == null)
				continue;

			if (!overrideColorKey.has(key))
				continue;

			const groupColor = this._resolveColorGroup(items, key, def);
			if (groupColor == null)
				continue;

			result[key] = groupColor;
			hasGroup = true;
		}
		return hasGroup ? result : null;
	}

	/**
	 * Color resolution order:
	 * 1. Self (if it is not an inherited color)
	 * 2. Closest item before self that has this color group (if it is not an inherited color)
	 * 3. Closest item after self that has this color group (if it is not an inherited color)
	 * 4. Closest item from self (inclusive) that has this color group and it has an inherited color
	 */
	protected _resolveColorGroup(items: AppearanceItems, ignoreKey: string, { group }: Immutable<AssetColorization>): ColorGroupResult | undefined {
		if (!group)
			return undefined;

		const selfResult = this._getColorByGroup(group, ignoreKey);
		if (selfResult?.[0] === 'primary')
			return { item: this, colorization: selfResult[1], color: selfResult[2] };

		let color: ColorGroupResult | undefined;
		let colorInherited: ColorGroupResult | undefined = selfResult ? { item: this, colorization: selfResult[1], color: selfResult[2] } : undefined;
		let foundSelf = false;
		for (const item of items) {
			if (item.id === this.id) {
				if (color)
					return color;

				foundSelf = true;
				continue;
			}

			const result = item._getColorByGroup(group);
			if (result == null)
				continue;

			const [resultKey, colorization, resultColor] = result;
			switch (resultKey) {
				case 'primary':
					if (foundSelf)
						return { item, colorization, color: resultColor };

					color = { item, colorization, color: resultColor };
					break;
				case 'inherited':
					if (!colorInherited || !foundSelf)
						colorInherited = { item, colorization, color: resultColor };
					break;
			}
		}
		return color ?? colorInherited;
	}

	public override _getColorByGroup(group: string, ignoreKey?: string): null | ['primary' | 'inherited', Immutable<AssetColorization>, HexRGBAColorString] {
		const { overrideColorKey, excludeFromColorInheritance } = this.getProperties();
		let inherited: [Immutable<AssetColorization>, HexRGBAColorString] | undefined;
		if (this.asset.definition.colorization) {
			for (const [key, value] of Object.entries(this.asset.definition.colorization)) {
				if (value.group !== group || !this.color[key])
					continue;
				if (key === ignoreKey || excludeFromColorInheritance.has(key))
					continue;

				if (!overrideColorKey.has(key))
					return ['primary', value, this.color[key]];

				if (!inherited)
					inherited = [value, this.color[key]];
			}
		}
		return inherited ? ['inherited', ...inherited] : null;
	}

	public getColorRibbon(items: AppearanceItems): HexRGBAColorString | undefined {
		return this.resolveColor(
			items,
			this.asset.definition.colorRibbonGroup ??
			first(Object.keys(this.asset.definition.colorization ?? {})) ??
			'',
		);
	}

	public override getModules(): ReadonlyMap<string, IItemModule<AssetProperties, undefined>> {
		return this.modules;
	}

	public override moduleAction(context: AppearanceModuleActionContext, moduleName: string, action: ItemModuleAction): ItemBodypart | null {
		const module = this.modules.get(moduleName);
		if (!module || module.type !== action.moduleType)
			return null;
		const moduleResult = module.doAction(context, action);
		if (!moduleResult)
			return null;

		const newModules = new Map(this.modules);
		newModules.set(moduleName, moduleResult);

		return this.withProps({
			modules: newModules,
		});
	}

	public override setModuleItems(moduleName: string, items: AppearanceItems): ItemBodypart | null {
		const moduleResult = this.modules.get(moduleName)?.setContents(items);
		if (!moduleResult)
			return null;

		const newModules = new Map(this.modules);
		newModules.set(moduleName, moduleResult);

		return this.withProps({
			modules: newModules,
		});
	}

	@MemoizeNoArg
	public override getPropertiesParts(): readonly Immutable<AssetProperties>[] {
		return [
			...super.getPropertiesParts(),
			...Array.from(this.modules.values()).flatMap((m) => m.getProperties()),
		];
	}
}
