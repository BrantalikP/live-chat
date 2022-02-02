import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
} from 'react';
import PeerConnection from '../../PeerConnection';

interface ContextType {
  onSend: (inputValue: string) => void;
  onEnterChat: () => void;
  onLeaveChat: () => void;
  state: { isEntered: boolean };
  socketMessages: any[]; //TODO: types
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
};

const WEBSOCKET_SERVER_IP = 'ws://3.126.116.7:8080/';

export const ChatContext = createContext<ContextType>(contextDefaults);

export const ChatProvider = ({ children }) => {
  const [isEntered, setIsEntered] = useState(false);
  const [socketMessages, setSocketMessages] = useState([]);

  const webSocket = useRef(null);
  const configuration = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
  };
  const connections: PeerConnection[] = [];

  const id = '123456'; //TODO:

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

    console.log({ data: message.data });

    if ('newuser' in message.data) {
      const connection = new PeerConnection(
        configuration,
        webSocket.current,
        message.recepient,
        message.sender,
      );
      connection.join();

      connections.push(connection);
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
    console.log({ inputValue });
    connections.forEach((connection) =>
      connection.dataChannel.send(inputValue),
    );
  };

  const onEnterChat = () => {
    const data = { newuser: 'newuser' }; //TODO:

    webSocket.current.send(
      JSON.stringify({
        sender: id,
        recepient: '',
        data,
        timestamp: Date.now(),
      }),
    );
    setIsEntered(true);
  };

  const onLeaveChat = () => {
    //TODO: add additional logic ?
    setIsEntered(false);
  };

  const chatContext: ContextType = {
    onSend,
    onEnterChat,
    onLeaveChat,
    socketMessages,
    state: { isEntered },
  };
  return (
    <ChatContext.Provider value={chatContext}>{children}</ChatContext.Provider>
  );
};

export const useChat = () => useContext(ChatContext);
