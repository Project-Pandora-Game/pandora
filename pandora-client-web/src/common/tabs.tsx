import classNames from 'classnames';
import React, { ReactElement, useLayoutEffect, useMemo, useState } from 'react';
import { ChildrenProps } from './reactTypes';
import './tabs.scss';

interface TabProps extends ChildrenProps {
	name: string;
	default?: boolean;
}

export function TabContainer({ children, id, className }: {
	children: (ReactElement<TabProps> | undefined | null)[]
	id?: string;
	className?: string;
}): ReactElement {

	const [currentTab, setTab] = useState(0);

	const tabs = useMemo<(string | undefined)[]>(() => children.map((c) => c?.props.name), [children]);

	useLayoutEffect(() => {
		if (children.length === 0)
			return;
		let defaultTab = children.findIndex((c) => c && c.props.default);
		if (defaultTab < 0) {
			defaultTab = 0;
		}
		setTab(defaultTab);
	}, [children]);

	return (
		<div className={ classNames('tab-container', className) } id={ id }>
			<ul>
				{
					tabs.map((tab, index) => (tab &&
						<li key={ index } className={ classNames('tab', { active: index === currentTab }) } onClick={ () => setTab(index) }>
							{tab}
						</li>
					))
				}
			</ul>
			{ currentTab < children.length ? children[currentTab] : null }
		</div>
	);
}

export function Tab({ children }: TabProps): ReactElement {
	return <>{ children }</>;
}
