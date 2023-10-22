export function DownloadAsFile(content: Blob, filename: string): void;
export function DownloadAsFile(content: string, filename: string, type?: string): void;
export function DownloadAsFile(content: string | Blob, filename: string, type?: string): void {
	let url = '';
	if (typeof content === 'string') {
		if (content.startsWith('data:')) {
			url = content;
		} else {
			const blob = new Blob([content], { type });
			url = URL.createObjectURL(blob);
		}
	} else {
		url = URL.createObjectURL(content);
	}
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	a.style.display = 'none';
	document.body.appendChild(a);
	a.click();
	a.remove();
	URL.revokeObjectURL(url);
}
