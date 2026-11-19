/**
 * Pipeline HSK 1 → 2 → 3.
 *
 * Legge i tre PDF (Simplified | Traditional | Pinyin | Meaning), pulisce
 * encoding e righe spezzate, scrive `src/data/hsk-all-raw.json` e costruisce
 * il curriculum mastery-based in `src/data/generated-curriculum.json`.
 *
 * Modulo 0 resta quello artigianale in `scripts/foundation-nodes.json`
 * (rad-ren, rad-nu, rad-zi, hanzi-hao, hanzi-ni, phrase-nihao).
 *
 * L'ordine didattico non è quello alfabetico del PDF. I caratteri singoli di
 * ogni livello sono ordinati per produttività (in quante parole composte del
 * dataset HSK 1-3 compare il carattere). Dopo ogni gruppo di caratteri entrano
 * le parole di quel livello i cui caratteri sono già stati introdotti. Gli id
 * `hskN-...` restano quelli già pubblicati, così i salvataggi futuri restano validi.
 *
 * Ogni nodo riceve una batteria progressiva: ascolto, riconoscimento,
 * cloze in contesto, riordino (parole di 2+ caratteri), tratti (solo 1–2),
 * selettore dei toni e, per i caratteri facili da confondere, il contrasto visivo.
 *
 * I nodi in `src/data/grammar-nodes.ts` vengono inseriti dopo le parole-ancora.
 * Ogni unità si chiude con una sfida di sintesi (`isUnitChallenge`).
 */

import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse/lib/pdf-parse.js");
const ts = require("typescript");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Node 19 non importa i file TypeScript: si transpila il modulo e si esegue. */
function loadGrammarNodes() {
  const file = path.join(root, "src/data/grammar-nodes.ts");
  const source = readFileSync(file, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
    fileName: file,
  });
  const exports = {};
  const runner = new Function("exports", "require", outputText);
  runner(exports, require);
  if (!Array.isArray(exports.GRAMMAR_NODES) || exports.GRAMMAR_NODES.length < 24) {
    throw new Error("grammar-nodes.ts non esporta almeno 24 nodi");
  }
  return exports.GRAMMAR_NODES;
}

const SOURCES = [
  { file: "new-hsk-1-vocabulary-list.pdf", level: 1 },
  { file: "new-hsk-2-vocabulary-list.pdf", level: 2 },
  { file: "new-hsk-3-vocabulary-list.pdf", level: 3 },
];

/** Voci del PDF già coperte dal Modulo 0: si riusa l'id, non si duplica il nodo. */
const FOUNDATION_ALIAS = new Map([
  ["人", "rad-ren"],
  ["好", "hanzi-hao"],
  ["你", "hanzi-ni"],
  ["你好", "phrase-nihao"],
]);

const UNIT_MIN = 18;
const UNIT_TARGET = 20;
const UNIT_MAX = 22;
const CHAR_BATCH = 9;
const WAVE_SIZE = 5;

/**
 * Tratti dei caratteri del curriculum (Make Me a Hanzi). A parità di
 * produttività i caratteri con meno tratti vengono prima; se il tratto manca,
 * resta l'ordine originale di estrazione.
 */
const STROKE_PACKED =
  "一1七2万3丈3三3上3下3不4且5世5业5东5丢6两7个3中4为4主5久3么3乎5乐5九2也3习3书4买6了2事8二2于3五4些8交6亮9人2什4今4介4从4他5以4们5件6休6会6伞6但7位7住7体7作7你7便9信9候10借10假11做11健10像13儿2元4先6全6八2公4六4共6关6兴6其8典8养9再6冒9写5冬5冰6决6冷7净8准10凉10凌10几2出5分4刚6初7别7刮8到8刷8刻8前9力2办4加5务5动6助7努7勺3包5化4北5区4医7十2千3午4半5单8卖8南9卡5卫3历4去5参8又2友4双4发5叔8受8变8口3句5只5叫5可5史5右5号5司5吃6合6同6名6后6向6吗6吧7听7告7员7呢8周8和8咖8咱9响9哥10哪9哭10唱11商11啊10啡11啤11喂12喜12喝12嘴16四5回6因6园7国8图8在6地6场6坏7坐7块7坚7城9境14士3声7处5备8复9夏10外5多6大3天4太4夫4头5奇8女3奶5她6好6如6妈6妹8妻8始8姐8姓8姨9婚11子3字6季8学8孩9它5安6完7定8宜8实8客9室9害10家10容10宾10对5封9小3少4尝9就12层7居8屋9展10山3岁6工3左5差9己3已3市5师6希7带9帮9常11干3平5年6床7应7店8康11开4弟7张7当6影15往8很9得11心4必5忘7忙6快7怎9怕8思9急9怪8总9息10您11情11惯11想13意13感13愿14慢14懂15戏6成6我7或8房8所8手4才3打5扫6找7把7护7报7担8拍8择8拿10持9挺9换10据11接11提12搬13收6放8故9教11数13文4料10斤4新13方4旁10旅10日4旧5早6时7明8易8星9春9昨9是9晚11晴12更7最12月4有6朋8服8望11期12末5本5朵6机6李7束7条7来7杯8板8极7果8查9树9校10样10根10桌10梯11检11椅12楚13楼13概13次6欢6歌14正5步7段9每7比4毛4气4水4求7汉5汽7沙7没7河8泉9法8注8泳8洗9活9海10清11渴12游12满13漂14演14澡16激16火4灯6点9炼9烧10热10然12照13熊14爬8爱10爷6爸8片4牙4牛4物8特10狗8猫11玩8环8现8班10球11理11瓜5瓶10甜11生5用5电5男7画8界9留10疼10病10瘦14白5百6的8盘11目5直8相9看9真10眼11着11睛13睡13知8短12矮13矿8码8碗13礼5票11离10秋9种9租10空8穿9突9站10笑10笔10第11等12答12筷13简13算14箱15篮16米6糕16糖16系7累11红6级6纸7练8终8绍8经8结9给9绩11绿11网6羊6羽6老6考6者8而6耳6聊11聪15肉6育8胖9能10脏10脑10脚11脸11腿13自6舒12舞14般10船11色6节5花7苹8茶9草9药9菜11蓝13蕉15虽9蛋11行6街12衣6表8衫8衬8被10裙12裤12西6要9见4视8觉9角7解13言7认4让5议5记5讲6识7诉7词7试8话8该8语9说9请10读10课10谁10调10谢12贵9赛14走7起10超12越12趣15足7跑12跟13路13跳13踢15身7车4轻9较10辆11边5过6迎7运7近7还7这7进7远7迟7送9适9选9遇12遍12道12那6邮7邻7都10酒10里7重9钟9钱10铁10铅10银11错13锻14长4门3问6间7闻9阳6阴6阿7附7院9除9难10雨8雪11零13需14静14非8面9鞋15音9页6须9顾10题15颜15风4飞3饭7饮7饱8饺9饿10馆11香9马3骑11高10鱼8鲜14鸟5鸡7黄11黑12";

const STROKES = new Map();
{
  const glyphs = Array.from(STROKE_PACKED);
  for (let index = 0; index < glyphs.length; ) {
    const glyph = glyphs[index];
    index += 1;
    let digits = "";
    while (index < glyphs.length && glyphs[index] >= "0" && glyphs[index] <= "9") {
      digits += glyphs[index];
      index += 1;
    }
    STROKES.set(glyph, Number(digits));
  }
}

/** Temi usati per intitolare le unità quando il blocco è già fatto di parole. */
const UNIT_THEMES = [
  { title: "Persone e Famiglia", keys: ["person", "people", "family", "father", "mother", "dad", "mom", "brother", "sister", "child", "son", "daughter", "friend", "husband", "wife", "man", "woman", "boy", "girl", "baby", "who"] },
  { title: "Tempo e Date", keys: ["time", "today", "tomorrow", "yesterday", "morning", "afternoon", "evening", "night", "week", "month", "year", "hour", "minute", "clock", "now", "early", "late", "day", "date"] },
  { title: "Numeri e Quantità", keys: ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "hundred", "thousand", "number", "half"] },
  { title: "Luoghi e Spostamenti", keys: ["place", "home", "house", "shop", "store", "hospital", "station", "airport", "road", "street", "city", "country", "travel", "car", "bus", "train", "plane", "taxi", "walk", "arrive", "leave"] },
  { title: "Cibo e Bevande", keys: ["eat", "drink", "food", "rice", "tea", "water", "fruit", "meat", "vegetable", "cook", "restaurant", "breakfast", "lunch", "dinner", "hungry", "delicious", "coffee", "milk"] },
  { title: "Studio e Scuola", keys: ["study", "learn", "school", "student", "teacher", "book", "read", "write", "class", "exam", "question", "language", "character", "word", "chinese", "university", "homework", "lesson"] },
  { title: "Lavoro e Società", keys: ["work", "job", "office", "company", "meeting", "manager", "money", "buy", "sell", "business", "colleague"] },
  { title: "Corpo e Salute", keys: ["body", "head", "hand", "eye", "ear", "mouth", "doctor", "hospital", "sick", "ill", "medicine", "health", "pain"] },
  { title: "Natura e Meteo", keys: ["weather", "rain", "snow", "sun", "wind", "cloud", "hot", "cold", "mountain", "river", "tree", "flower", "animal", "dog", "cat", "sky"] },
  { title: "Casa e Oggetti", keys: ["room", "door", "window", "table", "chair", "bed", "phone", "computer", "clothes", "shirt", "shoe", "cup", "bag"] },
  { title: "Azioni e Vita Quotidiana", keys: ["listen", "speak", "say", "talk", "sleep", "sit", "stand", "open", "close", "help", "play", "live", "want", "like", "love", "know", "think", "feel", "call", "wash", "wear"] },
  { title: "Qualità e Descrizioni", keys: ["big", "small", "good", "bad", "new", "old", "long", "short", "high", "low", "beautiful", "happy", "fast", "slow", "important", "different", "same", "easy", "difficult", "many", "few"] },
];

const TONE_TO_BASE = {
  ā: "a", á: "a", ǎ: "a", à: "a", Ā: "a", Á: "a", Ǎ: "a", À: "a",
  ē: "e", é: "e", ě: "e", è: "e", Ē: "e", É: "e", Ě: "e", È: "e",
  ī: "i", í: "i", ǐ: "i", ì: "i", Ī: "i", Í: "i", Ǐ: "i", Ì: "i",
  ō: "o", ó: "o", ǒ: "o", ò: "o", Ō: "o", Ó: "o", Ǒ: "o", Ò: "o",
  ū: "u", ú: "u", ǔ: "u", ù: "u", Ū: "u", Ú: "u", Ǔ: "u", Ù: "u",
  ǖ: "ü", ǘ: "ü", ǚ: "ü", ǜ: "ü", Ǖ: "ü", Ǘ: "ü", Ǚ: "ü", Ǜ: "ü",
  ń: "n", ň: "n", ǹ: "n", ü: "ü", Ü: "ü",
};

const VOWEL_TONES = {
  a: ["a", "ā", "á", "ǎ", "à"],
  e: ["e", "ē", "é", "ě", "è"],
  i: ["i", "ī", "í", "ǐ", "ì"],
  o: ["o", "ō", "ó", "ǒ", "ò"],
  u: ["u", "ū", "ú", "ǔ", "ù"],
  ü: ["ü", "ǖ", "ǘ", "ǚ", "ǜ"],
};

const MARKED = new Set("āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜńňǹ");

const SYLLABLES = new Set(
  `a ai an ang ao e ei en eng er o ou
ba bai ban bang bao bei ben beng bi bian biao bie bin bing bo bu
pa pai pan pang pao pei pen peng pi pian piao pie pin ping po pu
ma mai man mang mao me mei men meng mi mian miao mie min ming mo mu
fa fan fang fei fen feng fo fou fu
da dai dan dang dao de dei den deng di dia dian diao die ding diu dong dou du duan dui dun duo
ta tai tan tang tao te tei teng ti tian tiao tie ting tong tou tu tuan tui tun tuo
na nai nan nang nao ne nei nen neng ni nian niang niao nie nin ning niu nong nou nu nuan nü nüe nuo
la lai lan lang lao le lei leng li lia lian liang liao lie lin ling liu lo long lou lu luan lüe lun luo lü
ga gai gan gang gao ge gei gen geng gong gou gu gua guai guan guang gui gun guo
ka kai kan kang kao ke ken keng kong kou ku kua kuai kuan kuang kui kun kuo
ha hai han hang hao he hei hen heng hong hou hu hua huai huan huang hui hun huo
ji jia jian jiang jiao jie jin jing jiong jiu ju juan jue jun
qi qia qian qiang qiao qie qin qing qiong qiu qu quan que qun
xi xia xian xiang xiao xie xin xing xiong xiu xu xuan xue xun
zha zhai zhan zhang zhao zhe zhei zhen zheng zhi zhong zhou zhu zhua zhuai zhuan zhuang zhui zhun zhuo
cha chai chan chang chao che chen cheng chi chong chou chu chua chuai chuan chuang chui chun chuo
sha shai shan shang shao she shei shen sheng shi shou shu shua shuai shuan shuang shui shun shuo
ran rang rao re ren reng ri rong rou ru rua ruan rui run ruo
za zai zan zang zao ze zei zen zeng zi zong zou zu zuan zui zun zuo
ca cai can cang cao ce cen ceng ci cong cou cu cuan cui cun cuo
sa sai san sang sao se sen seng si song sou su suan sui sun suo
ya yan yang yao ye yi yin ying yo yong you yu yuan yue yun
wa wai wan wang wei wen weng wo wu
kei pou miu fiao m n ng`
    .trim()
    .split(/\s+/),
);

const INITIALS = ["zh", "ch", "sh", "b", "p", "m", "f", "d", "t", "n", "l", "g", "k", "h", "j", "q", "x", "r", "z", "c", "s", "y", "w"];

/** Parole inglesi corte o ambigue: servono a non far vincere un pinyin troppo lungo. */
const ENGLISH = new Set(
  `a i an the and or but if so as at by of to in on for from with into over per via yet nor not no yes ok tv pm am mr ms
you your yours we our ours they them their he she his her hers its my me us it be is am are was were been being
do did does go goes going up out off own old new one two three four five six seven eight nine ten zero
who how why what when where which while this that these those there here than then just also only some
any many much more most less few all both very too well back down still can may must will would should
could about above below under again once half next last each every other same such name time day year
man men woman women boy girl child children baby person people father mother brother sister friend
family dad mom son daughter wife husband grandpa grandma uncle aunt mister sir madam mr ms
big small little large long short tall high low deep near far full empty free true false kind sure
nice fine okay hello goodbye please thanks thank welcome sorry excuse morning afternoon evening night
today tomorrow yesterday week month year hour minute second number phone computer movie music sport
game ball shirt pants dress shoe shoes coat hat rain snow wind sun moon star tree flower bird horse
cow pig chicken fowl egg eggs airplane plane bed couch gate door eye eyes ice cream fat plump gym
mama busy inside outside front back left right black white green blue brown red yellow orange pink
young old early late open close start stop help work play live love like want need know think feel
tell give take make come have has had look book hand foot head room home food milk fish meat rice
soup cake salt sugar water money store shop bank card cash note page line word text test exam city
park road side mountain river lake sea ship train taxi hotel office house table chair window letter
paper question answer problem matter thing stuff place point state level group order power light
sound voice color colour country language chinese english french because however although already
always often never soon now together another around against across during without within between
before after really usually sometimes someone something anything nothing everything everyone anybody
everybody myself yourself himself herself itself structural particle modal classifier individual
ordinal thousand hundred million bicycle library supermarket university elementary hospital
restaurant breakfast lunch dinner clothes weather listen speak write read learn study sleep drink
cook wash wear buy sell call meet visit travel return arrive leave enter exit remember forget
understand believe decide prepare finish complete important different special useful beautiful
pretty cheap expensive correct wrong possible probable maybe perhaps example instance quarter
double pair sheet type sort means method reason result interest hobby relation relationship
daughter amusing traffic coffee bureau standard inferior you're don't it's i'm that's there's
what's let's cannot daytime during baozi cup glass vegetable dish illness disease prefix indicating
younger telephone television cinema cooked meal song company firm corporation tasty delicious
pleasant dumpling nine subject course mouth completed action marker noun modal ending sentence
permit although even though experience experienced action marker unit cents yuan standard inferior
station classmate weather cellphone mobile bookstore fruit asleep speak four they lunch clothes
primary elementary hour write thanks new rest imitate snow want also half chair yesterday breakfast
really china noon middle desk character goodbye find here know live cook sit preparation delicious
supermarket taxi vegetable wear consume vehicle eat call loudly car cup glass father eight hundred
half bao classifier books periodicals files edge border no mention suggestion surmise bakery
delicious hen airplane airport ticket remember classroom introduce enter near frequently hotel
begin exam possible trousers rapid happy nearly basketball tired leave floor journey route online
foreign finish ten thousand towards forget classifier hope wash toilet downstairs continue laugh
surname color medicine pharmacy grandfather moment already together idea overcast because swim
interesting sometimes right fish distant exercise stand husband preparation oneself walk soccer
football most aunt quiet safe move relocate manage means satisfied newspaper north passive notes
compare notebook competition must change everywhere perform else others guesthouse refrigerator
patient participate grass lawn layer check almost taste often shirt achievement grades city late
depart born discharged junior besides boat spring dictionary intelligent sweep intend roughly adult
size panda overcoat carry worry cake certainly everywhere obtain score lamp earth ground map
electricity elevator ebook lose northeast southeast winter animal zoo paragraph exercise dialogue
hungry moreover ear headphones send fever happen discover develop convenient noodles direction
apartment release holiday reassured dismiss separate wind sealed couple serve nearby review should
clean interested feel cold do barely rail according further kilogram public workday story scrape
shut relationship concerned concerning attention nation festival ocean afraid quite number suitable
blackboard afterwards passport garden painter welcome environment exchange yellow reply meeting
conference urgent season add vacation persevere inspect simple healthy speak negotiate money foot
receive street section marry program festival conclude solve sisters borrow catty process manager
duration wine former sentence decide card bloom attend happy apparently thirsty adorable however
quarter textbook guest text conditioning cry chopsticks mineral come blue experienced elderly depart
gift history face practice drill cool vehicle chat neighbor abroad exchange stair curb crossing
horse immediately satisfied classifier meter uncooked realize list celebrity south difficult sad
ugly male student problem unpleasant grade strive female crawl fear photograph plate bottle ride
strange actually rise takeoff automobile pencil clear request entertain autumn stadium skirt cordial
recognize consider serious easy straightforward umbrella sweep sofa jacket scoop height voice life
angry market test world accept collect thin uncle mathematics brush pair horizontal chauffeur
seasons sugar unusual raise sports sweet jump hear quite colleague agree hair sudden library leg
countryside takeout foreign complete bowl delayed party tennis website forget bathroom culture
west northwest watermelon southwest habit fond washing shower summer beforehand banana believe
suitcase towards resemble camera community careful campus headmaster shoe mind chest fresh trust
credit walk luggage hobby holiday choose select term tooth toothbrush sheep raise request page
surely altogether same afterwards formerly apart think following ordinary continuously music bank
beverage ought influence employ mail tourist mailbox relate famous useful again badminton language
raincoat encounter site willing exceed athlete dirty whatever middle grow anxious shine photograph
until merely paper obliged important weekend principal attention hospitalized dictionary bicycle
suffix invariably mouth best final recently guest homework assignment airplane egg bed gate boy eye pen pencil
ice cream gym mama busy person menu east small direction elevator patient achievement face station
couch door plump fat delicious tasty pleasant company television cinema younger brother sister
cooked song subject mouth nine dumpling telephone bookstore fruit clothes weather primary write
thanks snow half chair breakfast china noon desk goodbye cook preparation supermarket wear call
hundred suggestion bakery border mention loudly consume vehicle glass father cup files periodicals`
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean),
);

function toneless(text) {
  let out = "";
  for (const ch of text) out += TONE_TO_BASE[ch] ?? ch.toLowerCase();
  return out.replace(/u:/g, "ü").replace(/v/g, "ü");
}

function hanChars(text) {
  return Array.from(text).filter((ch) => /[\u3400-\u9fff\u3007]/.test(ch));
}

function isSyllable(raw) {
  if (!raw || raw.length > 8) return false;
  if (/[^A-Za-zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜüÜńňǹĀÁǍÀĒÉĚÈĪÍǏÌŌÓǑÒŪÚǓÙǕǗǙǛ]/.test(raw)) {
    return false;
  }
  return SYLLABLES.has(toneless(raw));
}

function segmentations(latin, count) {
  const results = [];
  function walk(pos, left, parts) {
    if (results.length > 500) return;
    if (left === 0) {
      results.push({
        pinyin: latin.slice(0, pos).trim(),
        meaning: latin.slice(pos).trim(),
        parts: parts.slice(),
      });
      return;
    }
    let start = pos;
    while (start < latin.length && /[\s'’·\-]/.test(latin[start])) start += 1;
    if (start >= latin.length) return;
    const slice = latin.slice(start);
    const max = Math.min(slice.length, 7);
    for (let len = 1; len <= max; len += 1) {
      const raw = slice.slice(0, len);
      if (!isSyllable(raw)) continue;
      parts.push(raw);
      walk(start + len, left - 1, parts);
      parts.pop();
    }
  }
  if (count > 0) walk(0, count, []);
  return results;
}

function scoreMeaning(meaning) {
  const text = meaning.trim();
  if (!text || /^[,|]/.test(text)) return -1;
  if (/^[-–(]/.test(text)) return 85;
  if (/^[0-9]/.test(text)) return 70;
  const match = text.match(/^[A-Za-z]+(?:['’][A-Za-z]+)*/);
  const word = (match?.[0] ?? "").toLowerCase();
  if (!word) return -1;
  if (ENGLISH.has(word)) return 120;
  const root = word.replace(/['’].*$/, "");
  if (root !== word && ENGLISH.has(root)) return 110;
  // «negg», «ngbed»: la finale del pinyin è finita nel glossario.
  for (const fragment of ["ng", "n", "g", "r"]) {
    if (word.startsWith(fragment)) {
      const rest = word.slice(fragment.length);
      if (rest.length >= 2 && ENGLISH.has(rest)) return 8;
    }
  }
  // «irplane»: il pinyin si è mangiato la vocale iniziale di «airplane».
  // Solo parole lunghe, così «pen» non perde contro «open».
  if (word.length >= 5) {
    for (const vowel of ["a", "e", "i", "o", "u"]) {
      if (ENGLISH.has(vowel + word)) return 12;
    }
  }
  if (word.length >= 3 && /[aeiouy]/.test(word)) return 40;
  return 5;
}

function cleanMeaning(meaning) {
  return meaning.replace(/\s+/g, " ").trim();
}

function parseLatin(latin, count, endsWithEr) {
  const scored = [];

  for (const seg of segmentations(latin, count)) {
    const dual = seg.meaning.match(/^,\s*([\s\S]+)$/);
    if (dual) {
      for (const alt of segmentations(dual[1], count)) {
        const score = scoreMeaning(alt.meaning);
        if (score < 0) continue;
        scored.push({
          pinyin: `${seg.pinyin}, ${alt.pinyin}`,
          meaning: cleanMeaning(alt.meaning),
          score,
        });
      }
      continue;
    }
    const score = scoreMeaning(seg.meaning);
    if (score >= 0) {
      scored.push({
        pinyin: seg.pinyin,
        meaning: cleanMeaning(seg.meaning),
        score,
      });
    }
  }

  if (endsWithEr && count > 1) {
    for (const seg of segmentations(latin, count - 1)) {
      if (!seg.meaning.startsWith("r")) continue;
      const meaning = seg.meaning.slice(1).trim();
      const score = scoreMeaning(meaning);
      if (score < 0) continue;
      scored.push({
        pinyin: `${seg.pinyin}r`,
        meaning: cleanMeaning(meaning),
        score,
      });
    }
  }

  scored.sort((a, b) => b.score - a.score || b.pinyin.length - a.pinyin.length);
  if (!scored.length || scored[0].score < 20) return null;
  return scored[0];
}

function splitHan(han) {
  const chars = Array.from(han);
  if (chars.length === 0 || chars.length % 2 !== 0) return null;
  const mid = chars.length / 2;
  return {
    simplified: chars.slice(0, mid).join(""),
    traditional: chars.slice(mid).join(""),
  };
}

function repairGlyphs(line) {
  return line.replaceAll("オ", "才").replaceAll("\uFFFD", "");
}

/** Carattere assente ma pinyin noto (il PDF a volte perde 山 e lascia solo shān). */
function restoreMissingHanzi(line) {
  if (/[\u3400-\u9fff]/.test(line)) return line;
  const trimmed = line.trim();
  if (trimmed.startsWith("shān") || toneless(trimmed).startsWith("shan")) {
    if (/^sh(ān|an)/i.test(trimmed)) return `山山${trimmed}`;
  }
  return line;
}

function forceChicken(text) {
  const match = text.match(/^([\u3400-\u9fff\u3007]+)([\s\S]*)$/);
  if (!match) return null;
  const han = splitHan(match[1]);
  if (!han || (han.simplified !== "鸡" && han.simplified !== "雞")) return null;
  const rest = match[2] ?? "";
  const at = rest.toLowerCase().indexOf("chicken");
  const meaning = at >= 0 ? cleanMeaning(rest.slice(at)) : "chicken; fowl";
  return { ...han, pinyin: "jī", meaning: meaning || "chicken; fowl", score: 100 };
}

function parseCleanLine(text) {
  const match = text.match(/^([\u3400-\u9fff\u3007]+)([\s\S]+)$/);
  if (!match) return null;
  const han = splitHan(match[1]);
  if (!han) return null;
  const count = Array.from(han.simplified).length;
  const endsWithEr = /[儿兒]$/.test(han.simplified);
  const latin = match[2].trim();
  const parsed = parseLatin(latin, count, endsWithEr);
  if (!parsed) return null;
  return { ...han, ...parsed };
}

function parseEntryLine(line, level) {
  let text = restoreMissingHanzi(repairGlyphs(line).replace(/\u00a0/g, " ").trim());
  if (!text) return null;
  let parsed = parseCleanLine(text);
  const chicken = (parsed?.simplified === "鸡" || parsed?.simplified === "雞")
    && parsed
    && !/^j[iīíǐì]/i.test(parsed.pinyin);
  if (!parsed || chicken) {
    const forced = forceChicken(text);
    if (forced) parsed = forced;
  }
  if (!parsed) return null;
  if ((parsed.simplified === "鸡" || parsed.simplified === "雞") && !/^j[iīíǐì]/i.test(parsed.pinyin)) {
    parsed = { ...parsed, pinyin: "jī" };
  }
  return {
    simplified: parsed.simplified,
    traditional: parsed.traditional,
    pinyin: parsed.pinyin.replace(/\s+/g, " ").trim(),
    meaning: cleanMeaning(parsed.meaning),
    hskLevel: level,
    score: parsed.score ?? 100,
  };
}

function cleanLine(line) {
  let text = line.replace(/\u00a0/g, " ").trim();
  text = text.replace(/Page\s*\d+\s*\/\s*\d+\s*/gi, "");
  text = text.replace(/chill-chinese\.com/gi, "");
  text = repairGlyphs(text);
  return text.replace(/\s+/g, " ").trim();
}

function isSkippable(line) {
  const compact = line.replace(/[^A-Za-z0-9\u3400-\u9fff]+/g, "").toLowerCase();
  if (!compact) return true;
  if (compact.includes("chillchinese")) return true;
  if (/^page\d+/.test(compact)) return true;
  if (compact.startsWith("simplifiedtraditional")) return true;
  if (compact.startsWith("hsk30")) return true;
  if (compact.startsWith("learnthesewords")) return true;
  if (compact.startsWith("trychill")) return true;
  if (compact.startsWith("meaningsadapted")) return true;
  if (compact.includes("cccedict")) return true;
  if (compact.startsWith("thislistislicensed")) return true;
  return false;
}

function joinParts(left, right) {
  if (/[A-Za-zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü]$/.test(left) && /^[A-Za-z]/.test(right)) {
    return `${left} ${right}`;
  }
  return left + right;
}

function looksLikeMeaningContinuation(line) {
  if (/[\u3400-\u9fff]/.test(line)) return false;
  if (/[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/.test(line)) return false;
  if (!/^[a-z]/i.test(line)) return false;
  const first = line.match(/^[A-Za-z]+/)?.[0] ?? "";
  if (!first) return false;
  for (let count = 1; count <= 4; count += 1) {
    if (segmentations(first, count).some((seg) => seg.meaning === "")) return false;
  }
  return true;
}

function collectEntries(text, level) {
  const pieces = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = cleanLine(raw);
    if (!line || isSkippable(line)) continue;
    pieces.push(line);
  }

  const entries = [];
  const failed = [];
  let rejoined = 0;

  for (let index = 0; index < pieces.length; index += 1) {
    let buffer = pieces[index];
    let parsed = parseEntryLine(buffer, level);
    while (index + 1 < pieces.length) {
      const next = pieces[index + 1];
      const joined = joinParts(buffer, next);
      const joinedParsed = parseEntryLine(joined, level);
      if (!parsed && joinedParsed) {
        buffer = joined;
        parsed = joinedParsed;
        rejoined += 1;
        index += 1;
        continue;
      }
      if (
        parsed &&
        looksLikeMeaningContinuation(next) &&
        joinedParsed &&
        joinedParsed.simplified === parsed.simplified &&
        joinedParsed.meaning.length > parsed.meaning.length
      ) {
        buffer = joined;
        parsed = joinedParsed;
        rejoined += 1;
        index += 1;
        continue;
      }
      if (!parsed && !parseEntryLine(next, level)) {
        buffer = joined;
        index += 1;
        continue;
      }
      break;
    }
    if (parsed?.simplified && parsed.pinyin && parsed.meaning) entries.push(parsed);
    else failed.push(buffer);
  }

  return { entries, failed, rejoined };
}

function dedupKey(entry) {
  const pinyin = entry.pinyin.toLowerCase().replace(/[\s'’\-·]+/g, "");
  return `${entry.simplified}|${pinyin}`;
}

function mulberry32(seed) {
  let value = seed >>> 0;
  return function next() {
    value |= 0;
    value = (value + 0x6d2b79f5) | 0;
    let t = Math.imul(value ^ (value >>> 15), 1 | value);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(text) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function shuffle(items, rng) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(rng() * (index + 1));
    const current = copy[index];
    copy[index] = copy[swap];
    copy[swap] = current;
  }
  return copy;
}

function takeUnique(candidates, correct, count) {
  const picked = [];
  const seen = new Set([correct]);
  for (const item of candidates) {
    if (!item || seen.has(item)) continue;
    seen.add(item);
    picked.push(item);
    if (picked.length === count) break;
  }
  return picked;
}

function clip(text, max) {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

function initialOfPinyin(pinyin) {
  const bare = toneless(pinyin).replace(/[^a-zü]/g, "");
  for (const initial of INITIALS) {
    if (bare.startsWith(initial)) return initial;
  }
  return "";
}

function firstVowel(pinyin) {
  return toneless(pinyin).replace(/[^a-zü]/g, "").match(/[aeiouü]/)?.[0] ?? "";
}

function toneVariants(pinyin) {
  const chars = Array.from(pinyin);
  let index = chars.findIndex((ch) => MARKED.has(ch));
  if (index === -1) {
    const stop = chars.findIndex((ch) => /[\s,'’\-]/.test(ch));
    const limit = stop === -1 ? chars.length : stop;
    index = chars.findIndex((ch, charIndex) => {
      if (charIndex >= limit) return false;
      const base = TONE_TO_BASE[ch] ?? ch.toLowerCase();
      return "aeiouü".includes(base);
    });
  }
  if (index < 0) return [];
  const base = TONE_TO_BASE[chars[index]] ?? chars[index].toLowerCase();
  const forms = VOWEL_TONES[base];
  if (!forms) return [];
  return forms
    .map((mark) => {
      const next = chars.slice();
      next[index] = mark;
      return next.join("");
    })
    .filter((value) => value !== pinyin);
}

function meaningDistractors(entry, sameLevel, all, rng) {
  const primary = shuffle(sameLevel.map((item) => item.meaning), rng);
  const extra = shuffle(all.map((item) => item.meaning), rng);
  return takeUnique([...primary, ...extra], entry.meaning, 3);
}

function pinyinDistractors(entry, sameLevel, all, rng) {
  const correct = entry.pinyin;
  const initial = initialOfPinyin(correct);
  const vowel = firstVowel(correct);
  const others = sameLevel.map((item) => item.pinyin).filter((py) => py && py !== correct);
  const sameInitial = others.filter((py) => initial && initialOfPinyin(py) === initial);
  const sameVowel = others.filter((py) => vowel && firstVowel(py) === vowel);
  const ranked = [
    ...shuffle(toneVariants(correct), rng),
    ...shuffle(sameInitial, rng),
    ...shuffle(sameVowel, rng),
    ...shuffle(others, rng),
    ...shuffle(all.map((item) => item.pinyin), rng),
  ];
  return takeUnique(ranked, correct, 3);
}

function pickSimilarChars(word, charPinyin, count, rng) {
  const banned = new Set(Array.from(word));
  const targetInitials = new Set(
    Array.from(word)
      .map((ch) => initialOfPinyin(charPinyin.get(ch) ?? ""))
      .filter(Boolean),
  );
  const pool = [...charPinyin.keys()].filter((ch) => !banned.has(ch));
  const same = pool.filter((ch) => targetInitials.has(initialOfPinyin(charPinyin.get(ch) ?? "")));
  const rest = pool.filter((ch) => !same.includes(ch));
  return [...shuffle(same, rng), ...shuffle(rest, rng)].slice(0, count);
}

const ADJECTIVES = new Set(
  `big small good bad new old long short tall high low hot cold fast slow happy beautiful busy tired hungry thirsty easy difficult hard important same different early late cheap expensive correct wrong quiet clean full empty young many few little large near far true false nice fine free kind sure ready afraid angry sad glad sick ill fat thin heavy light dark bright sweet delicious interesting possible useful special famous convenient comfortable healthy simple serious strange pretty`
    .split(/\s+/),
);

const NUMBERS = new Set("zero one two three four five six seven eight nine ten hundred thousand half".split(" "));

/** Frasi reali per le parole funzionali, dove un modello generico suonerebbe storto. */
const CLOZE_OVERRIDES = {
  是: { zh: "我是学生。", pinyin: "Wǒ shì xuéshēng.", it: "Io sono uno studente.", clozeZh: "我____学生。" },
  的: { zh: "这是我的书。", pinyin: "Zhè shì wǒ de shū.", it: "Questo è il mio libro.", clozeZh: "这是我____书。" },
  了: { zh: "我吃了。", pinyin: "Wǒ chī le.", it: "Ho mangiato.", clozeZh: "我吃____。" },
  吗: { zh: "你好吗？", pinyin: "Nǐ hǎo ma?", it: "Come stai?", clozeZh: "你好____？" },
  呢: { zh: "我很好，你呢？", pinyin: "Wǒ hěn hǎo, nǐ ne?", it: "Io sto bene, e tu?", clozeZh: "我很好，你____？" },
  吧: { zh: "我们走吧。", pinyin: "Wǒmen zǒu ba.", it: "Andiamo.", clozeZh: "我们走____。" },
  啊: { zh: "是啊。", pinyin: "Shì a.", it: "Eh già.", clozeZh: "是____。" },
  不: { zh: "我不是学生。", pinyin: "Wǒ bú shì xuéshēng.", it: "Non sono uno studente.", clozeZh: "我____是学生。" },
  没: { zh: "我没有书。", pinyin: "Wǒ méiyǒu shū.", it: "Non ho libri.", clozeZh: "我____有书。" },
  很: { zh: "我很好。", pinyin: "Wǒ hěn hǎo.", it: "Sto molto bene.", clozeZh: "我____好。" },
  也: { zh: "我也是学生。", pinyin: "Wǒ yě shì xuéshēng.", it: "Anch'io sono studente.", clozeZh: "我____是学生。" },
  都: { zh: "我们都是学生。", pinyin: "Wǒmen dōu shì xuéshēng.", it: "Siamo tutti studenti.", clozeZh: "我们____是学生。" },
  和: { zh: "你和我。", pinyin: "Nǐ hé wǒ.", it: "Tu e io.", clozeZh: "你____我。" },
  在: { zh: "我在家。", pinyin: "Wǒ zài jiā.", it: "Sono a casa.", clozeZh: "我____家。" },
  有: { zh: "我有书。", pinyin: "Wǒ yǒu shū.", it: "Ho un libro.", clozeZh: "我____书。" },
  个: { zh: "一个人。", pinyin: "Yí gè rén.", it: "Una persona.", clozeZh: "一____人。" },
  这: { zh: "这是书。", pinyin: "Zhè shì shū.", it: "Questo è un libro.", clozeZh: "____是书。" },
  那: { zh: "那是书。", pinyin: "Nà shì shū.", it: "Quello è un libro.", clozeZh: "____是书。" },
  什么: { zh: "这是什么？", pinyin: "Zhè shì shénme?", it: "Che cos'è?", clozeZh: "这是____？" },
  谁: { zh: "他是谁？", pinyin: "Tā shì shéi?", it: "Chi è lui?", clozeZh: "他是____？" },
  怎么: { zh: "你怎么去？", pinyin: "Nǐ zěnme qù?", it: "Come ci vai?", clozeZh: "你____去？" },
  多少: { zh: "这个多少钱？", pinyin: "Zhège duōshao qián?", it: "Quanto costa?", clozeZh: "这个____钱？" },
  几: { zh: "你有几本书？", pinyin: "Nǐ yǒu jǐ běn shū?", it: "Quanti libri hai?", clozeZh: "你有____本书？" },
  太: { zh: "太好了。", pinyin: "Tài hǎo le.", it: "Ottimo.", clozeZh: "____好了。" },
  最: { zh: "他最好。", pinyin: "Tā zuì hǎo.", it: "Lui è il migliore.", clozeZh: "他____好。" },
  会: { zh: "我会说中文。", pinyin: "Wǒ huì shuō Zhōngwén.", it: "So parlare cinese.", clozeZh: "我____说中文。" },
  能: { zh: "我能去。", pinyin: "Wǒ néng qù.", it: "Posso andare.", clozeZh: "我____去。" },
  要: { zh: "我要去。", pinyin: "Wǒ yào qù.", it: "Voglio andare.", clozeZh: "我____去。" },
  想: { zh: "我想吃饭。", pinyin: "Wǒ xiǎng chīfàn.", it: "Vorrei mangiare.", clozeZh: "我____吃饭。" },
  去: { zh: "我去学校。", pinyin: "Wǒ qù xuéxiào.", it: "Vado a scuola.", clozeZh: "我____学校。" },
  来: { zh: "请来。", pinyin: "Qǐng lái.", it: "Vieni, per favore.", clozeZh: "请____。" },
  做: { zh: "你在做什么？", pinyin: "Nǐ zài zuò shénme?", it: "Che cosa stai facendo?", clozeZh: "你在____什么？" },
  看: { zh: "我看书。", pinyin: "Wǒ kàn shū.", it: "Leggo un libro.", clozeZh: "我____书。" },
  听: { zh: "我听音乐。", pinyin: "Wǒ tīng yīnyuè.", it: "Ascolto la musica.", clozeZh: "我____音乐。" },
  说: { zh: "请说中文。", pinyin: "Qǐng shuō Zhōngwén.", it: "Parla cinese, per favore.", clozeZh: "请____中文。" },
  吃: { zh: "我吃饭。", pinyin: "Wǒ chī fàn.", it: "Mangio.", clozeZh: "我____饭。" },
  喝: { zh: "我喝水。", pinyin: "Wǒ hē shuǐ.", it: "Bevo acqua.", clozeZh: "我____水。" },
  我: { zh: "我是学生。", pinyin: "Wǒ shì xuéshēng.", it: "Io sono uno studente.", clozeZh: "____是学生。" },
  你: { zh: "你好。", pinyin: "Nǐ hǎo.", it: "Ciao.", clozeZh: "____好。" },
  他: { zh: "他是老师。", pinyin: "Tā shì lǎoshī.", it: "Lui è un insegnante.", clozeZh: "____是老师。" },
  她: { zh: "她是老师。", pinyin: "Tā shì lǎoshī.", it: "Lei è un'insegnante.", clozeZh: "____是老师。" },
  们: { zh: "我们是学生。", pinyin: "Wǒmen shì xuéshēng.", it: "Noi siamo studenti.", clozeZh: "我____是学生。" },
  人: { zh: "他是中国人。", pinyin: "Tā shì Zhōngguó rén.", it: "Lui è cinese.", clozeZh: "他是中国____。" },
  好: { zh: "我很好。", pinyin: "Wǒ hěn hǎo.", it: "Sto molto bene.", clozeZh: "我很____。" },
  你好: { zh: "你好吗？", pinyin: "Nǐ hǎo ma?", it: "Come stai?", clozeZh: "____吗？" },
};

const SENTENCE_PATTERNS = {
  noun: [
    { zh: "这是____。", pinyin: "Zhè shì ____.", it: "Questo è «{gloss}»." },
    { zh: "我有____。", pinyin: "Wǒ yǒu ____.", it: "Ho «{gloss}»." },
    { zh: "我喜欢____。", pinyin: "Wǒ xǐhuan ____.", it: "Mi piace «{gloss}»." },
  ],
  verb: [
    { zh: "我想____。", pinyin: "Wǒ xiǎng ____.", it: "Vorrei «{gloss}»." },
    { zh: "我要____。", pinyin: "Wǒ yào ____.", it: "Voglio «{gloss}»." },
  ],
  adj: [
    { zh: "这个很____。", pinyin: "Zhège hěn ____.", it: "Questo è molto «{gloss}»." },
    { zh: "今天很____。", pinyin: "Jīntiān hěn ____.", it: "Oggi è molto «{gloss}»." },
  ],
  number: [
    { zh: "我有____个。", pinyin: "Wǒ yǒu ____ gè.", it: "Ne ho «{gloss}»." },
    { zh: "这是____。", pinyin: "Zhè shì ____.", it: "Questo è «{gloss}»." },
  ],
  pronoun: [
    { zh: "____也来。", pinyin: "____ yě lái.", it: "Anche «{gloss}» viene." },
    { zh: "我看见____。", pinyin: "Wǒ kànjiàn ____.", it: "Vedo «{gloss}»." },
  ],
  classifier: [
    { zh: "给我一____。", pinyin: "Gěi wǒ yī ____.", it: "Dammene un «{gloss}»." },
    { zh: "我有一____。", pinyin: "Wǒ yǒu yī ____.", it: "Ne ho un «{gloss}»." },
  ],
  phrase: [
    { zh: "他说：____。", pinyin: "Tā shuō: ____.", it: "Lui dice: «{gloss}»." },
  ],
  grammar: [
    { zh: "我会写____。", pinyin: "Wǒ huì xiě ____.", it: "So scrivere «{gloss}»." },
    { zh: "请看____。", pinyin: "Qǐng kàn ____.", it: "Guarda: «{gloss}»." },
  ],
};

function hanList(text) {
  return Array.from(text ?? "").filter((glyph) => /[\u3400-\u9fff]/.test(glyph));
}

function classifyEntry(entry) {
  const meaning = String(entry.meaning || "").toLowerCase();
  if (/classifier|measure word/.test(meaning)) return "classifier";
  if (/particle|suffix|prefix|marker|structural/.test(meaning)) return "grammar";
  const head = meaning.split(/[;,/]/)[0].trim();
  if (/^(to|not to)\b/.test(head)) return "verb";
  const bare = head.replace(/^(a|an|the)\s+/, "");
  const first = bare.split(/\s+/)[0] ?? "";
  if (NUMBERS.has(first)) return "number";
  if (ADJECTIVES.has(first)) return "adj";
  if (/^(buono|bene|bello|grande|piccolo|felice)\b/.test(bare)) return "adj";
  if (/^(i|you|he|she|we|they|it|this|that|these|those|who|what|where|when|how)\b/.test(first)) return "pronoun";
  if (/^(tu|io|lui|lei|noi|voi|loro|questo|quello)\b/.test(bare)) return "pronoun";
  if (/^(hello|goodbye|thanks|thank|sorry|please|ciao|salve|grazie)\b/.test(first)) return "phrase";
  return "noun";
}

function fixedHan(patternZh) {
  return patternZh.replaceAll("____", "");
}

function pickPattern(patterns, word, rng) {
  const usable = patterns.filter((pattern) => !fixedHan(pattern.zh).includes(word));
  if (!usable.length) return null;
  return usable[Math.floor(rng() * usable.length)];
}

function safePattern(word) {
  const candidates = [
    { zh: "请看____。", pinyin: "Qǐng kàn ____.", it: "Guarda: «{gloss}»." },
    { zh: "这是____。", pinyin: "Zhè shì ____.", it: "Questo è «{gloss}»." },
    { zh: "我有____。", pinyin: "Wǒ yǒu ____.", it: "Ho «{gloss}»." },
    { zh: "____。", pinyin: "____.", it: "«{gloss}»." },
  ];
  return candidates.find((pattern) => !fixedHan(pattern.zh).includes(word)) ?? candidates[3];
}

function fillPattern(pattern, entry) {
  const gloss = clip(entry.meaning, 80);
  return {
    zh: pattern.zh.replaceAll("____", entry.simplified),
    pinyin: pattern.pinyin.replaceAll("____", entry.pinyin),
    it: pattern.it.replaceAll("{gloss}", gloss),
    clozeZh: pattern.zh,
  };
}

function sentenceFromExamples(entry) {
  const target = entry.simplified;
  if (!target) return null;
  for (const example of entry.examples ?? []) {
    if (!example?.zh?.includes(target)) continue;
    const clozeZh = example.zh.replace(target, "____");
    if (!clozeZh.includes("____") || clozeZh.includes(target)) continue;
    const extraHan = hanList(example.zh.split(target).join("")).length;
    const punct = /[。！？!?…]/.test(example.zh);
    if (extraHan < 2 && !(punct && extraHan >= 1)) continue;
    return {
      zh: example.zh,
      pinyin: example.pinyin || entry.pinyin,
      it: example.it || entry.meaning,
      clozeZh,
    };
  }
  return null;
}

function naturalSentence(entry, rng) {
  const fromExample = sentenceFromExamples(entry);
  if (fromExample) return fromExample;
  const override = CLOZE_OVERRIDES[entry.simplified];
  if (override && !override.clozeZh.includes(entry.simplified)) return override;
  const kind = classifyEntry(entry);
  const patterns = SENTENCE_PATTERNS[kind] ?? SENTENCE_PATTERNS.noun;
  const picked = pickPattern(patterns, entry.simplified, rng) ?? safePattern(entry.simplified);
  return fillPattern(picked, entry);
}

function uniquePool(entry, sameLevel, all) {
  const seen = new Set();
  const items = [];
  for (const item of [...sameLevel, ...all]) {
    if (!item?.simplified || item.simplified === entry.simplified || seen.has(item.simplified)) continue;
    seen.add(item.simplified);
    items.push(item);
  }
  return items;
}

function listeningDistractors(entry, sameLevel, all, rng) {
  const length = hanList(entry.simplified).length;
  const initial = initialOfPinyin(String(entry.pinyin || "").split(/[\s,，]+/)[0] || "");
  const items = uniquePool(entry, sameLevel, all);
  const sameLen = items.filter((item) => hanList(item.simplified).length === length);
  const sameInitial = sameLen.filter((item) => initial && initialOfPinyin(item.pinyin) === initial);
  const ranked = [
    ...shuffle(sameInitial, rng),
    ...shuffle(sameLen.filter((item) => !sameInitial.includes(item)), rng),
    ...shuffle(items, rng),
  ];
  return takeUnique(ranked.map((item) => item.simplified), entry.simplified, 3);
}

function wordDistractors(entry, sameLevel, all, rng) {
  const length = hanList(entry.simplified).length;
  const kind = classifyEntry(entry);
  const items = uniquePool(entry, sameLevel, all);
  const sameKind = items.filter(
    (item) => hanList(item.simplified).length === length && classifyEntry(item) === kind,
  );
  const sameLen = items.filter((item) => hanList(item.simplified).length === length);
  const ranked = [...shuffle(sameKind, rng), ...shuffle(sameLen, rng), ...shuffle(items, rng)];
  return takeUnique(ranked.map((item) => item.simplified), entry.simplified, 3);
}

function listeningExercise(entry, sameLevel, all, rng, id) {
  const distractors = listeningDistractors(entry, sameLevel, all, rng);
  if (distractors.length < 3) {
    throw new Error(`Distrattori listening insufficienti per ${entry.simplified}`);
  }
  return {
    id,
    type: "listening",
    question: "Ascolta la pronuncia e scegli la parola che hai sentito.",
    audioText: entry.simplified,
    options: shuffle([entry.simplified, ...distractors], rng),
    correctAnswer: entry.simplified,
    explanation: `Hai sentito ${entry.simplified} (${entry.pinyin}): «${clip(entry.meaning, 90)}».`,
  };
}

function recognitionExercise(entry, sameLevel, all, rng, id) {
  const preferTone = hashString(`${entry.simplified}:${entry.pinyin}`) % 2 === 0;
  if (preferTone) {
    const pinyins = pinyinDistractors(entry, sameLevel, all, rng);
    if (pinyins.length >= 3) {
      return {
        id,
        type: "pinyin_match",
        question: `Qual è il pinyin di ${entry.simplified} («${clip(entry.meaning, 90)}»)?`,
        options: shuffle([entry.pinyin, ...pinyins], rng),
        correctAnswer: entry.pinyin,
        explanation: `Si legge «${entry.pinyin}».`,
      };
    }
  }
  const meanings = meaningDistractors(entry, sameLevel, all, rng);
  return {
    id,
    type: "multiple_choice",
    question: `Che cosa significa ${entry.simplified} (${entry.pinyin})?`,
    options: shuffle([entry.meaning, ...meanings], rng),
    correctAnswer: entry.meaning,
    explanation: `${entry.simplified} significa «${entry.meaning}».`,
  };
}

function clozeExercise(entry, sameLevel, all, rng, sentence, id) {
  const distractors = wordDistractors(entry, sameLevel, all, rng);
  if (distractors.length < 3) {
    throw new Error(`Distrattori cloze insufficienti per ${entry.simplified}`);
  }
  return {
    id,
    type: "cloze",
    question: sentence.clozeZh,
    audioText: sentence.zh,
    context: sentence.it,
    options: shuffle([entry.simplified, ...distractors], rng),
    correctAnswer: entry.simplified,
    explanation: `La frase completa è ${sentence.zh} (${sentence.pinyin}).`,
  };
}

function orderExercise(entry, charPinyin, rng, id) {
  const chars = hanList(entry.simplified);
  const distractors = pickSimilarChars(entry.simplified, charPinyin, 2, rng);
  const correct = chars.join(" → ");
  return {
    id,
    type: "sentence_order",
    question: `Componi la parola per «${clip(entry.meaning, 90)}» (${entry.pinyin})`,
    options: shuffle([correct, ...distractors], rng),
    correctAnswer: correct,
    explanation: `L'ordine è ${entry.simplified}. I caratteri in più non fanno parte della parola.`,
  };
}

function strokeExercise(entry, id) {
  const chars = hanList(entry.simplified);
  return {
    id,
    type: "stroke_order",
    question:
      chars.length === 1
        ? `Traccia i tratti di ${entry.simplified}.`
        : `Traccia i tratti, un carattere alla volta: ${entry.simplified}.`,
    options: chars,
    correctAnswer: chars.join(""),
    explanation: `Hai completato l'ordine dei tratti di ${entry.simplified}.`,
  };
}

/** Caratteri che si scambiano a colpo d'occhio. Il primo set che contiene il bersaglio vince. */
const CONFUSABLES = [
  ["人", "入", "八"],
  ["大", "太", "天"],
  ["日", "目", "白"],
  ["土", "士", "工"],
  ["己", "已", "巳"],
  ["未", "末", "本"],
  ["干", "千", "于"],
  ["今", "令", "合"],
  ["我", "找", "或"],
  ["问", "间", "闻"],
  ["午", "牛", "年"],
  ["了", "子", "孑"],
  ["儿", "几", "九"],
  ["刀", "力", "办"],
  ["白", "百", "自"],
  ["月", "用", "朋"],
  ["田", "由", "甲"],
  ["王", "玉", "主"],
  ["水", "永", "冰"],
  ["木", "本", "未"],
  ["火", "灭", "灯"],
  ["贝", "见", "页"],
  ["他", "她", "它"],
  ["的", "地", "得"],
  ["在", "再", "左"],
  ["有", "友", "右"],
  ["去", "云", "丢"],
  ["来", "米", "未"],
  ["买", "卖", "实"],
  ["吗", "妈", "马"],
  ["吧", "把", "爸"],
  ["做", "作", "坐"],
  ["进", "近", "远"],
  ["门", "们", "问"],
  ["请", "清", "情"],
  ["想", "相", "箱"],
  ["学", "字", "校"],
  ["很", "得", "跟"],
  ["住", "往", "注"],
  ["快", "块", "决"],
  ["东", "车", "乐"],
  ["西", "四", "酉"],
  ["南", "难", "男"],
  ["北", "比", "此"],
  ["从", "众", "丛"],
  ["开", "并", "关"],
  ["长", "张", "帐"],
  ["少", "小", "尖"],
  ["多", "夕", "外"],
  ["天", "夫", "无"],
];

const TONE_NUMBER = {
  ā: 1, á: 2, ǎ: 3, à: 4, Ā: 1, Á: 2, Ǎ: 3, À: 4,
  ē: 1, é: 2, ě: 3, è: 4, Ē: 1, É: 2, Ě: 3, È: 4,
  ī: 1, í: 2, ǐ: 3, ì: 4, Ī: 1, Í: 2, Ǐ: 3, Ì: 4,
  ō: 1, ó: 2, ǒ: 3, ò: 4, Ō: 1, Ó: 2, Ǒ: 3, Ò: 4,
  ū: 1, ú: 2, ǔ: 3, ù: 4, Ū: 1, Ú: 2, Ǔ: 3, Ù: 4,
  ǖ: 1, ǘ: 2, ǚ: 3, ǜ: 4, Ǖ: 1, Ǘ: 2, Ǚ: 3, Ǜ: 4,
  ń: 2, ň: 3, ǹ: 4,
};

function confusableSet(character) {
  if ([...character].length !== 1) return null;
  return CONFUSABLES.find((set) => set.includes(character) && new Set(set).size === set.length) ?? null;
}

function toneNumberOf(syllable) {
  for (const glyph of syllable) {
    if (TONE_NUMBER[glyph]) return TONE_NUMBER[glyph];
  }
  return 5;
}

function baseSyllable(syllable) {
  return toneless(syllable).replace(/[^a-zü]/g, "");
}

function applyToneMark(base, tone) {
  const normalized = base.replace(/u:/g, "ü").replace(/v/g, "ü");
  if (!tone || tone === 5) return normalized;
  const chars = [...normalized];
  const vowelIndexes = [];
  for (let index = 0; index < chars.length; index += 1) {
    if ("aeiouü".includes(chars[index])) vowelIndexes.push(index);
  }
  if (!vowelIndexes.length) return normalized;
  let markAt = vowelIndexes[vowelIndexes.length - 1];
  const has = (vowel) => vowelIndexes.some((index) => chars[index] === vowel);
  if (has("a")) markAt = chars.indexOf("a");
  else if (has("e")) markAt = chars.indexOf("e");
  else if (has("o") && has("u") && chars.indexOf("o") < chars.indexOf("u")) markAt = chars.indexOf("o");
  const forms = VOWEL_TONES[chars[markAt]];
  if (!forms?.[tone]) return normalized;
  chars[markAt] = forms[tone];
  return chars.join("");
}

function segmentSyllables(raw) {
  const limit = raw.length;
  const best = Array(limit + 1).fill(null);
  best[0] = [];
  for (let start = 0; start < limit; start += 1) {
    if (!best[start]) continue;
    const max = Math.min(limit - start, 7);
    for (let length = 1; length <= max; length += 1) {
      const slice = raw.slice(start, start + length);
      if (!isSyllable(slice)) continue;
      const next = best[start].concat(slice);
      const at = start + length;
      if (!best[at] || next.length < best[at].length) best[at] = next;
    }
  }
  return best[limit];
}

function syllableTones(entry) {
  const reading = String(entry.pinyin || "").split(/[,，;；/／]/)[0].trim();
  if (!reading) return null;
  const pieces = [];
  for (const rough of reading.split(/[\s·]+/)) {
    for (const part of rough.split("'")) {
      if (!part) continue;
      const segmented = segmentSyllables(part);
      if (!segmented?.length) return null;
      pieces.push(...segmented);
    }
  }
  if (!pieces.length || pieces.length > 4) return null;
  return {
    syllables: pieces.map(baseSyllable),
    tones: pieces.map(toneNumberOf),
  };
}

function markedReading(parsed) {
  return parsed.syllables.map((syllable, index) => applyToneMark(syllable, parsed.tones[index])).join(" ");
}

function toneBuilderExercise(entry, parsed, id) {
  const marked = markedReading(parsed);
  const numbers = parsed.tones.map((tone) => (tone === 5 ? "neutro" : String(tone))).join("-");
  return {
    id,
    type: "tone_builder",
    question: `Assegna il tono a ogni sillaba di ${entry.simplified}.`,
    syllables: parsed.syllables,
    options: ["1", "2", "3", "4", "5"],
    correctAnswer: parsed.tones.join("-"),
    explanation: `Si legge ${marked} (${numbers}). 5 è il tono neutro.`,
  };
}

function plainGloss(meaning) {
  return String(meaning || "")
    .replace(/[\u3400-\u9fff]/g, "")
    .replace(/\s+/g, " ")
    .replace(/\s+([:;,.])/g, "$1")
    .trim();
}

function visualContrastExercise(entry, set, rng, id) {
  const gloss = plainGloss(entry.meaning) || "questo significato";
  return {
    id,
    type: "visual_contrast",
    question: `Quale carattere significa «${clip(gloss, 80)}» e si legge ${entry.pinyin}?`,
    options: shuffle([...set], rng),
    correctAnswer: entry.simplified,
    explanation: `${entry.simplified} è quello giusto. Gli altri gli somigliano nel tratto, non nel suono né nel senso.`,
  };
}

function pushFriction(exercises, entry, rng) {
  const parsed = syllableTones(entry);
  if (parsed && !exercises.some((exercise) => exercise.type === "tone_builder")) {
    exercises.push(toneBuilderExercise(entry, parsed, "tones"));
  }
  const set = confusableSet(entry.simplified);
  if (set && !exercises.some((exercise) => exercise.type === "visual_contrast")) {
    exercises.push(visualContrastExercise(entry, set, rng, "contrast"));
  }
}

function buildExercises(entry, sameLevel, all, charPinyin, rng, sentence) {
  const chars = hanList(entry.simplified);
  const exercises = [
    listeningExercise(entry, sameLevel, all, rng, "listening"),
    recognitionExercise(entry, sameLevel, all, rng, "recognize"),
  ];
  if (sentence?.clozeZh?.includes("____") && !sentence.clozeZh.includes(entry.simplified)) {
    exercises.push(clozeExercise(entry, sameLevel, all, rng, sentence, "cloze"));
  }
  if (chars.length >= 2) {
    exercises.push(orderExercise(entry, charPinyin, rng, "order"));
  }
  if (chars.length >= 1 && chars.length <= 2) {
    exercises.push(strokeExercise(entry, "stroke"));
  }
  pushFriction(exercises, entry, rng);
  assertExerciseList(entry, exercises);
  return exercises;
}

function assertExerciseList(entry, exercises) {
  const types = exercises.map((exercise) => exercise.type);
  const chars = hanList(entry.simplified);
  if (types[0] !== "listening") {
    throw new Error(`L'ascolto non è il primo esercizio di ${entry.simplified}`);
  }
  if (!types.includes("multiple_choice") && !types.includes("pinyin_match")) {
    throw new Error(`Manca il riconoscimento per ${entry.simplified}`);
  }
  if (!types.includes("cloze")) throw new Error(`Manca il cloze per ${entry.simplified}`);
  if (chars.length >= 2 && !types.includes("sentence_order")) {
    throw new Error(`Manca il riordino per ${entry.simplified}`);
  }
  if (chars.length > 0 && chars.length <= 2 && !types.includes("stroke_order")) {
    throw new Error(`Mancano i tratti per ${entry.simplified}`);
  }
  if (chars.length > 2 && types.includes("stroke_order")) {
    throw new Error(`Tratti non previsti per ${entry.simplified}`);
  }
  for (const exercise of exercises) {
    if (exercise.type === "listening") {
      if (exercise.audioText !== entry.simplified) {
        throw new Error(`audioText listening diverso da ${entry.simplified}`);
      }
      if (/[\u3400-\u9fffāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü]/.test(exercise.question)) {
        throw new Error(`La domanda di ascolto rivela ${entry.simplified}`);
      }
    }
    if (exercise.type === "cloze") {
      if (!exercise.question.includes("____") || exercise.question.includes(entry.simplified)) {
        throw new Error(`Cloze non valido per ${entry.simplified}: ${exercise.question}`);
      }
      if (!exercise.audioText?.includes(entry.simplified) || !exercise.context) {
        throw new Error(`Cloze senza frase o contesto per ${entry.simplified}`);
      }
    }
    if (exercise.type === "stroke_order") {
      if (!exercise.correctAnswer) throw new Error(`Tratti senza risposta per ${entry.simplified}`);
      continue;
    }
    if (exercise.type === "tone_builder") {
      const parsed = syllableTones(entry);
      if (!parsed || exercise.correctAnswer !== parsed.tones.join("-")) {
        throw new Error(`Toni non allineati al pinyin di ${entry.simplified}`);
      }
      if (!exercise.syllables || exercise.syllables.join("-") !== parsed.syllables.join("-")) {
        throw new Error(`Sillabe senza tono mancanti per ${entry.simplified}`);
      }
      continue;
    }
    if (exercise.type === "visual_contrast") {
      if (exercise.options.length < 3 || !exercise.options.includes(exercise.correctAnswer)) {
        throw new Error(`Contrasto visivo incompleto per ${entry.simplified}`);
      }
      if (exercise.question.includes(exercise.correctAnswer)) {
        throw new Error(`Il contrasto visivo rivela ${entry.simplified}`);
      }
      continue;
    }
    const minimum = exercise.type === "sentence_order" ? 2 : 4;
    if (exercise.options.length < minimum || !exercise.options.includes(exercise.correctAnswer)) {
      throw new Error(
        `Esercizio incompleto per ${entry.simplified} (${exercise.type}, ${exercise.options.length} opzioni)`,
      );
    }
  }
}

function assertTaughtNode(node) {
  if (!node.exercises || node.exercises.length < 3) {
    throw new Error(`Nodo didattico incompleto: ${node.id}`);
  }
  if (node.type === "grammar") {
    if (!node.grammarPattern) throw new Error(`Manca la formula su ${node.id}`);
    if (!node.explanation || node.explanation.length < 80) {
      throw new Error(`Spiegazione grammaticale troppo corta: ${node.id}`);
    }
    if ((node.examples ?? []).length < 2) throw new Error(`Esempi grammaticali insufficienti: ${node.id}`);
  }
  for (const exercise of node.exercises) {
    if (exercise.type === "tone_builder") {
      if (!/^[1-5](-[1-5])+$|^[1-5]$/.test(exercise.correctAnswer)) {
        throw new Error(`Toni illeggibili su ${node.id}`);
      }
      const count = exercise.correctAnswer.split("-").length;
      if (!exercise.syllables || exercise.syllables.length !== count) {
        throw new Error(`Sillabe e toni non coincidono su ${node.id}`);
      }
      continue;
    }
    if (exercise.type === "visual_contrast") {
      if (exercise.options.length < 3 || !exercise.options.includes(exercise.correctAnswer)) {
        throw new Error(`Contrasto incompleto su ${node.id}`);
      }
      if (exercise.question.includes(exercise.correctAnswer)) {
        throw new Error(`Il contrasto rivela la risposta su ${node.id}`);
      }
      continue;
    }
    if (exercise.type === "cloze") {
      if (!exercise.question.includes("____") || exercise.question.includes(exercise.correctAnswer)) {
        throw new Error(`Cloze non valido su ${node.id}`);
      }
      if (!exercise.audioText || !exercise.context) throw new Error(`Cloze senza frase su ${node.id}`);
      continue;
    }
    if (exercise.type === "sentence_order") {
      if (!exercise.correctAnswer.includes("→") || !exercise.options.includes(exercise.correctAnswer)) {
        throw new Error(`Riordino incompleto su ${node.id}`);
      }
      continue;
    }
    if (!exercise.options?.includes(exercise.correctAnswer)) {
      throw new Error(`Risposta assente dalle opzioni su ${node.id} (${exercise.type})`);
    }
  }
}

function assertNodeBattery(node) {
  if (node.type === "grammar" || node.isUnitChallenge) {
    assertTaughtNode(node);
    return;
  }
  const entry = {
    simplified: hanList(node.title).join(""),
    pinyin: node.pinyin,
    meaning: node.meaning,
  };
  if (!entry.simplified) throw new Error(`Nodo senza hanzi: ${node.id}`);
  const exercises = node.exercises.map((exercise) =>
    exercise.type === "listening" || exercise.type === "cloze" || exercise.type === "stroke_order"
      ? { ...exercise, correctAnswer: exercise.correctAnswer, audioText: exercise.audioText ?? exercise.correctAnswer }
      : exercise,
  );
  const listening = node.exercises.find((exercise) => exercise.type === "listening");
  if (!listening || listening.audioText !== entry.simplified) {
    throw new Error(`Ascolto assente o rivelato su ${node.id}`);
  }
  if (/[\u3400-\u9fffāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü]/.test(listening.question)) {
    throw new Error(`Domanda di ascolto non pulita su ${node.id}`);
  }
  assertExerciseList(
    { ...entry, simplified: entry.simplified },
    node.exercises.map((exercise) => {
      if (exercise.type !== "listening") return exercise;
      return { ...exercise, audioText: entry.simplified };
    }).map((exercise) => {
      if (exercise.type !== "cloze" && exercise.type !== "stroke_order") return exercise;
      return exercise;
    }),
  );
}

function explanationFor(entry) {
  const chars = Array.from(entry.simplified);
  const traditional =
    entry.traditional !== entry.simplified ? ` Forma tradizionale: ${entry.traditional}.` : "";
  if (chars.length === 1) {
    return `${entry.simplified} (${entry.pinyin}) significa «${entry.meaning}». È un carattere singolo dell'HSK ${entry.hskLevel}: va imparato prima delle parole che lo usano come mattone.${traditional}`;
  }
  return `${entry.simplified} (${entry.pinyin}) significa «${entry.meaning}». È composto da ${chars.join(" + ")}: i caratteri singoli che conosci già sono i prerequisiti di questa parola.${traditional}`;
}

function compoundExample(entry, pool) {
  const glyph = entry.simplified;
  if (!glyph || hanList(glyph).length !== 1 || !pool?.length) return null;
  const hits = pool.filter((item) => {
    const chars = hanList(item.simplified);
    return chars.length >= 2 && chars.length <= 3 && chars.includes(glyph);
  });
  hits.sort((left, right) => {
    const leftLate = left.hskLevel > entry.hskLevel ? 1 : 0;
    const rightLate = right.hskLevel > entry.hskLevel ? 1 : 0;
    if (leftLate !== rightLate) return leftLate - rightLate;
    const lengthGap = hanList(left.simplified).length - hanList(right.simplified).length;
    if (lengthGap !== 0) return lengthGap;
    if (left.hskLevel !== right.hskLevel) return left.hskLevel - right.hskLevel;
    return left.simplified.localeCompare(right.simplified, "zh");
  });
  return hits[0] ?? null;
}

function extraSentence(entry, primary) {
  const kind = classifyEntry(entry);
  const patterns = SENTENCE_PATTERNS[kind] ?? SENTENCE_PATTERNS.noun;
  const usable = patterns.filter((pattern) => {
    if (fixedHan(pattern.zh).includes(entry.simplified)) return false;
    return pattern.zh.replaceAll("____", entry.simplified) !== primary?.zh;
  });
  if (!usable.length) return null;
  const pattern = usable[hashString(`${entry.simplified}:${entry.pinyin}`) % usable.length];
  return fillPattern(pattern, entry);
}

function examplesFor(entry, sentence, pool) {
  const examples = [];
  const seen = new Set();
  const push = (example) => {
    if (!example?.zh || seen.has(example.zh) || example.zh === entry.simplified) return;
    seen.add(example.zh);
    examples.push({
      zh: example.zh,
      pinyin: example.pinyin || entry.pinyin,
      it: example.it || entry.meaning,
    });
  };
  const compound = compoundExample(entry, pool);
  if (compound) {
    push({ zh: compound.simplified, pinyin: compound.pinyin, it: clip(compound.meaning, 80) });
  }
  push(sentence);
  push(extraSentence(entry, sentence));
  if (!examples.length) {
    examples.push({ zh: entry.simplified, pinyin: entry.pinyin, it: entry.meaning });
  }
  return examples.slice(0, 3);
}

function mergeExamples(title, existing, generated) {
  const merged = [];
  const seen = new Set();
  const handmade = (existing ?? []).filter((example) => {
    if (!example?.zh || example.zh === title) return false;
    const extra = hanList(String(example.zh).split(title).join("")).length;
    return extra >= 1 || /[。！？]/.test(example.zh);
  });
  for (const example of [...handmade, ...generated]) {
    if (!example?.zh || seen.has(example.zh)) continue;
    seen.add(example.zh);
    merged.push({ zh: example.zh, pinyin: example.pinyin || "", it: example.it || "" });
    if (merged.length === 3) break;
  }
  if (!merged.length) {
    merged.push({ zh: title, pinyin: "", it: "" });
  }
  return merged;
}

function enrichFoundation(node, pool) {
  const entry = {
    simplified: node.title,
    pinyin: node.pinyin,
    meaning: node.meaning,
    hskLevel: node.hskLevel,
    examples: node.examples,
  };
  const rng = mulberry32(hashString(`foundation:${node.id}`));
  const chars = hanList(node.title);
  const sameLevel = pool.filter((item) => item.hskLevel === node.hskLevel);
  const preserved = (node.exercises ?? []).filter(
    (exercise) => exercise.type !== "listening" && exercise.type !== "cloze" && exercise.type !== "stroke_order",
  );
  const orders = preserved.filter((exercise) => exercise.type === "sentence_order");
  const rest = preserved.filter((exercise) => exercise.type !== "sentence_order");
  const sentence = naturalSentence(entry, rng);
  const next = [
    listeningExercise(entry, sameLevel, pool, rng, `${node.id}-listening`),
    ...rest,
  ];
  if (sentence?.clozeZh?.includes("____") && !sentence.clozeZh.includes(entry.simplified)) {
    next.push(clozeExercise(entry, sameLevel, pool, rng, sentence, `${node.id}-cloze`));
  }
  if (chars.length >= 2) {
    if (orders.length) next.push(...orders);
    else next.push(orderExercise(entry, new Map(pool.filter((item) => hanList(item.simplified).length === 1).map((item) => [item.simplified, item.pinyin])), rng, `${node.id}-order`));
  }
  if (chars.length >= 1 && chars.length <= 2) {
    next.push(strokeExercise(entry, `${node.id}-stroke`));
  }
  pushFriction(next, entry, rng);
  for (const exercise of next) {
    if (exercise.id === "tones" || exercise.id === "contrast") {
      exercise.id = `${node.id}-${exercise.id}`;
    }
  }
  node.exercises = next;
  node.examples = mergeExamples(node.title, node.examples, examplesFor(entry, sentence, pool));
}

function enrichFoundationNodes(nodes, pool) {
  for (const node of nodes) {
    if (typeof node.id === "string" && node.id.startsWith("hsk")) continue;
    enrichFoundation(node, pool);
  }
}

function makeId(level, simplified, pinyin, usedIds) {
  const slug = toneless(pinyin).replace(/ü/g, "v").replace(/[^a-z0-9]+/g, "").slice(0, 32) || "ci";
  let id = `hsk${level}-${slug}`;
  if (usedIds.has(id)) id = `${id}-${simplified}`;
  let salt = 2;
  while (usedIds.has(id)) {
    id = `hsk${level}-${slug}-${simplified}-${salt}`;
    salt += 1;
  }
  usedIds.add(id);
  return id;
}

function uniqueHan(text) {
  return [...new Set(Array.from(text))];
}

function isSingle(entry) {
  return Array.from(entry.simplified).length === 1;
}

/** Quante parole composte (lunghezza ≥ 2) di HSK 1-3 contengono il carattere. */
function characterProductivity(entries) {
  const counts = new Map();
  for (const entry of entries) {
    const chars = uniqueHan(entry.simplified);
    if (chars.length < 2) continue;
    for (const glyph of chars) counts.set(glyph, (counts.get(glyph) ?? 0) + 1);
  }
  return counts;
}

function compareSingles(productivity) {
  return (left, right) => {
    const score = (productivity.get(right.simplified) ?? 0) - (productivity.get(left.simplified) ?? 0);
    if (score !== 0) return score;
    const strokes = (STROKES.get(left.simplified) ?? 99) - (STROKES.get(right.simplified) ?? 99);
    if (strokes !== 0) return strokes;
    return left.sourceIndex - right.sourceIndex;
  };
}

function sortReadyCompounds(words, fresh) {
  return [...words].sort((left, right) => {
    const leftFresh = uniqueHan(left.simplified).filter((glyph) => fresh.has(glyph)).length;
    const rightFresh = uniqueHan(right.simplified).filter((glyph) => fresh.has(glyph)).length;
    if (rightFresh !== leftFresh) return rightFresh - leftFresh;
    const lengthGap = Array.from(left.simplified).length - Array.from(right.simplified).length;
    if (lengthGap !== 0) return lengthGap;
    return left.sourceIndex - right.sourceIndex || left.hskLevel - right.hskLevel;
  });
}

/**
 * Raggruppa le parole che non si scompongono in soli caratteri-nodo:
 * stesso carattere ancora insieme, prima i caratteri appena introdotti.
 */
function groupByShared(words, productivity, prefer) {
  const pool = [...words];
  const ordered = [];
  while (pool.length) {
    const frequency = new Map();
    for (const word of pool) {
      for (const glyph of uniqueHan(word.simplified)) {
        frequency.set(glyph, (frequency.get(glyph) ?? 0) + 1);
      }
    }
    let anchor = null;
    let best = [-1, -1, -1];
    for (const [glyph, count] of frequency) {
      const score = [
        prefer.has(glyph) ? 1 : 0,
        count,
        productivity.get(glyph) ?? 0,
      ];
      const better =
        score[0] > best[0] ||
        (score[0] === best[0] && score[1] > best[1]) ||
        (score[0] === best[0] && score[1] === best[1] && score[2] > best[2]);
      if (better) {
        anchor = glyph;
        best = score;
      }
    }
    const cluster = [];
    const rest = [];
    for (const word of pool) {
      if (uniqueHan(word.simplified).includes(anchor)) cluster.push(word);
      else rest.push(word);
    }
    cluster.sort((left, right) => {
      const leftPrefer = uniqueHan(left.simplified).filter((glyph) => prefer.has(glyph)).length;
      const rightPrefer = uniqueHan(right.simplified).filter((glyph) => prefer.has(glyph)).length;
      if (rightPrefer !== leftPrefer) return rightPrefer - leftPrefer;
      const lengthGap = Array.from(left.simplified).length - Array.from(right.simplified).length;
      if (lengthGap !== 0) return lengthGap;
      return left.sourceIndex - right.sourceIndex;
    });
    ordered.push(...cluster);
    pool.length = 0;
    pool.push(...rest);
  }
  return ordered;
}

function blockedByMissingSingle(word, introduced, singleNodeChars) {
  return uniqueHan(word.simplified).some((glyph) => singleNodeChars.has(glyph) && !introduced.has(glyph));
}

/**
 * Per ogni livello: caratteri singoli dal più produttivo, e subito dopo ogni
 * gruppo le parole i cui caratteri sono già tutti noti. Le parole che usano
 * caratteri mai insegnati da soli si raggruppano per carattere condiviso.
 * Se un carattere-nodo arriva solo in un livello successivo, la parola aspetta
 * quel carattere: altrimenti il prerequisito punterebbe in avanti e il grafo
 * avrebbe un ciclo.
 */
function arrangeByProductivity(byLevel, productivity, introduced, singleNodeChars) {
  const sections = [];
  let deferred = [];
  for (const level of [1, 2, 3]) {
    const entries = byLevel[level];
    const singles = entries.filter(isSingle).sort(compareSingles(productivity));
    const pending = [...deferred, ...entries.filter((entry) => !isSingle(entry))];
    deferred = [];
    const flow = [];

    for (let index = 0; index < singles.length; index += CHAR_BATCH) {
      const batch = singles.slice(index, index + CHAR_BATCH);
      flow.push(...batch);
      const fresh = new Set(batch.map((entry) => entry.simplified));
      for (const entry of batch) introduced.add(entry.simplified);

      const full = [];
      const partial = [];
      const rest = [];
      for (const word of pending) {
        const chars = uniqueHan(word.simplified);
        if (chars.every((glyph) => introduced.has(glyph))) {
          full.push(word);
          continue;
        }
        const blocked = blockedByMissingSingle(word, introduced, singleNodeChars);
        const sharesFresh = chars.some((glyph) => fresh.has(glyph));
        if (!blocked && sharesFresh) partial.push(word);
        else rest.push(word);
      }
      pending.length = 0;
      pending.push(...rest);
      flow.push(...sortReadyCompounds(full, fresh));
      flow.push(...groupByShared(partial, productivity, fresh));
    }

    const tail = [];
    const later = [];
    for (const word of pending) {
      if (blockedByMissingSingle(word, introduced, singleNodeChars)) later.push(word);
      else tail.push(word);
    }
    flow.push(...groupByShared(tail, productivity, new Set()));
    deferred = later;
    sections.push({ level, entries: flow });
  }

  if (deferred.length) {
    const sample = deferred.slice(0, 8).map((entry) => entry.simplified).join(", ");
    throw new Error(`Composti rimasti senza i caratteri richiesti: ${sample}`);
  }
  return sections;
}

function chunkUnits(items) {
  const countOf = items.length;
  if (countOf === 0) return [];
  if (countOf <= UNIT_MAX) return [items];
  let count = Math.max(1, Math.round(countOf / UNIT_TARGET));
  while (Math.ceil(countOf / count) > UNIT_MAX) count += 1;
  while (
    count > 1 &&
    Math.floor(countOf / count) < UNIT_MIN &&
    Math.ceil(countOf / (count - 1)) <= UNIT_MAX
  ) {
    count -= 1;
  }
  const base = Math.floor(countOf / count);
  let extra = countOf % count;
  const groups = [];
  let index = 0;
  for (let unit = 0; unit < count; unit += 1) {
    const size = base + (extra > 0 ? 1 : 0);
    if (extra > 0) extra -= 1;
    groups.push(items.slice(index, index + size));
    index += size;
  }
  return groups;
}

function themeScore(entries, keys) {
  let score = 0;
  for (const entry of entries) {
    const meaning = entry.meaning.toLowerCase();
    for (const key of keys) {
      const pattern = new RegExp(`(?:^|[^a-z])${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:[^a-z]|$)`, "i");
      if (pattern.test(meaning)) score += 1;
    }
  }
  return score;
}

function phaseTitle(level, unitIndex, entries) {
  const singles = entries.filter(isSingle).length;
  const ratio = singles / entries.length;
  if (unitIndex === 0 && ratio >= 0.3) {
    if (level === 1) return "I Mattoni Fondamentali";
    if (level === 2) return "Nuovi Mattoni";
    return "Mattoni Avanzati";
  }
  if (ratio >= 0.65) return "Caratteri Produttivi";

  const ranked = UNIT_THEMES.map((theme) => ({
    title: theme.title,
    score: themeScore(entries, theme.keys),
  })).sort((left, right) => right.score - left.score);
  const best = ranked[0];
  const second = ranked[1];
  const strong = best && best.score >= 5 && (!second || best.score >= second.score + 2);
  if (strong) return best.title;
  if (unitIndex === 1) return "Prime Combinazioni";
  if (ratio >= 0.5) return "Caratteri Produttivi";
  if (best && best.score >= 4 && (!second || best.score > second.score)) return best.title;
  if (unitIndex === 2) return "Combinazioni Quotidiane";
  if (unitIndex === 3) return "Nuove Combinazioni";
  return "Lessico e Combinazioni";
}

function keyCharacters(entries, productivity) {
  const picked = [];
  const singles = entries.filter(isSingle).sort(compareSingles(productivity));
  for (const entry of singles) {
    if (picked.includes(entry.simplified)) continue;
    picked.push(entry.simplified);
    if (picked.length === 4) return picked;
  }
  const rest = [...new Set(entries.flatMap((entry) => uniqueHan(entry.simplified)))]
    .filter((glyph) => !picked.includes(glyph))
    .sort((left, right) => (productivity.get(right) ?? 0) - (productivity.get(left) ?? 0));
  for (const glyph of rest) {
    picked.push(glyph);
    if (picked.length === 4) break;
  }
  return picked;
}

function assignUnitTitles(sections, productivity) {
  const groups = [];
  for (const section of sections) {
    const chunks = chunkUnits(section.entries);
    chunks.forEach((entries, index) => {
      const phase = phaseTitle(section.level, index, entries);
      const keys = keyCharacters(entries, productivity);
      const unitTitle = `HSK ${section.level} · Unità ${index + 1}: ${phase} (${keys.join(" · ")})`;
      for (const entry of entries) {
        entry.unit = index + 1;
        entry.unitTitle = unitTitle;
      }
      groups.push(entries);
    });
  }
  return groups;
}

/**
 * Gli id dipendono dall'ordine di `makeId` quando due voci condividono il pinyin.
 * Si riusa l'id già scritto nel curriculum; in assenza, si ricalcola con l'ordine
 * storico (prima i caratteri singoli, poi le parole, nell'ordine di estrazione).
 */
function loadPreviousIds(filePath) {
  const map = new Map();
  try {
    const previous = JSON.parse(readFileSync(filePath, "utf8"));
    for (const node of previous) {
      if (!node.id?.startsWith("hsk")) continue;
      map.set(`${node.hskLevel}|${node.title}|${node.pinyin}`, node.id);
    }
  } catch {
    // Prima generazione: gli id nascono da makeId.
  }
  return map;
}

function assignStableIds(byLevel, usedIds, previousIds) {
  for (const id of previousIds.values()) usedIds.add(id);
  for (const level of [1, 2, 3]) {
    const entries = byLevel[level];
    const ordered = [...entries.filter(isSingle), ...entries.filter((entry) => !isSingle(entry))];
    for (const entry of ordered) {
      const key = `${entry.hskLevel}|${entry.simplified}|${entry.pinyin}`;
      entry.stableId = previousIds.get(key) ?? makeId(level, entry.simplified, entry.pinyin, usedIds);
    }
  }
}

function firstSyllableRaw(pinyin) {
  return String(pinyin || "").split(/[\s,，/／]+/)[0].trim().toLowerCase();
}

function resolveAnchors(seed, nodes) {
  const found = [];
  for (const title of seed.after) {
    const hint = seed.anchorPinyin?.[title];
    const matches = nodes.filter((node) => {
      if (node.title !== title || node.type === "grammar" || node.isUnitChallenge) return false;
      if (!hint) return true;
      return firstSyllableRaw(node.pinyin) === hint.toLowerCase();
    });
    if (!matches.length) return null;
    found.push(...matches);
  }
  return found;
}

function shuffleChoices(exercise, rng) {
  if (
    exercise.type === "sentence_order" ||
    exercise.type === "tone_builder" ||
    exercise.type === "stroke_order" ||
    exercise.type === "listening"
  ) {
    return exercise;
  }
  return { ...exercise, options: shuffle([...exercise.options], rng) };
}

function materializeGrammar(seed, host, anchors) {
  const rng = mulberry32(hashString(`grammar:${seed.id}`));
  const exercises = seed.exercises.map((exercise) =>
    shuffleChoices({ ...exercise, id: `${seed.id}-${exercise.id}` }, rng),
  );
  pushFriction(exercises, { simplified: seed.title, pinyin: seed.pinyin, meaning: seed.meaning }, rng);
  for (const exercise of exercises) {
    if (exercise.id === "tones" || exercise.id === "contrast") exercise.id = `${seed.id}-${exercise.id}`;
  }
  const prerequisites = [];
  for (const anchor of anchors) {
    if (!prerequisites.includes(anchor.id)) prerequisites.push(anchor.id);
  }
  return {
    id: seed.id,
    type: "grammar",
    hskLevel: seed.hskLevel,
    orderIndex: host.orderIndex,
    title: seed.title,
    pinyin: seed.pinyin,
    meaning: seed.meaning,
    grammarPattern: seed.grammarPattern,
    explanation: seed.explanation,
    examples: seed.examples,
    exercises,
    prerequisites,
    unit: host.unit,
    unitTitle: host.unitTitle,
  };
}

function insertGrammarNodes(groups, foundation, seeds) {
  const pool = [...foundation, ...groups.flat()];
  const levelGroups = new Map();
  for (const group of groups) {
    const level = group[0]?.hskLevel;
    if (!levelGroups.has(level)) levelGroups.set(level, []);
    levelGroups.get(level).push(group);
  }
  const spread = new Map();
  const insertedAfter = new Map();

  for (const seed of seeds) {
    const anchors = resolveAnchors(seed, pool);
    if (!anchors?.length) {
      throw new Error(`Ancora mancante per ${seed.id}: ${seed.after.join(", ")}`);
    }
    const latest = anchors.reduce((best, node) => (node.orderIndex > best.orderIndex ? node : best));
    const levelUnits = levelGroups.get(seed.hskLevel) ?? [];
    const levelStart = levelUnits[0]?.[0];
    const beforeLevel = levelStart && latest.orderIndex < levelStart.orderIndex;
    if (beforeLevel) {
      const bucket = spread.get(seed.hskLevel) ?? [];
      bucket.push({ seed, anchors });
      spread.set(seed.hskLevel, bucket);
      continue;
    }
    const group = groups.find((items) => items.some((node) => node.id === latest.id));
    if (!group) throw new Error(`Unità dell'ancora assente per ${seed.id}`);
    const index = group.findIndex((node) => node.id === latest.id);
    const offset = insertedAfter.get(latest.id) ?? 0;
    const node = materializeGrammar(seed, latest, anchors);
    group.splice(index + 1 + offset, 0, node);
    insertedAfter.set(latest.id, offset + 1);
  }

  for (const [level, items] of spread) {
    const units = levelGroups.get(level) ?? [];
    if (!units.length) throw new Error(`Nessuna unità HSK ${level} per la grammatica anticipata`);
    items.forEach((item, index) => {
      const slot = items.length === 1
        ? Math.floor(units.length / 2)
        : Math.round((index * (units.length - 1)) / (items.length - 1));
      const group = units[Math.min(slot, units.length - 1)];
      group.push(materializeGrammar(item.seed, group[group.length - 1], item.anchors));
    });
  }
}

function phaseName(unitTitle) {
  const match = String(unitTitle || "").match(/:\s*([^:(]+)/);
  return match?.[1]?.trim() || "Unità";
}

function challengeExamples(source) {
  const picked = [];
  for (const node of source) {
    for (const example of node.examples ?? []) {
      if (!example?.zh || example.zh === node.title) continue;
      if (picked.some((item) => item.zh === example.zh)) continue;
      picked.push({ zh: example.zh, pinyin: example.pinyin || "", it: example.it || "" });
      if (picked.length === 2) return picked;
    }
  }
  if (!picked.length && source[0]) {
    picked.push({
      zh: source[0].title,
      pinyin: source[0].pinyin || "",
      it: source[0].meaning,
    });
  }
  return picked;
}

function buildUnitChallenge(source, meta) {
  const exercises = [];
  const rng = mulberry32(hashString(`challenge:${meta.id}`));
  const toneNode = source.find((node) => {
    const parsed = syllableTones({ simplified: node.title, pinyin: node.pinyin });
    return parsed && parsed.syllables.length >= 2;
  }) ?? source.find((node) => syllableTones({ simplified: node.title, pinyin: node.pinyin }));
  if (toneNode) {
    const parsed = syllableTones({ simplified: toneNode.title, pinyin: toneNode.pinyin });
    exercises.push({
      ...toneBuilderExercise(
        { simplified: toneNode.title, pinyin: toneNode.pinyin, meaning: toneNode.meaning },
        parsed,
        `${meta.id}-tones`,
      ),
      question: `Sfida: assegna il tono a ogni sillaba di ${toneNode.title}.`,
    });
  }
  const contrastNode = source.find((node) => hanList(node.title).length === 1 && confusableSet(node.title));
  if (contrastNode) {
    const gloss = clip(plainGloss(contrastNode.meaning) || contrastNode.meaning, 80);
    exercises.push({
      ...visualContrastExercise(
        { simplified: contrastNode.title, pinyin: contrastNode.pinyin, meaning: gloss },
        confusableSet(contrastNode.title),
        rng,
        `${meta.id}-contrast`,
      ),
      question: `Sfida: quale carattere significa «${gloss}» e si legge ${contrastNode.pinyin}?`,
    });
  }
  const orderNode = source.find((node) => node.exercises?.some((exercise) => exercise.type === "sentence_order"));
  if (orderNode) {
    const exercise = orderNode.exercises.find((item) => item.type === "sentence_order");
    exercises.push({ ...structuredClone(exercise), id: `${meta.id}-order` });
  }
  const clozeNode = [...source].reverse().find((node) => node.exercises?.some((exercise) => exercise.type === "cloze"));
  if (clozeNode && exercises.length < 4) {
    const exercise = clozeNode.exercises.find((item) => item.type === "cloze");
    exercises.push({ ...structuredClone(exercise), id: `${meta.id}-cloze` });
  }
  if (exercises.length < 3) {
    const recall = source.flatMap((node) => node.exercises ?? []).find((exercise) =>
      exercise.type === "multiple_choice" || exercise.type === "pinyin_match" || exercise.type === "listening",
    );
    if (recall) exercises.push({ ...structuredClone(recall), id: `${meta.id}-recall` });
  }
  if (exercises.length < 3) {
    throw new Error(`Sfida ${meta.id} con soli ${exercises.length} esercizi`);
  }

  const sample = source
    .slice(0, 8)
    .map((node) => (node.pinyin ? `${node.title} (${node.pinyin})` : node.title))
    .join(", ");
  return {
    id: meta.id,
    type: "vocab",
    hskLevel: meta.hskLevel,
    orderIndex: source[source.length - 1]?.orderIndex ?? 0,
    title: "挑战",
    pinyin: "tiǎo zhàn",
    meaning: `Sfida di sintesi · ${phaseName(meta.unitTitle)}`,
    explanation: `Questa sfida chiude l'unità e non introduce parole nuove. Rimette insieme i toni, i caratteri facili da confondere e le frasi appena studiate. Prima di rispondere, ripassa: ${sample}.`,
    examples: challengeExamples(source),
    exercises: exercises.slice(0, 4),
    prerequisites: [],
    unit: meta.unit,
    unitTitle: meta.unitTitle,
    isUnitChallenge: true,
  };
}

function levelFromTitle(unitTitle, fallback) {
  const match = String(unitTitle || "").match(/HSK\s+(\d+)/);
  return match ? Number(match[1]) : fallback;
}

function appendUnitChallenges(groups) {
  groups.forEach((group, index) => {
    const host = group[0];
    group.push(buildUnitChallenge(group, {
      id: `challenge-u${index + 1}`,
      hskLevel: levelFromTitle(host.unitTitle, host.hskLevel),
      unit: host.unit,
      unitTitle: host.unitTitle,
    }));
  });
}

function sealChallengePrereqs(groups) {
  for (const group of groups) {
    const challenge = group.find((node) => node.isUnitChallenge);
    if (!challenge) continue;
    for (const node of group) {
      if (node.id === challenge.id || challenge.prerequisites.includes(node.id)) continue;
      challenge.prerequisites.push(node.id);
    }
  }
}

function addWaveLocks(unitNodes, startIds = ["phrase-nihao"]) {
  let previous = [...startIds];
  for (const group of unitNodes) {
    for (let index = 0; index < group.length; index += WAVE_SIZE) {
      const wave = group.slice(index, index + WAVE_SIZE);
      for (const node of wave) {
        for (const id of previous) {
          if (!node.prerequisites.includes(id)) node.prerequisites.push(id);
        }
      }
      previous = wave.map((node) => node.id);
    }
  }
}

/**
 * Il grafo è un DAG e, partendo dai nodi senza prerequisiti, ogni nodo si
 * sblocca. Stampa `Graph validation passed: 100% reachable, 0 cycles`.
 */
function validateUnlockGraph(nodes) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const singlesByChar = new Map();
  for (const node of nodes) {
    if (Array.from(node.title).length !== 1) continue;
    const list = singlesByChar.get(node.title) ?? [];
    list.push(node.id);
    singlesByChar.set(node.title, list);
  }
  for (const node of nodes) {
    if (node.type === "grammar" || node.isUnitChallenge) continue;
    if (Array.from(node.title).length < 2) continue;
    for (const glyph of uniqueHan(node.title)) {
      const owners = singlesByChar.get(glyph);
      if (!owners?.length) continue;
      if (!owners.some((id) => node.prerequisites.includes(id))) {
        throw new Error(`Manca il prerequisito ${glyph} su ${node.id} (${node.title})`);
      }
    }
  }

  let cycles = 0;
  const color = new Map();
  function visit(id) {
    const mark = color.get(id) ?? 0;
    if (mark === 1) {
      cycles += 1;
      return;
    }
    if (mark === 2) return;
    const node = byId.get(id);
    if (!node) return;
    color.set(id, 1);
    for (const prereq of node.prerequisites) visit(prereq);
    color.set(id, 2);
  }
  for (const node of nodes) visit(node.id);

  const indegree = new Map(nodes.map((node) => [node.id, 0]));
  const outgoing = new Map(nodes.map((node) => [node.id, []]));
  let missing = 0;
  for (const node of nodes) {
    for (const prereq of node.prerequisites) {
      if (!outgoing.has(prereq)) {
        missing += 1;
        continue;
      }
      outgoing.get(prereq).push(node.id);
      indegree.set(node.id, indegree.get(node.id) + 1);
    }
  }
  const queue = [];
  for (const [id, degree] of indegree) {
    if (degree === 0) queue.push(id);
  }
  let reached = 0;
  while (queue.length) {
    const id = queue.shift();
    reached += 1;
    for (const next of outgoing.get(id)) {
      const degree = indegree.get(next) - 1;
      indegree.set(next, degree);
      if (degree === 0) queue.push(next);
    }
  }

  if (cycles !== 0 || missing !== 0 || reached !== nodes.length) {
    const percent = nodes.length ? Math.round((reached / nodes.length) * 100) : 0;
    throw new Error(
      `Graph validation failed: ${percent}% reachable (${reached}/${nodes.length}), ${cycles} cycles, prerequisiti assenti ${missing}`,
    );
  }
  console.log("Graph validation passed: 100% reachable, 0 cycles");
}

function printUnitPreview(nodes) {
  const units = [];
  for (const node of nodes) {
    if (node.unit === 0) continue;
    const last = units[units.length - 1];
    if (!last || last.title !== node.unitTitle) units.push({ title: node.unitTitle, nodes: [node] });
    else last.nodes.push(node);
  }
  console.log("Prime 6 unità:");
  for (const unit of units.slice(0, 6)) {
    const head = unit.nodes
      .slice(0, 5)
      .map((node) => `${node.title} (${node.pinyin})`)
      .join(", ");
    console.log(`  ${unit.title}`);
    console.log(`    ${head}`);
  }
}

function selfTest() {
  const cases = [
    ["爱愛àito love; to be fond of; to like", { simplified: "爱", traditional: "愛", pinyin: "ài", meaning: "to love; to be fond of; to like" }],
    ["八八bāeight", { simplified: "八", pinyin: "bā", meaning: "eight" }],
    ["爸爸爸爸bàbafather; dad", { simplified: "爸爸", pinyin: "bàba", meaning: "father; dad" }],
    ["不客气不客氣bú kèqiyou're welcome; don't mention it", { simplified: "不客气", pinyin: "bú kèqi" }],
    ["谁誰shéi, shuíwho", { simplified: "谁", pinyin: "shéi, shuí", meaning: "who" }],
    ["得得destructural particle", { simplified: "得", pinyin: "de", meaning: "structural particle" }],
    ["地地de-ly", { simplified: "地", pinyin: "de", meaning: "-ly" }],
    ["过過guò, guoexperienced action marker", { simplified: "过", pinyin: "guò, guo", meaning: "experienced action marker" }],
    ["女儿女兒nǚ'érdaughter", { simplified: "女儿", pinyin: "nǚ'ér", meaning: "daughter" }],
    ["这儿這兒zhèrhere", { simplified: "这儿", pinyin: "zhèr", meaning: "here" }],
    ["好玩儿好玩兒hǎowánramusing; fun; interesting", { simplified: "好玩儿", pinyin: "hǎowánr", meaning: "amusing; fun; interesting" }],
    ["红绿灯紅綠燈hóng-lǜdēngtraffic light; traffic signal", { simplified: "红绿灯", pinyin: "hóng-lǜdēng", meaning: "traffic light; traffic signal" }],
    ["咖啡咖啡kāfēicoffee", { simplified: "咖啡", pinyin: "kāfēi", meaning: "coffee" }],
    ["办公室辦公室bàngōngshìoffice; bureau", { simplified: "办公室", traditional: "辦公室", pinyin: "bàngōngshì", meaning: "office; bureau" }],
    ["鸡雞jīchicken; fowl", { simplified: "鸡", pinyin: "jī", meaning: "chicken; fowl" }],
    ["鸡雞jXchicken; fowl", { simplified: "鸡", pinyin: "jī", meaning: "chicken; fowl" }],
    ["山山shānmountain; hill", { simplified: "山", pinyin: "shān", meaning: "mountain; hill" }],
    ["shānmountain; hill", { simplified: "山", traditional: "山", pinyin: "shān", meaning: "mountain; hill" }],
    ["オオcáithen and only then; just now", { simplified: "才", pinyin: "cái", meaning: "then and only then; just now" }],
    ["角角jiǎounit of money equal to 0.1 yuan, or 10 cents", { simplified: "角", pinyin: "jiǎo" }],
    ["差差chànot up to standard; inferior; wrong", { simplified: "差", pinyin: "chà", meaning: "not up to standard; inferior; wrong" }],
    ["子子zinoun suffix", { simplified: "子", pinyin: "zi", meaning: "noun suffix" }],
    ["啊啊amodal particle ending sentence", { simplified: "啊", pinyin: "a", meaning: "modal particle ending sentence" }],
    ["怎么怎麼zěnmehow?; what?; why?", { simplified: "怎么", pinyin: "zěnme" }],
    ["汉语漢語HànyǔChinese language", { simplified: "汉语", pinyin: "Hànyǔ", meaning: "Chinese language" }],
    ["一点儿一點兒yìdiǎnra little; a bit", { simplified: "一点儿", pinyin: "yìdiǎnr", meaning: "a little; a bit" }],
    ["关系關係guānxìrelation; relationship", { simplified: "关系", pinyin: "guānxì", meaning: "relation; relationship" }],
  ];

  for (const [line, expected] of cases) {
    const parsed = parseEntryLine(line, 1);
    if (!parsed) throw new Error(`Self-test senza parse: ${line}`);
    for (const [key, value] of Object.entries(expected)) {
      if (parsed[key] !== value) {
        throw new Error(`Self-test «${line}»\n  ${key}: atteso "${value}", ottenuto "${parsed[key]}"`);
      }
    }
  }

  const joined = collectEntries("办公室\n辦公室bàngōngshìoffice; bureau\n", 3);
  if (joined.failed.length || joined.entries.length !== 1 || joined.entries[0].simplified !== "办公室") {
    throw new Error("Self-test riga spezzata non ricomposta");
  }
}

function exerciseSelfTest() {
  const entries = [
    { simplified: "爱", pinyin: "ài", meaning: "to love; to like", hskLevel: 1 },
    { simplified: "八", pinyin: "bā", meaning: "eight", hskLevel: 1 },
    { simplified: "爸爸", pinyin: "bàba", meaning: "father; dad", hskLevel: 1 },
    { simplified: "吗", pinyin: "ma", meaning: "modal particle ending sentence", hskLevel: 1 },
    { simplified: "好", pinyin: "hǎo", meaning: "good", hskLevel: 1 },
    { simplified: "是", pinyin: "shì", meaning: "to be", hskLevel: 1 },
    { simplified: "个", pinyin: "gè", meaning: "classifier for items", hskLevel: 1 },
    { simplified: "大", pinyin: "dà", meaning: "big; large", hskLevel: 1 },
    { simplified: "我", pinyin: "wǒ", meaning: "I; me", hskLevel: 1 },
    { simplified: "书", pinyin: "shū", meaning: "book", hskLevel: 1 },
    { simplified: "学习", pinyin: "xuéxí", meaning: "to study; to learn", hskLevel: 1 },
    { simplified: "学生", pinyin: "xuéshēng", meaning: "student", hskLevel: 1 },
    { simplified: "搬家", pinyin: "bānjiā", meaning: "to move house", hskLevel: 2 },
    { simplified: "出租车", pinyin: "chūzūchē", meaning: "taxi", hskLevel: 1 },
    {
      simplified: "你好",
      pinyin: "nǐ hǎo",
      meaning: "hello",
      hskLevel: 1,
      examples: [
        { zh: "你好！", pinyin: "nǐ hǎo!", it: "Ciao!" },
        { zh: "你好吗？", pinyin: "nǐ hǎo ma?", it: "Come stai?" },
      ],
    },
  ];
  const charPinyin = new Map(
    entries
      .filter((entry) => hanList(entry.simplified).length === 1)
      .map((entry) => [entry.simplified, entry.pinyin]),
  );
  for (const entry of entries) {
    const rng = mulberry32(hashString(`self:${entry.simplified}`));
    const sentence = naturalSentence(entry, rng);
    buildExercises(entry, entries, entries, charPinyin, rng, sentence);
  }
  const hello = entries.find((entry) => entry.simplified === "你好");
  const helloSentence = naturalSentence(hello, mulberry32(1));
  if (helloSentence.clozeZh !== "____吗？") {
    throw new Error(`Cloze di 你好 inatteso: ${helloSentence.clozeZh}`);
  }
  const baba = syllableTones({ simplified: "爸爸", pinyin: "bàba" });
  if (!baba || baba.syllables.join(",") !== "ba,ba" || baba.tones.join("-") !== "4-5") {
    throw new Error(`Toni di bàba inattesi: ${JSON.stringify(baba)}`);
  }
  const nihao = syllableTones({ simplified: "你好", pinyin: "nǐ hǎo" });
  if (!nihao || nihao.syllables.join(",") !== "ni,hao" || nihao.tones.join("-") !== "3-3") {
    throw new Error(`Toni di nǐ hǎo inattesi: ${JSON.stringify(nihao)}`);
  }
  const neutral = syllableTones({ simplified: "吗", pinyin: "ma" });
  if (!neutral || neutral.tones.join("-") !== "5") {
    throw new Error(`Tono neutro di ma inatteso: ${JSON.stringify(neutral)}`);
  }
}

async function main() {
  selfTest();
  exerciseSelfTest();
  console.log("Riparazioni encoding verificate (オ→才, 鸡→jī, shān→山, righe spezzate).");

  const extracted = { 1: [], 2: [], 3: [] };
  for (const source of SOURCES) {
    const filePath = path.join(root, source.file);
    const parsedPdf = await pdfParse(readFileSync(filePath));
    const { entries, failed, rejoined } = collectEntries(parsedPdf.text, source.level);
    if (failed.length) {
      console.error(`Righe non interpretate in HSK ${source.level}:`);
      for (const line of failed) {
        console.error(`  - ${line}`);
        console.error(
          `    codes: ${Array.from(line)
            .map((ch) => ch.codePointAt(0).toString(16))
            .join(" ")}`,
        );
      }
      throw new Error(`HSK ${source.level}: ${failed.length} righe non interpretate`);
    }
    extracted[source.level] = entries;
    console.log(`HSK ${source.level}: ${entries.length}${rejoined ? ` (righe ricomposte: ${rejoined})` : ""}`);
  }

  const unique = [];
  const seen = new Set();
  let dropped = 0;
  for (const level of [1, 2, 3]) {
    for (const entry of extracted[level]) {
      const key = dedupKey(entry);
      if (seen.has(key)) {
        dropped += 1;
        continue;
      }
      seen.add(key);
      unique.push({
        simplified: entry.simplified,
        traditional: entry.traditional,
        pinyin: entry.pinyin,
        meaning: entry.meaning,
        hskLevel: entry.hskLevel,
      });
    }
  }

  const kept = { 1: 0, 2: 0, 3: 0 };
  for (const entry of unique) kept[entry.hskLevel] += 1;
  console.log(
    `Dataset pulito: HSK 1 ${kept[1]}, HSK 2 ${kept[2]}, HSK 3 ${kept[3]} (scartati ${dropped} duplicati di livello superiore)`,
  );

  const low = unique.filter((entry) => {
    if (/^[-–(0-9]/.test(entry.meaning)) return false;
    const word = entry.meaning.match(/^[A-Za-z]+/)?.[0]?.toLowerCase() ?? "";
    if (!word) return true;
    if (/^(ng|ir)[a-z]/.test(word) && !ENGLISH.has(word)) return true;
    if (/^(negg|ngate|ngeye|ngbed|ngice|ngfat|ngym)$/.test(word)) return true;
    return false;
  });
  if (low.length) {
    console.log(`Voci sospette: ${low.length}`);
    for (const entry of low.slice(0, 40)) {
      console.log(`  HSK${entry.hskLevel} ${entry.simplified} | ${entry.pinyin} | ${entry.meaning}`);
    }
  }

  writeFileSync(
    path.join(root, "src/data/hsk-all-raw.json"),
    `${JSON.stringify(unique, null, 2)}\n`,
  );

  const foundation = JSON.parse(
    readFileSync(path.join(root, "scripts/foundation-nodes.json"), "utf8"),
  );
  const curriculum = structuredClone(foundation);
  const usedIds = new Set(curriculum.map((node) => node.id));
  const charOwner = new Map();
  const charPinyin = new Map();
  for (const node of curriculum) {
    if (Array.from(node.title).length === 1) {
      charOwner.set(node.title, node.id);
      if (node.pinyin) charPinyin.set(node.title, node.pinyin);
    }
  }

  const byLevel = { 1: [], 2: [], 3: [] };
  const aliased = [];
  for (const entry of unique) {
    const alias = FOUNDATION_ALIAS.get(entry.simplified);
    if (alias) {
      aliased.push(`${entry.simplified} → ${alias}`);
      if (Array.from(entry.simplified).length === 1 && !charPinyin.has(entry.simplified)) {
        charPinyin.set(entry.simplified, entry.pinyin);
      }
      continue;
    }
    byLevel[entry.hskLevel].push(entry);
    entry.sourceIndex = byLevel[entry.hskLevel].length;
    if (Array.from(entry.simplified).length === 1 && !charPinyin.has(entry.simplified)) {
      charPinyin.set(entry.simplified, entry.pinyin);
    }
  }
  if (aliased.length) console.log(`Nodi base riusati: ${aliased.join(", ")}`);

  const allEntries = unique.filter((entry) => !FOUNDATION_ALIAS.has(entry.simplified));
  const curriculumPath = path.join(root, "src/data/generated-curriculum.json");
  const previousIds = loadPreviousIds(curriculumPath);
  assignStableIds(byLevel, usedIds, previousIds);

  const productivity = characterProductivity(unique);
  const topProductive = [...productivity.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 12)
    .map(([glyph, score]) => `${glyph} ${score}`)
    .join(", ");
  console.log(`Produttività (parole composte): ${topProductive}`);

  const introduced = new Set(charOwner.keys());
  const singleNodeChars = new Set(introduced);
  for (const level of [1, 2, 3]) {
    for (const entry of byLevel[level]) {
      if (isSingle(entry)) singleNodeChars.add(entry.simplified);
    }
  }

  const sections = arrangeByProductivity(byLevel, productivity, introduced, singleNodeChars);
  const placed = sections.reduce((sum, section) => sum + section.entries.length, 0);
  const expected = [1, 2, 3].reduce((sum, level) => sum + byLevel[level].length, 0);
  if (placed !== expected) {
    throw new Error(`Flusso incompleto: collocati ${placed}, attesi ${expected}`);
  }
  const generatedGroups = assignUnitTitles(sections, productivity);

  let orderIndex = curriculum.reduce((max, node) => Math.max(max, node.orderIndex), -1) + 1;
  const nodeGroups = [];
  for (const group of generatedGroups) {
    const nodes = [];
    for (const entry of group) {
      const chars = Array.from(entry.simplified);
      const prerequisites = [];
      if (chars.length >= 2) {
        for (const glyph of chars) {
          const owner = charOwner.get(glyph);
          if (owner && !prerequisites.includes(owner)) prerequisites.push(owner);
        }
      }
      const id = entry.stableId;
      const sameLevel = byLevel[entry.hskLevel];
      const rng = mulberry32(hashString(`${entry.hskLevel}:${entry.simplified}:${entry.pinyin}`));
      const sentence = naturalSentence(entry, rng);
      const node = {
        id,
        type: chars.length === 1 ? "hanzi" : "vocab",
        hskLevel: entry.hskLevel,
        orderIndex,
        title: entry.simplified,
        traditional: entry.traditional,
        pinyin: entry.pinyin,
        meaning: entry.meaning,
        explanation: explanationFor(entry),
        examples: examplesFor(entry, sentence, unique),
        exercises: buildExercises(entry, sameLevel, allEntries, charPinyin, rng, sentence).map((exercise) => ({
          ...exercise,
          id: `${id}-${exercise.id.split("-").slice(-1)[0]}`,
        })),
        prerequisites,
        unit: entry.unit,
        unitTitle: entry.unitTitle,
      };
      orderIndex += 1;
      if (chars.length === 1 && !charOwner.has(entry.simplified)) {
        charOwner.set(entry.simplified, id);
      }
      curriculum.push(node);
      nodes.push(node);
    }
    nodeGroups.push(nodes);
  }

  enrichFoundationNodes(curriculum, unique);

  const grammarSeeds = loadGrammarNodes();
  const grammarByLevel = { 1: 0, 2: 0, 3: 0 };
  for (const seed of grammarSeeds) {
    grammarByLevel[seed.hskLevel] += 1;
    if (!seed.grammarPattern || !seed.explanation || seed.examples.length < 2 || seed.exercises.length < 3) {
      throw new Error(`Nodo grammaticale incompleto: ${seed.id}`);
    }
  }
  if (grammarByLevel[1] < 10 || grammarByLevel[2] < 7 || grammarByLevel[3] < 7) {
    throw new Error(`Copertura grammaticale insufficiente: ${JSON.stringify(grammarByLevel)}`);
  }

  const foundationNodes = curriculum.filter((node) => node.unit === 0);
  insertGrammarNodes(nodeGroups, foundationNodes, grammarSeeds);
  appendUnitChallenges(nodeGroups);
  const unitZeroChallenge = buildUnitChallenge(foundationNodes, {
    id: "challenge-u0",
    hskLevel: 1,
    unit: 0,
    unitTitle: foundationNodes[0]?.unitTitle ?? "Unità 0: Primi Passi",
  });
  unitZeroChallenge.prerequisites = foundationNodes.map((node) => node.id);
  foundationNodes.push(unitZeroChallenge);

  addWaveLocks(nodeGroups, [unitZeroChallenge.id]);
  sealChallengePrereqs(nodeGroups);

  const finalCurriculum = [...foundationNodes, ...nodeGroups.flat()];
  finalCurriculum.forEach((node, index) => {
    node.orderIndex = index;
  });

  const keptIds = new Set(finalCurriculum.map((node) => node.id));
  for (const id of previousIds.values()) {
    if (!keptIds.has(id)) throw new Error(`ID non più presente nel curriculum: ${id}`);
  }
  const titles = new Set(finalCurriculum.map((node) => node.unitTitle));
  for (const title of titles) {
    const challenges = finalCurriculum.filter((node) => node.unitTitle === title && node.isUnitChallenge);
    if (challenges.length !== 1) throw new Error(`Sfide per «${title}»: ${challenges.length}`);
  }
  const placedGrammar = finalCurriculum.filter((node) => node.type === "grammar");
  if (placedGrammar.length !== grammarSeeds.length) {
    throw new Error(`Grammatica collocata ${placedGrammar.length}/${grammarSeeds.length}`);
  }

  validateUnlockGraph(finalCurriculum);
  printUnitPreview(finalCurriculum);

  for (const node of finalCurriculum) {
    if (!node.exercises || node.exercises.length < 3) {
      throw new Error(`Nodo senza 3 esercizi: ${node.id}`);
    }
    assertNodeBattery(node);
  }
  const typeCounts = {};
  for (const node of finalCurriculum) {
    for (const exercise of node.exercises) {
      typeCounts[exercise.type] = (typeCounts[exercise.type] ?? 0) + 1;
    }
  }
  console.log("Batteria esercizi:", typeCounts);
  console.log(
    `Grammatica: ${placedGrammar.length} (HSK 1 ${grammarByLevel[1]}, HSK 2 ${grammarByLevel[2]}, HSK 3 ${grammarByLevel[3]})`,
  );

  writeFileSync(
    path.join(root, "src/data/generated-curriculum.json"),
    `${JSON.stringify(finalCurriculum, null, 2)}\n`,
  );

  const units = new Set(finalCurriculum.map((node) => node.unitTitle));
  console.log(`Nodi curriculum: ${finalCurriculum.length} in ${units.size} unità`);
  for (const level of [1, 2, 3]) {
    const count = finalCurriculum.filter((node) => node.hskLevel === level).length;
    console.log(`  nel grafo HSK ${level}: ${count}`);
  }

  const bundled = spawnSync(process.execPath, [path.join(root, "scripts/bundle-strokes.mjs")], {
    stdio: "inherit",
  });
  if (bundled.status !== 0) {
    throw new Error("bundle-strokes.mjs non è riuscito: i tratti offline non sono aggiornati");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
