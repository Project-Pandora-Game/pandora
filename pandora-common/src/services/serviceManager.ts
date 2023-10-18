export type Service = {
	init?(): Promise<void> | void;
	onDestroy?(): Promise<void> | void;
};
