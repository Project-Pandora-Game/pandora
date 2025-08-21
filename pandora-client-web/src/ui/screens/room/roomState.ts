import { SpaceIdSchema } from 'pandora-common';
import { z } from 'zod';
import { BrowserStorage } from '../../../browserStorage.ts';
import { useObservable } from '../../../observable.ts';

export const SettingDisplayCharacterName = BrowserStorage.createSession('graphics.display-character-name', true, z.boolean());

export const SettingDisplayRoomLinks = BrowserStorage.createSession('graphics.display-room-links', true, z.boolean());

export const DeviceOverlaySettingSchema = z.enum(['never', 'interactable', 'always']);
export const DeviceOverlayStateSchema = z.object({
	roomConstructionMode: z.boolean(),
	spaceId: SpaceIdSchema.nullish(),
	isPlayerAdmin: z.boolean(),
	canUseHands: z.boolean(),
});

export const DeviceOverlaySetting = BrowserStorage.create('device-overlay-toggle', 'interactable', DeviceOverlaySettingSchema);
export const DeviceOverlayState = BrowserStorage.createSession('device-overlay-state', {
	roomConstructionMode: false,
	spaceId: undefined,
	isPlayerAdmin: false,
	canUseHands: false,
}, DeviceOverlayStateSchema);

export function useIsRoomConstructionModeEnabled(): boolean {
	const { roomConstructionMode } = useObservable(DeviceOverlayState);
	return roomConstructionMode;
}
