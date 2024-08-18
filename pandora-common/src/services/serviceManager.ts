// Old services code

export type ServerService = {
	init?(): Promise<void> | void;
	onDestroy?(): Promise<void> | void;
};

export async function ServiceInit(service: ServerService): Promise<void> {
	if (service.init) {
		await service.init();
	}
}
