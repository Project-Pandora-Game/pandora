/* eslint-disable @typescript-eslint/naming-convention */
import { GetLogger } from 'pandora-common';
import promClient from 'prom-client';
import { GetDatabase } from '../database/databaseProvider.ts';

new promClient.Gauge({
	name: 'pandora_directory_account_active_total',
	help: 'Total count of accounts active in a given timeframe',
	labelNames: ['period'] as const,
	async collect() {
		const now = Date.now();
		if (ActiveAccountsCacheTime + ACTIVE_ACCOUNTS_CACHE_VALIDITY < now) {
			ActiveAccountsCache = CalculateAccountsMetricCache(now);
			ActiveAccountsCache.catch((err) => {
				GetLogger('Metrics').warning('Error getting active accounts:', err);
			});
			ActiveAccountsCacheTime = now;
		}
		const activeAccounts = await ActiveAccountsCache;

		this.reset();
		this.inc({ period: '1d' }, activeAccounts['1d']);
		this.inc({ period: '7d' }, activeAccounts['7d']);
		this.inc({ period: '30d' }, activeAccounts['30d']);
	},
});

type ActiveAccountsMetricCache = Readonly<{
	'1d': number;
	'7d': number;
	'30d': number;
}>;
const ACTIVE_ACCOUNTS_CACHE_VALIDITY = 25_000;
let ActiveAccountsCache: Promise<ActiveAccountsMetricCache> = Promise.resolve({ '1d': 0, '7d': 0, '30d': 0 });
let ActiveAccountsCacheTime = 0;

async function CalculateAccountsMetricCache(time: number): Promise<ActiveAccountsMetricCache> {
	const db = GetDatabase();

	const results = await Promise.all([
		db.getCountOfAccountsLastLoggedInAfter(time - 1 * 24 * 60 * 60 * 1000),
		db.getCountOfAccountsLastLoggedInAfter(time - 7 * 24 * 60 * 60 * 1000),
		db.getCountOfAccountsLastLoggedInAfter(time - 30 * 24 * 60 * 60 * 1000),
	]);

	return {
		'1d': results[0],
		'7d': results[1],
		'30d': results[2],
	};
}
