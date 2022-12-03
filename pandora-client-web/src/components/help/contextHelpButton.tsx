import React, { useCallback, useState } from 'react';
import { ReactElement } from 'react';
import { ChildrenProps } from '../../common/reactTypes';
import { useEvent } from '../../common/useEvent';
import { Button } from '../common/Button/Button';
import { Column } from '../common/container/container';
import { DraggableDialog } from '../dialog/dialog';
import helpIcon from '../../assets/icons/help.svg';
import './contextHelpButton.scss';
import { useKeyDownEvent } from '../../common/useKeyDownEvent';

export function ContextHelpButton({ children }: ChildrenProps): ReactElement {
	const [open, setOpen] = useState(false);

	const toggleOpen = useEvent(() => {
		setOpen(!open);
	});

	const close = useCallback(() => {
		setOpen(false);
	}, []);

	useKeyDownEvent(close, 'Escape');

	return (
		<>
			<button className='help-button' onClick={ toggleOpen }>
				<img src={ helpIcon } alt='Help' />
			</button>
			{ !open ? null : (
				<DraggableDialog title='Help'>
					<Column className='flex-1'>
						{ children }
					</Column>
					<Button className='slim' onClick={ close }>Close</Button>
				</DraggableDialog>
			) }
		</>
	);
}
