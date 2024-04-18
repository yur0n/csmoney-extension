window.addEventListener("message", (e) => {
	if (e.data.parse === true) {
		chrome.runtime.sendMessage(e.data);
	}
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	if (message.parsedSkins) {
		window.postMessage({ parsedSkins: message.parsedSkins }, "*");
	}
});