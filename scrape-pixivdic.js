const download = require('download');
const qs = require('querystring');
const fs = require('fs');
const jsonStream = require('jsonstream');

const genres = ['アニメ', 'マンガ', 'ラノベ', 'ゲーム', 'フィギュア', '音楽', 'アート', 'デザイン', '一般', '人物', 'キャラクター', 'セリフ', 'イベント', '同人サークル'];

(async () => {
	for (const genre of genres) {
		let page = 1;
		let articleSize = Infinity;

		while (articleSize > 0) {
			await new Promise((resolve) => setTimeout(resolve, 5000));
			console.log('downloading...', {genre, page});
			const buffer = await download(`https://dic.pixiv.net/category/${encodeURIComponent(genre)}?${qs.encode({
				json: true,
				page,
			})}`, 'download', {filename: `${genre}-${page.toString().padStart(5, '0')}.json`})
			const {articles = []} = JSON.parse(buffer.toString());
			articleSize = articles.length;
			page++;
		}
	}
})();

