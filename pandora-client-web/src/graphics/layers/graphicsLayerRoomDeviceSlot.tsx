import type { Immutable } from 'immer';
import { CharacterSize, type AssetFrameworkCharacterState, type ICharacterRoomData, type Item, type ItemRoomDevice, type RoomDeviceGraphicsLayerSlot } from 'pandora-common';
import * as PIXI from 'pixi.js';
import { useCallback, useMemo, type ReactElement } from 'react';
import type { Character } from '../../character/character.ts';
import { useDebugConfig } from '../../ui/screens/room/roomDebug.tsx';
import { useAppearanceConditionEvaluator, useCharacterPoseEvaluator } from '../appearanceConditionEvaluator.ts';
import { Container } from '../baseComponents/container.ts';
import { Graphics } from '../baseComponents/graphics.ts';
import type { PointLike } from '../common/point.ts';
import type { TransitionedContainerCustomProps } from '../common/transitions/transitionedContainer.ts';
import { useCharacterDisplayFilters, useCharacterDisplayStyle, usePlayerVisionFilters } from '../common/visionFilters.tsx';
import { GraphicsCharacter } from '../graphicsCharacter.tsx';
import { useGraphicsSmoothMovementEnabled } from '../graphicsSettings.tsx';
import { CHARACTER_MOVEMENT_TRANSITION_DURATION_NORMAL } from '../room/roomCharacter.tsx';
import { CalculateCharacterDeviceSlotPosition, useRoomCharacterOffsets } from '../room/roomCharacterPosition.ts';
import { MASK_SIZE } from './graphicsLayerAlphaImageMesh.tsx';

export function GraphicsLayerRoomDeviceSlot({ item, layer, charactersInDevice, characters }: {
	item: Item;
	layer: Immutable<RoomDeviceGraphicsLayerSlot>;
	charactersInDevice: readonly AssetFrameworkCharacterState[];
	characters: readonly Character<ICharacterRoomData>[];
}): ReactElement | null {
	const characterId = item.isType('roomDevice') ? item.slotOccupancy.get(layer.slot) : undefined;
	const characterState = useMemo(() => (characterId != null ? charactersInDevice.find((c) => c.id === characterId) : undefined), [charactersInDevice, characterId]);

	if (!characterId)
		return null;

	const character = characters.find((c) => c.id === characterId);

	if (!character || !characterState || !item.isType('roomDevice'))
		return null;

	return (
		<GraphicsLayerRoomDeviceSlotCharacter
			item={ item }
			layer={ layer }
			character={ character }
			characterState={ characterState }
		/>
	);
}

function GraphicsLayerRoomDeviceSlotCharacter({ item, layer, character, characterState }: {
	item: ItemRoomDevice;
	layer: Immutable<RoomDeviceGraphicsLayerSlot>;
	character: Character<ICharacterRoomData>;
	characterState: AssetFrameworkCharacterState;
}): ReactElement | null {
	const debugConfig = useDebugConfig();
	const smoothMovementEnabled = useGraphicsSmoothMovementEnabled();

	const playerFilters = usePlayerVisionFilters(character.isPlayer());
	const characterDisplayStyle = useCharacterDisplayStyle(character);
	const characterFilters = useCharacterDisplayFilters(characterDisplayStyle);
	const filters = useMemo(() => [...playerFilters, ...characterFilters], [playerFilters, characterFilters]);

	const {
		baseScale,
		pivot,
		rotationAngle,
	} = useRoomCharacterOffsets(characterState);

	const poseEvaluator = useCharacterPoseEvaluator(characterState.assetManager, characterState.actualPose);
	const evaluator = useAppearanceConditionEvaluator(poseEvaluator, characterState.items);

	const {
		position,
		pivot: actualPivot,
		scale,
	} = useMemo(() => CalculateCharacterDeviceSlotPosition({
		item,
		layer,
		characterState,
		evaluator,
		baseScale,
		pivot,
	}), [item, layer, characterState, evaluator, baseScale, pivot]);

	// Character must be in this device, otherwise we skip rendering it here
	// (could happen if character left and rejoined the room without device equipped)
	const roomDeviceLink = characterState.getRoomDeviceWearablePart()?.roomDeviceLink ?? null;
	if (roomDeviceLink == null || roomDeviceLink.device !== item.id || roomDeviceLink.slot !== layer.slot || characterDisplayStyle === 'hidden' || characterDisplayStyle === 'name-only')
		return null;

	const movementTransitionDuration = !smoothMovementEnabled ? 0 : CHARACTER_MOVEMENT_TRANSITION_DURATION_NORMAL;

	return (
		<GraphicsCharacter
			characterState={ characterState }
			position={ position }
			pivot={ actualPivot }
			scale={ scale }
			angle={ rotationAngle }
			filters={ filters }
			useBlinking
			movementTransitionDuration={ movementTransitionDuration }
			perPropertyMovementTransitionDuration={ ROOM_DEVICE_CHARACTER_TRANSITION_OVERRIDES }
		>
			{
				!debugConfig?.characterDebugOverlay ? null : (
					<Container zIndex={ 99999 }>
						<RoomDeviceLayerSlotCharacterDebugGraphics actualPivot={ actualPivot } />
					</Container>
				)
			}
		</GraphicsCharacter>
	);
}

const ROOM_DEVICE_CHARACTER_TRANSITION_OVERRIDES: TransitionedContainerCustomProps['perPropertyTransitionDuration'] = {
	angle: 0,
	scaleX: 0,
	scaleY: 0,
	x: 0,
	y: 0,
};

function RoomDeviceLayerSlotCharacterDebugGraphics({ actualPivot }: {
	actualPivot: Readonly<PointLike>;
}): ReactElement {
	const debugGraphicsDraw = useCallback((g: PIXI.GraphicsContext) => {
		g
			// Mask area
			.rect(-MASK_SIZE.x, -MASK_SIZE.y, MASK_SIZE.width, MASK_SIZE.height)
			.stroke({ color: 0xffff00, width: 1, pixelLine: true })
			// Character canvas standard area
			.rect(0, 0, CharacterSize.WIDTH, CharacterSize.HEIGHT)
			.stroke({ color: 0x00ff00, width: 1, pixelLine: true })
			// Pivot point
			.circle(actualPivot.x, actualPivot.y, 5)
			.fill(0xffaa00)
			.stroke({ color: 0x000000, width: 1 });
	}, [actualPivot]);

	return (
		<Graphics draw={ debugGraphicsDraw } />
	);
}
