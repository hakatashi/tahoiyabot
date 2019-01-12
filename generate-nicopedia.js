const parse = require('csv-parse');
const striptags = require('striptags');
const {hiraganize} = require('japanese');
const fs = require('fs');
const he = require('he');

const writer = fs.createWriteStream('nicopedia-entries.tsv');

let counter = 0;

const normalizeMeaning = (input) => {
	let meaning = input;
	meaning = meaning.replace(/\s*\[.+?\]\s*/g, '');
	meaning = meaning.replace(/\s*\(.+?\)\s*/g, '');
	meaning = meaning.replace(/（[^（）]+?）/g, '');
	meaning = meaning.replace(/（.+?）/g, '');
	meaning = meaning.replace(/【.+?】/g, '');
	if (meaning.includes('とは、')) {
		meaning = meaning.replace(/^.*?とは、/, '');
	} else if (meaning.includes('とは，')) {
		meaning = meaning.replace(/^.*?とは，/, '');
	} else if (meaning.includes('は、')) {
		meaning = meaning.replace(/^.*?は、/, '');
	} else if (meaning.includes('とは')) {
		meaning = meaning.replace(/^.*?とは/, '');
	} else if (meaning.includes('は')) {
		meaning = meaning.replace(/^.+?は/, '');
	}
	meaning = meaning.replace(/であり、.+$/, '');
	meaning = meaning.replace(/であるが、.+$/, '');
	meaning = meaning.replace(/で、.+$/, '');
	meaning = meaning.replace(/のこと(?!わざ).+$/, '');
	meaning = meaning.replace(/^== (.+?) ==$/g, '$1');
	meaning = meaning.replace(/。[^」』].*$/, '');
	meaning = meaning.replace(/^\*/, '');
	meaning = meaning.replace(/^[\d０-９][\.．\s]/, '');
	meaning = meaning.trim().replace(/(のこと|をいう|である|を指す|とされる|、|。)+$/, '');
	return meaning.trim();
};

(async () => {
	const files = [
		'head2008.csv',
		'head2009.csv',
		'head2010.csv',
		'head2011.csv',
		'head2012.csv',
		'head2013.csv',
		'head2014.csv',
	];

	const heads = new Map();

	for (const file of files) {
		const reader = fs.createReadStream(file);
		const parser = parse({
			escape: '\\',
			max_limit_on_data_read: 1e6,
		});
		let cnt = 0;

		reader.pipe(parser);

		parser.on('data', ([id, title, ruby, type]) => {
			heads.set(id, {id, title, ruby, type});
		});

		await new Promise((resolve) => {
			parser.on('end', () => {
				resolve();
			});
		});
	}

	{
		const reader = fs.createReadStream('latest.csv');
		const parser = parse({
			max_limit_on_data_read: 1e6,
		});
		let cnt = 0;

		reader.pipe(parser);

		parser.on('data', ([id, body]) => {
			if (!heads.has(id)) {
				return;
			}

			const {title, ruby, type} = heads.get(id);

			if (type !== 'a') {
				return;
			}

			if (title.endsWith('P')) {
				return;
			}

			const lines = he.decode(striptags(body.replace(/<li>/g, '* '))).trim().split('\n');
			const leadingLines = lines.slice(0, 8);
			const normalizedBodyIndex = leadingLines.findIndex((line) => line.match(/(とは|は、|である|指す)/) && !line.match(/(関しては、|この項目は、|この記事は、)/));

			if (normalizedBodyIndex === -1) {
				return;
			}

			let normalizedBody = leadingLines[normalizedBodyIndex];

			if (normalizedBody.match(/(以下の|以下を|次のこと|次の事|次の意味|下記|とは.{,3}$)/)) {
				normalizedBody = 'とは、' + (lines.slice(normalizedBodyIndex + 1).find((line) => line.trim().startsWith('* ')) || '')
					.trim()
					.slice(2)
					.replace(/^.+?( -|- )/, '')
					.replace(/^.+?･･･/, '')
					.replace(/^.+?…/, '');
			}

			const meaning = normalizeMeaning(normalizedBody);

			if (meaning.length < 5) {
				return;
			}

			if (meaning.match(/(歌い手|ニコ生|生主|生放送|MMD|大学生|MAD|Miku|アンチ|厨|投稿|タグ|プロデューサ|歌ってみた|してみた|プレイヤー|以下|配信者|実況|絵師|作曲|ニコニコ|下記|m@s|レイヤー|作者|東方|幻想郷|アイドルマスター|空耳|動画)/)) {
				return;
			}

			if (meaning.endsWith('P')) {
				return;
			}

			writer.write([
				title.replace(/\t/g, ''),
				hiraganize(ruby).replace(/\t/g, ''),
				meaning.replace(/\t/g, ''),
			].join('\t') + '\n');

			counter++;
			if (counter % 1000 === 0) {
				console.log(`Extracted ${counter} entries`);
			}
		});
	}
})();
