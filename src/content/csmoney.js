
chrome.runtime.onMessage.addListener(async (message) => {
	if (message.parse) {
		const parsedSkins = await compareSkins(message.data);
		chrome.runtime.sendMessage({ parsedSkins });
	}
	if (message.parseFloat) {
		const parsedSkinsFloat = await compareSkinsFloat(message.data);
		chrome.runtime.sendMessage({ parsedSkinsFloat });
	}
	if (message.parseSticker) {
		const parsedSkinsSticker = await compareSkinsSticker(message.data);
		chrome.runtime.sendMessage({ parsedSkinsSticker });
	}
});

async function compareSkins({ maxPrice, minPrice, maxProfit, minProfit }) {
	const parsedSkins = [];
	const skins = await getSkins({ maxPrice, minPrice });
	if (skins.error) return skins;
	const buffSkins = (await chrome.storage.local.get('buffSkins')).buffSkins;
	if (!buffSkins) return { error: 'Skins from Buff163 are not updated yet, try a bit later', status: 404 };
	for (const skin of skins) {
		const buffPrice = buffSkins[skin.name];
		if (!buffPrice) continue;
		if (buffPrice >= (skin.price * minProfit) && buffPrice <= (skin.price * maxProfit)) {
			const diff = (buffPrice / skin.price - 1) * 100
			console.log(`Skin: ${skin.name} | Buff price: ${buffPrice} | CS.Money price: ${skin.price} | Profit: ${diff.toFixed(2)}%`);

			const linkName = skin.name.replace('★',' ').replace('™','').replace('|','%7C').replace('(','&sort=price&order=asc&exterior=').replace(')',' ')
			const link = `https://cs.money/market/buy/?utm_source=mediabuy&utm_medium=cts&utm_campaign=market&utm_content=link&search=${linkName}`
			
			parsedSkins.push({
				name: skin.name,
				buffPrice,
				csPrice: skin.price,
				profit: diff.toFixed(2),
				id: skin.id,
				photo: skin.photo,
				link
			});
		}
	}
	return parsedSkins;
}

async function compareSkinsFloat(data) {
	let userSkins = data.items;
	const minProfit = data.minProfit;

	const itemsURL = chrome.runtime.getURL('user_item.txt');
	if (itemsURL) {
		const fileSkins = [];
		await fetch(itemsURL)
			.then(res => res.text())
			.then(text => {
				const lines = text.split('\n').trim();
				lines.forEach(line => {
					const [name, maxFloat, minFloat, maxPrice] = line.split(';').trim();
					fileSkins.push({ name, maxFloat, minFloat, maxPrice });
				});

			})
			.catch(e => console.log('file not added'));
		userSkins = [...userSkins, ...fileSkins];
	}
	if (!userSkins.length) return { error: 'No skins provided', status: 404 };
	const skins = await getSkins();
	if (skins.error) return skins;

	const parsedSkins = [];
	for (const userSkin of userSkins) {
		for (const skin of skins) {
			if (!skin.name.includes(userSkin.name)) continue;
			const { maxFloat, minFloat, maxPrice } = userSkin;
			if (!maxFloat, !minFloat, !maxPrice ) continue;
			if (skin.price * minProfit < maxPrice && minFloat < skin.float && skin.float < maxFloat) {
				const diff = ((maxPrice / skin.price) * 100).toFixed(2);
				console.log(`Skin: ${skin.name} | CS.Money price: ${skin.price} | Float: ${skin.float} | Profit: ${diff}%`);
	
				const linkName = skin.name.replace('★',' ').replace('™','').replace('|','%7C').replace('(','&sort=price&order=asc&exterior=').replace(')',' ')
				const link = `https://cs.money/market/buy/?utm_source=mediabuy&utm_medium=cts&utm_campaign=market&utm_content=link&search=${linkName}&sort=price&order=asc&maxFloat=${maxFloat}&minFloat=${minFloat}`
				
				parsedSkins.push({
					name: skin.name,
					csPrice: skin.price,
					float: skin.float,
					profit: diff,
					id: skin.id,
					photo: skin.photo,
					link
				});
			}
		}
	}
	
	return parsedSkins;
}

async function getSkins(maxPrice, minPrice) {
	try {
		const skins = [];
		let url;

		if (!maxPrice || !minPrice) {
			// url = 'https://cs.money/1.0/market/sell-orders?limit=60&maxFloat=0.36&name=AK-47%20Redline&order=desc&sort=insertDate'
			url = `https://cs.money/1.0/market/sell-orders?limit=60&maxFloat=0.99999999&order=desc&sort=insertDate`
		} else {
			url = `https://cs.money/1.0/market/sell-orders?limit=60&maxPrice=${maxPrice}&minPrice=${minPrice}&order=desc&sort=insertDate&offset=0`
		}

		const response = await fetch(url);
		if (response.ok) {
				const data = await response.json()
				data.items.forEach(item => {
					skins.push({
						name: item.asset.names.full,
						price: item.pricing.computed,
						id: item.asset.id,
						photo: item.asset.images.screenshot || item.asset.images.steam,
						float: item.asset.float
					});
				});
			return skins;
		} else {
			console.log('Failed to fetch: ' + response.status)
			return { error: 'Failed to fetch', status: response.status }
		}
	} catch (error) {
		console.log(error)
		return { error: error.message, status: 500 }
	}
}

async function compareSkinsSticker(data) {
	let userSkins = data.items;
	const minProfit = data.minProfit;
	const overpay = data.overpay;

	const itemsURL = chrome.runtime.getURL('user_sticker_items.txt');
	if (itemsURL) {
		const fileSkins = [];
		await fetch(itemsURL)
			.then(res => res.text())
			.then(text => {
				const lines = text.split('\n').trim();
				lines.forEach(line => {
					const [name, defPrice, maxPrice] = line.split(';').trim();
					fileSkins.push({ name, defPrice, maxPrice });
				});

			})
			.catch(e => console.log('file not added'));
		userSkins = [...userSkins, ...fileSkins];
	}
	if (!userSkins.length) return { error: 'No skins provided', status: 404 };

	const parsedSkins = [];
	const skins = await getSkinsSticker(overpay);
	if (skins.error) return skins;

	for (const userSkin of userSkins) {
		for (const skin of skins) {
			if (!skin.name.includes(userSkin.name)) continue;
			const { defPrice, maxPrice } = userSkin;
			if (!defPrice, !maxPrice ) continue;
			if (skin.price < maxPrice && ((defPrice + skin.totalStickersOverpayPrice - skin.price) / skin.price) > minProfit) {

				const profit = (((defPrice + skin.totalStickersOverpayPrice - skin.price) / skin.price) * 100).toFixed(2);
				console.log(`Skin: ${skin.name} | CS.Money price: ${skin.price} | Def price: ${defPrice} | Profit: ${profit}%`);
	
				const linkName = skin.name.replace('★',' ').replace('™','').replace('|','%7C').replace('(','&sort=price&order=asc&exterior=').replace(')',' ')
				const link = `https://cs.money/market/buy/?utm_source=mediabuy&utm_medium=cts&utm_campaign=market&utm_content=link&search=${linkName}&sort=price&order=asc&maxFloat=${maxFloat}&minFloat=${minFloat}`
				
				parsedSkins.push({
					name: skin.name,
					price: skin.price,
					dePrice: defPrice,
					totalStickersPrice: skin.totalStickersPrice,
					profit,
					stickers: skin.stickers,
					id: skin.id,
					photo: skin.photo,
					link
				});
			}
		}
	}
	return parsedSkins;
}

async function getSkinsSticker(overpay) {
	overpay = 
		{
			defaultOverpay: 0,
			katowice_overpay: 0.03,
			howlingdown_overpay: 0.03,
			katowiceholo_overpay: 0.01,
			crown_overpay: 0.05,
			HarpofWar_overpay: 0.03,
			kingoffield_overpay: 0.02
		}
	try {
		const skins = [];
		
		const url = `https://cs.money/1.0/market/sell-orders?hasStickers=true&limit=60&minPrice=10&order=desc&sort=insertDate`
		const response = await fetch(url);
		if (response.ok) {
				const data = await response.json()
				data.items.forEach(item => {
					const stickers = [];
					let totalStickersPrice = 0;
					let totalStickersOverpayPrice = 0;
					item.stickers.forEach(sticker => {
						if (sticker === null) return;
						const price = Math.round((sticker.wear ? 0 : sticker.pricing.default) * 100) / 100  // scratched = 0
						totalStickersPrice += price;
						let overpayPrice;
						for (const stickerName of Object.keys(overpay)) {
							if (sticker.name.includes(stickerName)) {
								overpayPrice = price * overpay[stickerName];
							} else {
								overpayPrice = price * overpay.defaultOverpay;
							}
							totalStickersOverpayPrice += overpayPrice;
							break;
						}
						
						stickers.push({
							name: sticker.name,
							price,
							wear: sticker.wear,
							overpayPrice
						})
					})
					skins.push({
						name: item.asset.names.full,
						price: item.pricing.computed,
						id: item.asset.id,
						photo: item.asset.images.screenshot || item.asset.images.steam,
						stickers,
						totalStickersPrice,
						totalStickersOverpayPrice,
					});
				});
			return skins;
		} else {
			console.log('Failed to fetch: ' + response.status)
			return { error: 'Failed to fetch', status: response.status }
		}
	} catch (error) {
		console.log(error)
		return { error: error.message, status: 500 }
	}
}