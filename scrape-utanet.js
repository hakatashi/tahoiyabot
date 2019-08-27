const download = require('download');
const qs = require('querystring');
const fs = require('fs-extra');
const path = require('path');
const {promisify} = require('util');
const scrapeIt = require('scrape-it');

const loadPage = async (page) => {
	const cachePath = path.join(__dirname, 'download', 'utanet', 'search', `${page}.json`);

	if (await fs.pathExists(cachePath)) {
		console.log(`Search cache for page = ${page} exists`);
		return fs.readJson(cachePath);
	}

	console.log(`Downloading search result page = ${page}`);

	const {data: {songs}} = await scrapeIt(`https://www.uta-net.com/search/?${qs.encode({
		Aselect: 2,
		Bselect: 4,
		Keyword: '%',
		sort: 1,
		pnum: page,
	})}`, {
		songs: {
			listItem: '.result_table tbody > tr',
			data: {
				title: '.td1 > a:first-child',
				link: {
					selector: '.td1 > a:first-child',
					attr: 'href',
				},
				artist: '.td2 > a',
				artistLink: {
					selector: '.td2 > a',
					attr: 'href',
				},
				lyricist: '.td3 > a',
				lyricistLink: {
					selector: '.td3 > a',
					attr: 'href',
				},
				composer: '.td4 > a',
				composerLink: {
					selector: '.td4 > a',
					attr: 'href',
				},
				firstLyric: '.td5',
			},
		},
	});

	await fs.outputJson(cachePath, songs);

	console.log(`Downloaded ${songs.length} songs`);

	return songs;
}

(async () => {
	let page = 1;
	let failures = 0;

	while (failures < 5){
		const songs = await loadPage(page);

		if (songs.length === 0) {
			failures++;
			continue;
		}

		for (const [index, song] of songs.entries()) {
			const url = new URL(song.link, 'https://www.uta-net.com/search/').href;
			const [id] = song.link.match(/\d+/) || [`${page}-${index}`];

			const filename = path.join(__dirname, 'download', 'utanet', 'song', `${id}.html`);
			if (await fs.pathExists(filename)) {
				console.log(`${filename} already exists`);
				continue;
			}

			await new Promise((resolve) => setTimeout(resolve, 15000));

			console.log('downloading...', {link: song.link, title: song.title});

			const buffer = await download(url);
			await fs.outputFile(filename, buffer);
		}
	}

	console.log('finished.');
	await new Promise((resolve) => setTimeout(resolve, 1e8))
})();

