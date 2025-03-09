import classNames from 'classnames';
import type { Immutable } from 'immer';
import React, { forwardRef, ReactElement, ReactNode, useEffect, useMemo, useState, type ForwardedRef, useImperativeHandle } from 'react';
import { Navigate, Route, Routes, matchPath, resolvePath, useLocation, useNavigate, useResolvedPath } from 'react-router';
import { ChildrenProps } from '../../../common/reactTypes';
import { LocalErrorBoundary } from '../../error/localErrorBoundary';
import { Column } from '../container/container';
import './tabs.scss';

export interface TabProps extends ChildrenProps {
	name: ReactNode;
	default?: boolean;
	onClick?: React.MouseEventHandler;
	tabClassName?: string;
}

export interface TabConfig {
	name: ReactNode;
	active: boolean;
	onClick: React.MouseEventHandler;
	tabClassName?: string;
}

export function Tabulation({ children, className, collapsable, tabsPosition = 'top', allowWrap = false, tabs }: {
	children: ReactNode;
	className?: string;
	collapsable?: true;
	tabs: readonly (TabConfig | undefined)[];
	/**
	 * Where are the tabs positioned, relative to the content
	 * @default 'top'
	 */
	tabsPosition?: 'top' | 'left';
	/**
	 * Whether the tabs should wrap to a new line if there is not enough space.
	 * @default false
	 */
	allowWrap?: boolean;
}): ReactElement {
	const [collapsed, setCollapsed] = useState(false);

	return (
		<div className={ classNames('tab-container', `tab-position-${tabsPosition}`, allowWrap ? 'allow-wrap' : null, className) }>
			<ul className={ classNames('header', { collapsed }) } role='tablist' aria-orientation={ tabsPosition === 'left' ? 'vertical' : 'horizontal' }>
				{
					tabs.map((tab, index) => (tab &&
						<button key={ index }
							className={ classNames('tab', { active: tab.active }, tab.tabClassName) }
							onClick={ tab.onClick }
							role='tab'
							aria-selected={ tab.active }
						>
							{ tab.name }
						</button>
					))
				}
				{
					collapsable && (
						<button className='tab collapse' onClick={ () => setCollapsed(true) } title='Hide tabs'>
							▲
						</button>
					)
				}
			</ul>
			{ !collapsed ? null : (
				<button className='tab-container-collapsed' onClick={ () => setCollapsed(false) } title='Reveal hidden tabs'>
					▼
				</button>
			) }
			{ children }
		</div>
	);
}

export interface TabContainerRef {
	setTabByName(name: string): void;
}

export const TabContainer = forwardRef(function TabContainer({
	children,
	className,
	collapsable,
	tabsPosition = 'top',
	allowWrap,
	onTabOpen,
}: {
	children: (ReactElement<TabProps> | undefined | null)[] | (ReactElement<TabProps> | undefined | null);
	className?: string;
	collapsable?: true;
	/**
	 * Where are the tabs positioned, relative to the content
	 * @default 'top'
	 */
	tabsPosition?: 'top' | 'left';
	/**
	 * Whether the tabs should wrap to a new line if there is not enough space.
	 * @default false
	 */
	allowWrap?: boolean;
	onTabOpen?: (tab: Immutable<TabConfig>) => (void | (() => void));
}, ref: ForwardedRef<TabContainerRef>): ReactElement {
	if (!Array.isArray(children)) {
		children = [children];
	}

	const [currentTab, setTab] = useState(() => {
		const defaultTab = children.findIndex((c) => c && c.props.default);
		return defaultTab >= 0 ? defaultTab : children.findIndex((c) => !!c);
	});

	const tabs = useMemo<(TabConfig | undefined)[]>(() => children.map((c, index): TabConfig | undefined => (c == null ? undefined : {
		name: c.props.name,
		active: index === currentTab,
		onClick: c.props.onClick ?? (() => setTab(index)),
		tabClassName: c.props.tabClassName,
	})), [children, currentTab]);

	useImperativeHandle(ref, () => ({
		setTabByName(name) {
			const tab = tabs.findIndex((t) => t?.name === name);
			if (tab >= 0) {
				setTab(tab);
			}
		},
	}), [tabs]);

	useEffect(() => {
		if (currentTab < tabs.length) {
			const tab = tabs[currentTab];
			if (tab) {
				return onTabOpen?.(tab);
			}
		}
	}, [currentTab, onTabOpen, tabs]);

	return (
		<Tabulation tabs={ tabs } className={ className } collapsable={ collapsable } tabsPosition={ tabsPosition } allowWrap={ allowWrap }>
			<React.Fragment key={ currentTab }>
				{ currentTab < children.length ? children[currentTab] : null }
			</React.Fragment>
		</Tabulation>
	);
});

/** Props where at least one of urlChunk and onClick handler is required */
type UrlTabProps = (
	TabProps & {
		onClick: React.MouseEventHandler;
		urlChunk?: string;
	}
) | (
	TabProps & {
		urlChunk: string;
	}
);

export function UrlTabContainer({
	children,
	className,
	collapsable,
	tabsPosition = 'top',
	allowWrap,
	noImplicitDefaultTab = false,
}: {
	children: (ReactElement<UrlTabProps> | undefined | null)[];
	className?: string;
	collapsable?: true;
	/**
	 * Where are the tabs positioned, relative to the content
	 * @default 'top'
	 */
	tabsPosition?: 'top' | 'left';
	/**
	 * Whether the tabs should wrap to a new line if there is not enough space.
	 * @default false
	 */
	allowWrap?: boolean;
	/**
	 * Disables the first tab being implicit default.
	 * This means, that if no tab is explicitly marked as `default`, no tab will be initially selected.
	 * @default false
	 */
	noImplicitDefaultTab?: boolean;
}): ReactElement {
	const routerPath = useResolvedPath('').pathname;
	const { pathname } = useLocation();
	const navigate = useNavigate();

	const defaultTabPath = useMemo(() => {
		const defaultTab = children.find((c) => c && c.props.default);
		return (defaultTab ?? (noImplicitDefaultTab ? undefined : children.find((c) => !!c)))?.props.urlChunk ?? '';
	}, [children, noImplicitDefaultTab]);

	const tabs = useMemo<(TabConfig | undefined)[]>(() => children.map((c): TabConfig | undefined => (c == null ? undefined : {
		name: c.props.name,
		active: (c.props.urlChunk != null) ? matchPath({ path: resolvePath(c.props.urlChunk, routerPath).pathname + (c.props.urlChunk ? '/*' : '') }, pathname) != null : false,
		onClick: c.props.onClick ?? (() => (c.props.urlChunk != null) ? navigate(c.props.urlChunk) : undefined),
		tabClassName: c.props.tabClassName,
	})), [children, navigate, routerPath, pathname]);

	return (
		<Tabulation tabs={ tabs } className={ className } collapsable={ collapsable } tabsPosition={ tabsPosition } allowWrap={ allowWrap }>
			<Routes>
				{
					children.map((tab, index) => (tab && tab.props.urlChunk != null && (
						tab.props.urlChunk ? (
							<Route
								key={ index }
								element={ (
									<React.Fragment key={ tab.props.urlChunk }>
										{ tab }
									</React.Fragment>
								) }
								path={ tab.props.urlChunk + '/*' }
							/>
						) : (
							<Route
								key={ index }
								element={ (
									<React.Fragment key='index'>
										{ tab }
									</React.Fragment>
								) }
								index
							/>
						)
					)))
				}
				{
					defaultTabPath ? (
						<Route
							path='*'
							element={ <Navigate to={ defaultTabPath } replace /> }
						/>
					) : null
				}
			</Routes>
		</Tabulation>
	);
}

export function Tab({ children }: TabProps): ReactElement {
	return (
		<LocalErrorBoundary errorOverlayClassName='flex-1 tab-content overflow-hidden'>
			<Column className='flex-1 tab-content overflow-hidden'>{ children }</Column>
		</LocalErrorBoundary>
	);
}

export function UrlTab(props: UrlTabProps): ReactElement {
	return <Tab { ...props } />;
}
