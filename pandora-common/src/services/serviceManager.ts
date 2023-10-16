export type Service = {
	init?(): Promise<Service> | Service;
	onDestroy?(): Promise<void> | void;
};
