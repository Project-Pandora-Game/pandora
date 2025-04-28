import type { AssetAttributeDefinition } from '../../../src/index.ts';

const ATTRIBUTES_DEFINITION_BASE = DefineAttributes({
	// Bodypart attributes
	Body_base: {
		name: 'Base body',
		description: 'A body',
		icon: 'body',
		useAsAssetPreference: false,
	},
	Head_base: {
		name: 'Base head',
		description: 'A head',
		icon: 'body',
		useAsAssetPreference: false,
	},
	Hair: {
		name: 'Hair',
		description: 'Hair',
		useAsAssetPreference: false,
	},
	Hair_front: {
		name: 'Front hair',
		description: 'Hair on the front of the head',
		useAsWardrobeFilter: {
			tabs: ['body'],
		},
		icon: 'hair_front',
		useAsAssetPreference: false,
	},
	Hair_back: {
		name: 'Back hair',
		description: 'Hair on the back of the head',
		useAsWardrobeFilter: {
			tabs: ['body'],
		},
		icon: 'hair_back',
		useAsAssetPreference: false,
	},
	Eyes: {
		name: 'Eyes',
		description: 'A pair of eyes',
		useAsWardrobeFilter: {
			tabs: ['body'],
		},
		icon: 'eye',
		useAsAssetPreference: false,
	},
	Mouth: {
		name: 'Mouth',
		description: 'A mouth',
		useAsWardrobeFilter: {
			tabs: ['body'],
		},
		icon: 'lips',
		useAsAssetPreference: false,
	},
	Mouth_open_wide: {
		name: 'Wide open mouth',
		description: 'A wide open mouth',
		useAsAssetPreference: false,
	},
	Mouth_tongue_out: {
		name: 'Tongue out',
		description: 'A wide open mouth with its tongue out',
		useAsAssetPreference: false,
	},
	// Items or attachment points from items
	Clothing: {
		name: 'Clothing',
		description: 'An article of clothing',
	},
	Clothing_upper: {
		name: 'Upper clothing',
		description: 'A top, shirt, or similar item worn over the upper body',
		useAsWardrobeFilter: {
			tabs: ['worn', 'storage'],
			excludeAttributes: ['Clothing_large', 'Clothing_outer'],
		},
		icon: 'upper',
	},
	Clothing_lower: {
		name: 'Lower clothing',
		description: 'A skirt, pants, or similar item worn on the hips',
		useAsWardrobeFilter: {
			tabs: ['worn', 'storage'],
			excludeAttributes: ['Clothing_large', 'Clothing_outer'],
		},
		icon: 'lower',
	},
	Underwear: {
		name: 'Underwear',
		description: 'A bra, panties, underpants, or similar item worn as lowest clothing layer',
		useAsWardrobeFilter: {
			tabs: ['worn', 'storage'],
		},
		icon: 'underwear',
	},
	Underwear_bra: {
		name: 'Bra',
		description: 'A bra',
	},
	Underwear_panties: {
		name: 'Panties',
		description: 'A pair of panties',
	},
	Footwear: {
		name: 'Footwear',
		description: 'A pair of shoes, boots, sandals, or similar item',
		useAsWardrobeFilter: {
			tabs: ['worn', 'storage'],
		},
		icon: 'footwear',
	},
	Restraint: {
		name: 'Restraint',
		description: 'An item that restricts or restrains the character in some form',
	},
	Restraint_arms: {
		name: 'Arms restraint',
		description: 'An item that restricts or restrains arms or hands',
		useAsWardrobeFilter: {
			tabs: ['worn', 'storage'],
		},
		icon: 'restraint_arms',
	},
	Restraint_legs: {
		name: 'Leg restraint',
		description: 'An item that restricts or restrains legs or feet',
		useAsWardrobeFilter: {
			tabs: ['worn', 'storage'],
		},
		icon: 'restraint_legs',
	},

	//#region Mouth items
	Mouth_item: {
		name: 'An item used on the mouth or lips',
		description: 'Any item that is positioned on the mouth (either outside or inside)',
	},
	Restraint_mouth: {
		name: 'Speech restraint',
		description: 'An item that decreases the ability to speak',
		useAsWardrobeFilter: {
			tabs: ['worn', 'storage'],
		},
		icon: 'gag',
	},
	Mouth_insert: {
		name: 'An item inserted in the mouth',
		description: 'An item that is inserted in the mouth (in the area between the lips)',
	},
	Mouth_protruding: {
		name: 'An item protruding outside of the mouth',
		description: 'An item that is protruding outside of the mouth',
	},
	Mouth_cover: {
		name: 'An item covering the mouth',
		description: 'An item that is covering the mouth',
	},
	//#endregion

	// Room devices
	Room_device: {
		name: 'Room device',
		description: 'Any room-level item (a lamp, cross, table, plant, ...)',
		useAsWardrobeFilter: {
			tabs: ['room', 'storage'],
		},
		icon: 'room_device',
	},
	Furniture: {
		name: 'Furniture',
		description: 'A bed, chair, bench, or similar usable room-level item',
		useAsWardrobeFilter: {
			tabs: ['room', 'storage'],
		},
		icon: 'furniture',
	},
	Storage: {
		name: 'Storage items',
		description: 'A chest, box, barrel, or similar room-level storage item',
		useAsWardrobeFilter: {
			tabs: ['room', 'storage'],
		},
		icon: 'storage',
	},
	// Locks
	Lock: {
		name: 'Lock',
		description: 'A lock',
		useAsWardrobeFilter: {
			tabs: ['room', 'storage', 'lockSlot'],
		},
		icon: 'lock',
	},
});

function DefineAttributes<const TAttributeName extends string>(
	definitions: Record<TAttributeName, NoInfer<AssetAttributeDefinition>>,
): Readonly<Record<TAttributeName, AssetAttributeDefinition>> {
	return definitions;
}

export type AssetTestAttributeNames = (keyof typeof ATTRIBUTES_DEFINITION_BASE) & string;
export const ASSET_TEST_ATTRIBUTES_DEFINITION: Readonly<Record<AssetTestAttributeNames, AssetAttributeDefinition>> = ATTRIBUTES_DEFINITION_BASE;
