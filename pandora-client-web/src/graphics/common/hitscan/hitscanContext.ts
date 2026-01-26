import type { Coordinates } from 'pandora-common';
import { createContext, type ReactElement } from 'react';

export interface HitscanContextProvider {
	registerTarget(target: HitscanTarget): (() => void);
}

export interface HitscanEvent extends Coordinates {
	pageX: number;
	pageY: number;
}

export interface HitscanTarget {
	readonly stopClickPropagation: boolean;
	getSelectionButtonContents(): ReactElement;

	/**
	 * Check whether this target contains the given position
	 * @param pos The position to scan, relative to the hitscan container
	 */
	contains(pos: Readonly<Coordinates>): boolean;

	/** Only triggers if this is the only matching target */
	onPointerDown?: (pos: Readonly<HitscanEvent>) => void;
	onPointerUp?: (pos: Readonly<HitscanEvent>) => void;
	onPointerUpOutside?: () => void;

	/**
	 * Usually happens in a sequence `onPointerDown` -> `onPointerUp` -> `onClick`.
	 * Note, that it can happen witout this, as a result of menu selection!
	 * @param pos - Position of the click. In case of menu selection, click before the menu opened.
	 * @param fromSelectionMenu - If the click happened from selection menu (`true`) or directly (`false`)
	 */
	onClick?: (pos: Readonly<HitscanEvent>, fromSelectionMenu: boolean) => void;

	onPointerEnter?: () => void;
	onPointerLeave?: () => void;
	/**
	 * When mouse moves over, even if this isn't the only target
	 * @param pos - Position of the mouse, relative to the hitscan container
	 */
	onPointerMove?: (pos: Readonly<HitscanEvent>) => void;
	/**
	 * When mouse moves while holding down on this target. Triggers even if mouse moves outside of it.
	 * Triggers right before `onPointerUp` as well.
	 * @param pos - The new position after drag.
	 * @param start - The original position, same as passed to `onPointerDown`
	 */
	onDrag?: (pos: Readonly<HitscanEvent>, start: Readonly<HitscanEvent>) => void;
}

export const HitscanContext = createContext<HitscanContextProvider | null>(null);
