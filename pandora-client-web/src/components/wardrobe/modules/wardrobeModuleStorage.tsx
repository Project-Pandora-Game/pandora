import classNames from 'classnames';
import {
	AppearanceActionProcessingContext,
	ItemInteractionType,
} from 'pandora-common';
import { ItemModuleStorage } from 'pandora-common/assets/modules/storage';
import React, { ReactElement, useCallback, useMemo, useState } from 'react';
import { Row } from '../../common/container/container.tsx';
import { useCheckAddPermissions } from '../../gameContext/permissionCheckProvider.tsx';
import { useWardrobeActionContext, useWardrobePermissionRequestCallback } from '../wardrobeActionContext.tsx';
import { ActionWarning, CheckResultToClassName } from '../wardrobeComponents.tsx';
import { useWardrobeContext } from '../wardrobeContext.tsx';
import { WardrobeModuleProps, WardrobeModuleTemplateProps } from '../wardrobeTypes.ts';

export function WardrobeModuleConfigStorage({ target, item, moduleName, m }: WardrobeModuleProps<ItemModuleStorage>): ReactElement {
	const { actions, globalState } = useWardrobeActionContext();
	const { focuser } = useWardrobeContext();
	const [requestPermission] = useWardrobePermissionRequestCallback();
	const [ref, setRef] = useState<HTMLElement | null>(null);

	const checkResultInitial = useMemo(() => {
		const processingContext = new AppearanceActionProcessingContext(actions, globalState);
		const actionTarget = processingContext.getTarget(target);
		if (actionTarget == null)
			return processingContext.invalid();

		processingContext.checkCanUseItemModule(actionTarget, item, moduleName, ItemInteractionType.MODIFY);
		return processingContext.finalize();
	}, [actions, globalState, item, moduleName, target]);

	const checkResult = useCheckAddPermissions(checkResultInitial);

	const onClick = useCallback((ev: React.MouseEvent) => {
		ev.stopPropagation();
		if (!checkResult.valid) {
			if (checkResult.prompt != null) {
				requestPermission(checkResult.prompt, Array.from(checkResult.requiredPermissions).map((p) => [p.group, p.id]));
			}
			return;
		}

		focuser.focusItemModule(item, moduleName, target);
	}, [requestPermission, item, moduleName, focuser, target, checkResult]);

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
