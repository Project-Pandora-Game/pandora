import { GetLogger } from 'pandora-common';
import type * as PIXI from 'pixi.js';
import { useContext, useEffect, useRef, type FC, type ReactElement, type RefObject } from 'react';
import type { ChildrenProps } from '../../../common/reactTypes.ts';
import { Button } from '../../../components/common/button/button.tsx';
import { Column } from '../../../components/common/container/container.tsx';
import { useContextMenuPosition } from '../../../components/contextMenu/contextMenu.tsx';
import { DialogInPortal, DraggableDialogPriorityContext } from '../../../components/dialog/dialog.tsx';
import type { PointLike } from '../point.ts';
import { HitscanContext, type HitscanContextProvider, type HitscanEvent, type HitscanTarget } from './hitscanContext.ts';

interface HitscanContainerProviderProps extends ChildrenProps {
	containerRef: Readonly<RefObject<PIXI.Container | null>>;
	openContextMenu: (component: FC<{ onClose: () => void; }>) => void;
}

export function HitscanContainerProvider({ containerRef, openContextMenu, children }: HitscanContainerProviderProps): ReactElement {
	const hitscanContainerRef = useRef<HitscanContainer>(undefined);
	if (hitscanContainerRef.current === undefined) {
		hitscanContainerRef.current = new HitscanContainer();
	}
	const hitscanContainer = hitscanContainerRef.current;
	hitscanContainer.openContextMenu = openContextMenu;

	useEffect(() => {
		const logger = GetLogger('HitscanContainerProvider');
		const container = containerRef.current;

		if (container == null) {
			logger.error('No container to attach hitscan container provider to');
			return;
		}

		const onPointerDown = (event: PIXI.FederatedPointerEvent) => {
			// Ignore middle mouse button
			if (event.button === 1)
				return;

			hitscanContainer.onPointerDown(event, container);
		};
		const onPointerUp = (event: PIXI.FederatedPointerEvent) => {
			// Ignore middle mouse button
			if (event.button === 1)
				return;

			hitscanContainer.onPointerUp(event, container);
		};
		const onPointerUpOutside = (event: PIXI.FederatedPointerEvent) => {
			// Ignore middle mouse button
			if (event.button === 1)
				return;

			hitscanContainer.onPointerUpOutside(event, container);
		};
		const onGlobalPointerMove = (event: PIXI.FederatedPointerEvent) => {
			hitscanContainer.onGlobalPointerMove(event, container);
		};
		const onPointerEnter = (event: PIXI.FederatedPointerEvent) => {
			hitscanContainer.onPointerEnter(event, container);
		};
		const onPointerLeave = (event: PIXI.FederatedPointerEvent) => {
			hitscanContainer.onPointerLeave(event, container);
		};

		container.addEventListener('pointerdown', onPointerDown);
		container.addEventListener('pointerup', onPointerUp);
		container.addEventListener('pointerupoutside', onPointerUpOutside);
		container.addEventListener('globalpointermove', onGlobalPointerMove);
		container.addEventListener('pointerenter', onPointerEnter);
		container.addEventListener('pointerleave', onPointerLeave);

		return () => {
			container.removeEventListener('pointerdown', onPointerDown);
			container.removeEventListener('pointerup', onPointerUp);
			container.removeEventListener('pointerupoutside', onPointerUpOutside);
			container.removeEventListener('globalpointermove', onGlobalPointerMove);
			container.removeEventListener('pointerenter', onPointerEnter);
			container.removeEventListener('pointerleave', onPointerLeave);
		};
	}, [containerRef, hitscanContainer]);

	return (
		<HitscanContext.Provider value={ hitscanContainer }>
			{ children }
		</HitscanContext.Provider>
	);
}

type HitscanTargetData = {
	readonly target: HitscanTarget;
	hover: boolean;
	held: {
		start: Readonly<HitscanEvent>;
		/** If there were multiple targets, the held is suppressed - the target is not informed about it */
		suppressed: boolean;
	} | null;
};

export class HitscanContainer implements HitscanContextProvider {
	private readonly _targets = new Set<HitscanTargetData>();
	public openContextMenu: HitscanContainerProviderProps['openContextMenu'] | undefined;

	public registerTarget(target: HitscanTarget): (() => void) {
		const targetData: HitscanTargetData = {
			target,
			hover: false,
			held: null,
		};

		this._targets.add(targetData);
		return () => {
			if (targetData.hover) {
				target.onPointerLeave?.();
				targetData.hover = false;
			}

			if (targetData.held !== null) {
				if (!targetData.held.suppressed) {
					target.onPointerUpOutside?.();
				}
				targetData.held = null;
			}

			this._targets.delete(targetData);
		};
	}

	public onPointerDown(event: PIXI.FederatedPointerEvent, container: PIXI.Container) {
		const pos: Readonly<HitscanEvent> = this._toHitscanEvent(event, container);
		const matching = this._moveTo(pos);

		// If there is a single matching target, use pointer down
		if (matching.length === 1) {
			const t = matching[0];
			t.held = {
				start: pos,
				suppressed: false,
			};
			t.target.onPointerDown?.(pos);
			if (t.target.stopClickPropagation) {
				event.stopPropagation();
			}
		} else {
			// Otherwise note it down without triggering any `onPointerDown`.
			for (const t of matching) {
				t.held = {
					start: pos,
					suppressed: true,
				};
				if (t.target.stopClickPropagation) {
					event.stopPropagation();
				}
			}
		}
	}

	public onPointerUp(event: PIXI.FederatedPointerEvent, container: PIXI.Container) {
		const pos: Readonly<HitscanEvent> = this._toHitscanEvent(event, container);
		const matching = this._moveTo(pos);

		// Go through matching targets and note down those that are held
		const clicks: HitscanTargetData[] = [];

		for (const t of matching) {
			if (t.held !== null) {
				clicks.push(t);
				if (!t.held.suppressed) {
					t.target.onPointerUp?.(pos);
				}
				t.held = null;
			}
		}

		// Clear all remaining (non-hit) targets
		for (const t of this._targets) {
			if (t.held !== null) {
				if (!t.held.suppressed) {
					t.target.onPointerUpOutside?.();
				}
				t.held = null;
			}
		}

		// If there is a single click target, do the click
		if (clicks.length === 1) {
			const t = clicks[0];
			t.target.onClick?.(pos, false);
		} else if (clicks.length > 1) {
			// If there is more, do a selection menu
			const contextMenuPosition: PointLike = {
				x: event.pageX,
				y: event.pageY,
			};
			this.openContextMenu?.(({ onClose }) => {
				const ref = useContextMenuPosition(contextMenuPosition);
				const priority = useContext(DraggableDialogPriorityContext);

				return (
					<DialogInPortal priority={ priority }>
						<div className='context-menu' ref={ ref } onPointerDown={ (e) => e.stopPropagation() }>
							<Column overflowY='auto' padding='small'>
								{ clicks.map((click, i) => (
									<Button key={ i } theme='transparent' onClick={ () => {
										onClose();
										click.target.onClick?.(pos, true);
									} }>
										{ click.target.getSelectionButtonContents() }
									</Button>
								)) }
								<hr />
								<Button theme='transparent' onClick={ onClose } >
									Close
								</Button>
							</Column>
						</div>
					</DialogInPortal>
				);
			});
		}
	}

	public onPointerUpOutside(_event: PIXI.FederatedPointerEvent, _container: PIXI.Container) {
		this._moveTo(null);

		// Clear all held states
		for (const targetData of this._targets) {
			if (targetData.held !== null) {
				if (!targetData.held.suppressed) {
					targetData.target.onPointerUpOutside?.();
				}
				targetData.held = null;
			}
		}
	}

	public onGlobalPointerMove(event: PIXI.FederatedPointerEvent, container: PIXI.Container) {
		const pos: Readonly<HitscanEvent> = this._toHitscanEvent(event, container);
		this._moveTo(pos);
	}

	public onPointerEnter(event: PIXI.FederatedPointerEvent, container: PIXI.Container) {
		const pos: Readonly<HitscanEvent> = this._toHitscanEvent(event, container);
		this._moveTo(pos);
	}

	public onPointerLeave(_event: PIXI.FederatedPointerEvent, _container: PIXI.Container) {
		this._moveTo(null);
	}

	private _toHitscanEvent(event: PIXI.FederatedPointerEvent, container: PIXI.Container): HitscanEvent {
		const pixiPos = event.getLocalPosition(container);
		return {
			x: pixiPos.x,
			y: pixiPos.y,
			pageX: event.pageX,
			pageY: event.pageY,
		};
	}

	/**
	 * Move pointer to position, handle pointer enter/leave, drag, and return list of matching targets
	 * @param pos
	 */
	private _moveTo(pos: Readonly<HitscanEvent> | null): HitscanTargetData[] {
		const matching: HitscanTargetData[] = [];

		for (const target of this._targets) {
			// If target is already held, emit drag events
			if (target.held !== null && !target.held.suppressed && pos !== null) {
				target.target.onDrag?.(pos, target.held.start);
			}

			if (pos !== null && target.target.contains(pos)) {
				matching.push(target);

				if (!target.hover) {
					target.hover = true;
					target.target.onPointerEnter?.();
				}
				target.target.onPointerMove?.(pos);
			} else {
				if (target.hover) {
					target.hover = false;
					target.target.onPointerLeave?.();
				}
			}
		}

		return matching;
	}
}
