import { cloneDeep } from 'lodash';
import { GetLogger, TypedEventEmitter } from 'pandora-common';
import { Application, ApplicationOptions } from 'pixi.js';
import { USER_DEBUG } from '../config/Environment';

const SHARED_APP_MAX_COUNT = 2;

export const PIXI_APPLICATION_OPTIONS: Readonly<Partial<ApplicationOptions>> = {
	backgroundColor: 0x1099bb,
	resolution: window.devicePixelRatio || 1,
	// Antialias **NEEDS** to be explicitly disabled - having it enabled causes seams when using filters (such as alpha masks)
	antialias: false,
};

async function CreateApplication(): Promise<Application> {
	const app = new Application();
	await app.init({
		...cloneDeep(PIXI_APPLICATION_OPTIONS),
		autoDensity: true,
		autoStart: false,
	});
	return app;
}

// This actually has more effect than just exposing for debugging purposes:
// It allows hot reload to reuse existing apps instead of having leak during development
interface WindowWithSharedApps extends Window {
	pandoraPixiApps?: GraphicsApplicationManager[];
	pandoraPixiAppsAvailable?: GraphicsApplicationManager[];
}

const SharedApps: GraphicsApplicationManager[] = (USER_DEBUG && Array.isArray((window as WindowWithSharedApps).pandoraPixiApps)) ? ((window as WindowWithSharedApps).pandoraPixiApps ?? []) : [];
const AvailableApps: GraphicsApplicationManager[] = (USER_DEBUG && Array.isArray((window as WindowWithSharedApps).pandoraPixiAppsAvailable)) ? ((window as WindowWithSharedApps).pandoraPixiAppsAvailable ?? []) : [];

if (USER_DEBUG) {
	(window as WindowWithSharedApps).pandoraPixiApps = SharedApps;
	(window as WindowWithSharedApps).pandoraPixiAppsAvailable = AvailableApps;
}

export class GraphicsApplicationManager extends TypedEventEmitter<{
	applicationReady: Application;
}> {
	private readonly logger = GetLogger('GraphicsApplicationManager');

	private _failed: boolean = false;
	private _app: Application | null = null;

	public get app(): Application | null {
		return this._app;
	}

	constructor() {
		super();
		CreateApplication()
			.then((app) => {
				this._failed = false;
				this._app = app;
				this.logger.debug('Pixi application loaded.');
				this.emit('applicationReady', app);
			})
			.catch((err: unknown) => {
				this._failed = true;
				this.logger.error('Failed to create Pixi application:', err);
			});
	}
}

export function GetApplicationManager(): GraphicsApplicationManager | null {
	let app = AvailableApps.pop();
	if (!app && SharedApps.length < SHARED_APP_MAX_COUNT) {
		app = new GraphicsApplicationManager();
		SharedApps.push(app);
	}
	return app ?? null;
}

export function ReleaseApplicationManager(app: GraphicsApplicationManager): void {
	AvailableApps.push(app);
}
