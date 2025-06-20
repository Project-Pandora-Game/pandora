import {
	GetLogger,
	Service,
	type Satisfies,
	type ServiceConfigBase,
	type ServiceProviderDefinition,
} from 'pandora-common';
import type { ClientServices } from './clientServices.ts';

type UserActivationServiceConfig = Satisfies<{
	dependencies: Pick<ClientServices, never>;
	events: false;
}, ServiceConfigBase>;

/**
 * Service for queuing requests that require user activation.
 */
export class UserActivationService extends Service<UserActivationServiceConfig> {
	private readonly logger = GetLogger('UserActivationService');

	private readonly _requestQueue: (() => void)[] = [];

	public requestRunOnUserActivation(callback: () => void) {
		this._requestQueue.push(callback);
	}

	private _pendingCheck: boolean = false;
	private _onActivatingEvent: () => void = () => {
		if (!this._pendingCheck && this._requestQueue.length > 0) {
			this._pendingCheck = true;
			queueMicrotask(this._checkUsableActivation);
		}
	};

	private _checkUsableActivation: () => void = () => {
		this._pendingCheck = false;
		// If browser does not support userActivation api, do one request and stop
		if (!window.navigator.userActivation) {
			this._requestQueue.shift()?.();
			return;
		}
		// If there is useful activation, use it
		while (window.navigator.userActivation.isActive) {
			const task = this._requestQueue.shift();
			if (task == null)
				break;

			task();
		}
	};

	protected override serviceInit(): void {
		if (!window.navigator.userActivation) {
			this.logger.warning('Browser does not support userActivation API');
		}

		// Listen for events that cause user activation
		// https://html.spec.whatwg.org/multipage/interaction.html#user-activation-processing-model
		window.addEventListener('keydown', (ev) => {
			if (ev.isTrusted && ev.key !== 'Escape') {
				this._onActivatingEvent();
			}
		}, { capture: true });
		window.addEventListener('mousedown', (ev) => {
			if (ev.isTrusted) {
				this._onActivatingEvent();
			}
		}, { capture: true });
		window.addEventListener('pointerdown', (ev) => {
			if (ev.isTrusted && ev.pointerType === 'mouse') {
				this._onActivatingEvent();
			}
		}, { capture: true });
		window.addEventListener('pointerup', (ev) => {
			if (ev.isTrusted && ev.pointerType !== 'mouse') {
				this._onActivatingEvent();
			}
		}, { capture: true });
		window.addEventListener('touchend', (ev) => {
			if (ev.isTrusted) {
				this._onActivatingEvent();
			}
		}, { capture: true });
	}
}

export const UserActivationServiceProvider: ServiceProviderDefinition<ClientServices, 'userActivation', UserActivationServiceConfig> = {
	name: 'userActivation',
	ctor: UserActivationService,
	dependencies: {},
};
