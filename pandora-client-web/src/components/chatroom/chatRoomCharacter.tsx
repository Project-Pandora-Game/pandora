import { CalculateCharacterMaxYForBackground, CharacterSize, CharacterView, ICharacterRoomData, IChatroomBackgroundData, IChatRoomClientData } from 'pandora-common';
import PIXI, { FederatedPointerEvent, Filter, Point, Rectangle, TextStyle } from 'pixi.js';
import React, { ReactElement, useCallback, useEffect, useMemo, useRef } from 'react';
import { Character, useCharacterAppearanceView } from '../../character/character';
import { ShardConnector } from '../../networking/shardConnector';
import _ from 'lodash';
import { ChatroomDebugConfig } from './chatroomDebug';
import { GraphicsCharacter } from '../../graphics/graphicsCharacter';
import { Container, Graphics, Text, useApp } from '@pixi/react';
import { useAppearanceConditionEvaluator } from '../../graphics/appearanceConditionEvaluator';
import { useEvent } from '../../common/useEvent';
import { MASK_SIZE } from '../../graphics/graphicsLayer';

type ChatRoomCharacterProps = {
	character: Character<ICharacterRoomData>;
	data: IChatRoomClientData | null;
	debugConfig: ChatroomDebugConfig;
	background: IChatroomBackgroundData;
	shard: ShardConnector | null;
	menuOpen: (character: Character<ICharacterRoomData>, data: FederatedPointerEvent) => void;
	filters: Filter[];
};

const BOTTOM_NAME_OFFSET = 100;
const CHARACTER_WAIT_DRAG_THRESHOLD = 100; // ms

export function ChatRoomCharacter({
	character,
	data,
	debugConfig,
	background,
	shard,
	menuOpen,
	filters,
}: ChatRoomCharacterProps): ReactElement {
	const app = useApp();
	const evaluator = useAppearanceConditionEvaluator(character);

	const setPositionRaw = useEvent((newX: number, newY: number): void => {
		const maxY = CalculateCharacterMaxYForBackground(background);

		newX = _.clamp(Math.round(newX), 0, background.size[0]);
		newY = _.clamp(Math.round(newY), 0, maxY);
		shard?.sendMessage('chatRoomCharacterMove', {
			id: character.data.id,
			position: [newX, newY],
		});
	});

	const setPositionThrottled = useMemo(() => _.throttle(setPositionRaw, 100), [setPositionRaw]);

	const [width, height] = background.size;
	const scaling = background.scaling;
	const x = Math.min(width, character.data.position[0]);
	const y = Math.min(height, character.data.position[1]);

	let baseScale = 1;
	if (evaluator.getBoneLikeValue('sitting') > 0) {
		baseScale *= 0.9;
	}

	const scale = baseScale * (1 - (y * scaling) / height);

	const backView = useCharacterAppearanceView(character) === CharacterView.BACK;

	const scaleX = backView ? -1 : 1;

	const yOffset = 0
		+ 1.75 * evaluator.getBoneLikeValue('kneeling')
		+ 0.75 * evaluator.getBoneLikeValue('sitting')
		+ (evaluator.getBoneLikeValue('kneeling') === 0 ? -0.2 : 0) * evaluator.getBoneLikeValue('tiptoeing');

	const labelX = CharacterSize.WIDTH / 2;
	const labelY = CharacterSize.HEIGHT - BOTTOM_NAME_OFFSET - yOffset;

	const hitArea = useMemo(() => new Rectangle(labelX - 100, labelY - 50, 200, 100), [labelX, labelY]);

	const characterContainer = useRef<PIXI.Container>(null);
	const dragging = useRef<Point | null>(null);
	/** Time at which user pressed button/touched */
	const pointerDown = useRef<number | null>(null);

	const onDragStart = useCallback((event: FederatedPointerEvent) => {
		if (dragging.current || !characterContainer.current) return;
		dragging.current = event.getLocalPosition<Point>(characterContainer.current.parent);
	}, []);

	const onDragMove = useEvent((event: FederatedPointerEvent) => {
		if (!dragging.current || !data || !characterContainer.current) return;
		const dragPointerEnd = event.getLocalPosition<Point>(characterContainer.current.parent);

		const newY = (dragPointerEnd.y - height + baseScale * BOTTOM_NAME_OFFSET) / ((scaling / height) * baseScale * BOTTOM_NAME_OFFSET - 1);

		setPositionThrottled(dragPointerEnd.x, newY);
	});

	const onPointerDown = useCallback((event: FederatedPointerEvent) => {
		event.stopPropagation();
		pointerDown.current = Date.now();
	}, []);

	const onPointerUp = useEvent((event: FederatedPointerEvent) => {
		dragging.current = null;
		if (pointerDown.current !== null && Date.now() < pointerDown.current + CHARACTER_WAIT_DRAG_THRESHOLD) {
			menuOpen(character, event);
		}
		pointerDown.current = null;
	});

	const onPointerMove = useCallback((event: FederatedPointerEvent) => {
		if (pointerDown.current !== null) {
			event.stopPropagation();
		}
		if (dragging.current) {
			onDragMove(event);
		} else if (pointerDown.current !== null && Date.now() >= pointerDown.current + CHARACTER_WAIT_DRAG_THRESHOLD) {
			onDragStart(event);
		}
	}, [onDragMove, onDragStart]);

	useEffect(() => {
		// TODO: Move to globalpointermove once @pixi/react supports them
		app.stage.eventMode = 'static';
		app.stage.on('pointermove', onPointerMove);
		return () => {
			app.stage.off('pointermove', onPointerMove);
		};
	}, [app, onPointerMove]);

	// Debug graphics
	const hotboxDebugDraw = useCallback((g: PIXI.Graphics) => {
		g.clear()
			.beginFill(0xff0000, 0.25)
			.drawRect(hitArea.x, hitArea.y, hitArea.width, hitArea.height);
	}, [hitArea]);

	return (
		<GraphicsCharacter
			ref={ characterContainer }
			appearanceContainer={ character }
			position={ { x, y: height - y } }
			scale={ { x: scaleX * scale, y: scale } }
			pivot={ { x: CharacterSize.WIDTH / 2, y: CharacterSize.HEIGHT - yOffset } }
			hitArea={ hitArea }
			eventMode='static'
			filters={ filters }
			onPointerDown={ onPointerDown }
			onPointerUp={ onPointerUp }
			onPointerUpOutside={ onPointerUp }
			zIndex={ -y }
		>
			<Text
				anchor={ { x: 0.5, y: 0.5 } }
				position={ { x: labelX, y: labelY } }
				scale={ { x: 1 / scaleX, y: 1 } }
				style={ new TextStyle({
					fontFamily: 'Arial',
					fontSize: 32,
					fill: character.data.settings.labelColor,
					align: 'center',
					dropShadow: true,
					dropShadowBlur: 4,
				}) }
				text={ character.data.name }
			/>
			{
				!debugConfig?.characterDebugOverlay ? null : (
					<Container
						zIndex={ 99999 }
					>
						<Graphics
							x={ -MASK_SIZE.x }
							y={ -MASK_SIZE.y }
							draw={ (g) => {
								g.clear()
									.lineStyle({ color: 0xffff00, width: 2 })
									.drawRect(0, 0, MASK_SIZE.width, MASK_SIZE.height);
							} }
						/>
						<Graphics
							draw={ (g) => {
								g.clear()
									.lineStyle({ color: 0x00ff00, width: 2 })
									.drawRect(0, 0, CharacterSize.WIDTH, CharacterSize.HEIGHT);
							} }
						/>
						<Graphics draw={ hotboxDebugDraw } />
					</Container>
				)
			}
		</GraphicsCharacter>
	);
}
