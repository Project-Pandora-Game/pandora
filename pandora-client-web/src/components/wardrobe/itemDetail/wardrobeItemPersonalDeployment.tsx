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
import { useWardrobeExecuteCallback } from '../wardrobeActionContext.tsx';
import { useStaggeredAppearanceActionResult } from '../wardrobeCheckQueue.ts';
import { WardrobeActionButton } from '../wardrobeComponents.tsx';

export function WardrobePersonalItemDeployment({ item, targetSelector, itemPath }: {
	item: Item<'personal'>;
	targetSelector: ActionTargetSelector;
	itemPath: ItemPath;
}): ReactElement | null {

	if (item.deployment == null)
		return null;

	const inRoomInventory = targetSelector.type === 'room' && itemPath.container.length === 0;

	return (
		<FieldsetToggle legend='Room visibility'>
			<Column padding='medium'>
				<i>This item can be displayed inside the room if moved to the room inventory</i>
				{ inRoomInventory ? (
					<>
						<WardrobeActionButton action={ {
							type: 'moveItem',
							target: targetSelector,
							item: itemPath,
							personalItemDeployment: { deployed: !item.deployment.deployed },
						} }>
							{ item.deployment.deployed ? (
								'Hide this item'
							) : (
								'Show this item in the room'
							) }
						</WardrobeActionButton>
						<WardrobePersonalItemDeploymentPosition deployment={ item.deployment } targetSelector={ targetSelector } itemPath={ itemPath } />
					</>
				) : null }
				<Row alignX='space-between' alignY='center'>
					{ item.deployment.autoDeploy ? (
						<div>Item will be shown automatically</div>
					) : (
						<div>Item will <strong>not</strong> be shown automatically</div>
					) }
					<WardrobeActionButton action={ {
						type: 'customize',
						target: targetSelector,
						item: itemPath,
						personalItemAutoDeploy: !item.deployment.autoDeploy,
					} }>
						{ item.deployment.autoDeploy ? (
							'Disable'
						) : (
							'Enable'
						) }
					</WardrobeActionButton>
				</Row>
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
