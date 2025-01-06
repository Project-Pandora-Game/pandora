import { z } from 'zod';
import type { RestrictionOverride } from '../../../assets';
import { Assert } from '../../../utility';
import type { AppearanceActionProcessingResult } from '../appearanceActionProcessingContext';
import type { AppearanceActionHandlerArg } from './_common';

export const AppearanceActionRestrictionOverrideChange = z.object({
	type: z.literal('restrictionOverrideChange'),
	/** Which mode we are changing to */
	mode: z.enum(['normal', 'safemode', 'timeout']),
});

/** Enter or leave safemode/timeout mode. */
export function ActionRestrictionOverrideChange({
	action,
	processingContext,
}: AppearanceActionHandlerArg<z.infer<typeof AppearanceActionRestrictionOverrideChange>>): AppearanceActionProcessingResult {
	const playerRestrictionManager = processingContext.getPlayerRestrictionManager();
	const current = playerRestrictionManager.appearance.getRestrictionOverride();
	const oldMode = current?.type ?? 'normal';

	// If we are already in a mode it we cannot enter it again
	if (oldMode === action.mode)
		return processingContext.invalid();
	// If we are not in normal mode we cannot enter any other mode
	if (oldMode !== 'normal' && action.mode !== 'normal')
		return processingContext.invalid();
	// Check the timer to leave it passed
	if (current?.allowLeaveAt != null && Date.now() < current.allowLeaveAt)
		return processingContext.invalid();

	const { features, development } = playerRestrictionManager.spaceContext;
	const removeAllowLeaveAt = features.includes('development') && development?.disableSafemodeCooldown === true;

	if (!processingContext.manipulator.produceCharacterState(playerRestrictionManager.appearance.id, (character) =>
		character.produceWithRestrictionOverride(action.mode, removeAllowLeaveAt),
	)) {
		return processingContext.invalid();
	}

	let id: `${RestrictionOverride['type']}${'Enter' | 'Leave'}`;
	if (action.mode === 'normal') {
		Assert(oldMode !== 'normal');
		id = `${oldMode}Leave`;
	} else {
		id = `${action.mode}Enter`;
	}

	processingContext.queueMessage({ id });

	return processingContext.finalize();
}
