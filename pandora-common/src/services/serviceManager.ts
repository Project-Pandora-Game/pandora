export type Service = {
	init(): Promise<Service> | Service;
	onDestroy?(): void;
};
