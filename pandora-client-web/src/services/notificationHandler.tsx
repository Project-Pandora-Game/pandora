import type { Immutable } from 'immer';
import {
	AssertNever,
	CLIENT_NOTIFICATION_TYPES,
	EMPTY_ARRAY,
	Service,
	type ClientNotificationGlobalSettings,
	type ClientNotificationSound,
	type ClientNotificationSoundSettings,
	type ClientNotificationSoundVolume,
	type ClientNotificationType,
	type ClientNotificationTypeSetting,
	type Satisfies,
	type ServiceConfigBase,
	type ServiceInitArgs,
	type ServiceProviderDefinition,
} from 'pandora-common';
import { useEffect } from 'react';
import { toast } from 'react-toastify';
import type * as z from 'zod';
import audioAlert from '../audio/alert.mp3';
import audioBell from '../audio/bell.mp3';
import audioBing from '../audio/bing.mp3';
import audioDingDing from '../audio/ding-ding.mp3';
import { Observable, ReadonlyObservable } from '../observable.ts';
import { GetAccountSettings } from './accountLogic/accountManagerHooks.ts';
import type { ClientServices } from './clientServices.ts';
import { useService } from './serviceProvider.tsx';

export const NOTIFICATION_AUDIO_VOLUME: Readonly<Record<ClientNotificationSoundVolume, string>> = {
	'0': '0%',
	'25': '25%',
	'50': '50%',
	'75': '75%',
	'100': '100%',
};

export const NOTIFICATION_AUDIO_NAMES: Readonly<Record<ClientNotificationSound, string>> = {
	'': '<None>',
	'alert': 'Alert',
	'bell': 'Bell',
	'bing': 'Bing',
	'dingding': 'Ding-Ding',
};

export const NOTIFICATION_AUDIO_SOUNDS: Readonly<Record<ClientNotificationSound, string | null>> = {
	'': null,
	'alert': audioAlert,
	'bell': audioBell,
	'bing': audioBing,
	'dingding': audioDingDing,
};

/** Helper for creating notification data type */
interface NotificationEntryData<TType extends ClientNotificationType> {
	type: TType;
	metadata: z.infer<(typeof CLIENT_NOTIFICATION_TYPES)[TType]['metadata']>;
	time: number;
	title?: string;
	content?: string;
	onClick?: () => void;
}

/** A notification data, including metadata and content */
export type NotificationEntry = {
	[type in ClientNotificationType]: NotificationEntryData<type>;
}[ClientNotificationType];

/**
 * Hook for suppressing some notifications contextually.
 */
export type NotificationSuppressionHook = (notification: Immutable<NotificationEntry>) => boolean;

type NotificationHandlerServiceConfig = Satisfies<{
	dependencies: Pick<ClientServices, 'accountManager' | 'audio'>;
	events: false;
}, ServiceConfigBase>;

export class NotificationHandler extends Service<NotificationHandlerServiceConfig> {
	private readonly _notifications = new Observable<Immutable<NotificationEntry[]>>(EMPTY_ARRAY);

	public get notifications(): ReadonlyObservable<Immutable<NotificationEntry[]>> {
		return this._notifications;
	}

	private readonly _suppress = new Set<NotificationSuppressionHook>();
	private readonly _popups = new WeakMap<Immutable<NotificationEntry>, Notification>();

	constructor(serviceInitArgs: ServiceInitArgs<NotificationHandlerServiceConfig>) {
		super(serviceInitArgs);

		window.addEventListener('focus', this._onFocus);
	}

	public readonly notify = (notification: Immutable<NotificationEntry>): void => {
		const settings = this.getNotificationTypeSettings(notification.type);

		// Check if the notification should be suppressed and simply ignore it if that is the case
		if (this._isNotificationSuppressed(notification))
			return;

		// Save notification (if configured)
		if (settings.persist) {
			this._notifications.produce((v) => [...v, notification]);
		}

		// Raise popup (if configured)
		if (settings.popup) {
			this._risePopup(notification);
		}

		// Make a sound (if configured)
		if (settings.sound != null) {
			const globalSettings = this.getGlobalNotificationSettings();
			this._playSound({
				sound: settings.sound.sound ?? globalSettings.sound.sound,
				volume: settings.sound.volume ?? globalSettings.sound.volume,
			});
		}
	};

	private _risePopup(notification: Immutable<NotificationEntry>) {
		const definition = CLIENT_NOTIFICATION_TYPES[notification.type];
		const title = notification.title ?? definition.name;

		if (
			this.getGlobalNotificationSettings().usePlatformPopup &&
			!globalThis.document.hasFocus() &&
			Notification.permission === 'granted'
		) {
			const platformNotification = new Notification(title, {
				body: notification.content,
				tag: notification.type,
				// @ts-expect-error: Not yet in TS typings
				timestamp: notification.time,
			});
			this._popups.set(notification, platformNotification);
			platformNotification.onclose = () => {
				this._popups.delete(notification);
			};
			platformNotification.onclick = () => {
				window.focus();
				platformNotification.close();
				this._popups.delete(notification);
				this.dismissNotification(notification);
				notification.onClick?.();
			};
		} else {
			toast(
				<>
					<strong className='fontSize-l'>{ title }</strong>
					<p>{ notification.content }</p>
				</>,
				{
					type: 'info',
					icon: false,
					isLoading: false,
					autoClose: 6_000,
					closeOnClick: true,
					closeButton: true,
					draggable: true,
					onClick: () => {
						this.dismissNotification(notification);
						notification.onClick?.();
					},
				},
			);
		}
	}

	private _playSound(sound: Immutable<ClientNotificationSoundSettings>) {
		const soundSource = NOTIFICATION_AUDIO_SOUNDS[sound.sound];
		const volume = Number(sound.volume) / 100;

		if (!soundSource || !volume)
			return;

		const audio = new Audio(soundSource);
		audio.volume = volume;
		this.serviceDeps.audio.playOnce(audio);
	}

	public getGlobalNotificationSettings(): Immutable<ClientNotificationGlobalSettings> {
		const { accountManager } = this.serviceDeps;
		return GetAccountSettings(accountManager).notificationGlobalSettings;
	}

	public getNotificationTypeSettings(type: ClientNotificationType): Immutable<ClientNotificationTypeSetting> {
		const { accountManager } = this.serviceDeps;
		return GetAccountSettings(accountManager).notificationTypeSettings?.[type] ?? CLIENT_NOTIFICATION_TYPES[type].defaultSettings;
	}

	private _isNotificationSuppressed(notification: Immutable<NotificationEntry>): boolean {
		const settings = this.getNotificationTypeSettings(notification.type);
		switch (settings.suppression) {
			case 'always':
				return false;
			case 'not-suppressed':
				return globalThis.document.hasFocus() && Array.from(this._suppress.values()).some((s) => s(notification));
			case 'not-blurred':
				return globalThis.document.hasFocus();
		}
		AssertNever(settings.suppression);
	}

	public addSuppressionHook(hook: NotificationSuppressionHook): () => void {
		this._suppress.add(hook);
		// auto-clear newly suppressed notifications
		this._onFocus();
		return () => {
			this._suppress.delete(hook);
		};
	}

	public clearAllNotifications() {
		this._notifications.value.forEach((n) => {
			this.dismissNotification(n);
		});
	}

	public dismissNotification(notification: Immutable<NotificationEntry>): void {
		this._notifications.produce((v) => v.filter((n) => n !== notification));
		const popup = this._popups.get(notification);
		if (popup != null) {
			popup.close();
			this._popups.delete(notification);
		}
	}

	private readonly _onFocus = () => {
		// When window is focused, auto-clear all newly suppressed notifications
		this._notifications.value.forEach((n) => {
			if (this._isNotificationSuppressed(n)) {
				this.dismissNotification(n);
			}
		});
	};
}

export const NotificationHandlerServiceProvider: ServiceProviderDefinition<ClientServices, 'notificationHandler', NotificationHandlerServiceConfig> = {
	name: 'notificationHandler',
	ctor: NotificationHandler,
	dependencies: {
		accountManager: true,
		audio: true,
	},
};

export function useNotify(): (notification: Immutable<NotificationEntry>) => void {
	return useService('notificationHandler').notify;
}

export function useNotificationSuppress(hook: NotificationSuppressionHook): void {
	const service = useService('notificationHandler');
	useEffect(() => {
		return service.addSuppressionHook(hook);
	}, [service, hook]);
}
