import { GetLogger } from 'pandora-common';
import { Component, ErrorInfo, ReactElement } from 'react';
import { ChildrenProps } from '../../common/reactTypes';
import './localErrorBoundary.scss';

export interface ForwardingErrorBoundaryProps extends ChildrenProps {
	errorHandler: (error: unknown) => void;
}

export interface ForwardingErrorBoundaryState {
	hadError: boolean;
}

const logger = GetLogger('ForwardingErrorBoundary');

export class ForwardingErrorBoundary extends Component<ForwardingErrorBoundaryProps, ForwardingErrorBoundaryState> {
	public override state: ForwardingErrorBoundaryState = {
		hadError: false,
	};

	public override render(): ReactElement | null {
		const { children } = this.props;
		const { hadError } = this.state;

		if (hadError) {
			return null;
		}

		return <>{ children }</>;
	}

	public static getDerivedStateFromError(_error: unknown): Partial<ForwardingErrorBoundaryState> {
		return {
			hadError: true,
		};
	}

	public override componentDidCatch(error: Error, errorInfo?: ErrorInfo) {
		logger.alert('Caught error:', error, errorInfo);

		const { errorHandler } = this.props;

		errorHandler(error);
	}
}
