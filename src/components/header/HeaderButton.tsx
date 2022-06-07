import classNames from 'classnames';
import React, { ButtonHTMLAttributes, DetailedHTMLProps, ReactElement } from 'react';
import './HeaderButton.scss';

export interface HeaderButtonProps extends DetailedHTMLProps<ButtonHTMLAttributes<HTMLButtonElement>, HTMLButtonElement> {
	icon: string;
	iconAlt: string;
	badge?: number;
}

export function HeaderButton({
	badge, children, className, icon, iconAlt, ...buttonProps
}: HeaderButtonProps): ReactElement {
	return (
		<button { ...buttonProps } className={ classNames('HeaderButton', className) }>
			<div className='icon-container'>
				<img src={ icon } alt={ iconAlt } />
				{ badge ? <span className='badge'>{ badge > 99 ? '99+' : badge }</span> : undefined }
			</div>
			{ children }
		</button>
	);
}
