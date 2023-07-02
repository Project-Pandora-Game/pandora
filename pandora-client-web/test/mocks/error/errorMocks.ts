import { CreateDefaultDirectoryStatus } from 'pandora-common';
import { DebugData } from '../../../src/components/error/debugContextProvider';
import { DirectoryConnectionState } from '../../../src/networking/directoryConnector';
import { ShardConnectionState } from '../../../src/networking/shardConnector';
import { MockConnectionInfo } from '../networking/mockShardConnector';

export function MockDebugData(overrides?: Partial<DebugData>): DebugData {
	return {
		directoryState: DirectoryConnectionState.CONNECTED,
		directoryStatus: CreateDefaultDirectoryStatus(),
		shardState: ShardConnectionState.CONNECTED,
		shardConnectionInfo: MockConnectionInfo(),
		...overrides,
	};
}
