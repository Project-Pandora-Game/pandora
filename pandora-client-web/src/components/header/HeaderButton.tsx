import classNames from 'classnames';
import { ButtonHTMLAttributes, DetailedHTMLProps, ReactElement } from 'react';
import { Button } from '../common/button/button.tsx';

export interface HeaderButtonProps extends DetailedHTMLProps<ButtonHTMLAttributes<HTMLButtonElement>, HTMLButtonElement> {
	icon: string;
	iconAlt: string;
	badge?: number;
}

export function HeaderButton({
	badge, children, className, icon, iconAlt, title, ...buttonProps
}: HeaderButtonProps): ReactElement {
	return (
		<Button
			theme='transparent'
			{ ...buttonProps }
			title={ title }
			className={ classNames('HeaderButton', className) }
		>
			<div className='icon-container'>
				<img src={ icon } alt={ iconAlt } />
				{ badge ? <span className='badge'>{ badge > 99 ? '99+' : badge }</span> : undefined }
			</div>
			{ children }
			{ title ? (
				<span className='label'>{ title }</span>
			) : null }
		</Button>
	);
}
