import { MergePoseLimits, PoseLimitsResult } from './appearanceValidation';
import type { AssetDefinitionExtraArgs, AssetDefinitionPoseLimits } from './definitions';
import { EffectsDefinition, EFFECTS_DEFAULT, MergeEffects } from './effects';

export interface AssetProperties<A extends AssetDefinitionExtraArgs = AssetDefinitionExtraArgs> {

	/** Configuration of how the asset limits pose */
	poseLimits?: AssetDefinitionPoseLimits<A>;

	/** The effects this item applies when worn */
	effects?: Partial<EffectsDefinition>;

	/** Attributes this asset gives */
	attributes?: (A['attributes'])[];

	/**
	 * Requirements needed to wear this item.
	 *
	 * Attributes provided by items __above__ this one in wear-order don't count.
	 * This item's own attributes _do_ count into requirements.
	 */
	requirements?: (A['attributes'] | `!${A['attributes']}`)[];

	/**
	 * Items that have any of these attributes are hidden by this item.
	 * Applies only to items __bellow__ this one in wear-order.
	 */
	hides?: (A['attributes'])[];

	/**
	 * Prevents this item from being added or removed on anyone, including on oneself
	 * @default false
	 */
	blockAddRemove?: boolean;

	/**
	 * Prevents this item from being added or removed by a character on herself
	 * @default false
	 */
	blockSelfAddRemove?: boolean;

	/**
	 * Prevents listed modules from being modified by anyone, including on oneself
	 * @default []
	 */
	blockModules?: string[];

	/**
	 * Prevents listed modules from being modified by anyone wearing this item
	 * @default []
	 */
	blockSelfModules?: string[];
}

export interface AssetPropertiesResult {
	poseLimits: PoseLimitsResult;
	effects: EffectsDefinition;
	attributes: Set<string>;
	hides: Set<string>;
}

export function CreateAssetPropertiesResult(): AssetPropertiesResult {
	return {
		poseLimits: {
			forcePose: new Map<string, [number, number]>(),
		},
		effects: EFFECTS_DEFAULT,
		attributes: new Set(),
		hides: new Set(),
	};
}

export function MergeAssetProperties<T extends AssetPropertiesResult>(base: T, properties: AssetProperties): T {
	base.poseLimits = MergePoseLimits(base.poseLimits, properties.poseLimits);
	base.effects = MergeEffects(base.effects, properties.effects);
	properties.attributes?.forEach((a) => base.attributes.add(a));
	properties.hides?.forEach((a) => base.hides.add(a));

	return base;
}

export interface AssetPropertiesIndividualResult extends AssetPropertiesResult {
	requirements: Set<string | `!${string}`>;
	blockAddRemove: boolean;
	blockSelfAddRemove: boolean;
	blockModules: Set<string>;
	blockSelfModules: Set<string>;
}

export function CreateAssetPropertiesIndividualResult(): AssetPropertiesIndividualResult {
	return {
		...CreateAssetPropertiesResult(),
		requirements: new Set(),
		blockAddRemove: false,
		blockSelfAddRemove: false,
		blockModules: new Set(),
		blockSelfModules: new Set(),
	};
}

export function MergeAssetPropertiesIndividual(base: AssetPropertiesIndividualResult, properties: AssetProperties): AssetPropertiesIndividualResult {
	base = MergeAssetProperties(base, properties);
	properties.requirements?.forEach((a) => base.requirements.add(a));
	base.blockAddRemove ||= properties.blockAddRemove ?? false;
	base.blockSelfAddRemove ||= properties.blockSelfAddRemove ?? false;
	properties.blockModules?.forEach((a) => base.blockModules.add(a));
	properties.blockSelfModules?.forEach((a) => base.blockSelfModules.add(a));

	return base;
}
