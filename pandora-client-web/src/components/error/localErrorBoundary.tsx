import { GetLogger } from 'pandora-common';
import React, { Component, ErrorInfo, ReactElement } from 'react';
import { ChildrenProps } from '../../common/reactTypes';
import { Button } from '../common/button/button';
import { DebugContext, debugContext } from './debugContextProvider';
import { BuildErrorReport } from './errorReport';
import { Column, Row } from '../common/container/container';
import { CopyToClipboard } from '../../common/clipboard';
import './localErrorBoundary.scss';
import classNames from 'classnames';
import { ModalDialog } from '../dialog/dialog';

export enum ReportCopyState {
	NONE = 'Copy to clipboard',
	SUCCESS = 'Copied!',
	FAILED = 'Failed',
}

export interface LocalErrorBoundaryProps extends ChildrenProps {
	errorOverlayClassName?: string;
}

export interface LocalErrorBoundaryState {
	report?: string;
	showReport: boolean;
	copyState: ReportCopyState;
}

const logger = GetLogger('LocalErrorBoundary');

export class LocalErrorBoundary extends Component<LocalErrorBoundaryProps, LocalErrorBoundaryState> {
	private timeout: number | null = null;

	public override state: LocalErrorBoundaryState = {
		showReport: false,
		copyState: ReportCopyState.NONE,
	};

	public override render(): ReactElement {
		const { children } = this.props;
		const { report } = this.state;

		if (report != null) {
			return this.renderErrorContent();
		}

		return <>{ children }</>;
	}

	public static getDerivedStateFromError(error: unknown): Partial<LocalErrorBoundaryState> {
		return {
			report: BuildErrorReport(error, undefined, undefined),
		};
	}

	public override componentDidCatch(error: Error, errorInfo?: ErrorInfo) {
		logger.alert('Caught error:', error, errorInfo);

		const { report } = this.state;
		if (!report) {
			const { debugData } = this.context as DebugContext;
			this.setState({
				report: BuildErrorReport(error, errorInfo, debugData),
			});
		}
	}

	public override componentWillUnmount(): void {
		if (this.timeout) {
			clearTimeout(this.timeout);
			this.timeout = null;
		}
	}

	private renderErrorContent(): ReactElement {
		const { copyState, showReport, report } = this.state;
		const {
			errorOverlayClassName = 'flex-1 fill',
		} = this.props;

		return (
			<div className={ classNames('localErrorBoundaryOverlay', errorOverlayClassName) }>
				<div className='localErrorBoundaryContent'>
					<h1>Something went wrong...</h1>
					<span>... which resulted in this component crashing</span>
					<Button
						onClick={ () => {
							this.setState({ showReport: true });
						} }
					>
						Show error report
					</Button>
					<Button
						onClick={ () => {
							this.setState({
								report: undefined,
								showReport: false,
							});
						} }
					>
						Reload the component
					</Button>
				</div>
				{
					showReport && report != null ? (
						<ModalDialog>
							<Column className='localErrorBoundaryDialog'>
								<h1>Something went wrong</h1>
								<p>
									Pandora has run into an error - this is likely a problem with the game.<br />
									Please report this error, providing the following information:
								</p>

								<pre>
									<span className='button-wrapper'>
										<Button onClick={ () => this.copyToClipboard() }>{ copyState }</Button>
									</span>
									<span className='report-content'>
										{ report }
									</span>
								</pre>

								<Row alignX='center' padding='medium'>
									<Button
										onClick={ () => {
											this.setState({ showReport: false });
										} }
									>
										Close
									</Button>
								</Row>
							</Column>
						</ModalDialog>
					) : null
				}
			</div>
		);
	}

	private copyToClipboard(): void {
		const { report } = this.state;

		CopyToClipboard(
			report ?? '',
			() => {
				this.setState({ copyState: ReportCopyState.SUCCESS });
				this.timeout = window.setTimeout(() => {
					this.setState({ copyState: ReportCopyState.NONE });
				}, 5000);
			},
			() => {
				this.setState({ copyState: ReportCopyState.FAILED });
				this.timeout = window.setTimeout(() => {
					this.setState({ copyState: ReportCopyState.NONE });
				}, 5000);
			},
		);
	}
}

LocalErrorBoundary.contextType = debugContext;
