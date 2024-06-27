
chrome.runtime.onMessage.addListener(async (message) => {
	if (message.parse) {
		const parsedSkins = await compareSkins(message.data);
		chrome.runtime.sendMessage({ parsedSkins });
	}
	if (message.parseFloat) {
		const parsedSkinsFloat = await compareSkinsFloat(message.data);
		chrome.runtime.sendMessage({ parsedSkinsFloat });
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
