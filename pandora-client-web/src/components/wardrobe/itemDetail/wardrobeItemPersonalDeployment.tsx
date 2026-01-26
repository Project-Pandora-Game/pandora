import classNames from 'classnames';
import { Immutable } from 'immer';
import { throttle } from 'lodash-es';
import {
	Item,
	ItemPath,
	type ActionTargetSelector,
	type AppearanceAction,
	type PersonalItemDeployment,
	type RoomPosition,
} from 'pandora-common';
import { ReactElement, useCallback, useMemo } from 'react';
import { NumberInput } from '../../../common/userInteraction/input/numberInput.tsx';
import { useUpdatedUserInput } from '../../../common/useSyncUserInput.ts';
import { LIVE_UPDATE_THROTTLE } from '../../../config/Environment.ts';
import { Column, Row } from '../../common/container/container.tsx';
import { FieldsetToggle } from '../../common/fieldsetToggle/index.tsx';
import { usePlayerState } from '../../gameContext/playerContextProvider.tsx';
import { useWardrobeExecuteCallback } from '../wardrobeActionContext.tsx';
import { useStaggeredAppearanceActionResult } from '../wardrobeCheckQueue.ts';
import { WardrobeActionButton } from '../wardrobeComponents.tsx';

export function WardrobePersonalItemDeployment({ item, targetSelector, itemPath }: {
	item: Item<'personal'>;
	targetSelector: ActionTargetSelector;
	itemPath: ItemPath;
}): ReactElement | null {
	const { playerState } = usePlayerState();

	if (item.deployment == null || item.asset.definition.roomDeployment == null)
		return null;

	const { autoDeployRelativePosition } = item.asset.definition.roomDeployment;

	const inRoomInventory = targetSelector.type === 'room' && itemPath.container.length === 0;

	return (
		<FieldsetToggle legend='Room visibility'>
			<Column padding='medium'>
				<i>Item can be displayed inside the room while in its room inventory</i>
				{ inRoomInventory ? (
					<>
						{ item.deployment.deployed ? (
							<WardrobeActionButton action={ {
								type: 'moveItem',
								target: targetSelector,
								item: itemPath,
								personalItemDeployment: { deployed: false },
							} }>
								Hide this item
							</WardrobeActionButton>
						) : (
							<Row>
								<WardrobeActionButton className='flex-grow-1' action={ {
									type: 'moveItem',
									target: targetSelector,
									item: itemPath,
									personalItemDeployment: { deployed: true },
								} }>
									Show this item at its last position
								</WardrobeActionButton>
								<WardrobeActionButton
									className='flex-grow-1'
									action={ {
										type: 'moveItem',
										target: targetSelector,
										item: itemPath,
										personalItemDeployment: {
											deployed: true, position: [
												playerState.position.position[0] + (playerState.actualPose.view === 'back' ? -1 : 1) * autoDeployRelativePosition[0],
												playerState.position.position[1] + (playerState.actualPose.view === 'back' ? -1 : 1) * autoDeployRelativePosition[1],
												playerState.position.position[2] + (playerState.actualPose.view === 'back' ? -1 : 1) * autoDeployRelativePosition[2],
											],
										},
									} }
									disabled={ playerState.position.type !== 'normal' || playerState.position.room !== targetSelector.roomId }
								>
									Show this item near your character
								</WardrobeActionButton>
							</Row>
						) }
						<WardrobePersonalItemDeploymentPosition deployment={ item.deployment } targetSelector={ targetSelector } itemPath={ itemPath } />
					</>
				) : null }
				<Column gap='tiny'>
					When this item is moved to a room inventory:
					<Row alignY='center' wrap gap='tiny'>
						<WardrobeActionButton
							className={ classNames('slim flex-grow-1', item.deployment.autoDeploy === false ? 'selected' : '') }
							action={ {
								type: 'customize',
								target: targetSelector,
								item: itemPath,
								personalItemAutoDeploy: false,
							} }
						>
							Do not display
						</WardrobeActionButton>
						<WardrobeActionButton
							className={ classNames('slim flex-grow-1', item.deployment.autoDeploy === 'atCharacter' ? 'selected' : '') }
							action={ {
								type: 'customize',
								target: targetSelector,
								item: itemPath,
								personalItemAutoDeploy: 'atCharacter',
							} }
						>
							Place near character
						</WardrobeActionButton>
						<WardrobeActionButton
							className={ classNames('slim flex-grow-1', item.deployment.autoDeploy === 'keepPosition' ? 'selected' : '') }
							action={ {
								type: 'customize',
								target: targetSelector,
								item: itemPath,
								personalItemAutoDeploy: 'keepPosition',
							} }
						>
							Place at previous spot
						</WardrobeActionButton>
					</Row>
				</Column>
			</Column>
		</FieldsetToggle>
	);
}

function WardrobePersonalItemDeploymentPosition({ deployment, targetSelector, itemPath }: {
	deployment: Immutable<PersonalItemDeployment>;
	targetSelector: ActionTargetSelector;
	itemPath: ItemPath;
}): ReactElement | null {
	const [execute] = useWardrobeExecuteCallback({ allowMultipleSimultaneousExecutions: true });

	const [positionX, setPositionX] = useUpdatedUserInput(deployment.position[0], [targetSelector, itemPath]);
	const [positionY, setPositionY] = useUpdatedUserInput(deployment.position[1], [targetSelector, itemPath]);
	const [positionYOffset, setPositionYOffset] = useUpdatedUserInput(deployment.position[2], [targetSelector, itemPath]);

	const checkAction = useMemo((): AppearanceAction => ({
		type: 'moveItem',
		target: targetSelector,
		item: itemPath,
		personalItemDeployment: { position: deployment.position },
	}), [targetSelector, itemPath, deployment]);
	const checkResult = useStaggeredAppearanceActionResult(checkAction);
	const disabled = checkResult == null || !checkResult.valid || checkResult.getActionSlowdownTime() > 0;

	const onChangeCaller = useCallback((newPosition: RoomPosition) => {
		execute({
			type: 'moveItem',
			target: targetSelector,
			item: itemPath,
			personalItemDeployment: { position: newPosition },
		});
	}, [execute, targetSelector, itemPath]);
	const onChangeCallerThrottled = useMemo(() => throttle(onChangeCaller, LIVE_UPDATE_THROTTLE), [onChangeCaller]);

	const changeCallback = useCallback((newPosition: RoomPosition) => {
		setPositionX(newPosition[0]);
		setPositionY(newPosition[1]);
		setPositionYOffset(newPosition[2]);
		onChangeCallerThrottled(newPosition);
	}, [setPositionX, setPositionY, setPositionYOffset, onChangeCallerThrottled]);

	return (
		<Row alignY='center'>
			<label>X:</label>
			<NumberInput
				className='positioning-input flex-1'
				value={ positionX }
				onChange={ (newValue) => {
					changeCallback([newValue, positionY, positionYOffset]);
				} }
				disabled={ disabled }
			/>
			<label>Y:</label>
			<NumberInput
				className='positioning-input flex-1'
				value={ positionY }
				onChange={ (newValue) => {
					changeCallback([positionX, newValue, positionYOffset]);
				} }
				disabled={ disabled }
			/>
			<Row alignY='center'>
				<label>Y offset:</label>
				<NumberInput
					className='positioning-input flex-1'
					value={ positionYOffset }
					onChange={ (newValue) => {
						changeCallback([positionX, positionY, newValue]);
					} }
					disabled={ disabled }
				/>
			</Row>
		</Row>
	);
}
