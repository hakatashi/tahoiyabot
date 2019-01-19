const {hiraganize} = require('japanese');
const parse = require('csv-parse');
const fs = require('fs');
const {escapeRegExp} = require('lodash');
const {promisify} = require('util');
const levenshtein = require('fast-levenshtein');

if (process.argv.length !== 4) {
	console.error('Usage: node filter-entries.js <excludes.txt> <entries-all.tsv>');
	process.exit(1);
}

const forbiddenSuffix = [
	'アルバム',
	'シングル',
	'大学',
	'家',
	'学校',
	'の駅',
	'する駅',
	'鉄道駅',
	'プロデューサー',
	'競走馬',
	'基礎自治体',
	'コマルカ',
	'ムニシピオ',
	'コムーネ',
	'コミューン',
	'アイドルグループ',
	'バンド',
	'氏族',
	'俳優',
	'の山',
	'番組',
	'地名',
	'町名',
	'キャラクター',
	'人物',
	'町村',
	'!',
	'！',
	'?',
	'？',
	'」',
	'』',
	'】',
	'タグ',
	'ボクサー',
	'文学者',
	'指揮者',
	'神社',
	'歌手',
	'デザイナー',
	'ソング',
	'元号',
	'声優',
	'路線',
	'映画',
	'ある市',
	'あった市',
	'する市',
	'した市',
	'いた市',
	'の市',
	'ある町',
	'あった町',
	'する町',
	'した町',
	'いた町',
	'の町',
	'ある村',
	'あった村',
	'する村',
	'した村',
	'いた村',
	'の村',
	'学者',
	'小説',
	'騎手',
	'選手',
	'事件',
	'アナウンサー',
	'ナレーター',
	'妃',
	'寺院',
	'監督',
	'歌手',
	'メーカー',
	'企業',
	'楽曲',
	'ドラマ',
	'ライトノベル',
	'の姓',
	'アニメ作品',
	'公卿',
	'登場人物',
	'主人公',
	'ヒロイン',
	'楽曲',
	'警察署',
	'消防署',
	'武将',
	'法律',
	'軍人',
	'皇族',
	'自治体',
	'女優',
	'武士',
	'大名',
	'モデル',
	'ライター',
	'弁護士',
	'大字',
	'団体',
	'ユニット',
	'小惑星',
	'イラストレーター',
	'イラストレータ',
	'行政区画',
	'ジャーナリスト',
	'官僚',
	'ディレクター',
	'マジシャン',
	'アーティスト',
	'男優',
	'男性名',
	'女性名',
	'ピアニスト',
	'エッセイスト',
	'町字',
	'博士',
	'教授',
	'項目',
	'都市',
	'作品',
	'法人',
	'社',
	'一覧',
	'リスト',
	'エンジニア',
	'一覧記事',
	'パイロット',
	'タレント',
	'説明する',
	'詩人',
	'藩主',
	'振付師',
	'歌人',
	'教育者',
	'編集者',
	'奏者',
	'原作者',
	'製作者',
	'制作者',
	'記者',
	'入植者',
	'伝道者',
	'作曲者',
	'指導者',
	'自然主義者',
	'発明者',
	'著者',
	'主唱者',
	'支持者',
	'独裁者',
	'キャラ',
	'企画',
	'当主',
	'十年紀',
	'世紀',
	'平年',
	'ではない',
	'ミュージシャン',
	'ストリッパー',
	'コメディアン',
	'雄馬',
	'牡馬',
	'雌馬',
	'牝馬',
	'司会者',
	'外交官',
	'奇術師',
	'DJ',
	'プロレスラー',
	'アイドル',
	'アイドルグループ',
	'華族',
	'ドライバー',
	'技術者',
	'子役',
	'医師',
	'料理人',
	'検察官',
	'側室',
	'僧侶',
	'司教',
	'ダンサー',
	'歌い手',
	'踊り手',
	'パーソナリティ',
	'インターチェンジ',
	'アニメーター',
	'郵便局',
	'野球場',
	'博物館',
	'美術館',
	'商業施設',
	'公園',
	'の城',
	'温泉',
	'力士',
	'スタジアム',
	'サッカークラブ',
	'記述する',
	'解説する',
	'述べる',
	'ダム',
	'ゴルファー',
	'ニスト',
	'ベーシスト',
	'ラッパー',
	'社長',
	'諸島',
	'日ま', // misnormalization of "xx日まで、～"
	'経穴',
	'位置する県',
	'携帯電話端末',
	'が存在する',
	'ます',
	'まとめサイト',
	'投手',
	'審判員',
	'の数',
	'参照',
];

const forbiddenSuffixRegex = new RegExp(`(?:${forbiddenSuffix.map((s) => escapeRegExp(s)).join('|')})(?:の1つ|の１つ|のひとつ|の一つ|の一人|のひとり|の1人|の１人|の一種|の1種|の１種|の名前|の名称)+?$`);

const forbiddenInfix = [
	'表記',
	'以下の',
	'削除しました',
	'作成ミス',
	'白紙化',
	'この記事',
	'読んで字の如く',
	'に登場する',
	'カップリング',
	'曖昧さ回避',
	'重複記事',
	'pixiv',
	'Pixiv',
	'ピクシブ',
	'お絵カキコ',
	'荒らし',
	'歌ってみた',
	'踊ってみた',
	'Історія',
];

const forbiddenInfixRegex = new RegExp(`(?:${forbiddenInfix.map((s) => escapeRegExp(s)).join('|')})`);

const normalizeMeaning = (input) => {
	let meaning = input;
	meaning = meaning.trim().replace(/(のこと|の事|をいう|である|です|を指す|とされ(る|ます)|とされてい(る|ます)|、|。)+$/, '');
	meaning = meaning.replace(/(の一つ|のひとつ|の１つ)$/, 'の1つ');
	meaning = meaning.replace(/(の1人|のひとり|の１人)$/, 'の一人');
	meaning = meaning.replace(/(の1種|の１種)$/, 'の一種');
	return meaning.trim();
};

(async () => {
	const excludesData = await promisify(fs.readFile)(process.argv[2])
	const excludes = new Set(excludesData.toString().split('\n'));

	let counter = 0;

	const reader = fs.createReadStream(process.argv[3]);
	const parser = parse({
		escape: '\\',
		delimiter: '\t',
		quote: false,
		max_limit_on_data_read: 1e6,
		skip_lines_with_error: true,
	});
	const writer = fs.createWriteStream('entries.filtered.tsv');

	reader.pipe(parser);

	parser.on('data', ([word, ruby, rawMeaning]) => {
		if (excludes.has(rawMeaning.replace(/ /g, '_'))) {
			return;
		}

		const normalizedRuby = hiraganize(ruby).replace(/[・･＝=「」【】［］『』()、。!?！？]/g, '');

		if (normalizedRuby.length > 20 || normalizedRuby.length === 0 || !normalizedRuby.match(/^[\p{Script=Hiragana}ー]+$/u)) {
			return;
		}

		const meaning = normalizeMeaning(rawMeaning);

		if (meaning.length <= 3) {
			return;
		}

		if (meaning.match(/^(?:グレゴリオ暦で)/)) {
			return;
		}

		if (meaning.match(forbiddenSuffixRegex)) {
			return;
		}

		if (meaning.match(forbiddenInfixRegex)) {
			return;
		}

		if (word.match(/(裁判所|一覧|事件|体育館)$/)) {
			return;
		}

		if (levenshtein.get(word, meaning) <= 2) {
			return;
		}

		writer.write([word, normalizedRuby, meaning].join('\t') + '\n');
	});
})();
