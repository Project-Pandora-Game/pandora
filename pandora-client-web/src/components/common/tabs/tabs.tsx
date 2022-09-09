import classNames from 'classnames';
import React, { ReactElement, useMemo, useState, ReactNode } from 'react';
import { ChildrenProps } from '../../../common/reactTypes';
import './tabs.scss';

interface TabProps extends ChildrenProps {
	name: ReactNode;
	default?: boolean;
	onClick?: React.MouseEventHandler<HTMLLIElement>;
	className?: string;
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

	const tabs = useMemo<(TabProps | undefined)[]>(() => children.map((c) => c?.props), [children]);

	return (
		<div className={ classNames('tab-container', className) } id={ id }>
			<ul className='tab-container__header'>
				{
					tabs.map((tab, index) => (tab &&
						<li key={ index }
							className={ classNames('tab', { active: index === currentTab }, tab.className) }
							onClick={ tab.onClick ?? (() => setTab(index)) }
						>
							{tab.name}
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
