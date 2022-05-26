import { AssertNever } from 'pandora-common';
import { toast, ToastContent, ToastOptions } from 'react-toastify';

export const TOAST_OPTIONS_SUCCESS: ToastOptions = {
	type: 'success',
	isLoading: false,
	autoClose: 2_000,
	hideProgressBar: true,
	closeOnClick: true,
	closeButton: true,
	draggable: true,
};
export const TOAST_OPTIONS_ERROR: ToastOptions = {
	type: 'error',
	isLoading: false,
	autoClose: 10_000,
	closeOnClick: true,
	closeButton: true,
	draggable: true,
};
export const TOAST_OPTIONS_PENDING: ToastOptions = {
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

		let id = this.id;

		options.onOpen = () => {
			if (id === null)
				return;
			if (this.id === null) {
				this.id = id;
			} else if (this.id !== id) {
				// Toast already replaced by newer one, close this one
				toast.dismiss(id);
			}
		};

		options.onClose = () => {
			if (id === null)
				return;
			if (this.id === id) {
				this.id = null;
			}
		};

		if (this.id !== null) {
			toast.update(this.id, {
				...options,
				render: content,
			});
		} else {
			this.id = id = toast(content, options);
		}
	}

	public hide(): void {
		if (this.id !== null) {
			toast.dismiss(this.id);
			this.id = null;
		}
	}
}
