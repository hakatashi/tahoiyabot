const fs = require('fs');
const Xml = require('xml-stream');
const bunzip2 = require('unbzip2-stream');
const {get} = require('lodash');
const wtf = require('wtf_wikipedia');
const striptags = require('striptags');
const {hiraganize} = require('japanese');

if (process.argv.length !== 3) {
	console.error('Usage: node generate-dataset.js <jawiki-xxxxxx-pages-meta-current.xml.bz2>');
	process.exit(1);
}

const reader = fs.createReadStream(process.argv[2]);
const inflater = bunzip2();
reader.pipe(inflater);
const xml = new Xml(inflater, 'utf8');
xml.preserve('text', true); // https://github.com/assistunion/xml-stream/issues/34#issuecomment-162135953
const writer = fs.createWriteStream('entries.tsv');

let counter = 0;

const namespaces = [];

const normalizeMeaning = (input) => {
	let meaning = input;
	meaning = meaning.replace(/\s*\[.+?\]\s*/g, '');
	meaning = meaning.replace(/\s*\(.+?\)\s*/g, '');
	meaning = meaning.replace(/（[^（）]+?）/g, '');
	meaning = meaning.replace(/（.+?）/g, '');
	meaning = meaning.replace(/【.+?】/g, '');
	if (meaning.includes('とは、')) {
		meaning = meaning.replace(/^.+?とは、/, '');
	} else if (meaning.includes('は、')) {
		meaning = meaning.replace(/^.+?は、/, '');
	} else if (meaning.includes('とは')) {
		meaning = meaning.replace(/^.+?とは/, '');
	} else if (meaning.includes('は')) {
		meaning = meaning.replace(/^.+?は/, '');
	} else {
		meaning = meaning.replace(/^.+?、/, '');
	}
	meaning = meaning.replace(/であり、.+$/, '');
	meaning = meaning.replace(/であるが、.+$/, '');
	meaning = meaning.replace(/で、.+$/, '');
	meaning = meaning.replace(/^== (.+?) ==$/g, '$1');
	meaning = meaning.replace(/。.*$/, '');
	meaning = meaning.replace(/^.+? -/, '');
	meaning = meaning.replace(/^\*/, '');
	meaning = meaning.trim().replace(/(のこと|をいう|である|を指す|とされる)+$/, '');
	return meaning.trim();
};

xml.on('endElement: namespace', (namespace) => {
	namespaces.push(namespace.$text);
});

xml.on('endElement: page', (page) => {
	if (namespaces.some((namespace) => page.title.startsWith(`${namespace}:`))) {
		return;
	}

	const title = page.title.replace(/\(.+?\)$/, '').trim();
	const text = get(page, ['revision', 'text', '$text'], '').replace(/画像:/g, 'Image:').replace(/{{by\|(.+?)}}/g, '$1').replace(/^ +/gm, '');
	const plainText = wtf(text).text().trim();

	let ruby = '';
	if (title.match(/^[\p{Script_Extensions=Hiragana}\p{Script_Extensions=Katakana}・=＝]+$/u)) {
		ruby = hiraganize(title.replace(/[・=＝]/g, ''));
	} else {
		const matches = plainText.split(/[。\n]/)[0].match(/[(（](.+?)[)）]/);
		if (matches) {
			const tempRuby = hiraganize(matches[1].split(/[、､，,]/)[0].replace(/\s/g, ''));
			if (tempRuby.match(/^[\p{Script_Extensions=Hiragana}・]+$/u)) {
				ruby = tempRuby.replace(/・/ug, '');
			}
		}
	}

	if (ruby === '') {
		return;
	}

	const meaning = normalizeMeaning(plainText.split(/[。．\n]/)[0]);

	if (meaning === '' || meaning.match(/[()（）【】[\]]/) || meaning.startsWith('#') || meaning === title) {
		return;
	}

	writer.write([page.title, ruby, meaning].join('\t') + '\n');

	counter++;
	if (counter % 1000 === 0) {
		console.log(`Extracted ${counter} entries`);
	}
});

xml.on('end', () => {
	writer.end();
});