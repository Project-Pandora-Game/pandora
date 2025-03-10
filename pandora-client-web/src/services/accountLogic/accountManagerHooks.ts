import type { Immutable } from 'immer';
import {
	ACCOUNT_SETTINGS_DEFAULT,
	type AccountSettings,
	type IDirectoryAccountInfo,
} from 'pandora-common';
import { useMemo } from 'react';
import { useNullableObservable, useObservable } from '../../observable.ts';
import { useService, useServiceOptional } from '../serviceProvider.tsx';
import type { AccountManager } from './accountManager.ts';

export function useCurrentAccount(): IDirectoryAccountInfo | null {
	const accountManager = useService('accountManager');
	return useObservable(accountManager.currentAccount);
}

/**
 * Gets modified settings for the current account.
 * @returns The partial settings object, or `undefined` if no account is loaded.
 */
export function useModifiedAccountSettings(): Immutable<Partial<AccountSettings>> | undefined {
	// Get account manually to avoid error in the editor
	return useNullableObservable(useServiceOptional('accountManager')?.currentAccount)?.settings;
}

/**
 * Resolves full account settings to their effective values.
 * @returns The settings that apply to this account.
 */
export function useAccountSettings(): Immutable<AccountSettings> {
	const modifiedSettings = useModifiedAccountSettings();
	return useMemo((): Immutable<AccountSettings> => ({
		...ACCOUNT_SETTINGS_DEFAULT,
		...modifiedSettings,
	}), [modifiedSettings]);
}

export function GetAccountSettings(accountManager: AccountManager): Immutable<AccountSettings> {
	return {
		...ACCOUNT_SETTINGS_DEFAULT,
		...(accountManager.currentAccount?.value?.settings),
	};
}
