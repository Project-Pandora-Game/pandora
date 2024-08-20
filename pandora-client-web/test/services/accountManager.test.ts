import type { RenderHookResult } from '@testing-library/react';
import { useCurrentAccount } from '../../src/services/accountLogic/accountManagerHooks';
import { MockServiceManager, RenderHookWithProviders, type ProvidersProps } from '../testUtils';
import { Assert, type ServiceManager } from 'pandora-common';
import type { ClientServices } from '../../src/services/clientServices';
import type { AccountManager } from '../../src/services/accountLogic/accountManager';

describe('AccountManager', () => {
	let serviceManager: ServiceManager<ClientServices>;
	let accountManager: AccountManager;

	beforeEach(() => {
		serviceManager = MockServiceManager();
		Assert(serviceManager.services.accountManager != null);
		accountManager = serviceManager.services.accountManager;
	});

	describe('useCurrentAccount', () => {
		it('should return the directory connector\'s current account information', () => {
			const { result } = renderHookWithTestProviders(useCurrentAccount);
			expect(result.current).toBe(accountManager.currentAccount.value);
		});
	});

	function renderHookWithTestProviders<Result, Props>(
		hook: (initialProps?: Props) => Result,
		providerPropOverrides?: Partial<Omit<ProvidersProps, 'children'>>,
	): RenderHookResult<Result, Props> {
		return RenderHookWithProviders(hook, { serviceManager, ...providerPropOverrides });
	}
});

