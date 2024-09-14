import { throttle } from 'lodash';
import * as PIXI from 'pixi.js';
import React, { ReactElement, useCallback, useMemo, useRef } from 'react';
import { useCharacterData } from '../../character/character';
import { useEvent } from '../../common/useEvent';
import { Container } from '../baseComponents/container';
import { MovementHelperGraphics } from '../movementHelper';
import { CHARACTER_WAIT_DRAG_THRESHOLD, PIVOT_TO_LABEL_OFFSET, useRoomCharacterPosition, type CharacterStateProps, type RoomCharacterInteractiveProps } from './roomCharacter';

export function RoomCharacterMovementTool({
	globalState,
	character,
	...props
}: RoomCharacterInteractiveProps): ReactElement | null {
	const characterState = useMemo(() => globalState.characters.get(character.id), [globalState, character.id]);

	if (!characterState)
		return null;

	return (
		<RoomCharacterMovementToolImpl
			{ ...props }
			globalState={ globalState }
			character={ character }
			characterState={ characterState }
		/>
	);
}

function RoomCharacterMovementToolImpl({
	character,
	characterState,
	projectionResolver,
	setRoomSceneMode,
	shard,
}: RoomCharacterInteractiveProps & CharacterStateProps): ReactElement | null {
	const id = characterState.id;

	const setPositionRaw = useCallback((newX: number, newY: number, newYOffset: number) => {
		shard?.sendMessage('roomCharacterMove', {
			id,
			position: projectionResolver.fixupPosition([newX, newY, newYOffset]),
		});
	}, [id, projectionResolver, shard]);

	const setPositionThrottled = useMemo(() => throttle(setPositionRaw, 100), [setPositionRaw]);

	const {
		position: dataPosition,
	} = useCharacterData(character);

	const {
		position,
		yOffsetExtra,
		scale,
		pivot,
	} = useRoomCharacterPosition(dataPosition, characterState, projectionResolver);

	const labelX = pivot.x;
	const labelY = pivot.y + PIVOT_TO_LABEL_OFFSET;

	const hitAreaRadius = 50;
	const hitArea = useMemo(() => new PIXI.Rectangle(-hitAreaRadius, -hitAreaRadius, 2 * hitAreaRadius, 2 * hitAreaRadius), [hitAreaRadius]);

	const movementHelpersContainer = useRef<PIXI.Container>(null);
	const dragging = useRef<PIXI.Point | null>(null);
	/** Time at which user pressed button/touched */
	const pointerDown = useRef<number | null>(null);
	const pointerDownTarget = useRef<'pos' | 'offset' | null>(null);

	const onDragStart = useCallback((event: PIXI.FederatedPointerEvent) => {
		if (dragging.current || !movementHelpersContainer.current) return;
		dragging.current = event.getLocalPosition<PIXI.Point>(movementHelpersContainer.current.parent);
	}, []);

	const onDragMove = useEvent((event: PIXI.FederatedPointerEvent) => {
		if (!dragging.current || !movementHelpersContainer.current) return;

		if (pointerDownTarget.current === 'pos') {
			const dragPointerEnd = event.getLocalPosition<PIXI.Point>(movementHelpersContainer.current.parent);

			const [newX, newY] = projectionResolver.inverseGivenZ(dragPointerEnd.x, dragPointerEnd.y - PIVOT_TO_LABEL_OFFSET * scale, 0);

			setPositionThrottled(newX, newY, yOffsetExtra);
		} else if (pointerDownTarget.current === 'offset') {
			const dragPointerEnd = event.getLocalPosition<PIXI.Point>(movementHelpersContainer.current);

			const newYOffset = (dragPointerEnd.y - labelY) * -scale;

			setPositionThrottled(dataPosition[0], dataPosition[1], newYOffset);
		}
	});

	const onPointerDownPos = useCallback((event: PIXI.FederatedPointerEvent) => {
		event.stopPropagation();
		pointerDown.current = Date.now();
		pointerDownTarget.current = 'pos';
	}, []);
	const onPointerDownOffset = useCallback((event: PIXI.FederatedPointerEvent) => {
		event.stopPropagation();
		pointerDown.current = Date.now();
		pointerDownTarget.current = 'offset';
	}, []);

	const onPointerUp = useEvent((_event: PIXI.FederatedPointerEvent) => {
		dragging.current = null;
		if (
			pointerDown.current !== null &&
			pointerDownTarget.current != null &&
			Date.now() < pointerDown.current + CHARACTER_WAIT_DRAG_THRESHOLD
		) {
			if (pointerDownTarget.current === 'pos') {
				setRoomSceneMode({ mode: 'normal' });
			} else if (pointerDownTarget.current === 'offset') {
				setPositionThrottled(dataPosition[0], dataPosition[1], 0);
			}
		}
		pointerDown.current = null;
		pointerDownTarget.current = null;
	});

	const onPointerMove = useCallback((event: PIXI.FederatedPointerEvent) => {
		if (pointerDown.current !== null) {
			event.stopPropagation();
		}
		if (dragging.current) {
			onDragMove(event);
		} else if (
			pointerDown.current !== null &&
			pointerDownTarget.current != null &&
			Date.now() >= pointerDown.current + CHARACTER_WAIT_DRAG_THRESHOLD
		) {
			onDragStart(event);
		}
	}, [onDragMove, onDragStart]);

	return (
		<Container
			ref={ movementHelpersContainer }
			position={ position }
			scale={ { x: scale, y: scale } }
			pivot={ pivot }
		>
			<MovementHelperGraphics
				radius={ hitAreaRadius }
				colorLeftRight={ 0xff0000 }
				colorUpDown={ 0x00ff00 }
				position={ { x: labelX, y: labelY } }
				scale={ { x: 1, y: 0.6 } }
				hitArea={ hitArea }
				eventMode='static'
				cursor='move'
				onpointerdown={ onPointerDownPos }
				onpointerup={ onPointerUp }
				onpointerupoutside={ onPointerUp }
				onglobalpointermove={ onPointerMove }
			/>
			<MovementHelperGraphics
				radius={ hitAreaRadius }
				colorUpDown={ 0x0000ff }
				position={ { x: labelX + 110, y: labelY - (yOffsetExtra / scale) } }
				hitArea={ hitArea }
				eventMode='static'
				cursor='ns-resize'
				onpointerdown={ onPointerDownOffset }
				onpointerup={ onPointerUp }
				onpointerupoutside={ onPointerUp }
				onglobalpointermove={ onPointerMove }
			/>
		</Container>
	);
}
