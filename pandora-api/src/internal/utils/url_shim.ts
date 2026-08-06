/**
 * Pandora's shim of the `URL` global typings, to be mostly runtime-independent,
 * as all runtimes we expect to run in have URL available, but there is no unified typings.
 */
export interface PandoraURL {
	readonly origin: string;
	protocol: string;
	username: string;
	password: string;
	host: string;
	hostname: string;
	port: string;
	pathname: string;
	search: string;
	hash: string;
	href: string;

	toJSON(): string;
}

export interface PandoraURLStatic {
	new(url: string, base?: string | PandoraURL): PandoraURL;
	canParse(url: string, base?: string): boolean;
	parse(url: string, base?: string): PandoraURL | null;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export const URL = (globalThis as unknown as { URL: PandoraURLStatic; }).URL;
