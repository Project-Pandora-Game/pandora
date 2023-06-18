import classNames from 'classnames';
import {
	Assert,
	FormatTimeInterval,
	ItemLock,
	MessageSubstitute,
} from 'pandora-common';
import React, { ReactElement, useCallback, useMemo } from 'react';
import { Column, Row } from '../../common/container/container';
import { ItemModuleLockSlot } from 'pandora-common/dist/assets/modules/lockSlot';
import emptyLock from '../../../assets/icons/lock_empty.svg';
import closedLock from '../../../assets/icons/lock_closed.svg';
import openLock from '../../../assets/icons/lock_open.svg';
import { useCurrentTime } from '../../../common/useCurrentTime';
import { WardrobeModuleProps } from '../wardrobeTypes';
import { useWardrobeContext } from '../wardrobeContext';
import { WardrobeActionButton } from '../wardrobeComponents';

export function WardrobeModuleConfigLockSlot({ item, moduleName, m, setFocus }: WardrobeModuleProps<ItemModuleLockSlot>): ReactElement {
	const { targetSelector } = useWardrobeContext();
	const onFocus = useCallback((e: React.MouseEvent) => {
		e.stopPropagation();
		setFocus({
			container: [
				...item.container,
				{
					item: item.itemId,
					module: moduleName,
				},
			],
			itemId: null,
		});
	}, [item, moduleName, setFocus]);

	if (m.lock == null) {
		return (
			<Column padding='medium'>
				<Row padding='medium' wrap>
					<button className={ classNames('wardrobeActionButton', 'allowed') } onClick={ onFocus } >
						<img width='21' height='33' src={ emptyLock } />
					</button>
					<Row padding='medium' alignY='center'>
						No lock
					</Row>
				</Row>
			</Column>
		);
	}

	if (!m.lock.isLocked()) {
		return (
			<Column padding='medium'>
				<Row padding='medium' wrap>
					<img width='21' height='33' src={ openLock } />
					<Row padding='medium' alignY='center'>
						Lock: { m.lock.asset.definition.name } (unlocked)
					</Row>
				</Row>
				<Row wrap>
					<WardrobeActionButton
						action={ {
							type: 'delete',
							target: targetSelector,
							item: {
								container: [
									...item.container,
									{
										item: item.itemId,
										module: moduleName,
									},
								],
								itemId: m.lock.id,
							},
						} }
					>
						➖ Remove and delete
					</WardrobeActionButton>
					<WardrobeActionButton
						action={ {
							type: 'transfer',
							source: targetSelector,
							item: {
								container: [
									...item.container,
									{
										item: item.itemId,
										module: moduleName,
									},
								],
								itemId: m.lock.id,
							},
							target: { type: 'roomInventory' },
							container: [],
						} }
					>
						<span>
							<u>▽</u> Store in room
						</span>
					</WardrobeActionButton>
				</Row>
				<WardrobeLockSlotUnlocked item={ item } moduleName={ moduleName } m={ m } lock={ m.lock } />
			</Column>
		);
	}

	return (
		<Column padding='medium'>
			<Row padding='medium' wrap>
				<img width='21' height='33' src={ closedLock } />
				<Row padding='medium' alignY='center'>
					Locked with: { m.lock.asset.definition.name }
				</Row>
			</Row>
			<WardrobeLockSlotLocked item={ item } moduleName={ moduleName } m={ m } lock={ m.lock } />
		</Column>
	);
}

function WardrobeLockSlotLocked({ item, moduleName, lock }: Omit<WardrobeModuleProps<ItemModuleLockSlot>, 'setFocus'> & { lock: ItemLock; }): ReactElement | null {
	const { targetSelector } = useWardrobeContext();
	const now = useCurrentTime();
	const lockedText = useMemo(() => {
		Assert(lock.lockData?.locked != null);
		const formatText = lock.asset.definition.lockedText ?? 'Locked by CHARACTER at TIME';
		if (formatText.length === 0)
			return null;

		const { name, id, time } = lock.lockData.locked;

		const substitutes = {
			CHARACTER_NAME: name,
			CHARACTER_ID: id,
			CHARACTER: `${name} (${id})`,
			TIME_PASSED: FormatTimeInterval(now - time),
			TIME: new Date(time).toLocaleString(),
		};
		return (
			<Row padding='medium' alignY='start'>
				{ MessageSubstitute(formatText, substitutes) }
			</Row>
		);
	}, [lock, now]);

	return (
		<>
			{ lockedText }
			<WardrobeActionButton
				action={ {
					type: 'moduleAction',
					target: targetSelector,
					item,
					module: moduleName,
					action: {
						moduleType: 'lockSlot',
						lockAction: { action: 'unlock' },
					},
				} }>
				Unlock
			</WardrobeActionButton>
		</>
	);
}

function WardrobeLockSlotUnlocked({ item, moduleName }: Omit<WardrobeModuleProps<ItemModuleLockSlot>, 'setFocus'> & { lock: ItemLock; }): ReactElement | null {
	const { targetSelector } = useWardrobeContext();
	return (
		<WardrobeActionButton
			action={ {
				type: 'moduleAction',
				target: targetSelector,
				item,
				module: moduleName,
				action: {
					moduleType: 'lockSlot',
					lockAction: { action: 'lock' },
				},
			} }>
			Lock
		</WardrobeActionButton>
	);
}
