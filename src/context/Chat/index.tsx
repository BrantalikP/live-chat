import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import PeerConnection from '../../PeerConnection';
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

interface InputType {
	value: string;
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

const WEBSOCKET_SERVER_IP = 'ws://3.71.110.139:8080/';
// const WEBSOCKET_SERVER_IP = 'ws://172.16.13.14:8080/';

export const ChatContext = createContext<ContextType>(contextDefaults);

const id = uuid();

export const ChatProvider = ({ children }) => {
	const [isEntered, setIsEntered] = useState(false);
	const [socketMessages, setSocketMessages] = useState([]);
	const [connection, setConnection] = useState(null);

	const [messageData, setMessageData] = useState<MessageData[]>([]);
	const [error, setError] = useState(null);

	const webSocket = useRef(null);
	const configuration = {
		iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
	};
	const connections = useRef<PeerConnection[]>([]);

	const onMessage = async (message) => {
		const socketData = JSON.parse(message.data);

		if (socketData.data.type === 'offer') {
			//TODO: add logic for another use

			connection.setRemoteDescription(new RTCSessionDescription(socketData.data));
			const answer = await connection.createAnswer();
			await connection.setLocalDescription(answer);
			// this.send({ answer });
		}

		setSocketMessages((prev) => [...prev, socketData]);
	};

	useEffect(() => {
		webSocket.current = new WebSocket(WEBSOCKET_SERVER_IP);

		webSocket.current.onmessage = onMessage;

		webSocket.current.onclose = () => {
			webSocket.current.close();
		};

		return () => {
			webSocket.current.close();
		};
	}, []);

	//TODO:
	const onSend = (inputValue: string) => {
		try {
			setMessageData((prev) => [
				...prev,
				{ message: inputValue, username: 'ja', senderId: id, timestamp: Date.now() },
			]);
			connections.current.forEach((connection) => connection.sendMessage(inputValue));
		} catch (e) {
			setError(e);
			console.warn(e);
		}
	};

	const onEnterChat = async () => {
		setError(null);
		const connection = new PeerConnection(configuration, webSocket.current, id, '');

		try {
			await connection.join();
			connections.current.push(connection);
			connection.on('message', (event) => setMessageData((prev) => [...prev, JSON.parse(event.data)]));

			const data = { newuser: 'newuser', type: 'candidate' };
			webSocket.current.send(JSON.stringify({ sender: id, recepient: '', data, timestamp: Date.now() }));

			setConnection(connection);
			setIsEntered(true);
		} catch (e) {
			setError(e);
			console.warn(e);
		}
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
