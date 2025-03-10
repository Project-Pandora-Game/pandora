import { CreateDefaultDirectoryStatus } from 'pandora-common';
import { DebugData } from '../../../src/components/error/debugContextProvider.tsx';
import { DirectoryConnectionState } from '../../../src/networking/directoryConnector.ts';
import { ShardConnectionState } from '../../../src/networking/shardConnector.ts';
import { MockConnectionInfo } from '../networking/mockShardConnector.ts';

export function MockDebugData(overrides?: Partial<DebugData>): DebugData {
	return {
		directoryState: DirectoryConnectionState.CONNECTED,
		directoryStatus: CreateDefaultDirectoryStatus(),
		shardState: ShardConnectionState.CONNECTED,
		shardConnectionInfo: MockConnectionInfo(),
		...overrides,
	};
}
