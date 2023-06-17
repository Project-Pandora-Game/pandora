import classNames from 'classnames';
import React, { ReactElement, useMemo, useState, ReactNode } from 'react';
import { ChildrenProps } from '../../../common/reactTypes';
import './tabs.scss';
import { Column } from '../container/container';

interface TabProps extends ChildrenProps {
	name: ReactNode;
	default?: boolean;
	onClick?: React.MouseEventHandler;
	tabClassName?: string;
}

export function TabContainer({
	children,
	id,
	className,
	collapsable,
	tabsPosition = 'top',
}: {
	children: (ReactElement<TabProps> | undefined | null)[];
	id?: string;
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

	const [collapsed, setCollapsed] = useState(false);

	const tabs = useMemo<(TabProps | undefined)[]>(() => children.map((c) => c?.props), [children]);

	return (
		<div className={ classNames('tab-container', `tab-position-${tabsPosition}`, className) } id={ id }>
			<ul className={ classNames('header', { collapsed }) }>
				{
					tabs.map((tab, index) => (tab &&
						<button key={ index }
							className={ classNames('tab', { active: index === currentTab }, tab.tabClassName) }
							onClick={ tab.onClick ?? (() => setTab(index)) }
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
			{ currentTab < children.length ? children[currentTab] : null }
		</div>
	);
}

export function Tab({ children }: TabProps): ReactElement {
	return <Column className='flex-1 tab-content overflow-hidden'>{ children }</Column>;
}
