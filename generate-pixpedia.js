const {hiraganize} = require('japanese');
const fs = require('fs');
const zlib = require('zlib');
const tar = require('tar-stream');
const concat = require('concat-stream');

if (process.argv.length !== 3) {
	console.error('Usage: node generate-pixpedia.js <pixpedia.tar.gz>');
	process.exit(1);
}

const reader = fs.createReadStream(process.argv[2]);
const gunzipper = zlib.createGunzip();
const unpacker = tar.extract();
const writer = fs.createWriteStream('pixpedia-entries-raw.tsv');

reader.pipe(gunzipper).pipe(unpacker);

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
	}
	meaning = meaning.replace(/であり、.+$/, '');
	meaning = meaning.replace(/であるが、.+$/, '');
	meaning = meaning.replace(/のこと(?!わざ).+$/, '');
	meaning = meaning.replace(/を指す.+$/, '');
	meaning = meaning.replace(/^== (.+?) ==$/g, '$1');
	meaning = meaning.replace(/。[^」』].*$/, '');
	meaning = meaning.replace(/^\*/, '');
	meaning = meaning.replace(/^[\d０-９][\.．\s]/, '');
	meaning = meaning.trim().replace(/(のこと|をいう|である|を指す|とされる|、|。)+$/, '');
	return meaning.trim();
};

(async () => {
	let counter = 0;

	unpacker.on('entry', ({name, type}, stream, done) => {
		if (type !== 'file' || !name.endsWith('.json')) {
			done();
			return;
		}
		stream.pipe(concat((data) => {
			const {articles} = JSON.parse(data);
			for (const article of articles) {
				const firstLine = article.summary.split(/\r?\n/)[0];

				const meaning = normalizeMeaning(firstLine);

				if (meaning.length < 5) {
					continue;
				}

				writer.write([
					article.tag_name,
					meaning,
				].join('\t') + '\n');

				counter++;
				if (counter % 1000 === 0) {
					console.log(`Extracted ${counter} entries`);
				}
			}
			done();
		}));
	});
})();
