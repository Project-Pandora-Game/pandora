import type { Immutable } from 'immer';
import { isEqual } from 'lodash';
import { z } from 'zod';
import { CloneDeepMutable } from '../../utility/misc';
import { CoordinatesCompressedSchema } from './common';
import { PointDefinitionSchema, type PointTemplate } from './points';

// Fix for pnpm resolution weirdness
import type { } from '../../validation';

export const PointTemplateDeltaSchema = z.object({
	removed: CoordinatesCompressedSchema.array().optional(),
	added: PointDefinitionSchema.array().optional(),
});
export type PointTemplateDelta = z.infer<typeof PointTemplateDeltaSchema>;

export function PointTemplateDiff(base: Immutable<PointTemplate>, target: Immutable<PointTemplate>): PointTemplateDelta {
	const result: PointTemplateDelta = {};

	for (const basePoint of base) {
		if (!target.some((targetPoint) => isEqual(basePoint, targetPoint))) {
			result.removed ??= [];
			result.removed.push(CloneDeepMutable(basePoint.pos));
		}
	}

	for (const targetPoint of target) {
		if (!base.some((basePoint) => isEqual(basePoint, targetPoint))) {
			result.added ??= [];
			result.added.push(CloneDeepMutable(targetPoint));
		}
	}

	return result;
}
