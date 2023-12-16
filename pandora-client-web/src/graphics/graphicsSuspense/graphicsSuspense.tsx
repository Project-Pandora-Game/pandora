import * as PIXI from 'pixi.js';
import { Container, Graphics } from '@pixi/react';
import { TypedEventEmitter } from 'pandora-common';
import React, { ReactElement, ReactNode, createContext, useCallback, useContext, useLayoutEffect, useMemo, useSyncExternalStore } from 'react';
import { PointLike } from '../graphicsCharacter';

// Time after which a new asset appearing won't hide the container again
const CREATION_STABILIZATION_PERIOD = 1_000;

const GraphicsSuspenseContext = createContext<GraphicsSuspenseManager | null>(null);

export function GraphicsSuspense({
	children,
	loadingCirclePosition,
	loadingCircleRadius,
}: {
	children: ReactNode;
	loadingCirclePosition: PointLike | null;
	loadingCircleRadius?: number;
}): ReactElement {
	const manager = useMemo(() => new GraphicsSuspenseManager(), []);

	const finalLoadingRadius = loadingCircleRadius ?? Math.max(10, loadingCirclePosition != null ? (
		Math.ceil(0.1 * Math.min(loadingCirclePosition.x, loadingCirclePosition.y))
	) : 0);

	const progress = useSyncExternalStore(manager.getSubscriber('update'), () => manager.loadingProgress);

	const drawLoadingCircle = useCallback((g: PIXI.Graphics) => {
		const alpha = 0.6;
		g.clear()
			.lineStyle(2, 0x000000, alpha)
			.beginFill(0x550000, alpha)
			.drawCircle(0, 0, finalLoadingRadius)
			.endFill()
			.beginFill(0x00ff44, alpha)
			.moveTo(0, -finalLoadingRadius)
			.arc(0, 0, finalLoadingRadius, -0.5 * Math.PI, progress * (2 * Math.PI) - 0.5 * Math.PI)
			.lineTo(0, 0)
			.lineTo(0, -finalLoadingRadius)
			.endFill();
	}, [progress, finalLoadingRadius]);

	return (
		<>
			<Container visible={ false } ref={ manager.updateContainerRef }>
				<GraphicsSuspenseContext.Provider value={ manager }>
					{ children }
				</GraphicsSuspenseContext.Provider>
			</Container>
			{
				(loadingCirclePosition != null && manager.loadingProgress < 1) ? (
					<Graphics
						draw={ drawLoadingCircle }
						position={ {
							x: loadingCirclePosition.x,
							y: loadingCirclePosition.y,
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

class GraphicsSuspenseManager extends TypedEventEmitter<{ update: void; }> {
	private readonly _initTime = Date.now();
	private readonly _assets = new Set<GraphicsSuspenseAsset>();

	private _currentContainer: PIXI.Container | null = null;
	private _readyStable = false;
	private _loadingProgress: number = 0;

	public get loadingProgress(): number {
		return this._loadingProgress;
	}

	public readonly updateContainerRef = (container: PIXI.Container | null) => {
		if (this._currentContainer != null) {
			this._currentContainer.visible = false;
			this._currentContainer = null;
		}
		this._currentContainer = container;
		this._update();
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
		if (this._currentContainer == null)
			return;

		let total = 1;
		let ready = 1;
		for (const asset of this._assets) {
			total++;
			if (asset.isReady) {
				ready++;
			}
		}

		const allReady = (ready === total);

		if (!this._readyStable && allReady && (Date.now() >= this._initTime + CREATION_STABILIZATION_PERIOD)) {
			this._readyStable = true;
		}

		this._loadingProgress = allReady ? 1 : ready / total;
		this._currentContainer.visible = allReady || this._readyStable;
		this.emit('update', undefined);
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

