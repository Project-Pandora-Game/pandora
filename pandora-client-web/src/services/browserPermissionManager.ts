import { cloneDeep } from 'lodash-es';
import {
	ArrayToRecordKeys,
	GetLogger,
	KnownObject,
	Service,
	type Satisfies,
	type ServiceConfigBase,
	type ServiceProviderDefinition,
} from 'pandora-common';
import { Observable, type ReadonlyObservable } from '../observable.ts';
import type { ClientServices } from './clientServices.ts';

type BrowserPermissionManagerServiceConfig = Satisfies<{
	dependencies: Pick<ClientServices, never>;
	events: false;
}, ServiceConfigBase>;

export type BrowserPermissionState = 'unsupported' | 'granted' | 'prompt' | 'denied';

const BASE_PERMISSION_GETTERS = {
	notifications: () => {
		switch (globalThis.Notification?.permission) {
			case 'granted':
				return 'granted';
			case 'default':
				return 'prompt';
			case 'denied':
				return 'denied';
		}
		return 'unsupported';
	},
} as const satisfies Partial<Record<PermissionName, () => BrowserPermissionState>>;

function BrowserPermissionStatusToState(status: PermissionStatus): BrowserPermissionState {
	switch (status.state) {
		case 'granted':
			return 'granted';
		case 'prompt':
			return 'prompt';
		case 'denied':
			return 'denied';
	}
	return 'unsupported';
}

export type PandoraBrowserPermission = keyof typeof BASE_PERMISSION_GETTERS;

/**
 * Service for interacting with browser's permissions.
 */
export class BrowserPermissionManager extends Service<BrowserPermissionManagerServiceConfig> {
	private readonly logger = GetLogger('BrowserPermissionManager');

	private readonly _permissionStates = new Observable<Record<PandoraBrowserPermission, BrowserPermissionState>>(ArrayToRecordKeys(KnownObject.keys(BASE_PERMISSION_GETTERS), 'unsupported'));

	public get permissionStates(): ReadonlyObservable<Readonly<Record<PandoraBrowserPermission, BrowserPermissionState>>> {
		return this._permissionStates;
	}

	protected override serviceInit(): void {
		// Do initial query over permissions
		const state = cloneDeep(this._permissionStates.value);
		for (const [p, check] of KnownObject.entries(BASE_PERMISSION_GETTERS)) {
			try {
				state[p] = check();
				this.logger.verbose(`Permission '${p}' initially:`, state[p]);
			} catch (error) {
				this.logger.warning(`Error checking base availability of permission '${p}':`, error);
				state[p] = 'unsupported';
			}
		}

		this._permissionStates.value = state;

		// Ask permissions API for continuous permission updates
		for (const p of KnownObject.keys(BASE_PERMISSION_GETTERS)) {
			(async () => {
				const permissionStatus = await globalThis.navigator.permissions.query({ name: p });
				permissionStatus.onchange = () => {
					const newState = BrowserPermissionStatusToState(permissionStatus);
					if (newState !== this._permissionStates.value[p]) {
						this.logger.info(`Permission '${p}' changed to:`, newState);
						this._permissionStates.produceImmer((d) => {
							d[p] = newState;
						});
					}
				};
				const initialState = BrowserPermissionStatusToState(permissionStatus);
				if (initialState !== this._permissionStates.value[p]) {
					this.logger.info(`Permission '${p}' changed after initial query to:`, initialState);
					this._permissionStates.produceImmer((d) => {
						d[p] = initialState;
					});
				}
			})()
				.catch((error) => {
					this.logger.warning(`Error requesting permission status for permission '${p}':`, error);
				});
		}
	}
}

export const BrowserPermissionManagerServiceProvider: ServiceProviderDefinition<ClientServices, 'browserPermissionManager', BrowserPermissionManagerServiceConfig> = {
	name: 'browserPermissionManager',
	ctor: BrowserPermissionManager,
	dependencies: {},
};
