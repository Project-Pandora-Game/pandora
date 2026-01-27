import { screen, waitFor } from '@testing-library/react';
import { HTMLInputTypeAttribute } from 'react';

export function TestFieldIsRendered(
	fieldName: string,
	label: string,
	expectedType: HTMLInputTypeAttribute,
	expectedAutoComplete?: string,
): void {
	it(`should render a ${ fieldName } field`, () => {
		const field = screen.getByLabelText(label);
		expect(field).toBeVisible();
		expect(field).toHaveAttribute('type', expectedType);
		if (expectedAutoComplete) {
			expect(field).toHaveAttribute('autoComplete', expectedAutoComplete);
		}
	});
}

export function TestSubmitButtonIsRendered(): void {
	it('should render a submit button', () => {
		const button = screen.getByRole('button');
		expect(button).toBeVisible();
		expect(button).toHaveAttribute('type', 'submit');
	});
}

export async function ExpectFieldToBeInvalid(label: string, errorMessage?: string): Promise<void> {
	await waitFor(() => {
		const input = screen.getByLabelText(label);
		expect(input).toBeInvalid();
		if (errorMessage) {
			if (input instanceof HTMLInputElement) {
				expect(input.validationMessage).toBe(errorMessage);
			} else {
				expect(screen.getByText(errorMessage)).toBeVisible();
			}
		}
	});
}
