import { fireEvent, render } from '@testing-library/react';
import { NumberInput } from '../../../src/common/userInteraction/input/numberInput.tsx';
import { TextInput } from '../../../src/common/userInteraction/input/textInput.tsx';

describe('input value synchronization', () => {
	it('updates focused read-only text immediately when the selected data changes', () => {
		const view = render(<TextInput value='first asset' readOnly />);
		const input = view.getByRole('textbox') as HTMLInputElement;
		input.focus();
		view.rerender(<TextInput value='second asset' readOnly />);
		expect(input.value).toBe('second asset');

		fireEvent.blur(input);
		view.rerender(<TextInput value='third asset' readOnly />);
		expect(input.value).toBe('third asset');
	});

	it('updates focused read-only numbers immediately', () => {
		const view = render(<NumberInput value={ 1 } readOnly />);
		const input = view.getByRole('spinbutton') as HTMLInputElement;
		input.focus();
		view.rerender(<NumberInput value={ 2 } readOnly />);
		expect(input.valueAsNumber).toBe(2);
	});

	it('preserves in-progress edits when an editable field receives a new value', () => {
		const view = render(<TextInput value='initial' />);
		const input = view.getByRole('textbox') as HTMLInputElement;
		input.focus();
		fireEvent.change(input, { target: { value: 'typing' } });
		view.rerender(<TextInput value='remote update' />);
		expect(input.value).toBe('typing');
	});
});
