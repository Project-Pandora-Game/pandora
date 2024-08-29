import classNames from 'classnames';
import React, { ReactElement, useMemo } from 'react';
import { Row } from '../../common/container/container';
import { ItemModuleStorage } from 'pandora-common/dist/assets/modules/storage';
import { WardrobeModuleProps, WardrobeModuleTemplateProps } from '../wardrobeTypes';
import { useWardrobeContext } from '../wardrobeContext';
import {
	AppearanceActionProcessingContext,
	ItemInteractionType,
} from 'pandora-common';

export function WardrobeModuleConfigStorage({ item, moduleName, m }: WardrobeModuleProps<ItemModuleStorage>): ReactElement {
	const { target, targetSelector, focuser, actions } = useWardrobeContext();
	const onClick = React.useCallback((ev: React.MouseEvent) => {
		ev.stopPropagation();
		focuser.focusItemModule(item, moduleName, target);
	}, [item, moduleName, focuser, target]);

	const checkResult = useMemo(() => {
		const processingContext = new AppearanceActionProcessingContext(actions);
		const actionTarget = processingContext.getTarget(targetSelector);
		if (actionTarget == null)
			return processingContext.invalid();

		processingContext.checkCanUseItemModule(actionTarget, item, moduleName, ItemInteractionType.MODIFY);
		return processingContext.finalize();
	}, [actions, item, moduleName, targetSelector]);

	const isLocked = !checkResult.valid;
	return (
		<Row padding='medium' wrap>
			<button className={ classNames('wardrobeActionButton', isLocked ? 'blocked' : 'allowed') } onClick={ onClick }>
				Open
			</button>
			<Row padding='medium' alignY='center'>
				Contains { m.getContents().length } items.
			</Row>
		</Row>
	);
}

export function WardrobeModuleTemplateConfigStorage({ template }: WardrobeModuleTemplateProps<'storage'>): ReactElement {
	return (
		<Row padding='medium' wrap>
			Contains { template?.contents.length ?? 0 } items. Storage contents of a template cannot be edited at the moment.
		</Row>
	);
}
