import type { Immutable } from 'immer';
import { isEqual } from 'lodash-es';
import * as z from 'zod';
import { CloneDeepMutable } from '../../utility/misc.ts';
import { CoordinatesCompressedSchema } from './common.ts';
import { PointDefinitionSchema, type PointTemplate } from './points.ts';

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
