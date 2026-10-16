import { describe, expect, it } from '@jest/globals';
import { Logger, LogLevel, type LoggerConfig } from 'pandora-common';
import type { IBaseTokenInfo } from 'pandora-common/networking/api/directory_client';
import { TokenStoreBase } from '../../src/shard/tokenStoreBase.ts';

describe('TokenStoreBase', () => {
	it('does not log the secret when creating a token', async () => {
		const messages: unknown[][] = [];
		const config: LoggerConfig = {
			printTime: false,
			timeLocale: undefined,
			onFatal: [],
			logOutputs: [{
				logLevel: LogLevel.INFO,
				logLevelOverrides: {},
				supportsColor: false,
				onMessage: (_prefix, message) => {
					messages.push(message);
				},
			}],
		};

		class TestTokenStore extends TokenStoreBase<IBaseTokenInfo> {
			constructor() {
				super(new Logger('test', '[test]', config), 8, 8);
				this.generator = (size = 0) => 'x'.repeat(size);
			}

			protected onInit(): void {
				// No-op for this test.
			}

			protected load(): Promise<(IBaseTokenInfo & { token: string; })[]> {
				return Promise.resolve([]);
			}

			protected save(): Promise<void> {
				return Promise.resolve();
			}

			protected _validateExtra(): boolean {
				return true;
			}

			public create(): ReturnType<typeof this._create> {
				return this._create({ id: 1, username: 'test', roles: { isAuthorized: () => false } }, {});
			}
		}

		const result = await new TestTokenStore().create();
		expect(messages).toHaveLength(1);
		expect(JSON.stringify(messages)).not.toContain(result.token);
		expect(JSON.stringify(messages)).not.toContain('"token"');
	});
});
