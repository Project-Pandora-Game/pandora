import classNames from 'classnames';
import {
	AppearanceActionProcessingContext,
	ItemInteractionType,
} from 'pandora-common';
import { ItemModuleStorage } from 'pandora-common/dist/assets/modules/storage';
import React, { ReactElement, useCallback, useMemo, useState } from 'react';
import { Row } from '../../common/container/container';
import { useCheckAddPermissions } from '../../gameContext/permissionCheckProvider';
import { useWardrobeActionContext, useWardrobePermissionRequestCallback } from '../wardrobeActionContext';
import { ActionWarning, CheckResultToClassName } from '../wardrobeComponents';
import { useWardrobeContext } from '../wardrobeContext';
import { WardrobeModuleProps, WardrobeModuleTemplateProps } from '../wardrobeTypes';

export function WardrobeModuleConfigStorage({ item, moduleName, m }: WardrobeModuleProps<ItemModuleStorage>): ReactElement {
	const { actions, globalState } = useWardrobeActionContext();
	const { targetSelector, focuser } = useWardrobeContext();
	const [requestPermission] = useWardrobePermissionRequestCallback();
	const [ref, setRef] = useState<HTMLElement | null>(null);

	const checkResultInitial = useMemo(() => {
		const processingContext = new AppearanceActionProcessingContext(actions, globalState);
		const actionTarget = processingContext.getTarget(targetSelector);
		if (actionTarget == null)
			return processingContext.invalid();

		processingContext.checkCanUseItemModule(actionTarget, item, moduleName, ItemInteractionType.MODIFY);
		return processingContext.finalize();
	}, [actions, globalState, item, moduleName, targetSelector]);

	const checkResult = useCheckAddPermissions(checkResultInitial);

	const onClick = useCallback((ev: React.MouseEvent) => {
		ev.stopPropagation();
		if (!checkResult.valid) {
			if (checkResult.prompt != null) {
				requestPermission(checkResult.prompt, Array.from(checkResult.requiredPermissions).map((p) => [p.group, p.id]));
			}
			return;
		}

		focuser.focusItemModule(item, moduleName, targetSelector);
	}, [requestPermission, item, moduleName, focuser, targetSelector, checkResult]);

	return (
		<Row padding='medium' wrap>
			<button
				ref={ setRef }
				className={ classNames(
					'wardrobeActionButton',
					CheckResultToClassName(checkResult, false),
				) }
				onClick={ onClick }
			>
				<ActionWarning checkResult={ checkResult } actionInProgress={ false } parent={ ref } />
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
