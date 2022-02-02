import React, { useEffect, useState } from 'react';
import { useChat } from '../context/Chat';

const Chat = () => {
  const { socketMessages, onSend, onEnterChat, onLeaveChat, state } = useChat();
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
    //TODO: zkontrolovat jestli pripojeni probehlo uspesne
    setChatOpen(true);
  };

  const onEndChat = () => {
    onLeaveChat();
    //TODO: zkontrolovat jestli pripojeni probehlo uspesne
    setChatOpen(false);
  };

  console.log({ socketMessages });

  const onMessageSend = () => {
    onSend(inputValue);
    setInputValue('');
  };

  return (
    <div>
      <h2>Chat</h2>
      {chatOpen && (
        <>
          <input
            value={inputValue}
            onChange={({ target: { value } }) => setInputValue(value)}
          />
          <button onClick={onMessageSend}>send</button>
        </>
      )}
      <button onClick={!isEntered ? onStartChat : onEndChat}>
        {!isEntered ? 'join' : 'leave chat'}
      </button>
    </div>
  );
};

export default Chat;
