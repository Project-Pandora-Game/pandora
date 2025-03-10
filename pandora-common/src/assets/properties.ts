import { Immutable } from 'immer';
import { IsReadonlyArray } from '../utility/index.ts';
import { AppearanceLimitTree } from './appearanceLimit.ts';
import type { AssetDefinitionExtraArgs, AssetDefinitionPoseLimits } from './definitions.ts';
import { EFFECTS_DEFAULT, EffectsDefinition, MergeEffects } from './effects.ts';

export interface AssetProperties<A extends AssetDefinitionExtraArgs = AssetDefinitionExtraArgs> {

	/** Configuration of how the asset limits pose */
	poseLimits?: AssetDefinitionPoseLimits<A> | AssetDefinitionPoseLimits<A>[];

	/** The effects this item applies when worn */
	effects?: Partial<EffectsDefinition>;

	/** Collection of interactions based on attributes */
	attributes?: {
		/**
		 * Attributes this asset gives.
		 * @default []
		 * @example
		 * ['Clothing', 'Clothing_upper']
		 */
		provides?: (A['attributes'])[];

		/**
		 * Requirements needed to wear this item.
		 * Requirements starting with a `!` signify a conflict (must _not_ have the specified attribute).
		 *
		 * Only attributes provided by items __below__ this one in the wear-order count.
		 * This item's own attributes do _not_ count into requirements.
		 * @default []
		 * @example
		 * ['Mouth_open_wide', '!Mouth_tongue_out']
		 */
		requires?: (A['attributes'] | `!${A['attributes']}`)[];

		/**
		 * Prevents items that have any of the specified attributes from being modified and blocks adding and removing them.
		 *
		 * Applies only to items __below__ this one in the wear-order.
		 * @default []
		 * @example
		 * ['Mouth_insert']
		 */
		covers?: (A['attributes'])[];

		/**
		 * Items that have any of these attributes are hidden by this item.
		 * Applies only to items __below__ this one in the wear-order.
		 * @default []
		 * @example
		 * ['Hair', 'Ears']
		 */
		hides?: (A['attributes'])[];
	};

	/**
	 * Flags allowing to limit which item's state combinations are valid.
	 * Flags only operate within a single item, they do not affect other items.
	 */
	stateFlags?: {
		/**
		 * State flags this state gives.
		 * @default []
		 * @example
		 * ['strap']
		 */
		provides?: string[];

		/**
		 * Flags that this state requires.
		 *
		 * Format is a record of <`flag`, `description if not met`>.
		 * @default {}
		 * @example
		 * {
		 *     strap: 'This option requires a strap to be present.',
		 * }
		 */
		requires?: { [flag: string]: string; };
	};

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

	/**
	 * A unique list of color keys that disable user colorization.
	 * By default, colorization that has a name is user configured,
	 * specifying the color key in this list will make the inheritance group a higher priority
	 * thereby disabling user colorization and the color will be inherited from the group.
	 *
	 * @default []
	 */
	overrideColorKey?: string[];

	/**
	 * A unique list of color keys for which color inheritance is excluded.
	 * If an item is excluded from color inheritance for a particular key,
	 * it will not serve as a source of color for other items with that inheritance group.
	 *
	 * @default []
	 */
	excludeFromColorInheritance?: string[];
}

export interface AssetPropertiesResult {
	limits: AppearanceLimitTree;
	effects: EffectsDefinition;
	attributes: Set<string>;
	attributesHides: Set<string>;
	attributesCovers: Set<string>;
}

export function CreateAssetPropertiesResult(): AssetPropertiesResult {
	return {
		limits: new AppearanceLimitTree(),
		effects: EFFECTS_DEFAULT,
		attributes: new Set(),
		attributesHides: new Set(),
		attributesCovers: new Set(),
	};
}

export function MergeAssetProperties<T extends AssetPropertiesResult>(base: T, properties: Immutable<AssetProperties>): T {
	if (IsReadonlyArray(properties.poseLimits)) {
		for (const limit of properties.poseLimits) {
			base.limits.merge(limit);
		}
	} else {
		base.limits.merge(properties.poseLimits);
	}
	base.effects = MergeEffects(base.effects, properties.effects);
	properties.attributes?.provides?.forEach((a) => base.attributes.add(a));
	properties.attributes?.hides?.forEach((a) => base.attributesHides.add(a));
	properties.attributes?.covers?.forEach((a) => base.attributesCovers.add(a));

	return base;
}

export interface AssetPropertiesIndividualResult extends AssetPropertiesResult {
	attributeRequirements: Set<string | `!${string}`>;
	stateFlags: Set<string>;
	stateFlagsRequirements: Map<string, string>;
	blockAddRemove: boolean;
	blockSelfAddRemove: boolean;
	blockModules: Set<string>;
	blockSelfModules: Set<string>;
	overrideColorKey: Set<string>;
	excludeFromColorInheritance: Set<string>;
}

export function CreateAssetPropertiesIndividualResult(): AssetPropertiesIndividualResult {
	return {
		...CreateAssetPropertiesResult(),
		attributeRequirements: new Set(),
		stateFlags: new Set(),
		stateFlagsRequirements: new Map(),
		blockAddRemove: false,
		blockSelfAddRemove: false,
		blockModules: new Set(),
		blockSelfModules: new Set(),
		overrideColorKey: new Set(),
		excludeFromColorInheritance: new Set(),
	};
}

export function MergeAssetPropertiesIndividual(base: AssetPropertiesIndividualResult, properties: Immutable<AssetProperties>): AssetPropertiesIndividualResult {
	base = MergeAssetProperties(base, properties);
	properties.attributes?.requires?.forEach((a) => base.attributeRequirements.add(a));

	properties.stateFlags?.provides?.forEach((a) => base.stateFlags.add(a));
	// Merge required flags. The requirement reasons are simply concatenated (with a space between)
	for (const [flag, reason] of Object.entries(properties.stateFlags?.requires ?? {})) {
		const currentReason = base.stateFlagsRequirements.get(flag);
		base.stateFlagsRequirements.set(flag, (currentReason ? `${currentReason} ` : '') + reason);
	}

	base.blockAddRemove ||= properties.blockAddRemove ?? false;
	base.blockSelfAddRemove ||= properties.blockSelfAddRemove ?? false;
	properties.blockModules?.forEach((a) => base.blockModules.add(a));
	properties.blockSelfModules?.forEach((a) => base.blockSelfModules.add(a));
	properties.overrideColorKey?.forEach((a) => base.overrideColorKey.add(a));
	properties.excludeFromColorInheritance?.forEach((a) => base.excludeFromColorInheritance.add(a));

	return base;
}
