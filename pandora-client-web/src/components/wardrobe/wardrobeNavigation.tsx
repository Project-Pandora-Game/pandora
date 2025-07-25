import {
	AssertNever,
	type ActionTargetSelector,
} from 'pandora-common';
import { z } from 'zod';
import './wardrobe.scss';
import { WardrobeFocusSchema } from './wardrobeTypes.ts';

export const WardrobeLocationStateSchema = z.object({
	initialFocus: WardrobeFocusSchema.optional(),
}).passthrough();
export type WardrobeLocationState = z.infer<typeof WardrobeLocationStateSchema>;

export function ActionTargetToWardrobeUrl(target: ActionTargetSelector): string {
	if (target.type === 'character') {
		return `/wardrobe/character/${target.characterId}`;
	} else if (target.type === 'roomInventory') {
		return '/wardrobe/room-inventory';
	}
	AssertNever(target);
}
