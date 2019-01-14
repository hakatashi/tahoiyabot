const parse = require('csv-parse');
const {hiraganize} = require('japanese');
const fs = require('fs');

const writer = fs.createWriteStream('wordnet-entries.tsv');

let counter = 0;

(async () => {
	const meanings = new Map();

	{
		const reader = fs.createReadStream('wnjpn-def.tab');
		const parser = parse({
			escape: '\\',
			delimiter: '\t',
			max_limit_on_data_read: 1e6,
		});
		let cnt = 0;

		reader.pipe(parser);

		parser.on('data', ([id, index, , definition]) => {
			if (index === '0') {
				meanings.set(id, definition);
			}
		});

		await new Promise((resolve) => {
			parser.on('end', () => {
				resolve();
			});
		});
	}

	{
		const reader = fs.createReadStream('wnjpn-all-ruby.tsv');
		const parser = parse({
			escape: '\\',
			delimiter: '\t',
			max_limit_on_data_read: 1e6,
		});
		let cnt = 0;

		reader.pipe(parser);

		parser.on('data', ([id, word, , ruby]) => {
			if (meanings.has(id)) {
				const meaning = meanings.get(id).replace(/（.+?）/g, '');
				const normalizedRuby = hiraganize(ruby);
				if (!normalizedRuby.match(/^[\p{Script=Hiragana}ー]+$/u)) {
					return;
				}

				meanings.delete(id);

				if (meaning.match(/[\p{Script=Hiragana}ー]$/u) && !meaning.endsWith('こと')) {
					return;
				}

				if (meaning.includes(':：')) {
					return;
				}

				writer.write([word, normalizedRuby, meaning].join('\t') + '\n');
				counter++;
				if (counter % 1000 === 0) {
					console.log(`Extracted ${counter} entries`);
				}
			}
		});

		await new Promise((resolve) => {
			parser.on('end', () => {
				resolve();
			});
		});
	}
})();
