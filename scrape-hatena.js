const download = require('download');
const qs = require('querystring');
const fs = require('fs');
const path = require('path');
const {promisify} = require('util');
const {uniq} = require('lodash');
const iconv = require('iconv-lite');

(async () => {
	const exists = await new Promise((resolve) => {
		promisify(fs.access)('keywordlist_furigana_with_kid.csv', fs.constants.F_OK, (error) => {
			resolve(!error);
		});
	});
	if (!exists) {
		await download('http://d.hatena.ne.jp/images/keyword/keywordlist_furigana_with_kid.csv', __dirname);
	}

	const keywordlist = await promisify(fs.readFile)('keywordlist_furigana_with_kid.csv');
	const keywords = uniq(iconv.decode(keywordlist, 'euc-jp').split('\n').map((line) => line.split('\t')[1]));

	for (const keyword of keywords) {
		const filename = `${keyword.replace(/[/\\?%*:|"<>]/g, '_')}.xml`;
		const exists = await new Promise((resolve) => {
			promisify(fs.access)(path.join('download', 'hatena', filename), fs.constants.F_OK, (error) => {
				resolve(!error);
			});
		});
		if (exists) {
			console.log(`${filename} already exists`);
			continue;
		}
		await new Promise((resolve) => setTimeout(resolve, 5000));
		console.log('downloading...', {keyword});
		const buffer = await download(`http://d.hatena.ne.jp/keyword?${qs.encode({
			word: keyword,
			mode: 'rss',
			ie: 'utf8',
		})}`, 'download/hatena', {filename})
	}

	console.log('finished.');
	await new Promise((resolve) => setTimeout(resolve, 1e8))
})();

