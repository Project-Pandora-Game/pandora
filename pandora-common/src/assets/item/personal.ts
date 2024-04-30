import type { Immutable } from 'immer';
import { first } from 'lodash';

import type { HexRGBAColorString } from '../../validation';
import type { AssetProperties } from '../properties';
import type { Asset } from '../asset';
import type { IItemModule } from '../modules/common';
import type { AppearanceModuleActionContext } from '../appearanceActions';
import type { AppearanceItems } from '../appearanceValidation';
import type { ItemBundle, IItemLoadContext } from './base';

import { MemoizeNoArg } from '../../utility';
import { LoadItemModule, ItemModuleAction } from '../modules';

import { ItemBaseProps, ItemBase } from './_internal';

declare module './_internal' {
	interface InternalItemTypeMap {
		personal: ItemPersonal;
	}
}

interface ItemPersonalProps extends ItemBaseProps<'personal'> {
	readonly modules: ReadonlyMap<string, IItemModule<AssetProperties, undefined>>;
}

export class ItemPersonal extends ItemBase<'personal'> implements ItemPersonalProps {
	public readonly modules: ReadonlyMap<string, IItemModule<AssetProperties, undefined>>;

	protected constructor(props: ItemPersonalProps, overrideProps?: Partial<ItemPersonalProps>) {
		super(props, overrideProps);
		this.modules = overrideProps?.modules ?? props.modules;
	}

	protected override withProps(overrideProps: Partial<ItemPersonalProps>): ItemPersonal {
		return new ItemPersonal(this, overrideProps);
	}

	public static loadFromBundle(asset: Asset<'personal'>, bundle: ItemBundle, context: IItemLoadContext): ItemPersonal {
		// Load modules
		const modules = new Map<string, IItemModule<AssetProperties, undefined>>();
		for (const [moduleName, moduleConfig] of Object.entries(asset.definition.modules ?? {})) {
			modules.set(moduleName, LoadItemModule<AssetProperties, undefined>(moduleConfig, bundle.moduleData?.[moduleName], context));
		}

		return new ItemPersonal({
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

	public override moduleAction(context: AppearanceModuleActionContext, moduleName: string, action: ItemModuleAction): ItemPersonal | null {
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

	public override setModuleItems(moduleName: string, items: AppearanceItems): ItemPersonal | null {
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
