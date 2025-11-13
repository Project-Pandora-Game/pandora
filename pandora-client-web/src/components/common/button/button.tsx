import classNames from 'classnames';
import React, { ButtonHTMLAttributes, DetailedHTMLProps, ReactElement } from 'react';
import './button.scss';

export type ButtonTheme = 'default' | 'defaultActive' | 'danger' | 'transparent' | 'semiTransparent';

export interface ButtonProps extends Omit<DetailedHTMLProps<ButtonHTMLAttributes<HTMLButtonElement>, HTMLButtonElement>, 'ref'> {
	theme?: ButtonTheme;
	slim?: boolean;
}

function ButtonImpl({ theme = 'default', children, className, slim = false, type = 'button', ...buttonProps }: ButtonProps, ref: React.ForwardedRef<HTMLButtonElement>): ReactElement {
	return (
		<button ref={ ref }
			{ ...buttonProps }
			type={ type }
			className={ classNames(
				'Button',
				slim ? 'slim' : null,
				className,
				theme,
			) }
		>
			{ children }
		</button>
	);
}

export const Button = React.forwardRef(ButtonImpl);

export interface IconButtonProps extends Omit<ButtonProps, 'children'> {
	src: string;
	alt: string;
}

function IconButtonImpl({ src, alt, className, title, ...buttonProps }: IconButtonProps, ref: React.ForwardedRef<HTMLButtonElement>): ReactElement {
	return (
		<Button { ...buttonProps } className={ classNames('IconButton', className) } title={ title ?? alt } ref={ ref }>
			<img src={ src } alt={ alt } crossOrigin='anonymous' />
		</Button>
	);
}

export const IconButton = React.forwardRef(IconButtonImpl);
