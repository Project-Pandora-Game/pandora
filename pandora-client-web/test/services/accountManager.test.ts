import type { RenderHookResult } from '@testing-library/react';
import { Assert, type ServiceManager } from 'pandora-common';
import type { IAccountManager } from '../../src/services/accountLogic/accountManager.ts';
import { useCurrentAccount } from '../../src/services/accountLogic/accountManagerHooks.ts';
import type { ClientServices } from '../../src/services/clientServices.ts';
import { MockServiceManager, RenderHookWithProviders, type ProvidersProps } from '../testUtils.tsx';

describe('AccountManager', () => {
	let serviceManager: ServiceManager<ClientServices>;
	let accountManager: IAccountManager;

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

