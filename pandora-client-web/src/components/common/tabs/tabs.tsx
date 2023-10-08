import classNames from 'classnames';
import React, { ReactElement, useMemo, useState, ReactNode, useEffect } from 'react';
import { ChildrenProps } from '../../../common/reactTypes';
import './tabs.scss';
import { Column } from '../container/container';
import { useMatch, useNavigate } from 'react-router';
import { useEvent } from '../../../common/useEvent';

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
	urlMatch,
}: {
	children: (ReactElement<TabProps> | undefined | null)[];
	id?: string;
	className?: string;
	collapsable?: true;
	urlMatch?: `${string}/:tab`;
	/**
	 * Where are the tabs positioned, relative to the content
	 * @default 'top'
	 */
	tabsPosition?: 'top' | 'left';
}): ReactElement {
	// eslint-disable-next-line react-hooks/rules-of-hooks
	const match = urlMatch ? useMatch(urlMatch)?.params : null;

	const [currentTab, setTab] = useState(() => {
		const defaultTab = children.findIndex((c) => c && c.props.default);
		return defaultTab >= 0 ? defaultTab : children.findIndex((c) => !!c);
	});

	const navigate = useNavigate();
	const setTabAction = useEvent((name: unknown, index: number) => {
		setTab(index);
		if (typeof name === 'string' && urlMatch) {
			navigate(urlMatch.replace(':tab', name));
		}
	});

	useEffect(() => {
		const tab = match && 'tab' in match ? match.tab : null;
		if (tab) {
			const index = children.findIndex((c) => c?.props.name === tab);
			if (index >= 0) {
				setTab(index);
			}
		}
	}, [match, children]);

	const [collapsed, setCollapsed] = useState(false);

	const tabs = useMemo<(TabProps | undefined)[]>(() => children.map((c) => c?.props), [children]);

	return (
		<div className={ classNames('tab-container', `tab-position-${tabsPosition}`, className) } id={ id }>
			<ul className={ classNames('header', { collapsed }) }>
				{
					tabs.map((tab, index) => (tab &&
						<button key={ index }
							className={ classNames('tab', { active: index === currentTab }, tab.tabClassName) }
							onClick={ tab.onClick ?? (() => setTabAction(tab.name, index)) }
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
