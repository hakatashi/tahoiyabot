const download = require('download');
const qs = require('querystring');
const fs = require('fs');
const path = require('path');
const {promisify} = require('util');
const jsonStream = require('jsonstream');

const genres = ['アニメ', 'マンガ', 'ラノベ', 'ゲーム', 'フィギュア', '音楽', 'アート', 'デザイン', '一般', '人物', 'キャラクター', 'セリフ', 'イベント', '同人サークル'];

(async () => {
	for (const genre of genres) {
		let page = 0;
		let articleSize = Infinity;

		while (articleSize > 0) {
			page++;
			const filename = `${genre}-${page.toString().padStart(5, '0')}.json`;
			const exists = await new Promise((resolve) => {
				promisify(fs.access)(path.join('download', filename), fs.constants.F_OK, (error) => {
					resolve(!error);
				});
			});
			if (exists) {
				console.log(`${filename} already exists`);
				continue;
			}
			await new Promise((resolve) => setTimeout(resolve, 5000));
			console.log('downloading...', {genre, page});
			const buffer = await download(`https://dic.pixiv.net/category/${encodeURIComponent(genre)}?${qs.encode({
				json: true,
				page,
			})}`, 'download', {filename})
			const {articles = []} = JSON.parse(buffer.toString());
			articleSize = articles.length;
		}
	}

	console.log('finished.');
	await new Promise((resolve) => setTimeout(resolve, 1e8))
})();

