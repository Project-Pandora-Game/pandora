import classNames from 'classnames';
import React, { ButtonHTMLAttributes, DetailedHTMLProps, ReactElement } from 'react';
import './Button.scss';

export type ButtonTheme = 'default';

export interface ButtonProps extends DetailedHTMLProps<ButtonHTMLAttributes<HTMLButtonElement>, HTMLButtonElement> {
	theme?: ButtonTheme;
}

export function Button({ theme = 'default', children, className, ...buttonProps }: ButtonProps): ReactElement {
	return (
		<button { ...buttonProps } className={ classNames('Button', className, theme) }>
			{ children }
		</button>
	);
}
