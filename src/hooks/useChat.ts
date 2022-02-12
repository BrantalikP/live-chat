import { useContext } from 'react';
import { ChatContext } from '../context/Chat';

export const useChat = () => useContext(ChatContext);
