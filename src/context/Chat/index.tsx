import React, { createContext, useContext, useState, useRef } from 'react';
import { v4 as uuid } from 'uuid';

interface MessageData {
	message: string;
	username: string;
	senderId: string;
	timestamp: number;
}

interface ContextType {
	onSend: (inputValue: string) => void;
	onEnterChat: () => void;
	onLeaveChat: () => void;
	state: { isEntered: boolean };
	messageData: any[]; //TODO: types
	error: string | null;
}

interface Props {
	children: JSX.Element;
}

const contextDefaults: ContextType = {
	onSend: () => {},
	onEnterChat: () => {},
	onLeaveChat: () => {},
	state: { isEntered: false },
	messageData: [],
	error: null,
};

const WEBSOCKET_SERVER_IP = 'ws://3.71.110.139:8001/';
const configuration = {
	iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

export const ChatContext = createContext<ContextType>(contextDefaults);

export const ChatProvider = ({ children }: Props) => {
	const [isEntered, setIsEntered] = useState(false);
	const [localUuid] = useState(uuid());
	const [messageData, setMessageData] = useState<MessageData[]>([]);
	const [error, setError] = useState<string>('');
	const webSocket = useRef<WebSocket>(null);
	const peerConnections = useRef<
		Map<string, { displayName: string; pc: RTCPeerConnection; dataChannel: RTCDataChannel }>
	>(new Map());

	const onSend = (inputValue: string) => {
		try {
			setMessageData((prev) => [
				...prev,
				{ message: inputValue, username: 'ja', senderId: localUuid, timestamp: Date.now() },
			]);
			console.log(peerConnections);
			peerConnections.current.forEach((connection) => {
				const message = JSON.stringify({
					senderId: localUuid,
					username: 'test', //TODO:asd
					message: inputValue,
					timestamp: Date.now(),
				});

				connection?.dataChannel?.send(message);
			});
		} catch (e) {
			setError(e as string);
			console.warn(e);
		}
	};

	function checkPeerDisconnect(peerUuid: string) {
		var state = peerConnections.current.get(peerUuid)?.pc.iceConnectionState;
		console.log(`connection with peer ${peerUuid} ${state}`);
		if (state === 'failed' || state === 'closed' || state === 'disconnected') {
			peerConnections.current.delete(peerUuid);
		}
	}

	function setUpPeer(peerUuid: string, displayName: string, initCall = false) {
		const pc = new RTCPeerConnection(configuration);
		const dataChannel = pc.createDataChannel('test');

		pc.onicecandidate = (event) => gotIceCandidate(event, peerUuid);
		pc.oniceconnectionstatechange = () => checkPeerDisconnect(peerUuid);
		pc.addEventListener('datachannel', (event) =>
			Object.defineProperty(peerConnections.current.get(peerUuid), 'dataChannel', { value: event.channel })
		);
		pc.addEventListener('connectionstatechange', () => {
			if (peerConnections.current.get(peerUuid)?.pc.connectionState === 'connected') console.log('CONNECTED');
		});

		dataChannel.addEventListener('message', (event) => setMessageData((prev) => [...prev, JSON.parse(event.data)]));

		if (initCall) {
			pc.createOffer()
				.then((description) => createdDescription(description, peerUuid))
				.catch((e) => console.log({ e }));
		}

		peerConnections.current.set(peerUuid, { displayName: displayName, pc, dataChannel });
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
		var signal = JSON.parse(message.data);
		var peerUuid = signal.uuid;

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

	const onEnterChat = async () => {
		setError('');

		//@ts-ignore
		webSocket.current = new WebSocket(WEBSOCKET_SERVER_IP);

		console.log(webSocket);

		webSocket.current.onmessage = gotMessageFromServer;
		webSocket.current.onopen = () => {
			console.log({ displayName: localUuid, uuid: localUuid, dest: 'all' });
			webSocket.current?.send(
				JSON.stringify({ displayName: localUuid || 'aaa', uuid: localUuid || 'bbb', dest: 'all' })
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
		state: { isEntered },
		error,
	};
	return <ChatContext.Provider value={chatContext}>{children}</ChatContext.Provider>;
};

export const useChat = () => useContext(ChatContext);
