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
	const [channel, setChannel] = useState(null);
	const [messageData, setMessageData] = useState<MessageData[]>([]);
	const [error, setError] = useState(null);

	const webSocket = useRef(null);
	const configuration = {
		iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
	};
	const connections = useRef<PeerConnection[]>([]);

	const onMessage = async (message) => {
		console.log({ message });
		const socketData = JSON.parse(message.data);

		setSocketMessages((prev) => [...prev, socketData]);

		console.log({ socketData });
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

	const handleDataChannelMessageReceived = ({ data }) => {
		const message = JSON.parse(data);

		console.log({ TADZ: message });
		// const { name: user } = message;
		// let messages = messagesRef.current;
		// let userMessages = messages[user];
		// if (userMessages) {
		//   userMessages = [...userMessages, message];
		//   let newMessages = Object.assign({}, messages, { [user]: userMessages });
		//   messagesRef.current = newMessages;
		//   setMessages(newMessages);
		// } else {
		//   let newMessages = Object.assign({}, messages, { [user]: [message] });
		//   messagesRef.current = newMessages;
		//   setMessages(newMessages);
		// }
	};

	const onEnterChat = async () => {
		setError(null);
		const connection = new PeerConnection(configuration, webSocket.current, id, '');
		let localConnection = new RTCPeerConnection(configuration);
		localConnection.ondatachannel = (event) => {
			console.log('Data channel is created!');
			let receiveChannel = event.channel;
			receiveChannel.onopen = () => {
				console.log('Data channel is open and ready to be used.');
			};
			receiveChannel.onmessage = handleDataChannelMessageReceived;

			console.log({ receiveChannel });
			setChannel(receiveChannel);
		};
		console.log({ localConnection });
		setConnection(localConnection);
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
