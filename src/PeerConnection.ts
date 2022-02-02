type Message = {
	sender: string;
	recepient: string;
	data: {
		// TODO:
		type: 'offer';
		icecandidate: unknown;
		answer: RTCSessionDescriptionInit;
	};
	timestamp: string;
};

class PeerConnection {
	public peerConnection: RTCPeerConnection;
	public dataChannel: RTCDataChannel;
	public signaling: WebSocket;
	private localId: string;
	private remoteId: string;

	constructor(configuration: RTCConfiguration, signaling: WebSocket, localId: string, remoteId: string) {
		this.peerConnection = new RTCPeerConnection(configuration);
		this.dataChannel = this.peerConnection.createDataChannel('testChanel');
		this.signaling = signaling;
		this.localId = localId;
		this.remoteId = remoteId;

		this.dataChannel.addEventListener('message', (event) => console.log('MESSAGE', event.data));

		this.signaling.addEventListener('message', async (message) => {
			const data: Message = JSON.parse(message.data);

			if (data.data.type === 'offer') {
				this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.data));
				const answer = await this.peerConnection.createAnswer();
				await this.peerConnection.setLocalDescription(answer);
				console.log('ANSW');
				this.send({ answer });
			}

			if ('answer' in data.data) {
				const remoteDescription = new RTCSessionDescription(data.data.answer);
				await this.peerConnection.setRemoteDescription(remoteDescription);
			}

			if ('icecandidate' in data.data) {
				try {
					await this.peerConnection.addIceCandidate(data.data.icecandidate);
				} catch (e) {
					console.error(e);
				}
			}
		});

		this.peerConnection.addEventListener('icecandidate', (event) => {
			if (event.candidate) this.send({ icecandidate: event.candidate });
		});

		this.peerConnection.addEventListener('datachannel', (event) => {
			this.dataChannel = event.channel;
		});

		this.peerConnection.addEventListener('connectionstatechange', () => {
			if (this.peerConnection.connectionState === 'connected') {
				console.log('CONNECTED');
			}
		});
	}

	private async createOffer() {
		const offer = await this.peerConnection.createOffer();

		await this.peerConnection.setLocalDescription(offer);

		return offer;
	}

	public async join() {
		const offer = await this.createOffer();
		this.send(offer);
	}

	private send(data: unknown) {
		console.log('SENDEING', {
			sender: this.localId,
			recepient: this.remoteId,
			data,
			timestamp: Date.now(),
		});
		this.signaling.send(
			JSON.stringify({
				sender: this.localId,
				recepient: this.remoteId,
				data,
				timestamp: Date.now(),
			})
		);
	}

	public sendMessage(message: string) {
		const data = {
			senderId: this.localId,
			username: 'test',
			message,
			timestamp: Date.now(),
		};

		this.dataChannel.send(JSON.stringify(data));
	}

	public on(event: 'message', handler: (event: MessageEvent) => void) {
		switch (event) {
			case 'message':
				this.dataChannel.addEventListener('message', (event) => handler(event));
				break;

			default:
				break;
		}
	}
}

export default PeerConnection;
