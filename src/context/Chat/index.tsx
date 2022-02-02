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

const WEBSOCKET_SERVER_IP = 'ws://3.70.221.123:8080/';

export const ChatContext = createContext<ContextType>(contextDefaults);

const id = uuid();

export const ChatProvider = ({ children }) => {
	const [isEntered, setIsEntered] = useState(false);
	const [socketMessages, setSocketMessages] = useState([]);
	const [messageData, setMessageData] = useState<MessageData[]>([]);
	const [error, setError] = useState(null);

	const webSocket = useRef(null);
	const configuration = {
		iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
	};
	const connections = useRef([]);

	const onMessage = ({ data }) => {
		const message: {
			sender: string;
			recepient: string;
			data: {
				id: string;
				offer?: { sdp: string; type: string };
				answer?: { sdp: string; type: string };
				icecandidate: {};
			};
			timestamp: string;
		} = JSON.parse(data);

		setSocketMessages((prev) => [...prev, data]);

		if ('newuser' in message.data) {
			try {
				const connection = new PeerConnection(
					configuration,
					webSocket.current,
					message.recepient,
					message.sender
				);
				connection.join();
				connection.on('message', (event: { data: string }) =>
					setMessageData((prev) => [...prev, JSON.parse(event.data)])
				);

				connections.current.push(connection);
			} catch (e) {
				setError(e);
				console.warn(e);
			}
		}
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
			connection.on('message', (event) => setMessageData((prev) => [...prev, event.data]));
			connections.current.push(connection);

			const data = { newuser: 'newuser' };
			webSocket.current.send(JSON.stringify({ sender: id, recepient: '', data, timestamp: Date.now() }));

			setIsEntered(true);
		} catch (e) {
			setError(e);
			console.warn(e);
		}
	};

	const onLeaveChat = () => {
		// 	webSocket.current.close();
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
