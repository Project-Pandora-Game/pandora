import { MouseEvent, ReactElement, useCallback, useState } from 'react';
import helpIcon from '../../assets/icons/help.svg';
import { ChildrenProps } from '../../common/reactTypes.ts';
import { useEvent } from '../../common/useEvent.ts';
import { Button } from '../common/button/button.tsx';
import { Column } from '../common/container/container.tsx';
import { DraggableDialog } from '../dialog/dialog.tsx';
import './contextHelpButton.scss';

export function ContextHelpButton({ children }: ChildrenProps): ReactElement {
	const [open, setOpen] = useState(false);

	const toggleOpen = useEvent((ev: MouseEvent) => {
		ev.preventDefault();
		ev.stopPropagation();
		setOpen(!open);
	});

	const close = useCallback((ev: MouseEvent | KeyboardEvent) => {
		ev.preventDefault();
		ev.stopPropagation();
		setOpen(false);
	}, []);

	const dialogClose = useCallback(() => setOpen(false), []);

	return (
		<>
			<button className='help-button' onClick={ toggleOpen }>
				<img src={ helpIcon } alt='Help' />
			</button>
			{ !open ? null : (
				<DraggableDialog title='Help' close={ dialogClose } hiddenClose>
					<Column padding='medium' className='flex-1'>
						{ children }
					</Column>
					<Button className='slim' onClick={ close }>Close</Button>
				</DraggableDialog>
			) }
		</>
	);
}
