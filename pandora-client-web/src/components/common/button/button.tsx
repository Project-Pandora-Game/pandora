import classNames from 'classnames';
import React, { ButtonHTMLAttributes, DetailedHTMLProps, ReactElement, type ReactNode } from 'react';
import './button.scss';

export type ButtonTheme = 'default' | 'defaultActive' | 'danger' | 'transparent' | 'semiTransparent';

export interface ButtonProps extends DetailedHTMLProps<ButtonHTMLAttributes<HTMLButtonElement>, HTMLButtonElement> {
	theme?: ButtonTheme;
	slim?: boolean;

	/** A "new item" or "active item" notification-like badge to show on the tab */
	badge?: ReactNode;
	/**
	 * Whether the badge is active (trying to get attention), or highlights passive effect
	 * @default 'active'
	 */
	badgeType?: 'active' | 'passive';
	/** Title text for the badge */
	badgeTitle?: string;
}

export function Button({ theme = 'default', children, className, slim = false, type = 'button', badge, badgeType = 'active', badgeTitle, ...buttonProps }: ButtonProps): ReactElement {
	return (
		<button
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
			{ badge ? (
				<div className={ `badge badge-type-${badgeType}` } title={ badgeTitle }>
					{ badge }
				</div>
			) : null }
		</button>
	);
}

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
