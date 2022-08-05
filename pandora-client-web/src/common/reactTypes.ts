import { ReactNode } from 'react';

export interface ChildrenProps {
	children?: ReactNode;
}

export interface CommonProps extends ChildrenProps {
	id?: string;
	className?: string;
}
