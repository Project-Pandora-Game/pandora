import { AssertNever } from 'pandora-common';
import { toast, ToastContent, ToastOptions } from 'react-toastify';

const TOAST_OPTIONS_SUCCESS: ToastOptions = {
	type: 'success',
	isLoading: false,
	autoClose: 2_000,
	hideProgressBar: true,
	closeOnClick: true,
	closeButton: true,
	draggable: true,
};
const TOAST_OPTIONS_ERROR: ToastOptions = {
	type: 'error',
	isLoading: false,
	autoClose: 10_000,
	closeOnClick: true,
	closeButton: true,
	draggable: true,
};
const TOAST_OPTIONS_PENDING: ToastOptions = {
	type: 'default',
	isLoading: true,
	autoClose: false,
	closeOnClick: false,
	closeButton: false,
	draggable: false,
};

export class PersistentToast {
	private id: string | number | null = null;

	public show(style: 'progress' | 'success' | 'error', content: ToastContent): void {
		let options: ToastOptions;
		if (style === 'progress') {
			options = { ...TOAST_OPTIONS_PENDING };
		} else if (style === 'success') {
			options = { ...TOAST_OPTIONS_SUCCESS };
		} else if (style === 'error') {
			options = { ...TOAST_OPTIONS_ERROR };
		} else {
			AssertNever(style);
		}

		options.onClose = () => {
			this.id = null;
		};

		if (this.id !== null) {
			toast.update(this.id, {
				...options,
				render: content,
			});
		} else {
			this.id = toast(content, options);
		}
	}

	public hide(): void {
		if (this.id !== null) {
			toast.dismiss(this.id);
			this.id = null;
		}
	}
}
