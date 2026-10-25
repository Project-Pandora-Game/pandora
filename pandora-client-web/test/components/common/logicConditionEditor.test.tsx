import { fireEvent, render, screen } from '@testing-library/react';
import { useState, type ReactElement } from 'react';
import { Button } from '../../../src/components/common/button/button.tsx';
import { LogicConditionEditor, type LogicConditionEditorConditionComponentProps } from '../../../src/ui/components/logicConditionEditor/logicConditionEditor.tsx';

function StatefulDetails({ label }: { label: string; }): ReactElement {
	const [count, setCount] = useState(0);
	return <Button onClick={ () => setCount(count + 1) }>{ label }: { count }</Button>;
}

function StatefulCondition({ condition }: LogicConditionEditorConditionComponentProps<string>): ReactElement {
	return <StatefulDetails label={ condition } />;
}

describe('LogicConditionEditor renderers', () => {
	it('preserves child state when a render callback changes', () => {
		const conditions = [{ logic: 'and' as const, condition: 'condition' }];
		const view = render(<LogicConditionEditor conditions={ conditions } renderCondition={ () => <StatefulDetails label='before' /> } />);
		fireEvent.click(screen.getByRole('button', { name: 'before: 0' }));
		expect(screen.getByRole('button', { name: 'before: 1' })).toBeVisible();

		view.rerender(<LogicConditionEditor conditions={ conditions } renderCondition={ () => <StatefulDetails label='after' /> } />);
		expect(screen.getByRole('button', { name: 'after: 1' })).toBeVisible();
	});

	it('continues to render hook-using component children as components', () => {
		const conditions = [{ logic: 'and' as const, condition: 'component' }];
		const view = render(<LogicConditionEditor conditions={ conditions } ConditionComponent={ StatefulCondition } />);
		fireEvent.click(screen.getByRole('button', { name: 'component: 0' }));
		view.rerender(<LogicConditionEditor conditions={ conditions } ConditionComponent={ StatefulCondition } processing />);
		expect(screen.getByRole('button', { name: 'component: 1' })).toBeVisible();
	});
});
