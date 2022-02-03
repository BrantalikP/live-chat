import { createServer } from 'http';
import * as WebSocket from 'ws';

const httpServer = createServer();
const ws = new WebSocket.Server({ server: httpServer });
const sendToAll = (message: WebSocket.RawData) => {
	ws.clients.forEach((client) => {
		if (client.readyState === WebSocket.OPEN) {
			client.send(message.toString('utf-8'));
		}
	});
};

ws.on('connection', function (socket) {
	socket.on('message', function (message) {
		console.log(`received: ${message}`);
		sendToAll(message);
	});

	socket.on('error', () => ws.close());
});

httpServer.listen(8001);
