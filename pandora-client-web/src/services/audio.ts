import {
	GetLogger,
	Service,
	type Satisfies,
	type ServiceConfigBase,
	type ServiceProviderDefinition,
} from 'pandora-common';
import type { ClientServices } from './clientServices.ts';

type AudioServiceConfig = Satisfies<{
	dependencies: Pick<ClientServices, 'userActivation'>;
	events: false;
}, ServiceConfigBase>;

/**
 * Service for playing audio, even on the background.
 */
export class AudioService extends Service<AudioServiceConfig> {
	private readonly logger = GetLogger('AudioService');

	private _audioContext: AudioContext | null = null;

	private _requestActivationRun(): void {
		this.serviceDeps.userActivation.requestRunOnUserActivation(() => {
			if (this._audioContext == null) {
				this._audioContext = new AudioContext();

				this._audioContext.addEventListener('statechange', this._onContextStateChange);

				this.logger.verbose('Audio context created');
			}

			if (this._audioContext.state !== 'running') {
				this._audioContext.resume().then(() => {
					this.logger.verbose('Audio context resumed');
				}, (err) => {
					this.logger.error('Failed to resume audio context', err);
				});
			}
		});
	}

	private _onContextStateChange = () => {
		if (this._audioContext != null && this._audioContext.state !== 'running') {
			this.logger.alert('Audio context got interrupted, requesting resume');
			this._requestActivationRun();
		}
	};

	protected override serviceInit(): void {
		if (typeof AudioContext === 'undefined') {
			this.logger.error('Browser does not support AudioContext');
			return;
		}
		this._requestActivationRun();
	}

	private _didWarnSeparatePlay = false;
	public playOnce(audio: HTMLAudioElement): void {
		let track: MediaElementAudioSourceNode | undefined;

		if (this._audioContext != null && this._audioContext.state === 'running') {
			track = this._audioContext.createMediaElementSource(audio);
			track.connect(this._audioContext.destination);
		} else if (!this._didWarnSeparatePlay) {
			this.logger.warning('Audio play requested without context, playing separately.');
			this._didWarnSeparatePlay = true;
		}

		audio.addEventListener('ended', () => {
			track?.disconnect();
		});
		audio.play().catch((err) => {
			this.logger.warning('Error playing sound:', err);
			track?.disconnect();
		});
	}
}

export const AudioServiceProvider: ServiceProviderDefinition<ClientServices, 'audio', AudioServiceConfig> = {
	name: 'audio',
	ctor: AudioService,
	dependencies: {
		userActivation: true,
	},
};
