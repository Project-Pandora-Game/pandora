import classNames from 'classnames';
import { DetailedHTMLProps, ForwardedRef, forwardRef, HTMLAttributes, ReactElement } from 'react';
import './scrollbar.scss';

export type ScrollableProps<K extends keyof HTMLElementTagNameMap> = NoInfer<DetailedHTMLProps<HTMLAttributes<HTMLElementTagNameMap[K]>, HTMLElementTagNameMap[K]>> & {
	tag?: K;
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
	tag,
	children,
	className,
	direction = 'vertical',
	alwaysShowScrollabar = false,
	...props
}: ScrollableProps<K>, ref: ForwardedRef<HTMLElementTagNameMap[K]>): ReactElement {
	const Element = (tag as 'div') ?? 'div';
	const elementProps = props as DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement>;

	return (
		<Element
			{ ...elementProps }
			className={ classNames(
				className,
				`scrollable-${direction}`,
				alwaysShowScrollabar ? 'scrollable-always' : null,
			) }
			ref={ ref as ForwardedRef<HTMLDivElement> }
		>
			{ children }
		</Element>
	);
}

export const Scrollable = forwardRef(ScrollableImpl);

