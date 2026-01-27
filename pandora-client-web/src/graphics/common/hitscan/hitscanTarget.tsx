import { freeze, type Immutable } from 'immer';
import { GetLogger, type Coordinates } from 'pandora-common';
import type * as PIXI from 'pixi.js';
import { useContext, useDebugValue, useEffect, useRef, type ReactElement } from 'react';
import { Observable, useNullableObservable, type ReadonlyObservable } from '../../../observable.ts';
import { HitscanContext, type HitscanEvent, type HitscanTarget } from './hitscanContext.ts';

export interface HitscanTargetProps extends Pick<HitscanTarget, 'getSelectionButtonContents' | 'onPointerDown' | 'onPointerUp' | 'onPointerUpOutside' | 'onClick' | 'onPointerEnter' | 'onPointerLeave' | 'onPointerMove' | 'onDrag'> {
	hitArea: PIXI.Rectangle;
	/**
	 * If set, then clicks are not propagated to hitscan container's parents
	 * @default false
	 */
	stopClickPropagation?: boolean;
}

export interface HitscanTargetState {
	hover: boolean;
	held: boolean;
}

const DEFAULT_STATE = freeze<Immutable<HitscanTargetState>>({
	hover: false,
	held: false,
}, true);

export function useDefineHitscanTarget(props: HitscanTargetProps | null): Immutable<HitscanTargetState> {
	const hitscanContext = useContext(HitscanContext);

	const hitscanTargetRef = useRef<HitscanTargetRect | null>(null);

	if (props == null) {
		hitscanTargetRef.current = null;
	} else {
		if (hitscanTargetRef.current == null) {
			hitscanTargetRef.current = new HitscanTargetRect(props);
		} else {
			// Update props while preserving target's identity
			hitscanTargetRef.current.updateProps(props);
		}
	}
	const hitscanTarget = hitscanTargetRef.current;

	useDebugValue(hitscanTarget);

	useEffect(() => {
		if (hitscanTarget == null)
			return;

		const logger = GetLogger('useDefineHitscanTarget');

		if (hitscanContext == null) {
			logger.warning('Using hitscan target outside of hitscan context with have no effect');
			return;
		}

		return hitscanContext.registerTarget(hitscanTarget);
	}, [hitscanContext, hitscanTarget]);

	return useNullableObservable(hitscanTarget?.state) ?? DEFAULT_STATE;
}

export class HitscanTargetRect implements HitscanTarget {
	private readonly _state = new Observable<Immutable<HitscanTargetState>>(DEFAULT_STATE);
	public get state(): ReadonlyObservable<Immutable<HitscanTargetState>> {
		return this._state;
	}

	private _props: HitscanTargetProps;

	public get stopClickPropagation(): boolean {
		return this._props.stopClickPropagation === true;
	}

	constructor(props: HitscanTargetProps) {
		this._props = props;
	}

	public updateProps(props: HitscanTargetProps) {
		this._props = props;
	}

	public contains(pos: Readonly<Coordinates>): boolean {
		return this._props.hitArea.contains(pos.x, pos.y);
	}

	public getSelectionButtonContents(): ReactElement {
		return this._props.getSelectionButtonContents();
	}

	public readonly onPointerDown: ((pos: Readonly<HitscanEvent>) => void) = (pos) => {
		this._state.produceImmer((d) => {
			d.held = true;
		});
		this._props.onPointerDown?.(pos);
	};

	public readonly onPointerUp: ((pos: Readonly<HitscanEvent>) => void) = (pos) => {
		this._state.produceImmer((d) => {
			d.held = false;
		});
		this._props.onPointerUp?.(pos);
	};

	public readonly onPointerUpOutside: (() => void) = () => {
		this._state.produceImmer((d) => {
			d.held = false;
		});
		this._props.onPointerUpOutside?.();
	};

	public readonly onClick: ((pos: Readonly<HitscanEvent>, fromSelectionMenu: boolean) => void) = (pos, fromSelectionMenu) => {
		this._props.onClick?.(pos, fromSelectionMenu);
	};

	public readonly onPointerEnter: (() => void) = () => {
		this._state.produceImmer((d) => {
			d.hover = true;
		});
		this._props.onPointerEnter?.();
	};

	public readonly onPointerLeave: (() => void) = () => {
		this._state.produceImmer((d) => {
			d.hover = false;
		});
		this._props.onPointerLeave?.();
	};

	public readonly onPointerMove: ((pos: Readonly<HitscanEvent>) => void) = (pos) => {
		this._props.onPointerMove?.(pos);
	};

	public readonly onDrag: ((pos: Readonly<HitscanEvent>, start: Readonly<HitscanEvent>) => void) = (pos, start) => {
		this._props.onDrag?.(pos, start);
	};
}
