const {hiraganize} = require('japanese');
const fs = require('fs');
const zlib = require('zlib');
const tar = require('tar-stream');
const concat = require('concat-stream');
const xml2js = require('xml2js');
const {get} = require('lodash');
const {AllHtmlEntities} = require('html-entities');

if (process.argv.length !== 3) {
	console.error('Usage: node generate-hatena.js [hatena.tar.gz]');
	process.exit(1);
}

const entities = new AllHtmlEntities();
const reader = fs.createReadStream(process.argv[2]);
const gunzipper = zlib.createGunzip();
const unpacker = tar.extract();
const writer = fs.createWriteStream('hatena-entries.tsv');

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
	meaning = meaning.trim().replace(/(のこと|の事|をいう|である|です|を指す|とされ(る|ます)|とされてい(る|ます)|、|。)+$/, '');
	meaning = meaning.replace(/(の一つ|のひとつ|の１つ)$/, 'の1つ');
	meaning = meaning.replace(/(の1人|のひとり|の１人)$/, 'の一人');
	meaning = meaning.replace(/(の1種|の１種)$/, 'の一種');
	return meaning.trim();
};

const set = new Set();

(async () => {
	let counter = 0;

	unpacker.on('entry', ({name, type}, stream, done) => {
		if (type !== 'file' || !name.endsWith('.xml')) {
			done();
			return;
		}
		stream.pipe(concat(async (data) => {
			if (data.length === 0) {
				done();
				return;
			}

			const d = await new Promise((resolve) => {
				xml2js.parseString(data, {explicitArray: false}, (error, result) => {
					if (error) {
						resolve(null);
					} else {
						resolve(result);
					}
				});
			});

			if (d === null) {
				done();
				return;
			}

			const title = get(d, ['rdf:RDF', 'item', 'title'], null);
			const ruby = get(d, ['rdf:RDF', 'item', 'hatena:furigana'], null);
			const content = get(d, ['rdf:RDF', 'item', 'content:encoded'], null);

			if (title === null || content === null || ruby === null || set.has(title)) {
				done();
				return;
			}

			const firstLine = entities.decode(content.replace(/>\?</g, '').replace(/<.+?>/g, '')).split(/\n/).find((line) => line.trim().length > 0);

			if (!firstLine) {
				done();
				return;
			}

			const meaning = normalizeMeaning(firstLine);

			if (meaning.length < 5 || meaning.startsWith('→') || meaning.includes('::')) {
				done();
				return;
			}

			writer.write([
				entities.decode(title),
				hiraganize(ruby).replace(/う゛/g, 'ゔ'),
				meaning,
			].join('\t') + '\n');
			set.add(title);

			counter++;
			if (counter % 1000 === 0) {
				console.log(`Extracted ${counter} entries`);
			}

			done();
		}));
	});
})();
