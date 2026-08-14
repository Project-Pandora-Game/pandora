import { ConnectToPandoraApi, WELL_KNOWN_SERVER_ADDRESSES, type PandoraApi } from 'pandora-api/api';
import { AsyncSynchronized, GetLogger, PandoraAccessTokenSchema, Service, type Satisfies, type ServiceConfigBase, type ServiceProviderDefinition } from 'pandora-common';
import type { CliServices } from './cliServices.ts';

type CliApiManagerServiceConfig = Satisfies<{
	dependencies: Pick<CliServices, never>;
	events: false;
}, ServiceConfigBase>;

export class CliApiManagerService extends Service<CliApiManagerServiceConfig> {
	private readonly logger = GetLogger('CliApiManagerService');

	private _api: PandoraApi | null = null;

	@AsyncSynchronized()
	public async getApi(): Promise<PandoraApi> {
		if (this._api != null)
			return this._api;

		let address = process.env.PANDORA_API_SERVER?.trim();
		if (!address) {
			address = 'main';
		} else if (!Object.hasOwn(WELL_KNOWN_SERVER_ADDRESSES, address)) {
			// If it isn't a well-known address, it must be an URL
			if (!URL.canParse(address)) {
				this.logger.error(`Invalid server address "${address}". Valid values: ${Object.keys(WELL_KNOWN_SERVER_ADDRESSES).join('|')} or URL path to Directory server's api_socket.io.`);
				throw new Error('Invalid server address specified');
			}
		}

		const token = process.env.PANDORA_API_TOKEN?.trim();
		if (!token) {
			this.logger.error('Missing PANDORA_API_TOKEN. Specify the token using environment variable or the .env file.');
			throw new Error('Missing PANDORA_API_TOKEN');
		}
		const parsedToken = PandoraAccessTokenSchema.safeParse(token);
		if (!parsedToken.success) {
			this.logger.error('Invalid PANDORA_API_TOKEN. Pandora API tokens begin with "pdr_at_" and can be obtained through Client\'s Settings -> Advanced Settings -> Access Tokens');
			throw new Error('Invalid PANDORA_API_TOKEN');
		}

		const connectResult = (await ConnectToPandoraApi({
			token: parsedToken.data,
			directoryConnectionAddress: address,
		}));

		if (connectResult.is_err()) {
			throw new Error('Failed to connect to API', { cause: connectResult.error });
		}

		this._api = connectResult.value;
		return connectResult.value;
	}

	public close() {
		if (this._api != null) {
			this._api.close();
			this._api = null;
		}
	}
}

export const CliApiManagerServiceProvider: ServiceProviderDefinition<CliServices, 'apiManager', CliApiManagerServiceConfig> = {
	name: 'apiManager',
	ctor: CliApiManagerService,
	dependencies: {},
};
