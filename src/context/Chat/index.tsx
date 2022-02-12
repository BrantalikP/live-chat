import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import { v4 as uuid } from 'uuid';

export enum Event {
	HAS_JOINED = 'hasJoined',
	HAS_LEFT = 'hasLeft',
}
export interface MessageData {
	message: string;
	id: string;
	username: string;
	senderId: string;
	timestamp: number;
	avatar: string;
	event?: Event;
}

interface ContextType {
	onSend: (inputValue: string) => void;
	onEnterChat: ({ name, avatar }: { name: string; avatar: string }) => void;
	onLeaveChat: () => void;
	state: { isEntered: boolean };
	userCounter: Number;
	messageData: MessageData[]; // TODO: types
	connections: PeerConnection;
	error: string | null;
}

interface Props {
	children: JSX.Element;
	signalingServer: string;
	iceServers: { urls: string }[];
}

type PeerConnection = Map<string, { displayName: string; pc: RTCPeerConnection; dataChannel: RTCDataChannel }>;

const contextDefaults: ContextType = {
	onSend: () => {},
	onEnterChat: () => {},
	onLeaveChat: () => {},
	state: { isEntered: false },
	connections: new Map(),
	messageData: [],
	error: null,
	userCounter: 0,
};

const DEFAULT_AVATAR =
	'https://cdn.backstage-api.com?key=backstage-cms-production-uploads/1000x1000/5e0ad1b0-515e-11e9-a7ed-371ac744bd33/profile-images/img/5c55a618-e55a-4c68-85ed-55afa4b8e2fb-image%201@2x.png';

export const ChatContext = createContext<ContextType>(contextDefaults);

export const ChatProvider = ({ children, signalingServer, iceServers }: Props) => {
	const [isEntered, setIsEntered] = useState(false);
	const [userCounter, setUserCounter] = useState(1);
	const [localUuid] = useState(uuid());
	const [messageData, setMessageData] = useState<MessageData[]>([]);
	const [error, setError] = useState<string>('');
	const [user, setUser] = useState({ name: 'test', avatar: DEFAULT_AVATAR });
	const webSocket = useRef<WebSocket>(null);
	const peerConnections = useRef<PeerConnection>(new Map());

	const onSendEventMessage = (peer, event: Event) => {
		// FIXME: OHACK
		if (peer.displayName.length <= 20) {
			setMessageData((prev) => [
				...prev,
				{
					id: uuid(),
					senderId: localUuid,
					username: peer.displayName,
					timestamp: Date.now(),
					avatar: user.avatar,
					message: '',
					event,
				},
			]);
		}
	};

	const onSend = (inputValue: string) => {
		try {
			const messageId = uuid();
			setMessageData((prev) => [
				...prev,
				{
					id: messageId,
					message: inputValue,
					username: 'Me',
					senderId: localUuid,
					timestamp: Date.now(),
					avatar: user.avatar,
				},
			]);

			peerConnections.current.forEach((connection) => {
				const message = JSON.stringify({
					id: messageId,
					senderId: localUuid,
					username: user.name,
					message: inputValue,
					timestamp: Date.now(),
					avatar: user.avatar,
				});

				connection?.dataChannel?.send(message);
			});
		} catch (e) {
			setError(e as string);
			console.warn(e);
		}
	};

	function checkPeerDisconnect(peerUuid: string) {
		const state = peerConnections.current.get(peerUuid)?.pc.iceConnectionState;
		console.log(`connection with peer ${peerUuid} ${state}`);
		if (state === 'failed' || state === 'closed' || state === 'disconnected') {
			setUserCounter((prev) => prev - 1);
			onSendEventMessage(peerConnections.current.get(peerUuid), Event.HAS_LEFT);
			peerConnections.current.delete(peerUuid);
		}
	}

	function setUpPeer(peerUuid: string, displayName: string, initCall = false) {
		const configuration = { iceServers };
		const dataChannelId = uuid();
		const peerConnection = new RTCPeerConnection(configuration);
		const dataChannel = peerConnection.createDataChannel(dataChannelId);

		peerConnection.onicecandidate = (event) => gotIceCandidate(event, peerUuid);
		peerConnection.oniceconnectionstatechange = () => checkPeerDisconnect(peerUuid);
		peerConnection.addEventListener('datachannel', (event) =>
			Object.defineProperty(peerConnections.current.get(peerUuid), 'dataChannel', {
				value: event.channel,
			})
		);
		peerConnection.addEventListener('connectionstatechange', () => {
			if (peerConnections.current.get(peerUuid)?.pc.connectionState === 'connected')
				onSendEventMessage(peerConnections.current.get(peerUuid), Event.HAS_JOINED);
			console.log('CONNECTED');
		});

		dataChannel.addEventListener('message', (event) => setMessageData((prev) => [...prev, JSON.parse(event.data)]));

		if (initCall) {
			peerConnection
				.createOffer()
				.then((description) => createdDescription(description, peerUuid))
				.catch((e) => console.log({ e }));
		}

		peerConnections.current.set(peerUuid, { displayName, pc: peerConnection, dataChannel });
	}

	function gotIceCandidate(event: RTCPeerConnectionIceEvent, peerUuid: string) {
		if (event.candidate != null) {
			webSocket.current?.send(JSON.stringify({ ice: event.candidate, uuid: localUuid, dest: peerUuid }));
		}
	}

	function createdDescription(description: RTCSessionDescriptionInit, peerUuid: string) {
		console.log(`got description, peer ${peerUuid}`);
		peerConnections.current
			.get(peerUuid)
			?.pc.setLocalDescription(description)
			.then(function () {
				webSocket.current?.send(
					JSON.stringify({
						sdp: peerConnections.current.get(peerUuid)?.pc.localDescription,
						uuid: localUuid,
						dest: peerUuid,
					})
				);
			})
			.catch((e) => console.log(e));
	}

	function gotMessageFromServer(message: MessageEvent) {
		const signal = JSON.parse(message.data);
		const peerUuid = signal.uuid;

		// Ignore messages that are not for us or from ourselves
		if (peerUuid == localUuid || (signal.dest != localUuid && signal.dest != 'all')) return;

		if (signal.displayName && signal.dest == 'all') {
			// set up peer connection object for a newcomer peer
			setUpPeer(peerUuid, signal.displayName);
			webSocket.current?.send(JSON.stringify({ displayName: localUuid, uuid: localUuid, dest: peerUuid }));
		} else if (signal.displayName && signal.dest == localUuid) {
			// initiate call if we are the newcomer peer
			setUpPeer(peerUuid, signal.displayName, true);
		} else if (signal.sdp) {
			peerConnections.current
				.get(peerUuid)
				?.pc.setRemoteDescription(new RTCSessionDescription(signal.sdp))
				.then(function () {
					// Only create answers in response to offers
					if (signal.sdp.type == 'offer') {
						peerConnections.current
							.get(peerUuid)
							?.pc.createAnswer()
							.then((description) => createdDescription(description, peerUuid))
							.catch((e) => console.error(e));
					}
				})
				.catch((e) => console.error(e));
		} else if (signal.ice) {
			peerConnections.current
				.get(peerUuid)
				?.pc.addIceCandidate(new RTCIceCandidate(signal.ice))
				.catch((e) => console.error(e));
		}
	}

	const onEnterChat = async ({ name, avatar }) => {
		setError('');
		setUser({ name, avatar });
		// @ts-ignore
		webSocket.current = new WebSocket(signalingServer);

		webSocket.current.onmessage = gotMessageFromServer;
		webSocket.current.onopen = () => {
			console.log({ displayName: name, uuid: localUuid, dest: 'all' });
			webSocket.current?.send(
				JSON.stringify({
					displayName: name || 'aaa',
					uuid: localUuid || 'bbb',
					dest: 'all',
				})
			);
		};

		setIsEntered(true);
	};

	const onLeaveChat = () => {
		webSocket.current?.close();
		peerConnections.current.forEach((connection) => {
			connection.pc.close();
		});
		setIsEntered(false);
	};

	const chatContext: ContextType = {
		onSend,
		onEnterChat,
		onLeaveChat,
		messageData,
		userCounter,
		connections: peerConnections.current,
		state: { isEntered },
		error,
	};

	return <ChatContext.Provider value={chatContext}>{children}</ChatContext.Provider>;
};
