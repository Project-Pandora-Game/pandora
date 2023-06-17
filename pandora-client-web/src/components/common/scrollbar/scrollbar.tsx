import classNames from 'classnames';
import React, { DetailedHTMLProps, HTMLAttributes, ReactElement, ForwardedRef, forwardRef } from 'react';
import './scrollbar.scss';

export type ScrollbarColor = 'dark' | 'lighter';

export type ScrollbarProps<K extends keyof HTMLElementTagNameMap> = DetailedHTMLProps<HTMLAttributes<HTMLElementTagNameMap[K]>, HTMLElementTagNameMap[K]> & {
	color: ScrollbarColor;
	tag?: K;
};

function ScrollbarImpl<K extends keyof HTMLElementTagNameMap = 'div'>({ color, children, className, tag, ...props }: ScrollbarProps<K>, ref: ForwardedRef<HTMLElementTagNameMap[K]>): ReactElement {
	const Element = (tag as 'div') ?? 'div';
	const elementProps = props as DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement>;
	return (
		<Element { ...elementProps } ref={ ref as ForwardedRef<HTMLDivElement> } className={ classNames('Scrollbar', className, color) }>
			{ children }
		</Element>
	);
}

export const Scrollbar = forwardRef(ScrollbarImpl);

export type ScrollableProps<K extends keyof HTMLElementTagNameMap> = ScrollbarProps<K> & {
	/**
	 * Direction the scrollable will allow scrolling in
	 * @default 'vertical'
	 */
	direction?: 'vertical' | 'horizontal' | 'both';
	/**
	 * Whether to always show the scrollbar, or only if content overflows
	 * @default false
	 */
	alwaysShowScrollabar?: boolean;
};

function ScrollableImpl<K extends keyof HTMLElementTagNameMap = 'div'>({
	className,
	direction = 'vertical',
	alwaysShowScrollabar = false,
	...props
}: ScrollableProps<K>, ref: ForwardedRef<HTMLElementTagNameMap[K]>): ReactElement {
	return (
		<Scrollbar
			{ ...props }
			className={ classNames(
				className,
				`scrollable-${direction}`,
				alwaysShowScrollabar ? 'scrollable-always' : null,
			) }
			ref={ ref }
		/>
	);
}

export const Scrollable = forwardRef(ScrollableImpl);

