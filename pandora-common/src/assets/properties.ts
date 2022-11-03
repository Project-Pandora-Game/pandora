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
	 * Allows or forbids character from equipping this item themselves
	 * @default true
	 */
	allowSelfEquip?: boolean;
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
	allowSelfEquip: boolean;
}

export function CreateAssetPropertiesIndividualResult(): AssetPropertiesIndividualResult {
	return {
		...CreateAssetPropertiesResult(),
		requirements: new Set(),
		allowSelfEquip: true,
	};
}

export function MergeAssetPropertiesIndividual(base: AssetPropertiesIndividualResult, properties: AssetProperties): AssetPropertiesIndividualResult {
	base = MergeAssetProperties(base, properties);
	properties.requirements?.forEach((a) => base.requirements.add(a));
	base.allowSelfEquip &&= properties.allowSelfEquip !== false;

	return base;
}
