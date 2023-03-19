declare namespace GlobalMixins {
	// Adds the internal @pixi/react event to the visible types, so we can use it manually
	interface DisplayObjectEvents {
		// eslint-disable-next-line @typescript-eslint/naming-convention
		__REACT_PIXI_REQUEST_RENDER__: [];
	}
}
