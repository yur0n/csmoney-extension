import { io } from "socket.io-client";

const socket = io();

window.addEventListener("message", async (e) => {
	if (e.data.parse === true) {
		if (socket.connected) {
			socket.emit('parsing', e.data);
		} else {
			window.postMessage({ parsedSkins: { error: 'Only one instance allowed, close all other pages and refresh this page', status: 409 } }, "*");
		}
	}
});

socket.on('parsing_allowed', (data) => {
	chrome.runtime.sendMessage(data);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	if (message.parsedSkins) {
		window.postMessage({ parsedSkins: message.parsedSkins }, "*");
	}
});