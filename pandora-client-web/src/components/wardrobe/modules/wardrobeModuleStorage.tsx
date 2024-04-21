import classNames from 'classnames';
import React, { ReactElement } from 'react';
import { Row } from '../../common/container/container';
import { ItemModuleStorage } from 'pandora-common/dist/assets/modules/storage';
import { WardrobeModuleProps, WardrobeModuleTemplateProps } from '../wardrobeTypes';
import { useWardrobeContext } from '../wardrobeContext';

export function WardrobeModuleConfigStorage({ item, moduleName, m }: WardrobeModuleProps<ItemModuleStorage>): ReactElement {
	const { target, focuser } = useWardrobeContext();
	const onClick = React.useCallback((ev: React.MouseEvent) => {
		ev.stopPropagation();
		focuser.focusItemModule(item, moduleName, target);
	}, [item, moduleName, focuser, target]);
	return (
		<Row padding='medium' wrap>
			<button className={ classNames('wardrobeActionButton', 'allowed') } onClick={ onClick }>
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
