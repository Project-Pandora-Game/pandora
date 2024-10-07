import classNames from 'classnames';
import type { Immutable } from 'immer';
import React, { ReactElement, ReactNode, useEffect, useMemo, useState } from 'react';
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

export function Tabulation({ children, className, collapsable, tabsPosition, tabs }: {
	children: ReactNode;
	className?: string;
	collapsable?: true;
	tabs: readonly (TabConfig | undefined)[];
	/**
	 * Where are the tabs positioned, relative to the content
	 * @default 'top'
	 */
	tabsPosition?: 'top' | 'left';
}): ReactElement {
	const [collapsed, setCollapsed] = useState(false);

	return (
		<div className={ classNames('tab-container', `tab-position-${tabsPosition}`, className) }>
			<ul className={ classNames('header', { collapsed }) }>
				{
					tabs.map((tab, index) => (tab &&
						<button key={ index }
							className={ classNames('tab', { active: tab.active }, tab.tabClassName) }
							onClick={ tab.onClick }
						>
							{ tab.name }
						</button>
					))
				}
				{
					collapsable && (
						<li className='tab collapse' onClick={ () => setCollapsed(true) }>
							▲
						</li>
					)
				}
			</ul>
			{ !collapsed ? null : (
				<div className='tab-container-collapsed' onClick={ () => setCollapsed(false) }>
					▼
				</div>
			) }
			{ children }
		</div>
	);
}

export function TabContainer({
	children,
	className,
	collapsable,
	tabsPosition = 'top',
	onTabOpen,
}: {
	children: (ReactElement<TabProps> | undefined | null)[];
	className?: string;
	collapsable?: true;
	/**
	 * Where are the tabs positioned, relative to the content
	 * @default 'top'
	 */
	tabsPosition?: 'top' | 'left';
	onTabOpen?: (tab: Immutable<TabConfig>) => (void | (() => void));
}): ReactElement {

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

	useEffect(() => {
		if (currentTab < tabs.length) {
			const tab = tabs[currentTab];
			if (tab) {
				return onTabOpen?.(tab);
			}
		}
	}, [currentTab, onTabOpen, tabs]);

	return (
		<Tabulation tabs={ tabs } className={ className } collapsable={ collapsable } tabsPosition={ tabsPosition }>
			<React.Fragment key={ currentTab }>
				{ currentTab < children.length ? children[currentTab] : null }
			</React.Fragment>
		</Tabulation>
	);
}

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
}: {
	children: (ReactElement<UrlTabProps> | undefined | null)[];
	className?: string;
	collapsable?: true;
	/**
	 * Where are the tabs positioned, relative to the content
	 * @default 'top'
	 */
	tabsPosition?: 'top' | 'left';
}): ReactElement {
	const routerPath = useResolvedPath('').pathname;
	const { pathname } = useLocation();
	const navigate = useNavigate();

	const defaultTabPath = useMemo(() => {
		const defaultTab = children.find((c) => c && c.props.default);
		return (defaultTab ?? children.find((c) => !!c))?.props.urlChunk ?? '';
	}, [children]);

	const tabs = useMemo<(TabConfig | undefined)[]>(() => children.map((c): TabConfig | undefined => (c == null ? undefined : {
		name: c.props.name,
		active: (c.props.urlChunk != null) ? matchPath({ path: resolvePath(c.props.urlChunk, routerPath).pathname + (c.props.urlChunk ? '/*' : '') }, pathname) != null : false,
		onClick: c.props.onClick ?? (() => (c.props.urlChunk != null) ? navigate(c.props.urlChunk) : undefined),
		tabClassName: c.props.tabClassName,
	})), [children, navigate, routerPath, pathname]);

	return (
		<Tabulation tabs={ tabs } className={ className } collapsable={ collapsable } tabsPosition={ tabsPosition }>
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
