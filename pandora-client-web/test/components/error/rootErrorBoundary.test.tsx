import { render, RenderResult, screen, waitFor } from '@testing-library/react';
import { noop } from 'lodash';
import { Logger } from 'pandora-common';
import { ReactElement, useEffect } from 'react';
import { debugContext, DebugData } from '../../../src/components/error/debugContextProvider';
import { MAX_ERROR_STACK_LINES } from '../../../src/components/error/errorReport';
import { RootErrorBoundary } from '../../../src/components/error/rootErrorBoundary';
import { DirectoryConnectionState } from '../../../src/networking/directoryConnector';
import { ShardConnectionState } from '../../../src/networking/shardConnector';
import { MockDebugData } from '../../mocks/error/errorMocks';

describe('RootErrorBoundary', () => {
	const setDebugData = jest.fn();
	let debugData: DebugData;
	let error: Error;
	let consoleError: jest.SpyInstance;
	let loggerFatal: jest.SpyInstance;

	beforeAll(() => {
		consoleError = jest.spyOn(console, 'error');
		consoleError.mockImplementation(noop);
		loggerFatal = jest.spyOn(Logger.prototype, 'fatal');
		loggerFatal.mockImplementation(noop);
	});

	afterAll(() => {
		consoleError.mockRestore();
		loggerFatal.mockRestore();
	});

	beforeEach(() => {
		debugData = MockDebugData({
			directoryState: DirectoryConnectionState.CONNECTED,
			shardState: ShardConnectionState.CONNECTED,
		});
		error = new Error('Boom!');
	});

	it('should display child content if no errors are thrown', () => {
		renderComponent(<span>Keep calm and carry on</span>);
		expect(screen.getByText('Keep calm and carry on')).toBeVisible();
		expect(screen.queryByRole('heading')).not.toBeInTheDocument();
	});

	it('should catch errors synchronously thrown by a component', () => {
		renderComponent(<SynchronousBomb error={ error } />);
		expectErrorScreen();
	});

	it('should catch errors thrown asynchronously by a component', async () => {
		renderComponent(<AsynchronousBomb error={ error } />);
		await waitFor(() => {
			expectErrorScreen();
		});
	});

	/*
	 * FIXME: It doesn't look like it's currently possible to test this without Jest bombing out, as unhandled promise
	 * rejections in jsdom cause the underlying Node process to terminate
	 * See https://github.com/jsdom/jsdom/issues/2346
	 */
	it.skip('should catch errors thrown asynchronously by a promise rejection in a component', async () => {
		renderComponent(<PromiseBomb error={ error } />);
		await waitFor(() => {
			expectErrorScreen();
		});
	});

	it('should catch errors thrown outside of the React component tree', async () => {
		renderComponent(<div>Tick, tick, tick</div>);
		setTimeout(() => {
			throw error;
		}, 10);
		await waitFor(() => {
			expectErrorScreen();
		});
	});

	/*
	 * FIXME: It doesn't look like it's currently possible to test this without Jest bombing out, as unhandled promise
	 * rejections in jsdom cause the underlying Node process to terminate
	 * See https://github.com/jsdom/jsdom/issues/2346
	 */
	it.skip('should catch errors thrown asynchronously by a promise rejection outside of the React component tree',
		async () => {
			renderComponent(<div>Tick, tick, tick</div>);
			void Promise.reject(error);
			await waitFor(() => {
				expectErrorScreen();
			});
		},
	);

	function renderComponent(element: ReactElement): RenderResult {
		return render(
			<debugContext.Provider value={ { debugData, setDebugData } }>
				<RootErrorBoundary>
					{ element }
				</RootErrorBoundary>
			</debugContext.Provider>,
		);
	}

	function expectErrorScreen(): void {
		expect(screen.getByRole('heading')).toHaveTextContent('Something went wrong');
		const reportContent = screen.getByTestId('report-content');
		const expectedStack = (error.stack ?? '')
			.split('\n')
			.slice(0, MAX_ERROR_STACK_LINES);
		expect(reportContent).toBeVisible();
		expect(reportContent).toHaveTextContent(error.name);
		expect(reportContent).toHaveTextContent(error.message);
		expectReportContentLines(expectedStack);
		expect(reportContent).toHaveTextContent('Directory state: CONNECTED');
		expectReportContentLines(JSON.stringify(debugData.directoryState, null, 4).split('\n'));
		expect(reportContent).toHaveTextContent('Shard state: CONNECTED');
		expectReportContentLines(JSON.stringify(debugData.shardState, null, 4).split('\n'));
	}

	function expectReportContentLines(lines: string[]): void {
		const reportContent = screen.getByTestId('report-content');
		for (const line of lines) {
			expect(reportContent).toHaveTextContent(line.trim());
		}
	}
});

interface BombProps {
	error: Error;
}

function SynchronousBomb({ error }: BombProps): ReactElement {
	throw error;
}

function AsynchronousBomb({ error }: BombProps): ReactElement {
	useEffect(() => {
		setTimeout(() => {
			throw error;
		}, 10);
	}, [error]);

	return <span>Tick, tick, tick</span>;
}

function PromiseBomb({ error }: BombProps): ReactElement {
	useEffect(() => {
		void (async () => {
			await Promise.reject(error);
		})();
	});

	return <span>Tick, tick, tick</span>;
}
