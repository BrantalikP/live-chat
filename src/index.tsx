import React from 'react';
import ReactDOM from 'react-dom';
import { ChatProvider } from './context/Chat';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

ReactDOM.render(
	<ChatProvider signalingServer="ws://3.71.110.139:8001/" iceServers={[{ urls: 'stun:stun.l.google.com:19302' }]}>
		<App />
	</ChatProvider>,
	document.getElementById('root')
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
