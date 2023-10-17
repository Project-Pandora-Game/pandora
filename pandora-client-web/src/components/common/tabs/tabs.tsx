import classNames from 'classnames';
import React, { ReactElement, useMemo, useState, ReactNode } from 'react';
import { ChildrenProps } from '../../../common/reactTypes';
import './tabs.scss';
import { Column } from '../container/container';
import { Navigate, Route, Routes, matchPath, resolvePath, useLocation, useNavigate, useResolvedPath } from 'react-router';

interface TabProps extends ChildrenProps {
	name: ReactNode;
	default?: boolean;
	onClick?: React.MouseEventHandler;
	tabClassName?: string;
}

interface TabConfig {
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
}: {
	children: (ReactElement<TabProps> | undefined | null)[];
	className?: string;
	collapsable?: true;
	/**
	 * Where are the tabs positioned, relative to the content
	 * @default 'top'
	 */
	tabsPosition?: 'top' | 'left';
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

	return (
		<Tabulation tabs={ tabs } className={ className } collapsable={ collapsable } tabsPosition={ tabsPosition }>
			{ currentTab < children.length ? children[currentTab] : null }
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
		return (defaultTab ?? children.find((c) => !!c))?.props.urlChunk || '';
	}, [children]);

	const tabs = useMemo<(TabConfig | undefined)[]>(() => children.map((c): TabConfig | undefined => (c == null ? undefined : {
		name: c.props.name,
		active: c.props.urlChunk ? matchPath({ path: resolvePath(c.props.urlChunk, routerPath).pathname + '/*' }, pathname) != null : false,
		onClick: c.props.onClick ?? (() => c.props.urlChunk ? navigate(c.props.urlChunk) : undefined),
		tabClassName: c.props.tabClassName,
	})), [children, navigate, routerPath, pathname]);

	return (
		<Tabulation tabs={ tabs } className={ className } collapsable={ collapsable } tabsPosition={ tabsPosition }>
			<Routes>
				{
					children.map((tab, index) => (tab && (
						<Route key={ index } element={ tab } path={ tab.props.urlChunk + '/*' } />
					)))
				}
				{
					defaultTabPath ? (
						<Route
							path='*'
							element={ <Navigate to={ defaultTabPath } /> }
						/>
					) : null
				}
			</Routes>
		</Tabulation>
	);
}

export function Tab({ children }: TabProps): ReactElement {
	return <Column className='flex-1 tab-content overflow-hidden'>{ children }</Column>;
}

export function UrlTab(props: UrlTabProps): ReactElement {
	return <Tab { ...props } />;
}
