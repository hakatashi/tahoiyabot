const fs = require('fs');
const Xml = require('xml-stream');
const bunzip2 = require('unbzip2-stream');
const {get} = require('lodash');
const wtf = require('wtf_wikipedia');
const striptags = require('striptags');

const reader = fs.createReadStream('jawiki-20181220-pages-meta-current.xml.bz2');
const inflater = bunzip2();
reader.pipe(inflater);
const xml = new Xml(inflater, 'utf8');

let cnt = 0;

const namespaces = [];

xml.on('endElement: namespace', (namespace) => {
	namespaces.push(namespace.$text);
});

xml.on('endElement: page', (page) => {
	if (namespaces.some((namespace) => page.title.startsWith(`${namespace}:`))) {
		return;
	}
	if (page.title.includes(':')) {
		console.log(page.title);
	}
	if (cnt % 1000 === 0 && false) {
		const text = get(page, ['revision', 'text', '$text'], '');
		const doc = wtf(text);
		console.log([page.title, striptags(doc.text()).slice(0, 100)]);
	}
	cnt++;
});

xml.on('end', () => {
	const writer = fs.createWriteStream('wikipedia.txt');

	for (const entry of entries) {
		writer.write(`${entry.join('\t')}\n`);
	}

	writer.end();
});