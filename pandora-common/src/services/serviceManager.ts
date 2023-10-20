export type Service = {
	init?(): Promise<void> | void;
	onDestroy?(): Promise<void> | void;
};

export async function ServiceInit(service: Service): Promise<void> {
	if (service.init) {
		await service.init();
	}
}
