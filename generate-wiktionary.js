const fs = require('fs');
const Xml = require('xml-stream');
const bunzip2 = require('unbzip2-stream');
const {get, last, chunk, flatten} = require('lodash');
const wtf = require('wtf_wikipedia');
const striptags = require('striptags');
const {hiraganize} = require('japanese');

if (process.argv.length !== 3) {
	console.error('Usage: node generate-dataset.js <jawiktionary-xxxxxxxx-pages-articles.xml.bz2>');
	process.exit(1);
}

const reader = fs.createReadStream(process.argv[2]);
const inflater = bunzip2();
reader.pipe(inflater);
const xml = new Xml(inflater, 'utf8');
xml.preserve('text', true); // https://github.com/assistunion/xml-stream/issues/34#issuecomment-162135953
const writer = fs.createWriteStream('wiktionary-entries.tsv');

let counter = 0;

const namespaces = [];

const normalizeMeaning = (input) => {
	let meaning = input;
	meaning = meaning.replace(/\s*\[.+?\]\s*/g, '');
	meaning = meaning.replace(/\s*\(.+?\)\s*/g, '');
	meaning = meaning.replace(/（[^（）]+?）/g, '');
	meaning = meaning.replace(/（.+?）/g, '');
	meaning = meaning.replace(/【.+?】/g, '');
	meaning = meaning.replace(/［.+?］/g, '');
	meaning = meaning.replace(/《.+?》/g, '');
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
	const text = get(page, ['revision', 'text', '$text'], '')
		.replace(/画像:/g, 'Image:')
		.replace(/{{by\|(.+?)}}/g, '$1')
		.replace(/{{ふりがな\|([^|}]+?)\|[^|}]+?\|[^|}]*?=[^|}]*?}}/g, '$1')
		.replace(/{{ふりがな\|([^|}]+?)\|[^|}]+?\|([^|}]+?)}}/g, '$1$2')
		.replace(/{{ふりがな\|([^|}]+?)\|[^|}]+?}}/g, '$1')
		.replace(/^ +/gm, '');
	if (title === 'メインページ') {
		return;
	}
	if (!text.match('Category:{{ja}}') && !text.match('Category:{{jpn}}') && !text.match('Category:日本語')) {
		return;
	}
	const wiki = wtf(text);
	const plainText = striptags(wiki.text().trim());
	const sections = wiki.sections();
	const jaSectionIndex = sections.findIndex((section) => ['日本語', 'jpn', 'ja'].includes(section.title()));
	const jaSectionEndIndex = (jaSectionIndex === -1 ? sections : sections.slice(jaSectionIndex + 1)).findIndex((section) => section.indentation() === 0);
	const jaSections = sections.slice(jaSectionIndex === -1 ? 0 : jaSectionIndex, jaSectionEndIndex === -1 ? Infinity : (jaSectionIndex + jaSectionEndIndex + 1));
	const jaText = striptags(jaSections.map((section) => section.text()).join('\n'));
	const nounSection = jaSections.find((section) => ['固有名詞', '名詞', 'noun'].includes(section.title()));

	let ruby = '';
	if (title.match(/^[\p{Script_Extensions=Hiragana}\p{Script_Extensions=Katakana}・=＝]+$/u)) {
		ruby = hiraganize(title);
	}

	if (ruby === '') {
		if (nounSection) {
			const matches = nounSection.text().match(/[\(（【](.+?)[\)）】]/g);
			const rubies = flatten((matches || []).map((match) => match.slice(1, -1).split(/[、､，,、\/／\(\)（） 　]/)))
			const rubyMatch = rubies.find((ruby) => ruby.replace(/([\[\]':]|熟字訓|呉音|漢音|唐音)/g, '').match(/^[\p{Script_Extensions=Hiragana}\p{Script_Extensions=Katakana}\s]+$/u))
			if (rubyMatch) {
				ruby = hiraganize(rubyMatch.replace(/([\[\]':]|熟字訓|呉音|漢音|唐音)/g, ''));
			}
		}
	}

	if (ruby === '') {
		const matches = jaText.match(/[\(（【](.+?)[\)）】]/g);
		const rubies = flatten((matches || []).map((match) => match.slice(1, -1).split(/[、､，,、\/／\(\)（）]/)))
		const rubyMatch = rubies.find((ruby) => ruby.replace(/([\[\]':]|熟字訓|呉音|漢音|唐音)/g, '').match(/^[\p{Script_Extensions=Hiragana}\p{Script_Extensions=Katakana}\s]+$/u))
		if (rubyMatch) {
			ruby = hiraganize(rubyMatch.replace(/([\[\]':]|熟字訓|呉音|漢音|唐音)/g, ''));
		}
	}

	if (ruby === '') {
		const rubySection = jaSections.find((section) => ['発音', '読み', 'pron', 'pron|ja', 'pron|jpn'].includes(section.title()));

		if (rubySection) {
			const matches = rubySection.text().match(/[\p{Script_Extensions=Hiragana}\p{Script_Extensions=Katakana}\p{Script_Extensions=Han}-]+/ug);
			const tokens = flatten((matches || []).map((token) => token.split(/[、､，,]/)));
			let matchedToken = null;
			if ((matchedToken = tokens.find((token) => token.match(/^[\p{Script_Extensions=Hiragana}-]+$/u)))) {
				ruby = matchedToken.replace(/-/g, '');
			} else if ((matchedToken = tokens.find((token) => token.match(/^[\p{Script_Extensions=Hiragana}\p{Script_Extensions=Katakana}-]+$/u)))) {
				ruby = hiraganize(matchedToken.replace(/-/g, ''));
			}
		}
	}

	if (ruby === '') {
		const matches = text.match(/{{DEFAULTSORT:(.+?)}}/);
		if (matches) {
			const defaultSort = matches[1];
			const rubies = defaultSort.match(/[\p{Script_Extensions=Hiragana}\p{Script_Extensions=Katakana}]+/gu);

			if (rubies) {
				ruby = hiraganize(last(rubies));
			}
		}
	}

	ruby = ruby.replace(/[\P{Script_Extensions=Hiragana}・、。･「」〉〈』『【〕〔】》《゠〃=＝\s]/g, '');

	if (ruby === '') {
		return;
	}

	let meaning = '';

	const lists = flatten(jaSections.map((section) => section.lists()));
	if (meaning === '') {
		const meaningList = lists.find(list => list.lines().some(line => line.text().startsWith('1)')));
		if (meaningList) {
			meaning = normalizeMeaning(meaningList.lines().find(line => line.text().startsWith('1)')).text().replace(/^1\)/, ''));
		}
	}

	if (meaning === '') {
		const meaningList = lists.find(l => l.lines()[0].text().includes('。'));
		if (meaningList) {
			meaning = normalizeMeaning(meaningList.lines()[0].text().replace(/^1\)/, ''));
		}
	}

	if (meaning === '') {
		const firstLine = jaText.split('\n').find((line) => line.match(/\S/));
		if (firstLine && firstLine.includes('。')) {
			meaning = normalizeMeaning(firstLine);
		}
	}

	if (meaning === '' || meaning.match(/[()（）【】[\]]/) || meaning.startsWith('#') || meaning.endsWith('参照') || meaning.endsWith('表記') || meaning === title) {
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
