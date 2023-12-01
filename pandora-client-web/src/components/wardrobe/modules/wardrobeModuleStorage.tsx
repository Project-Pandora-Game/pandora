import classNames from 'classnames';
import React, { ReactElement } from 'react';
import { Row } from '../../common/container/container';
import { ItemModuleStorage } from 'pandora-common/dist/assets/modules/storage';
import { WardrobeModuleProps, WardrobeModuleTemplateProps } from '../wardrobeTypes';

export function WardrobeModuleConfigStorage({ item, moduleName, m, setFocus }: WardrobeModuleProps<ItemModuleStorage>): ReactElement {
	return (
		<Row padding='medium' wrap>
			<button
				className={ classNames('wardrobeActionButton', 'allowed') }
				onClick={ (ev) => {
					ev.stopPropagation();
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
				} }
			>
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
