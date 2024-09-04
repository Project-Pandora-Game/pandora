import classNames from 'classnames';
import {
	AppearanceActionProcessingContext,
	ItemInteractionType,
} from 'pandora-common';
import { ItemModuleStorage } from 'pandora-common/dist/assets/modules/storage';
import React, { ReactElement, useCallback, useMemo, useState } from 'react';
import { Row } from '../../common/container/container';
import { useWardrobeContext } from '../wardrobeContext';
import { WardrobeModuleProps, WardrobeModuleTemplateProps } from '../wardrobeTypes';
import { ActionWarning, CheckResultToClassName } from '../wardrobeComponents';
import { useCheckAddPermissions } from '../../gameContext/permissionCheckProvider';

export function WardrobeModuleConfigStorage({ item, moduleName, m }: WardrobeModuleProps<ItemModuleStorage>): ReactElement {
	const { target, targetSelector, focuser, actions } = useWardrobeContext();
	const [ref, setRef] = useState<HTMLElement | null>(null);

	const checkResultInitial = useMemo(() => {
		const processingContext = new AppearanceActionProcessingContext(actions);
		const actionTarget = processingContext.getTarget(targetSelector);
		if (actionTarget == null)
			return processingContext.invalid();

		processingContext.checkCanUseItemModule(actionTarget, item, moduleName, ItemInteractionType.MODIFY);
		return processingContext.finalize();
	}, [actions, item, moduleName, targetSelector]);

	const checkResult = useCheckAddPermissions(checkResultInitial);

	const onClick = useCallback((ev: React.MouseEvent) => {
		ev.stopPropagation();
		if (!checkResult.valid) {
			return;
		}

		focuser.focusItemModule(item, moduleName, target);
	}, [item, moduleName, focuser, target, checkResult]);

	return (
		<Row padding='medium' wrap>
			<button
				ref={ setRef }
				className={ classNames(
					'wardrobeActionButton',
					CheckResultToClassName(checkResult),
				) }
				onClick={ onClick }
			>
				<ActionWarning problems={ checkResult.problems } prompt={ !checkResult.valid && checkResult.prompt != null } parent={ ref } />
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
