import React, { useEffect, useState } from 'react';
import { useChat } from '../context/Chat';

import './styles.css';

const Chat = () => {
	const { onSend, onEnterChat, onLeaveChat, state, messageData, error } = useChat();
	const [inputValue, setInputValue] = useState('');
	const [chatOpen, setChatOpen] = useState(false);
	const { isEntered } = state;

	useEffect(() => {
		return () => {
			onLeaveChat();
		};
	}, []);

	const onStartChat = () => {
		onEnterChat();
		console.log('onSTART CHAT');
		//TODO: zkontrolovat jestli pripojeni probehlo uspesne
		setChatOpen(true);
	};

	const onEndChat = () => {
		onLeaveChat();
		//TODO: zkontrolovat jestli pripojeni probehlo uspesne
		setChatOpen(false);
	};

	const onMessageSend = () => {
		onSend(inputValue);

		setInputValue('');
	};

	return (
		<div>
			<h2>Chat</h2>
			{error && <div className="errorText">Something went wrong</div>}
			<div>
				{messageData.map(({ message, username }) => (
					<div>
						{username}: {message}
					</div>
				))}
			</div>
			{isEntered && (
				<>
					<input value={inputValue} onChange={({ target: { value } }) => setInputValue(value)} />
					<button onClick={onMessageSend}>send</button>
				</>
			)}
			<button onClick={!isEntered ? onStartChat : onEndChat}>{!isEntered ? 'join' : 'leave chat'}</button>
		</div>
	);
};

export default Chat;
