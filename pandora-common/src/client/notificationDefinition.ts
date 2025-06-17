import { z, type ZodType } from 'zod';
import type { ClientNotificationGroup } from './notifications.ts';

export type ClientNotificationGroupDefinitionBase = {
	name: string;
};

export type ClientNotificationTypeDefinitionBase<TGroup extends ClientNotificationGroup = ClientNotificationGroup> = {
	/** Name of the type, shown in the UI. */
	name: string;
	/** Group this notification type belongs to. */
	group: TGroup;
	/** Title for the notification when triggered, defaults to name. */
	title?: string;
	/** Metadata included with the notification (not necessarily whole content). Usable to decide if notification should be suppressed */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	metadata: ZodType<any, any, any>;
	/**
	 * Allows selecting `not-suppressed` suppression option. The content is used in the following context:
	 * ```
	 * `Do not notify if Pandora is focused and ${suppressable}`
	 * ```
	 */
	suppressable?: string;
	/** Default settings for the notification type */
	defaultSettings: ClientNotificationTypeSetting;
};

/**
 * Shape for how notification definitions should look like.
 *
 * __A notification type must be prefixed with its group name.__
 */
export type ClientNotificationTypeDefinitionDataShape = {
	[TGroup in ClientNotificationGroup]: {
		[key in `${TGroup}${string}`]: Readonly<ClientNotificationTypeDefinitionBase<TGroup>>;
	};
}[ClientNotificationGroup];

export const ClientNotificationSoundSchema = z.enum(['', 'alert', 'bell', 'bing', 'dingding']);
export type ClientNotificationSound = z.infer<typeof ClientNotificationSoundSchema>;
export const ClientNotificationSoundVolumeSchema = z.enum(['0', '25', '50', '75', '100']);
export type ClientNotificationSoundVolume = z.infer<typeof ClientNotificationSoundVolumeSchema>;

export const ClientNotificationSoundSettingsSchema = z.object({
	/** What sound should this notification produce. */
	sound: ClientNotificationSoundSchema.catch(''),
	/** What volume should this notification produce. */
	volume: ClientNotificationSoundVolumeSchema.catch('100'),
});
export type ClientNotificationSoundSettings = z.infer<typeof ClientNotificationSoundSettingsSchema>;

/**
 * When should notification be triggered, vs when it should be suppressed:
 * - `always` = Always notify
 * - `not-suppressed` = Do not notify if Pandora is focused and suppression trigger is in effect (e.g. chat is visible)
 * - `not-blurred` = Do not notify if Pandora is focused (no matter the screen)
 */
export const ClientNotificationSuppressionSettingSchema = z.enum(['always', 'not-suppressed', 'not-blurred']);

/**
 * Settings for a specific notification type
 */
export const ClientNotificationTypeSettingSchema = z.object({
	/** Whether this notification should create an entry in notification menu and affect notification count until resolved */
	persist: z.boolean().catch(false),
	/** Whether this notification should make a sound when triggered. `null` = no sound, missing entries default to global settings */
	sound: ClientNotificationSoundSettingsSchema.partial().nullable().catch(null),
	/** Whether this notification should make a toast or an OS popup if enabled globally */
	popup: z.boolean().catch(false),
	/** Setting for when should notifications of this type be suppressed */
	suppression: ClientNotificationSuppressionSettingSchema.catch('not-suppressed'),
});
export type ClientNotificationTypeSetting = z.infer<typeof ClientNotificationTypeSettingSchema>;

export const ClientNotificationGlobalSettingsSchema = z.object({
	sound: ClientNotificationSoundSettingsSchema,
	/** Whether to use platform popup mechanism if Pandora is not focused instead of toast, for types that specifc `popup` presentation. */
	usePlatformPopup: z.boolean().catch(false),
});
export type ClientNotificationGlobalSettings = z.infer<typeof ClientNotificationGlobalSettingsSchema>;
