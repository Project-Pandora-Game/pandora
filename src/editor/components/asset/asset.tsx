import React from 'react';

export function AssetUI() {
	const selectedAsset = null;

	if (!selectedAsset) {
		return (
			<div>
				<h3>Select an asset to edit layers</h3>
			</div>
		);
	}

	return <div>Asset</div>;
}
