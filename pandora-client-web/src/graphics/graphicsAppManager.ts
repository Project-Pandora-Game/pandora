import { cloneDeep } from 'lodash-es';
import { GetLogger, TypedEventEmitter } from 'pandora-common';
import { Application, ApplicationOptions } from 'pixi.js';
import { DestroyGraphicsLoader } from '../assets/assetManager.tsx';
import { USER_DEBUG } from '../config/Environment.ts';

const SHARED_APP_MAX_COUNT = 2;

export const PIXI_APPLICATION_OPTIONS: Readonly<Partial<ApplicationOptions>> = {
	backgroundColor: 0x1099bb,
	resolution: window.devicePixelRatio || 1,
	// Alpha needs to start on a value < 1, otherwise it fails to initialize transparency correctly and cannot be enabled later on
	backgroundAlpha: 0,
	// Antialias **NEEDS** to be explicitly disabled - having it enabled causes seams when using filters (such as alpha masks)
	antialias: false,
};

export async function CreatePixiApplication(multiView: boolean = false): Promise<Application> {
	const app = new Application();
	await app.init({
		...cloneDeep(PIXI_APPLICATION_OPTIONS),
		autoDensity: true,
		autoStart: false,
		multiView,
	});
	return app;
}

function DestroyApplication(app: Application): void {
	app.destroy(true, true);
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
	beforeDestroy: void;
}> {
	private readonly logger = GetLogger('GraphicsApplicationManager');

	private _failed: boolean = false;
	private _app: Application | null = null;

	public get app(): Application | null {
		return this._app;
	}

	constructor() {
		super();
		CreatePixiApplication()
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

	public _triggerBeforeDestroy() {
		this.emit('beforeDestroy', undefined);
	}
}

let cleanupInitialized = false;
function InitCleanupHook() {
	if (cleanupInitialized)
		return;
	cleanupInitialized = true;

	window.addEventListener('beforeunload', function () {
		// Forcefully cleanup any applications currently in use
		// we want to avoid any leaks (that tend to happen despite the fact that browsers _should_ cleanup everything when page is unloaded)
		AvailableApps.splice(0, AvailableApps.length);
		for (const manager of SharedApps.splice(0, SharedApps.length)) {
			try {
				const { app } = manager;
				if (!app)
					continue;
				manager._triggerBeforeDestroy();
				DestroyApplication(app);
			} catch (error) {
				GetLogger('GraphicsApplicationManager').error('Failed to cleanup application:', error);
			}
		}
		DestroyGraphicsLoader();
	});
}

export function GetApplicationManager(): GraphicsApplicationManager | null {
	let app = AvailableApps.pop();
	if (!app && SharedApps.length < SHARED_APP_MAX_COUNT) {
		InitCleanupHook();
		app = new GraphicsApplicationManager();
		SharedApps.push(app);
	}
	return app ?? null;
}

export function ReleaseApplicationManager(app: GraphicsApplicationManager): void {
	AvailableApps.push(app);
}
