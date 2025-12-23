import { ReactElement } from 'react';
import { Column } from '../container/container.tsx';

export function UsageMeter({ title, used, limit }: {
	title: string;
	used: number | null;
	limit: number;
}): ReactElement {
	if (used == null) {
		return (
			<Column gap='tiny' alignY='center' padding='small'>
				<span>{ title }: Loading...</span>
				<progress />
			</Column>
		);
	}

	return (
		<Column gap='tiny' alignY='center' padding='small'>
			<span>{ title }: { used } / { limit } ({ Math.ceil(100 * used / limit) }%)</span>
			<meter className='fill-x' min={ 0 } max={ 1 } low={ 0.75 } high={ 0.9 } optimum={ 0 } value={ used / limit }>{ Math.ceil(100 * used / limit) }%</meter>
		</Column>
	);
}
