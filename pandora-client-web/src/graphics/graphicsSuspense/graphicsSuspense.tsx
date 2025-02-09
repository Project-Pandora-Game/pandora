import { TypedEventEmitter } from 'pandora-common';
import * as PIXI from 'pixi.js';
import { ReactElement, ReactNode, createContext, useContext, useLayoutEffect, useMemo } from 'react';
import { Container } from '../baseComponents/container';
import { Graphics } from '../baseComponents/graphics';
import { PointLike } from '../graphicsCharacter';
import { PixiElementRequestUpdate } from '../reconciler/element';

/** Time after which a new asset appearing won't hide the container again */
const CREATION_STABILIZATION_PERIOD = 1_000;
/** Time during which progressbar won't show if it was hidden */
const PROGRESS_GRACE_PERIOD = 500;
/** Base radius used for loading graphics. Needs to be decently big to avoid artifacts */
const LOADING_PROGRESS_BASE_RADIUS = 100;

const GraphicsSuspenseContext = createContext<GraphicsSuspenseManager | null>(null);

export function GraphicsSuspense({
	children,
	loadingCirclePosition,
	loadingCircleRadius,
	sortableChildren = false,
}: {
	children: ReactNode;
	loadingCirclePosition: PointLike | null;
	loadingCircleRadius?: number;
	sortableChildren?: boolean;
}): ReactElement {
	const manager = useMemo(() => new GraphicsSuspenseManager(), []);

	const finalLoadingRadius = loadingCircleRadius ?? Math.max(10, loadingCirclePosition != null ? (
		Math.ceil(0.1 * Math.min(loadingCirclePosition.x, loadingCirclePosition.y))
	) : 0);

	return (
		<>
			<Container
				ref={ manager.updateContainerRef }
				visible={ false }
				sortableChildren={ sortableChildren }
			>
				<GraphicsSuspenseContext.Provider value={ manager }>
					{ children }
				</GraphicsSuspenseContext.Provider>
			</Container>
			{
				(loadingCirclePosition != null) ? (
					<Graphics
						ref={ manager.updateProgressGraphicsRef }
						visible={ false }
						position={ {
							x: loadingCirclePosition.x,
							y: loadingCirclePosition.y,
						} }
						scale={ {
							x: finalLoadingRadius / LOADING_PROGRESS_BASE_RADIUS,
							y: finalLoadingRadius / LOADING_PROGRESS_BASE_RADIUS,
						} }
					/>
				) : null
			}
		</>
	);
}

export function useRegisterSuspenseAsset(): GraphicsSuspenseAsset {
	const manager = useContext(GraphicsSuspenseContext);
	const asset = useMemo(() => new GraphicsSuspenseAsset(), []);

	useLayoutEffect(() => {
		if (manager == null)
			return;

		return manager.registerAsset(asset);
	}, [manager, asset]);

	return asset;
}

class GraphicsSuspenseManager {
	private readonly _initTime = Date.now();
	private readonly _assets = new Set<GraphicsSuspenseAsset>();

	private _currentContainer: PIXI.Container | null = null;
	private _currentProgressGraphics: PIXI.Graphics | null = null;

	private _ready: boolean = false;
	private _showProgress: boolean = true;
	private _loadingProgress: number = 0;

	private _showProgressDelayTimer: number | null = null;

	public readonly updateContainerRef = (container: PIXI.Container | null) => {
		if (this._currentContainer != null) {
			this._currentContainer.visible = false;
			this._currentContainer = null;
		}
		this._currentContainer = container;
		this._updateGraphics();
	};

	public readonly updateProgressGraphicsRef = (graphics: PIXI.Graphics | null) => {
		if (this._currentProgressGraphics != null) {
			this._currentProgressGraphics.visible = false;
			this._currentProgressGraphics = null;
		}
		this._currentProgressGraphics = graphics;
		this._updateGraphics();
	};

	public registerAsset(asset: GraphicsSuspenseAsset): () => void {
		this._assets.add(asset);

		const handlerCleanup = asset.on('update', () => {
			this._update();
		});
		this._update();

		return () => {
			handlerCleanup();
			this._assets.delete(asset);
			this._update();
		};
	}

	private _update(): void {
		let total = 1;
		let ready = 1;
		for (const asset of this._assets) {
			total++;
			if (asset.isReady) {
				ready++;
			}
		}

		const allReady = (ready === total);

		// If the previous state or new state is ready, check about changing to the stable state if the stabilization period passed
		let readyStable = false;
		if ((allReady || this._ready) && (Date.now() >= this._initTime + CREATION_STABILIZATION_PERIOD)) {
			readyStable = true;
		}

		this._loadingProgress = allReady ? 1 : ready / total;
		this._ready = allReady || readyStable;
		if (!this._ready) {
			this._showProgress = true;
		} else if (this._loadingProgress === 1) {
			this._showProgress = false;
			if (this._showProgressDelayTimer != null) {
				clearTimeout(this._showProgressDelayTimer);
				this._showProgressDelayTimer = null;
			}
		} else if (!this._showProgress && this._showProgressDelayTimer == null) {
			// We want to show progress even if ready, but only with delay
			this._showProgressDelayTimer = setTimeout(() => {
				this._showProgressDelayTimer = null;
				if (this._loadingProgress < 1) {
					this._showProgress = true;
					this._updateGraphics();
				}
			}, PROGRESS_GRACE_PERIOD);
		}
		this._updateGraphics();
	}

	private _updateGraphics(): void {
		if (this._currentContainer != null && !this._currentContainer.destroyed) {
			this._currentContainer.visible = this._ready;
			PixiElementRequestUpdate(this._currentContainer);
		}

		if (this._currentProgressGraphics != null && !this._currentProgressGraphics.destroyed) {
			const g = this._currentProgressGraphics;
			if (this._showProgress) {
				const alpha = 0.6;
				g.clear()
					.circle(0, 0, LOADING_PROGRESS_BASE_RADIUS)
					.fill({ color: 0x550000, alpha })
					.stroke({ width: 2, color: 0x000000, alpha })
					.moveTo(0, -LOADING_PROGRESS_BASE_RADIUS)
					.arc(0, 0, LOADING_PROGRESS_BASE_RADIUS, -0.5 * Math.PI, this._loadingProgress * (2 * Math.PI) - 0.5 * Math.PI)
					.lineTo(0, 0)
					.lineTo(0, -LOADING_PROGRESS_BASE_RADIUS)
					.fill({ color: 0x00ff44, alpha })
					.stroke({ width: 2, color: 0x000000, alpha });
				g.visible = true;
			} else {
				g.clear();
				g.visible = false;
			}
			PixiElementRequestUpdate(this._currentProgressGraphics);
		}
	}
}

class GraphicsSuspenseAsset extends TypedEventEmitter<{ update: void; }> {
	private _isReady: boolean = false;

	public get isReady(): boolean {
		return this._isReady;
	}

	public setReady(value: boolean) {
		if (this._isReady === value)
			return;

		this._isReady = value;
		this.emit('update', undefined);
	}
}
