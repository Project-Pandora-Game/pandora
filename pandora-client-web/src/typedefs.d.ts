declare module '*.svg' {
	const url: string;
	export = url;
}

declare module '*.png' {
	const url: string;
	export = url;
}

declare module '*.mp3' {
	const url: string;
	export = url;
}

declare module '*.wav' {
	const url: string;
	export = url;
}

declare interface Navigator {
	getAutoplayPolicy?(type: 'mediaelement' | 'audiocontext' | HTMLMediaElement | AudioContext): 'allowed' | 'allowed-muted' | 'disallowed';
}
