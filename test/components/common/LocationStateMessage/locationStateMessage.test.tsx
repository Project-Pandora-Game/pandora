import { screen } from '@testing-library/react';
import React from 'react';
import { LocationStateMessage } from '../../../../src/components/common/LocationStateMessage/locationStateMessage';
import { RenderWithRouter } from '../../../testUtils';

describe('LocationStateMessage', () => {
	it('should not render when there is no location state', () => {
		RenderWithRouter(<LocationStateMessage />, {
			initialEntries: ['/foo'],
		});
		expect(screen.queryByTestId('LocationStateMessage')).not.toBeInTheDocument();
	});

	it('should not render when there is no message in the location state', () => {
		RenderWithRouter(<LocationStateMessage />, {
			initialEntries: [{ pathname: '/foo', state: { testData: 'something' } }],
		});
		expect(screen.queryByTestId('LocationStateMessage')).not.toBeInTheDocument();
	});

	it('should render any message in the location state', () => {
		RenderWithRouter(<LocationStateMessage />, {
			initialEntries: [{ pathname: '/foo', state: { message: 'Location state message' } }],
		});
		const message = screen.getByTestId('LocationStateMessage');
		expect(message).toBeVisible();
		expect(message).toHaveTextContent('Location state message');
	});
});
