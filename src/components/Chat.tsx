import React, { useEffect, useState } from 'react';
import { useChat } from '../context/Chat';

const Chat = () => {
  const { socketMessages, onSend, onEnterChat, onLeaveChat } = useChat();
  const [inputValue, setInputValue] = useState('');
  const [chatOpen, setChatOpen] = useState(false);

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

  console.log({ socketMessages });

  return (
    <div>
      <h2>Chat</h2>
      {chatOpen && (
        <>
          <input onChange={({ target: { value } }) => setInputValue(value)} />
          <button onClick={() => onSend(inputValue)}>send</button>
        </>
      )}
      <button onClick={onStartChat}>join</button>
    </div>
  );
};

export default Chat;
