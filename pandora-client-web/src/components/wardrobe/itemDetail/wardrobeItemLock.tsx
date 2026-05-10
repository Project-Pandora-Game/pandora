import type { ActionTargetSelector, ItemLock, ItemPath } from 'pandora-common';
import { useMemo, type ReactElement } from 'react';
import closedLock from '../../../assets/icons/lock_closed.svg';
import openLock from '../../../assets/icons/lock_open.svg';
import { Column, Row } from '../../common/container/container.tsx';
import { FieldsetToggle } from '../../common/fieldsetToggle/fieldsetToggle.tsx';
import { WardrobeLockSlotActionButton, type WardrobeLockSlotActionButtonContext } from '../modules/wardrobeModuleLockSlot.tsx';
import { WardrobeLockLogicLocked, WardrobeLockLogicUnlocked } from '../views/wardrobeLockLogic.tsx';

export function WardrobeItemLockDetails({ lock, targetSelector, itemPath }: {
	lock: ItemLock;
	targetSelector: ActionTargetSelector;
	itemPath: ItemPath;
}): ReactElement {
	const actionContext = useMemo((): WardrobeLockSlotActionButtonContext => ({
		target: targetSelector,
		lock: itemPath,
	}), [targetSelector, itemPath]);

	if (!lock.isLocked()) {
		return (
			<FieldsetToggle legend='Lock'>
				<Column padding='medium'>
					<Row padding='medium' wrap>
						<img width='21' height='33' src={ openLock } />
						<Row padding='medium' alignY='center'>
							<span>
								Unlocked
							</span>
						</Row>
					</Row>
					<WardrobeLockLogicUnlocked
						lockLogic={ lock.lockLogic }
						ActionButton={ WardrobeLockSlotActionButton }
						actionContext={ actionContext }
					/>
				</Column>
			</FieldsetToggle>
		);
	}

	return (
		<FieldsetToggle legend='Lock'>
			<Column padding='medium'>
				<Row padding='medium' wrap>
					<img width='21' height='33' src={ closedLock } />
					<Row padding='medium' alignY='center'>
						<span>
							Locked
						</span>
					</Row>
				</Row>
				<WardrobeLockLogicLocked
					lockLogic={ lock.lockLogic }
					lockedText={ lock.asset.definition.lockedText }
					ActionButton={ WardrobeLockSlotActionButton }
					actionContext={ actionContext }
				/>
			</Column>
		</FieldsetToggle>
	);
}
