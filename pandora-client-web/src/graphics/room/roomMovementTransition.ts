import { LIVE_UPDATE_THROTTLE } from '../../config/Environment.ts';
import { useGraphicsSmoothMovementEnabled } from '../graphicsSettings.tsx';

export const CHARACTER_MOVEMENT_TRANSITION_DURATION_NORMAL = 250; // ms
export const CHARACTER_MOVEMENT_TRANSITION_DURATION_MANIPULATION = LIVE_UPDATE_THROTTLE; // ms

/**
 * Duration (ms) of the smooth movement transition for things in a room (characters, items).
 * @param quick - Whether the thing is being manipulated (move mode, or following something that is) and so should react quickly
 */
export function useRoomMovementTransitionDuration(quick: boolean): number {
	const smoothMovementEnabled = useGraphicsSmoothMovementEnabled();

	return !smoothMovementEnabled ? 0 :
		quick ? CHARACTER_MOVEMENT_TRANSITION_DURATION_MANIPULATION :
		CHARACTER_MOVEMENT_TRANSITION_DURATION_NORMAL;
}
