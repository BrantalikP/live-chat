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
	socketMessages: any[]; //TODO: types
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
	socketMessages: [],
	messageData: [],
	error: null,
};

const WEBSOCKET_SERVER_IP = 'ws://3.71.110.139:8001/';
// const WEBSOCKET_SERVER_IP = 'ws://172.16.13.14:8080/';

export const ChatContext = createContext<ContextType>(contextDefaults);

export const ChatProvider = ({ children }: Props) => {
	const peerConnections = useRef<
		Record<string, { displayName: string; pc: RTCPeerConnection; dataChannel: RTCDataChannel }>
	>({});
	const [isEntered, setIsEntered] = useState(false);
	const [socketMessages, setSocketMessages] = useState([]);
	const [connection, setConnection] = useState(null);
	const [localUuid, setLocalUuid] = useState(uuid());

	const [messageData, setMessageData] = useState<MessageData[]>([]);
	const [error, setError] = useState(null);

	const webSocket = useRef<WebSocket>(null);
	const configuration = {
		iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
	};
	const connections = useRef([]);

	//TODO:
	const onSend = (inputValue: string) => {
		try {
			setMessageData((prev) => [
				...prev,
				{ message: inputValue, username: 'ja', senderId: localUuid, timestamp: Date.now() },
			]);
			console.log(peerConnections);
			Object.values(peerConnections.current).forEach((connection) => {
				console.log('Connection', connection);

				const message = JSON.stringify({
					senderId: localUuid,
					username: 'test', //TODO:asd
					message: inputValue,
					timestamp: Date.now(),
				});
				//@ts-ignore
				connection?.dataChannel?.send(message);
			});
			// connections.current.forEach((connection) => connection.pc.sendMessage(inputValue));
		} catch (e) {
			setError(e);
			console.warn(e);
		}
	};

	function checkPeerDisconnect(peerUuid: string) {
		var state = peerConnections.current[peerUuid].pc.iceConnectionState;
		console.log(`connection with peer ${peerUuid} ${state}`);
		if (state === 'failed' || state === 'closed' || state === 'disconnected') {
			delete peerConnections.current[peerUuid];
			document.getElementById('videos').removeChild(document.getElementById('remoteVideo_' + peerUuid));
		}
	}

	function setUpPeer(peerUuid: string, displayName: string, initCall = false) {
		const pc = new RTCPeerConnection(configuration);
		const dataChannel = pc.createDataChannel('test');

		pc.onicecandidate = (event) => gotIceCandidate(event, peerUuid);
		pc.oniceconnectionstatechange = () => checkPeerDisconnect(peerUuid);
		pc.addEventListener('datachannel', (event) => (peerConnections.current[peerUuid].dataChannel = event.channel));
		pc.addEventListener('connectionstatechange', () => {
			if (peerConnections.current[peerUuid].pc.connectionState === 'connected') console.log('CONNECTED');
		});

		dataChannel.addEventListener('message', (event) => setMessageData((prev) => [...prev, JSON.parse(event.data)]));

		if (initCall) {
			pc.createOffer()
				.then((description) => createdDescription(description, peerUuid))
				.catch((e) => console.log({ e }));
		}

		peerConnections.current[peerUuid] = { displayName: displayName, pc, dataChannel };
	}

	function gotIceCandidate(event: RTCPeerConnectionIceEvent, peerUuid: string) {
		if (event.candidate != null) {
			webSocket.current.send(JSON.stringify({ ice: event.candidate, uuid: localUuid, dest: peerUuid }));
		}
	}

	function createdDescription(description: RTCSessionDescriptionInit, peerUuid: string) {
		console.log(`got description, peer ${peerUuid}`);
		peerConnections.current[peerUuid].pc
			.setLocalDescription(description)
			.then(function () {
				webSocket.current.send(
					JSON.stringify({
						sdp: peerConnections.current[peerUuid].pc.localDescription,
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
			webSocket.current.send(JSON.stringify({ displayName: localUuid, uuid: localUuid, dest: peerUuid }));
		} else if (signal.displayName && signal.dest == localUuid) {
			// initiate call if we are the newcomer peer
			setUpPeer(peerUuid, signal.displayName, true);
		} else if (signal.sdp) {
			peerConnections.current[peerUuid].pc
				.setRemoteDescription(new RTCSessionDescription(signal.sdp))
				.then(function () {
					// Only create answers in response to offers
					if (signal.sdp.type == 'offer') {
						peerConnections.current[peerUuid].pc
							.createAnswer()
							.then((description) => createdDescription(description, peerUuid))
							.catch((e) => console.error(e));
					}
				})
				.catch((e) => console.error(e));
		} else if (signal.ice) {
			peerConnections.current[peerUuid].pc
				.addIceCandidate(new RTCIceCandidate(signal.ice))
				.catch((e) => console.error(e));
		}
	}

	const onEnterChat = async () => {
		setError(null);

		webSocket.current = new WebSocket(WEBSOCKET_SERVER_IP);

		console.log(webSocket);

		webSocket.current.onmessage = gotMessageFromServer;
		webSocket.current.onopen = () => {
			console.log({ displayName: localUuid, uuid: localUuid, dest: 'all' });
			webSocket.current.send(
				JSON.stringify({ displayName: localUuid || 'aaa', uuid: localUuid || 'bbb', dest: 'all' })
			);
		};

		setIsEntered(true);
	};

	const onLeaveChat = () => {
		webSocket.current.close();
		connections.current.forEach((connection) => {
			connection.peerConnection.close();
		});
		setIsEntered(false);
	};

	const chatContext: ContextType = {
		onSend,
		onEnterChat,
		onLeaveChat,
		socketMessages,
		messageData,
		state: { isEntered },
		error,
	};
	return <ChatContext.Provider value={chatContext}>{children}</ChatContext.Provider>;
};

export const useChat = () => useContext(ChatContext);
