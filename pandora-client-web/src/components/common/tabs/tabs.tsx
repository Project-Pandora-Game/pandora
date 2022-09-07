import classNames from 'classnames';
import React, { ReactElement, useMemo, useState } from 'react';
import { ChildrenProps } from '../../../common/reactTypes';
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

	const [currentTab, setTab] = useState(() => {
		const defaultTab = children.findIndex((c) => c && c.props.default);
		return defaultTab < 0 ? 0 : defaultTab;
	});

	const tabs = useMemo<(string | undefined)[]>(() => children.map((c) => c?.props.name), [children]);

	return (
		<div className={ classNames('tab-container', className) } id={ id }>
			<ul className='tab-container__header'>
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
