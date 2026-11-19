import type { Example, Exercise } from "@/types/learning";

/**
 * Nodi di grammatica operativa, inseriti da `scripts/import-hsk.mjs`
 * subito dopo le parole-ancora (o distribuiti nel livello, se le ancore
 * sono già state introdotte prima).
 */
export interface GrammarSeed {
  id: string;
  hskLevel: number;
  title: string;
  pinyin?: string;
  meaning: string;
  grammarPattern: string;
  explanation: string;
  examples: Example[];
  exercises: Exercise[];
  /** Titoli dei nodi già nel curriculum: la grammatica segue l'ultimo. */
  after: string[];
  /** Se il titolo è ambiguo, sillaba esatta della prima lettura (toni inclusi). */
  anchorPinyin?: Record<string, string>;
}

function choice(
  id: string,
  question: string,
  correct: string,
  wrong: string[],
  explanation: string,
): Exercise {
  return {
    id,
    type: "multiple_choice",
    question,
    options: [correct, ...wrong],
    correctAnswer: correct,
    explanation,
  };
}

function cloze(
  id: string,
  question: string,
  answer: string,
  audioText: string,
  context: string,
  distractors: string[],
  explanation: string,
): Exercise {
  return {
    id,
    type: "cloze",
    question,
    audioText,
    context,
    options: [answer, ...distractors],
    correctAnswer: answer,
    explanation,
  };
}

function order(
  id: string,
  question: string,
  correct: string[],
  distractors: string[][],
  explanation: string,
): Exercise {
  const correctAnswer = correct.join(" → ");
  return {
    id,
    type: "sentence_order",
    question,
    options: [correctAnswer, ...distractors.map((tokens) => tokens.join(" → "))],
    correctAnswer,
    explanation,
  };
}

export const GRAMMAR_NODES: GrammarSeed[] = [
  {
    id: "grammar-shi",
    hskLevel: 1,
    title: "是",
    pinyin: "shì",
    meaning: "Frase con 是: identità e classificazione",
    grammarPattern: "Soggetto + 是 + Sostantivo",
    explanation:
      "是 (shì) è il verbo «essere» quando colleghi una persona o una cosa alla sua identità: nazionalità, mestiere, nome. L'ordine è fisso: prima chi è il soggetto, poi 是, poi il sostantivo. Non si usa 是 davanti a un aggettivo: «sto bene» è 我很好, non 我是很好. La negazione è 不 subito prima di 是: 我不是老师. Nella domanda chiusa 是 resta al suo posto e 吗 va in fondo: 你是学生吗？",
    examples: [
      { zh: "我是学生。", pinyin: "Wǒ shì xuéshēng.", it: "Io sono uno studente." },
      { zh: "她是老师。", pinyin: "Tā shì lǎoshī.", it: "Lei è un'insegnante." },
      { zh: "这是书。", pinyin: "Zhè shì shū.", it: "Questo è un libro." },
    ],
    after: ["是"],
    exercises: [
      order(
        "order",
        "Metti in ordine: «Io sono un'insegnante».",
        ["我", "是", "老师"],
        [
          ["是", "我", "老师"],
          ["我", "老师", "是"],
          ["老师", "是", "我"],
        ],
        "Il soggetto apre la frase, 是 sta in mezzo, il sostantivo chiude.",
      ),
      cloze(
        "cloze",
        "我____学生。",
        "是",
        "我是学生。",
        "Io sono uno studente.",
        ["很", "的", "在"],
        "是 collega 我 al nome del ruolo. 很 servirebbe a un aggettivo, non a 学生.",
      ),
      choice(
        "rule",
        "Quale frase usa 是 nel modo corretto?",
        "他是中国人。",
        ["他是很高兴。", "是他中国人。", "他中国人是。"],
        "是 classifica (中国人, un nome). Davanti a 高兴 si usa 很, non 是.",
      ),
    ],
  },
  {
    id: "grammar-hen",
    hskLevel: 1,
    title: "很",
    pinyin: "hěn",
    meaning: "Aggettivo predicativo con 很, senza 是",
    grammarPattern: "Soggetto + 很 + Aggettivo",
    explanation:
      "In cinese l'aggettivo funziona da predicato e non ha bisogno di «essere». 我很好 significa «sto bene». 很, da solo, è spesso un collante neutro: nella frase semplice non vuol dire per forza «molto». Inserire 是 (我是很好) è l'errore tipico di chi parte dall'italiano. Per negare si toglie 很 e si mette 不: 我不好. Per insistere sul grado alto si usa 太…了 (太好了) o 非常, non un 是 in più.",
    examples: [
      { zh: "我很好。", pinyin: "Wǒ hěn hǎo.", it: "Sto bene." },
      { zh: "今天很冷。", pinyin: "Jīntiān hěn lěng.", it: "Oggi fa freddo." },
      { zh: "这个不大。", pinyin: "Zhège bú dà.", it: "Questo non è grande." },
    ],
    after: ["很"],
    exercises: [
      order(
        "order",
        "Metti in ordine: «Oggi fa freddo».",
        ["今天", "很", "冷"],
        [
          ["今天", "是", "很", "冷"],
          ["很", "今天", "冷"],
          ["今天", "冷", "很"],
        ],
        "Niente 是. L'aggettivo chiude la frase e 很 lo precede.",
      ),
      cloze(
        "cloze",
        "她____高兴。",
        "很",
        "她很高兴。",
        "Lei è contenta.",
        ["是", "的", "吗"],
        "高兴 è un aggettivo predicativo: il legame giusto è 很, non 是.",
      ),
      choice(
        "rule",
        "Come si nega «他很高»?",
        "他不高。",
        ["他不很高。", "他不是高。", "他没高。"],
        "不 sostituisce 很. 没 non nega gli aggettivi di stato.",
      ),
    ],
  },
  {
    id: "grammar-de",
    hskLevel: 1,
    title: "的",
    pinyin: "de",
    meaning: "Possesso e modifica con 的",
    grammarPattern: "Modificatore + 的 + Nome",
    explanation:
      "的 (de, tono neutro) aggancia un modificatore al nome che segue. Con un possessore è il «di» italiano, ma l'ordine è rovesciato: 我的书 è «il libro di me», cioè «il mio libro». Lo stesso schema vale per una descrizione: 老师的名字, «il nome dell'insegnante». 的 non sostituisce 很 e non è il 得 del complemento di grado. Se il legame è ovvio e il modificatore è un pronome monosillabico in un contesto familiare, a volte cade (我妈妈), ma all'inizio è più sicuro tenerlo.",
    examples: [
      { zh: "这是我的书。", pinyin: "Zhè shì wǒ de shū.", it: "Questo è il mio libro." },
      { zh: "老师的名字", pinyin: "lǎoshī de míngzi", it: "il nome dell'insegnante" },
      { zh: "他是我的朋友。", pinyin: "Tā shì wǒ de péngyou.", it: "Lui è un mio amico." },
    ],
    after: ["的"],
    exercises: [
      order(
        "order",
        "Metti in ordine: «il libro dell'insegnante».",
        ["老师", "的", "书"],
        [
          ["的", "老师", "书"],
          ["书", "的", "老师"],
          ["老师", "书", "的"],
        ],
        "Chi modifica sta prima di 的; il nome modificato sta dopo.",
      ),
      cloze(
        "cloze",
        "这是我____书。",
        "的",
        "这是我的书。",
        "Questo è il mio libro.",
        ["得", "地", "很"],
        "Tra il possessore 我 e il nome 书 ci vuole la particella neutra 的.",
      ),
      choice(
        "rule",
        "Quale frase esprime un possesso?",
        "这是老师的书。",
        ["这是老师很书。", "这是老师是书。", "这是的老师书。"],
        "Possessore + 的 + nome. 很 e 是 non creano un complemento di specificazione.",
      ),
    ],
  },
  {
    id: "grammar-ma",
    hskLevel: 1,
    title: "吗",
    pinyin: "ma",
    meaning: "Domanda chiusa sì/no con 吗",
    grammarPattern: "Frase dichiarativa + 吗",
    explanation:
      "吗 (ma, neutro) trasforma un'affermazione in una domanda a cui si risponde sì o no. Non si sposta nulla: si aggiunge 吗 in fondo. 你是学生。 diventa 你是学生吗？ Non si usa insieme a un'altra parola interrogativa: 你是谁吗？ non si dice. La risposta positiva ripete il verbo (是 / 有 / 在); la negativa lo precede con 不 o 没. 你好吗？ è lo schema applicato al saluto: «tu stai bene?».",
    examples: [
      { zh: "你好吗？", pinyin: "Nǐ hǎo ma?", it: "Come stai?" },
      { zh: "你是学生吗？", pinyin: "Nǐ shì xuéshēng ma?", it: "Sei uno studente?" },
      { zh: "他在家吗？", pinyin: "Tā zài jiā ma?", it: "È a casa?" },
    ],
    after: ["吗"],
    exercises: [
      order(
        "order",
        "Metti in ordine la domanda: «Sei un'insegnante?».",
        ["你", "是", "老师", "吗"],
        [
          ["吗", "你", "是", "老师"],
          ["你", "吗", "是", "老师"],
          ["你", "是", "吗", "老师"],
        ],
        "吗 è sempre l'ultimo elemento, dopo il punto informativo della frase.",
      ),
      cloze(
        "cloze",
        "你是学生____？",
        "吗",
        "你是学生吗？",
        "Sei uno studente?",
        ["呢", "的", "了"],
        "La domanda sì/no chiude con 吗. 呢 chiede «e tu?», non un sì/no.",
      ),
      choice(
        "rule",
        "Quale domanda è ben formata?",
        "他在学校吗？",
        ["他吗在学校？", "他是谁吗？", "吗他在学校？"],
        "吗 si accoda a una frase già completa e non convive con 谁.",
      ),
    ],
  },
  {
    id: "grammar-bu-mei",
    hskLevel: 1,
    title: "不",
    pinyin: "bù",
    meaning: "Negazione: 不 contro 没",
    grammarPattern: "Soggetto + 不/没 + Verbo",
    explanation:
      "不 (bù, e bú davanti a un quarto tono) nega il presente, l'abitudine, la volontà, 是 e gli aggettivi: 我不是学生, 今天不去. 没 (méi), quasi sempre nella forma 没有, nega due cose diverse: il possesso (没有书, «non ho libri») e un evento che non è avvenuto (我没去, «non ci sono andato»). Non si dice 不有 e non si dice 没是. Davanti a 有, 没 assorbe spesso 有 nella pronuncia 没有. Scegli il negatore in base al tipo di predicato, non in base all'italiano «non».",
    examples: [
      { zh: "我不是老师。", pinyin: "Wǒ bú shì lǎoshī.", it: "Non sono un insegnante." },
      { zh: "我没有书。", pinyin: "Wǒ méiyǒu shū.", it: "Non ho libri." },
      { zh: "我没去学校。", pinyin: "Wǒ méi qù xuéxiào.", it: "Non sono andato a scuola." },
    ],
    after: ["不", "没有"],
    exercises: [
      order(
        "order",
        "Metti in ordine: «Non ho libri».",
        ["我", "没有", "书"],
        [
          ["我", "不有", "书"],
          ["我", "不是", "书"],
          ["没有", "我", "书"],
        ],
        "Il possesso si nega con 没有. 不有 non esiste.",
      ),
      cloze(
        "cloze",
        "我____是学生。",
        "不",
        "我不是学生。",
        "Non sono uno studente.",
        ["没", "别", "非"],
        "是 si nega con 不. 没 non sta davanti a 是.",
      ),
      choice(
        "rule",
        "Quale frase nega un'azione che non è avvenuta?",
        "我没吃饭。",
        ["我不是饭。", "我不好饭。", "我没是饭。"],
        "没 + verbo = l'azione non si è compiuta. 是 non nega un pasto.",
      ),
    ],
  },
  {
    id: "grammar-order",
    hskLevel: 1,
    title: "语序",
    pinyin: "yǔxù",
    meaning: "Ordine della frase: tempo e luogo prima del verbo",
    grammarPattern: "Soggetto + Tempo + Luogo + Verbo + Oggetto",
    explanation:
      "Il cinese non sposta le parole per fare una domanda e non mette il tempo in fondo, come spesso fa l'italiano. Lo scheletro della frase dichiarativa è: soggetto, poi quando, poi dove, poi il verbo, poi l'oggetto. 我今天在家吃饭 è «io + oggi + a casa + mangio». Il tempo non segue il verbo (我吃饭今天 è innaturale) e il luogo, introdotto da 在, sta prima dell'azione. Le eccezioni si imparano dopo; questo ordine copre la grande maggioranza delle frasi HSK 1.",
    examples: [
      { zh: "我今天在家吃饭。", pinyin: "Wǒ jīntiān zài jiā chīfàn.", it: "Oggi mangio a casa." },
      { zh: "他下午在学校学习。", pinyin: "Tā xiàwǔ zài xuéxiào xuéxí.", it: "Nel pomeriggio studia a scuola." },
      { zh: "我们现在去北京。", pinyin: "Wǒmen xiànzài qù Běijīng.", it: "Adesso andiamo a Pechino." },
    ],
    after: ["今天", "在"],
    exercises: [
      order(
        "order",
        "Metti in ordine: «Oggi mangio a casa».",
        ["我", "今天", "在家", "吃饭"],
        [
          ["我", "吃饭", "今天", "在家"],
          ["今天", "我", "吃饭", "在家"],
          ["我", "在家", "今天", "吃饭"],
        ],
        "Dopo il soggetto viene il tempo, poi il luogo, e solo alla fine il verbo.",
      ),
      cloze(
        "cloze",
        "我____在家吃饭。",
        "今天",
        "我今天在家吃饭。",
        "Oggi mangio a casa.",
        ["吗", "的", "很"],
        "Il complemento di tempo si inserisce tra il soggetto e 在 + luogo.",
      ),
      choice(
        "rule",
        "Qual è l'ordine naturale?",
        "Soggetto, tempo, luogo, verbo",
        ["Soggetto, verbo, tempo, luogo", "Tempo, verbo, soggetto, luogo", "Luogo, verbo, soggetto, tempo"],
        "Tempo e luogo sono avverbi di sfondo: precedono il verbo.",
      ),
    ],
  },
  {
    id: "grammar-ge",
    hskLevel: 1,
    title: "个",
    pinyin: "gè",
    meaning: "Classificatore universale 个",
    grammarPattern: "Numero + 个 + Nome",
    explanation:
      "Tra un numero e un nome il cinese vuole un classificatore. 个 (gè) è quello generico: persone, cose, idee quando non conosci ancora la misura specifica. 一个人, 两个学生. Davanti a 个 e agli altri classificatori, «due» è 两 e non 二: 两个人, non 二个人. 二 resta nei numeri composti (十二) e al telefono. 个 non è un plurale: il nome non cambia forma. La struttura è sempre numero + classificatore + nome, mai nome + numero.",
    examples: [
      { zh: "一个人。", pinyin: "Yí gè rén.", it: "Una persona." },
      { zh: "两个学生。", pinyin: "Liǎng gè xuéshēng.", it: "Due studenti." },
      { zh: "我有三个朋友。", pinyin: "Wǒ yǒu sān gè péngyou.", it: "Ho tre amici." },
    ],
    after: ["个"],
    exercises: [
      order(
        "order",
        "Metti in ordine: «due insegnanti».",
        ["两", "个", "老师"],
        [
          ["二", "个", "老师"],
          ["老师", "两", "个"],
          ["个", "两", "老师"],
        ],
        "Con il classificatore si conta 两, e 个 sta in mezzo tra numero e nome.",
      ),
      cloze(
        "cloze",
        "三____朋友。",
        "个",
        "三个朋友。",
        "Tre amici.",
        ["的", "是", "很"],
        "Il classificatore è obbligatorio tra il numero e il nome.",
      ),
      choice(
        "rule",
        "Quale gruppo nominale è corretto?",
        "一个老师",
        ["老师一个", "一老师", "个一老师"],
        "Numero + 个 + nome. Il nome non va prima e il numero non si attacca nudo.",
      ),
    ],
  },
  {
    id: "grammar-zai",
    hskLevel: 1,
    title: "在",
    pinyin: "zài",
    meaning: "Localizzazione con 在",
    grammarPattern: "Soggetto + 在 + Luogo",
    explanation:
      "在 (zài) risponde a «dove?». Da solo, con un luogo, significa «trovarsi»: 我在家, «sono a casa»; 书在桌子上, «il libro è sul tavolo». Il luogo segue 在, non lo precede. Per dire che un'azione avviene in un posto, 在 + luogo sta prima del verbo: 我在学校看书. Non confonderlo con 再 (zài, quarto tono), che significa «di nuovo». Nella domanda si aggiunge 吗 oppure si sostituisce il luogo con 哪儿: 你在哪儿？",
    examples: [
      { zh: "我在家。", pinyin: "Wǒ zài jiā.", it: "Sono a casa." },
      { zh: "书在桌子上。", pinyin: "Shū zài zhuōzi shàng.", it: "Il libro è sul tavolo." },
      { zh: "我在学校看书。", pinyin: "Wǒ zài xuéxiào kàn shū.", it: "Leggo a scuola." },
    ],
    after: ["在"],
    exercises: [
      order(
        "order",
        "Metti in ordine: «Sono a casa».",
        ["我", "在", "家"],
        [
          ["我", "家", "在"],
          ["在", "我", "家"],
          ["家", "在", "我"],
        ],
        "在 introduce il luogo e sta tra il soggetto e il posto.",
      ),
      cloze(
        "cloze",
        "他____学校学习。",
        "在",
        "他在学校学习。",
        "Studia a scuola.",
        ["再", "对", "从"],
        "Il luogo dell'azione si marca con 在 (quarto tono diverso da 再 «di nuovo»).",
      ),
      choice(
        "rule",
        "Quale frase localizza correttamente?",
        "妈妈在家。",
        ["妈妈家在。", "在妈妈家。", "妈妈再家。"],
        "Soggetto + 在 + luogo. 再 non significa «a, in».",
      ),
    ],
  },
  {
    id: "grammar-xiang-yao",
    hskLevel: 1,
    title: "想",
    pinyin: "xiǎng",
    meaning: "Volere: 想 e 要 prima del verbo",
    grammarPattern: "Soggetto + 想/要 + Verbo",
    explanation:
      "想 (xiǎng) e 要 (yào) stanno davanti a un altro verbo e ne esprimono la spinta. 想 è il desiderio, spesso traducibile con «vorrei» o «mi va»: 我想喝茶. 要 è più deciso: volontà, necessità, o un piano già preso (我要去学校). Nessuno dei due vuole 是 in mezzo e nessuno dei due va dopo il verbo principale. La negazione di 想 è 不想; 要 nel senso di «volere» si nega spesso con 不想, perché 不要 suona come un divieto («non devi»). 想 da solo può anche voler dire «pensare», ma in questo schema è seguito da un verbo d'azione.",
    examples: [
      { zh: "我想喝茶。", pinyin: "Wǒ xiǎng hē chá.", it: "Vorrei bere del tè." },
      { zh: "我要去学校。", pinyin: "Wǒ yào qù xuéxiào.", it: "Voglio andare a scuola." },
      { zh: "他不想吃饭。", pinyin: "Tā bù xiǎng chīfàn.", it: "Non gli va di mangiare." },
    ],
    after: ["想", "要"],
    exercises: [
      order(
        "order",
        "Metti in ordine: «Vorrei bere dell'acqua».",
        ["我", "想", "喝水"],
        [
          ["我", "喝水", "想"],
          ["想", "我", "喝水"],
          ["我", "是", "想", "喝水"],
        ],
        "想 precede il verbo che desideri fare. Non si sposta in fondo.",
      ),
      cloze(
        "cloze",
        "她____学习中文。",
        "要",
        "她要学习中文。",
        "Vuole studiare cinese.",
        ["是", "的", "吗"],
        "要 + verbo esprime una volontà netta. 是 non introduce un'azione.",
      ),
      choice(
        "rule",
        "Qual è la differenza utile all'inizio?",
        "想 è un desiderio; 要 è una decisione più netta.",
        ["想 segue il verbo; 要 lo precede.", "想 nega; 要 afferma.", "想 è un nome; 要 è un classificatore."],
        "Entrambi precedono il verbo. Cambia l'intensità, non la posizione.",
      ),
    ],
  },
  {
    id: "grammar-le",
    hskLevel: 1,
    title: "了",
    pinyin: "le",
    meaning: "Particella 了: completamento e nuovo stato",
    grammarPattern: "Verbo + 了  /  Frase + 了",
    explanation:
      "了 (le, neutro) non è un passato universale. Subito dopo il verbo segnala che l'azione è compiuta: 我吃了, «ho mangiato»; 我买了一本书, «ho comprato un libro». In fondo alla frase segnala un cambiamento, una situazione nuova: 太好了, «adesso sì che va bene»; 下雨了, «si è messo a piovere». La negazione di un'azione non compiuta non è 不了 ma 没, e in quel caso 了 cade: 我没吃. Non confonderlo con 的 e non attaccarlo a ogni verbo solo perché in italiano usi il passato.",
    examples: [
      { zh: "我吃了。", pinyin: "Wǒ chī le.", it: "Ho mangiato." },
      { zh: "太好了。", pinyin: "Tài hǎo le.", it: "Ottimo. (la situazione è cambiata)" },
      { zh: "我没去。", pinyin: "Wǒ méi qù.", it: "Non ci sono andato." },
    ],
    after: ["了"],
    exercises: [
      order(
        "order",
        "Metti in ordine: «Ho mangiato».",
        ["我", "吃", "了"],
        [
          ["我", "了", "吃"],
          ["了", "我", "吃"],
          ["我", "吃", "的"],
        ],
        "Il 了 di completamento segue il verbo, non lo precede.",
      ),
      cloze(
        "cloze",
        "太好____。",
        "了",
        "太好了。",
        "Ottimo.",
        ["的", "吗", "呢"],
        "In fondo alla frase 了 marca il nuovo stato: adesso è «troppo» bene.",
      ),
      choice(
        "rule",
        "Come si dice che non hai mangiato?",
        "我没吃。",
        ["我没吃了。", "我不吃了饭。", "我吃不了。"],
        "没 nega il completamento e 了 non resta. 吃不了 è il potenziale «non riuscire a finire».",
      ),
    ],
  },
  {
    id: "grammar-de-complement",
    hskLevel: 2,
    title: "得",
    pinyin: "de",
    meaning: "Complemento di grado con 得",
    grammarPattern: "Verbo + 得 + Grado",
    explanation:
      "得 (de, neutro) apre il complemento di grado: dice come è andata l'azione. 她说得很流利, «parla in modo fluente»; 我跑得不快, «non corro veloce». Il grado sta dopo 得, non prima del verbo. È un carattere diverso da 的 (possesso) e da 地 (che trasforma un aggettivo in avverbio prima del verbo: 慢慢地走). Se c'è un oggetto, la frase semplice dell'HSK 2 spesso evita l'oggetto o ripete il verbo; il nucleo da automatizzare è verbo + 得 + aggettivo. La negazione del grado si mette dopo 得: 写得不好.",
    examples: [
      { zh: "她说得很流利。", pinyin: "Tā shuō de hěn liúlì.", it: "Parla in modo molto fluente." },
      { zh: "我跑得不快。", pinyin: "Wǒ pǎo de bú kuài.", it: "Non corro veloce." },
      { zh: "你汉字写得很好。", pinyin: "Nǐ Hànzì xiě de hěn hǎo.", it: "Scrivi molto bene i caratteri." },
    ],
    after: ["得"],
    anchorPinyin: { 得: "de" },
    exercises: [
      order(
        "order",
        "Metti in ordine: «Parla in modo fluente».",
        ["她", "说", "得", "很流利"],
        [
          ["她", "很流利", "说"],
          ["她", "得", "说", "很流利"],
          ["她", "说", "的", "很流利"],
        ],
        "得 segue il verbo e introduce il grado. 的 non ha questo ruolo.",
      ),
      cloze(
        "cloze",
        "他跑____很快。",
        "得",
        "他跑得很快。",
        "Corre molto veloce.",
        ["的", "地", "了"],
        "Il complemento di grado vuole 得, non la particella di possesso 的.",
      ),
      choice(
        "rule",
        "Dove sta la negazione in «non scrive bene»?",
        "写得不好",
        ["不写得好", "写不好得", "没写得好"],
        "不 entra nel complemento, dopo 得. Non nega il verbo principale.",
      ),
    ],
  },
  {
    id: "grammar-zhengzai",
    hskLevel: 2,
    title: "正在",
    pinyin: "zhèngzài",
    meaning: "Azione in corso: 正在…呢",
    grammarPattern: "Soggetto + 正在 + Verbo + 呢",
    explanation:
      "正在 (zhèngzài) mette l'azione nel momento in cui la dici: non è un'abitudine e non è un fatto chiuso. 他正在看书呢, «in questo momento sta leggendo». 呢 in fondo non è la domanda «e tu?»: qui appoggia la durata, come un «eh, proprio adesso». Nella lingua reale puoi tenere solo 正在, solo 在, o solo 呢, ma lo schema completo è quello da riconoscere. Non aggiungere 了 di completamento: un'azione ancora in corso non è 了. La negazione naturale è 没在: 他没在睡觉.",
    examples: [
      { zh: "他正在看书呢。", pinyin: "Tā zhèngzài kàn shū ne.", it: "Sta leggendo, proprio adesso." },
      { zh: "妈妈正在做饭呢。", pinyin: "Māma zhèngzài zuòfàn ne.", it: "La mamma sta cucinando." },
      { zh: "我没在睡觉。", pinyin: "Wǒ méi zài shuìjiào.", it: "Non sto dormendo." },
    ],
    after: ["正在", "呢"],
    exercises: [
      order(
        "order",
        "Metti in ordine: «La mamma sta cucinando».",
        ["妈妈", "正在", "做饭", "呢"],
        [
          ["妈妈", "做饭", "正在", "呢"],
          ["正在", "妈妈", "做饭", "呢"],
          ["妈妈", "呢", "正在", "做饭"],
        ],
        "正在 precede il verbo; 呢 chiude la frase.",
      ),
      cloze(
        "cloze",
        "他们____上课呢。",
        "正在",
        "他们正在上课呢。",
        "Stanno facendo lezione.",
        ["了", "过", "得"],
        "正在 colloca l'azione adesso. 了 la darebbe per compiuta.",
      ),
      choice(
        "rule",
        "Quale frase descrive un'azione in corso?",
        "他正在打电话呢。",
        ["他打电话了。", "他想打电话。", "他打电话得快。"],
        "正在…呢 è il presente progressivo. 了, 想 e 得 dicono altro.",
      ),
    ],
  },
  {
    id: "grammar-bi",
    hskLevel: 2,
    title: "比",
    pinyin: "bǐ",
    meaning: "Comparativo con 比",
    grammarPattern: "A + 比 + B + Aggettivo",
    explanation:
      "比 (bǐ) costruisce il comparativo di maggioranza senza una parola separata per «più». A + 比 + B + aggettivo: 我比你高, «io rispetto a te sono alto», cioè «sono più alto di te». L'aggettivo resta nudo: 很 non ci va, perché 很 blocca il confronto. Per dire «di molto» si aggiunge 得多 o 多了 dopo l'aggettivo: 高得多. La negazione precede 比, non l'aggettivo: 我不比你高, «non sono più alto di te». 比 non significa «per esempio» in questo schema.",
    examples: [
      { zh: "我比你高。", pinyin: "Wǒ bǐ nǐ gāo.", it: "Sono più alto di te." },
      { zh: "今天比昨天冷。", pinyin: "Jīntiān bǐ zuótiān lěng.", it: "Oggi fa più freddo di ieri." },
      { zh: "我不比他忙。", pinyin: "Wǒ bù bǐ tā máng.", it: "Non sono più impegnato di lui." },
    ],
    after: ["比"],
    exercises: [
      order(
        "order",
        "Metti in ordine: «Oggi fa più freddo di ieri».",
        ["今天", "比", "昨天", "冷"],
        [
          ["今天", "很", "比", "昨天", "冷"],
          ["今天", "冷", "比", "昨天"],
          ["比", "今天", "昨天", "冷"],
        ],
        "A e B stanno ai due lati di 比; l'aggettivo chiude, senza 很.",
      ),
      cloze(
        "cloze",
        "他____我忙。",
        "比",
        "他比我忙。",
        "Lui è più occupato di me.",
        ["很", "得", "是"],
        "比 inserisce il termine di paragone prima dell'aggettivo nudo.",
      ),
      choice(
        "rule",
        "Quale comparativo è accettabile?",
        "妹妹比我小。",
        ["妹妹比我很小。", "妹妹很比我小。", "妹妹比小我。"],
        "Niente 很 sull'aggettivo del confronto, e 小 non si sposta prima di 我.",
      ),
    ],
  },
  {
    id: "grammar-duration",
    hskLevel: 2,
    title: "多久",
    pinyin: "duō jiǔ",
    meaning: "Durata dell'azione",
    grammarPattern: "Soggetto + Verbo + 了 + Durata",
    explanation:
      "La durata risponde a «per quanto tempo?» e si mette dopo il verbo, non prima. 我学了两个小时, «ho studiato per due ore». 了 qui accompagna un tratto di tempo già percorso. Se il verbo ha un oggetto, l'oggetto non può semplicemente incunearsi: o lo metti prima come tema, o ripeti il verbo. 我看书看了一个小时, «quanto a leggere, ho letto un'ora». All'inizio usa la forma senza oggetto (学了、工作了、等了) finché la ripetizione non è automatica. 小时, 分钟, 天 sono le unità; il classificatore 个 compare con 小时 (两个小时) ma non con 天 (两天).",
    examples: [
      { zh: "我学了两个小时。", pinyin: "Wǒ xué le liǎng gè xiǎoshí.", it: "Ho studiato per due ore." },
      { zh: "他工作了一天。", pinyin: "Tā gōngzuò le yì tiān.", it: "Ha lavorato per un giorno." },
      { zh: "我看书看了一个小时。", pinyin: "Wǒ kàn shū kàn le yí gè xiǎoshí.", it: "Ho letto per un'ora." },
    ],
    after: ["小时"],
    exercises: [
      order(
        "order",
        "Metti in ordine: «Ho studiato per due ore».",
        ["我", "学了", "两个小时"],
        [
          ["我", "两个小时", "学了"],
          ["两个小时", "我", "学了"],
          ["我", "学", "两个小时", "了"],
        ],
        "La durata segue il verbo. Non apre la frase come farebbe un orario.",
      ),
      cloze(
        "cloze",
        "我们等了二十____。",
        "分钟",
        "我们等了二十分钟。",
        "Abbiamo aspettato venti minuti.",
        ["小时", "个", "了"],
        "分钟 è l'unità dei minuti e si attacca al numero, dopo il verbo.",
      ),
      choice(
        "rule",
        "Come si dice «ho letto per un'ora» tenendo l'oggetto 书?",
        "我看书看了一个小时。",
        ["我看了一个小时书。", "我一个小时看书了。", "我看书了一个小时。"],
        "Con l'oggetto il verbo si ripete: il secondo porta 了 e la durata.",
      ),
    ],
  },
  {
    id: "grammar-result",
    hskLevel: 2,
    title: "看完",
    pinyin: "kàn wán",
    meaning: "Complementi risultativi: 看见、听懂、做完",
    grammarPattern: "Verbo + Risultato",
    explanation:
      "Un verbo cinese spesso dice solo l'azione, non l'esito. Il risultato si attacca come secondo carattere: 看 + 见 = 看见 «vedere davvero», 听 + 懂 = 听懂 «capire ascoltando», 做 + 完 = 做完 «finire di fare». 看 non garantisce 看见: puoi guardare senza vedere. La negazione di un risultato non raggiunto è 没, e il complemento resta: 没看见, 没听懂, 没做完. 不看见 non si dice. Il 了 di completamento, se c'è, segue tutto il composto: 做完了. Impara questi tre come mattoni, poi riconoscerai lo stesso stampo in 吃完、找到、听清楚.",
    examples: [
      { zh: "我看见你了。", pinyin: "Wǒ kànjiàn nǐ le.", it: "Ti ho visto." },
      { zh: "你听懂了吗？", pinyin: "Nǐ tīngdǒng le ma?", it: "Hai capito (ascoltando)?" },
      { zh: "我还没做完。", pinyin: "Wǒ hái méi zuòwán.", it: "Non ho ancora finito." },
    ],
    after: ["看见", "懂", "完"],
    exercises: [
      order(
        "order",
        "Metti in ordine: «Ho finito i compiti».",
        ["我", "做完", "作业", "了"],
        [
          ["我", "做", "作业", "完"],
          ["我", "完", "做", "作业"],
          ["我", "没", "做完", "作业", "了"],
        ],
        "完 si salda al verbo. 了, se serve, chiude dopo l'oggetto o dopo il composto.",
      ),
      cloze(
        "cloze",
        "对不起，我没____。",
        "听懂",
        "对不起，我没听懂。",
        "Scusa, non ho capito.",
        ["听见", "看完", "听到"],
        "没 + verbo risultativo: l'esito non c'è stato. Qui l'esito è 懂, capire.",
      ),
      choice(
        "rule",
        "Quale negazione è corretta?",
        "我没看见他。",
        ["我看不见他了没。", "我不看见他。", "我看见不他。"],
        "没 nega il risultato e resta davanti all'intero verbo composto.",
      ),
    ],
  },
  {
    id: "grammar-kuaiyao",
    hskLevel: 2,
    title: "快要",
    pinyin: "kuàiyào",
    meaning: "Futuro imminente: 快要…了",
    grammarPattern: "Soggetto + 快要 + Verbo + 了",
    explanation:
      "快要…了 annuncia che qualcosa sta per succedere, non che è già successa. 快要下雨了, «sta per piovere»; 火车快要到了, «il treno sta per arrivare». 了 in fondo è il 了 del cambiamento: la situazione è sul punto di diventare un'altra. Non è il 了 attaccato al verbo di 我吃了. 快要 si può accorciare in 要…了 o 快…了, con la stessa cornice. Non usarlo per un piano lontano («l'anno prossimo andrò»): lì basta 要 o un complemento di tempo, senza questa coppia.",
    examples: [
      { zh: "快要下雨了。", pinyin: "Kuàiyào xià yǔ le.", it: "Sta per piovere." },
      { zh: "火车快要到了。", pinyin: "Huǒchē kuàiyào dào le.", it: "Il treno sta per arrivare." },
      { zh: "我快要毕业了。", pinyin: "Wǒ kuàiyào bìyè le.", it: "Sto per laurearmi." },
    ],
    after: ["快要"],
    exercises: [
      order(
        "order",
        "Metti in ordine: «Il treno sta per arrivare».",
        ["火车", "快要", "到", "了"],
        [
          ["火车", "到", "快要", "了"],
          ["快要", "火车", "了", "到"],
          ["火车", "快要", "了", "到"],
        ],
        "快要 precede il verbo e 了 chiude la frase.",
      ),
      cloze(
        "cloze",
        "电影快要开始____。",
        "了",
        "电影快要开始了。",
        "Il film sta per cominciare.",
        ["过", "的", "吗"],
        "Il 了 finale è obbligatorio in questo schema: segna il cambiamento imminente.",
      ),
      choice(
        "rule",
        "Che cosa comunica 快要…了?",
        "Un evento è imminente.",
        ["Un'azione è già finita ieri.", "Un confronto con 比.", "Un permesso con 可以."],
        "La cornice 快要 + verbo + 了 guarda avanti di poco, non indietro.",
      ),
    ],
  },
  {
    id: "grammar-keyi-neng",
    hskLevel: 2,
    title: "可以",
    pinyin: "kěyǐ",
    meaning: "Possibilità: 可以 e 能",
    grammarPattern: "Soggetto + 可以/能 + Verbo",
    explanation:
      "可以 (kěyǐ) e 能 (néng) si traducono entrambi «potere», ma non sono intercambiabili. 可以 chiede o concede permesso, e dice che una cosa è accettabile: 我可以进来吗？ «posso entrare?». 能 parla di capacità o di circostanze oggettive: 我能看见, «riesco a vedere»; 今天下雨，不能去, «piove, non si può andare». Entrambi precedono il verbo. 可以 si nega con 不可以 (divieto) o, più morbido, con 不能. 会 è un terzo verbo, «saper fare» un'abilità appresa (我会游泳), e non va confuso con questi due.",
    examples: [
      { zh: "我可以进来吗？", pinyin: "Wǒ kěyǐ jìnlái ma?", it: "Posso entrare?" },
      { zh: "我能看见山。", pinyin: "Wǒ néng kànjiàn shān.", it: "Riesco a vedere la montagna." },
      { zh: "这里不能停车。", pinyin: "Zhèlǐ bù néng tíng chē.", it: "Qui non si può parcheggiare." },
    ],
    after: ["可以", "能"],
    exercises: [
      order(
        "order",
        "Metti in ordine: «Posso entrare?».",
        ["我", "可以", "进来", "吗"],
        [
          ["我", "进来", "可以", "吗"],
          ["可以", "我", "进来", "吗"],
          ["我", "能", "可以", "进来"],
        ],
        "可以 sta prima del verbo di movimento; 吗 chiude la richiesta.",
      ),
      cloze(
        "cloze",
        "太黑了，我没____看见。",
        "能",
        "太黑了，我没能看见。",
        "Era troppo buio, non sono riuscito a vedere.",
        ["可以", "会", "要"],
        "能 è la capacità ostacolata dalle circostanze. 可以 sarebbe un permesso.",
      ),
      choice(
        "rule",
        "Quale frase chiede permesso?",
        "我可以坐这儿吗？",
        ["我能说中文。", "我会写汉字。", "我要坐这儿。"],
        "可以 + 吗 è la richiesta. 能 e 会 descrivono capacità; 要 è una volontà.",
      ),
    ],
  },
  {
    id: "grammar-ba",
    hskLevel: 3,
    title: "把",
    pinyin: "bǎ",
    meaning: "Costruzione con 把: disporre dell'oggetto",
    grammarPattern: "Soggetto + 把 + Oggetto + Verbo + Risultato",
    explanation:
      "把 (bǎ) tira l'oggetto davanti al verbo quando il verbo fa qualcosa a quell'oggetto: lo sposta, lo cambia, lo chiude, lo finisce. 我把书放在桌子上, «prendo il libro e lo metto sul tavolo». L'oggetto è specifico (il libro di cui parliamo, non «dei libri» in generale) e il verbo non può restare nudo: serve un risultato, una direzione o un 了. 我把书看 non si dice; 我把书看完了 sì. 把 non è il classificatore omonimo «manciata / manico»: qui è la preposizione di disposizione. La negazione e i verbi modali stanno prima di 把: 别把窗户打开, 我想把作业做完.",
    examples: [
      { zh: "我把书放在桌子上。", pinyin: "Wǒ bǎ shū fàng zài zhuōzi shàng.", it: "Metto il libro sul tavolo." },
      { zh: "请把门关上。", pinyin: "Qǐng bǎ mén guānshang.", it: "Per favore chiudi la porta." },
      { zh: "她把作业做完了。", pinyin: "Tā bǎ zuòyè zuòwán le.", it: "Ha finito i compiti." },
    ],
    after: ["把"],
    exercises: [
      order(
        "order",
        "Metti in ordine: «Metto il libro sul tavolo».",
        ["我", "把", "书", "放在桌子上"],
        [
          ["我", "放在桌子上", "把", "书"],
          ["我", "把", "放在桌子上", "书"],
          ["把", "我", "书", "放在桌子上"],
        ],
        "把 trascina l'oggetto prima del verbo, e il verbo porta già il risultato.",
      ),
      cloze(
        "cloze",
        "请____窗户打开。",
        "把",
        "请把窗户打开。",
        "Per favore apri la finestra.",
        ["被", "对", "给"],
        "把 introduce l'oggetto su cui agisci. 被 ribalterebbe la frase in passivo.",
      ),
      choice(
        "rule",
        "Quale frase con 把 è completa?",
        "我把水喝完了。",
        ["我把水喝。", "我喝把水完了。", "我把喝完水了。"],
        "L'oggetto segue 把 e il verbo deve avere un complemento (完了). Il verbo nudo non regge.",
      ),
    ],
  },
  {
    id: "grammar-bei",
    hskLevel: 3,
    title: "被",
    pinyin: "bèi",
    meaning: "Voce passiva con 被",
    grammarPattern: "Oggetto + 被 + Agente + Verbo + Risultato",
    explanation:
      "被 (bèi) ribalta la prospettiva: ciò che subisce l'azione diventa il soggetto grammaticale. 水杯被他打破了, «il bicchiere è stato rotto da lui». L'agente (他) può sparire se non importa o non si conosce: 书被拿走了. Come con 把, il verbo vuole un esito: 打破、拿走、看见. 被 tende verso l'effetto subito, spesso sgradito, anche se non è una regola assoluta. Non usarlo per tradurre ogni «essere» italiano: 我是学生 non diventa una frase con 被. La negazione sta prima di 被: 没被发现.",
    examples: [
      { zh: "水杯被他打破了。", pinyin: "Shuǐbēi bèi tā dǎpò le.", it: "Il bicchiere è stato rotto da lui." },
      { zh: "书被拿走了。", pinyin: "Shū bèi názǒu le.", it: "Il libro è stato portato via." },
      { zh: "我的自行车被偷了。", pinyin: "Wǒ de zìxíngchē bèi tōu le.", it: "Mi hanno rubato la bicicletta." },
    ],
    after: ["被"],
    exercises: [
      order(
        "order",
        "Metti in ordine: «Il libro è stato portato via».",
        ["书", "被", "拿走", "了"],
        [
          ["书", "拿走", "被", "了"],
          ["被", "书", "拿走", "了"],
          ["书", "把", "拿走", "了"],
        ],
        "Il paziente apre; 被 introduce chi compie l'azione, anche se qui l'agente è omesso.",
      ),
      cloze(
        "cloze",
        "蛋糕____弟弟吃完了。",
        "被",
        "蛋糕被弟弟吃完了。",
        "Il dolce è stato finito dal fratello minore.",
        ["把", "让", "对"],
        "被 segnala che 蛋糕 subisce l'azione. 把 metterebbe 蛋糕 dopo, non prima.",
      ),
      choice(
        "rule",
        "Quando l'agente non si conosce, che cosa è accettabile?",
        "门被打开了。",
        ["门被打开。", "被门打开了。", "门把打开了。"],
        "L'agente si omette e il verbo tiene il risultato. Senza complemento la frase con 被 resta zoppa.",
      ),
    ],
  },
  {
    id: "grammar-budan",
    hskLevel: 3,
    title: "不但",
    pinyin: "búdàn",
    meaning: "Correlazione: non solo… ma anche…",
    grammarPattern: "Soggetto + 不但 + A + 而且 + B",
    explanation:
      "不但…而且… (búdàn… érqiě…) aggiunge un secondo fatto nella stessa direzione, di solito più forte del primo. «Non solo… ma anche…». 他不但会说中文，而且会写汉字. Se il soggetto è lo stesso, sta prima di 不但 e non si ripete. Se i soggetti cambiano, ognuno sta nella sua metà: 不但他来，而且我也来. 而且 non va messo da solo all'inizio di questa coppia e non si scambia l'ordine delle due parti: la prima è la base, la seconda è l'aggiunta. È diverso da 虽然…但是…, che contrappone invece di sommare.",
    examples: [
      { zh: "他不但会说中文，而且会写汉字。", pinyin: "Tā búdàn huì shuō Zhōngwén, érqiě huì xiě Hànzì.", it: "Non solo sa parlare cinese, ma sa anche scrivere i caratteri." },
      { zh: "这家店不但便宜，而且很好。", pinyin: "Zhè jiā diàn búdàn piányi, érqiě hěn hǎo.", it: "Questo negozio non solo è economico, ma è anche buono." },
      { zh: "不但我去，而且他也去。", pinyin: "Búdàn wǒ qù, érqiě tā yě qù.", it: "Non solo ci vado io, ma ci va anche lui." },
    ],
    after: ["不但", "而且"],
    exercises: [
      order(
        "order",
        "Metti in ordine: «Non solo è economico, ma è anche vicino».",
        ["不但", "便宜", "而且", "很近"],
        [
          ["而且", "便宜", "不但", "很近"],
          ["不但", "而且", "便宜", "很近"],
          ["便宜", "不但", "很近", "而且"],
        ],
        "不但 apre il primo pregio, 而且 il secondo. Non si invertono.",
      ),
      cloze(
        "cloze",
        "她____会唱歌，而且会跳舞。",
        "不但",
        "她不但会唱歌，而且会跳舞。",
        "Non solo sa cantare, ma sa anche ballare.",
        ["虽然", "如果", "除了"],
        "不但 prepara un'aggiunta. 虽然 preparerebbe un contrasto con 但是.",
      ),
      choice(
        "rule",
        "Se il soggetto è uno solo, dove sta?",
        "Prima di 不但, e non si ripete.",
        ["Dopo 而且, una volta sola.", "Sia prima di 不但 sia prima di 而且.", "Solo in fondo alla frase."],
        "他不但…而且… Il soggetto condiviso sta una volta sola, davanti alla coppia.",
      ),
    ],
  },
  {
    id: "grammar-yue",
    hskLevel: 3,
    title: "越",
    pinyin: "yuè",
    meaning: "Progressione: più… più…",
    grammarPattern: "Soggetto + 越 + A + 越 + B",
    explanation:
      "越…越… (yuè… yuè…) lega due variazioni che crescono insieme. «Più… più…». 他越跑越快, «più corre, più va veloce»; 雨越下越大, «più piove, più viene giù forte». Il soggetto sta prima del primo 越. La forma fissa 越来越 dice che qualcosa aumenta col passare del tempo, senza nominare la causa: 天气越来越冷, «fa sempre più freddo». Non si mette 很 dentro lo schema e non si usa 比. 越 da solo, fuori da questa coppia, può voler dire «superare», ma qui conta la correlazione doppia.",
    examples: [
      { zh: "他越跑越快。", pinyin: "Tā yuè pǎo yuè kuài.", it: "Più corre, più è veloce." },
      { zh: "天气越来越冷。", pinyin: "Tiānqì yuè lái yuè lěng.", it: "Fa sempre più freddo." },
      { zh: "我越学越喜欢中文。", pinyin: "Wǒ yuè xué yuè xǐhuan Zhōngwén.", it: "Più lo studio, più mi piace il cinese." },
    ],
    after: ["越"],
    exercises: [
      order(
        "order",
        "Metti in ordine: «Fa sempre più freddo».",
        ["天气", "越来越", "冷"],
        [
          ["天气", "很", "越来越", "冷"],
          ["越来越", "天气", "冷"],
          ["天气", "比", "越来越", "冷"],
        ],
        "越来越 sta tra il tema e l'aggettivo. 很 e 比 non entrano.",
      ),
      cloze(
        "cloze",
        "他____跑____快。",
        "越",
        "他越跑越快。",
        "Più corre, più è veloce.",
        ["很", "比", "更"],
        "I due spazi vogliono la stessa parola, 越. È la correlazione, non un comparativo con 比.",
      ),
      choice(
        "rule",
        "Che cosa aggiunge 越来越 rispetto a 越…越…?",
        "La variazione nel tempo, senza dire la causa.",
        ["Un confronto tra due persone.", "Una condizione con 如果.", "Un permesso con 可以."],
        "越来越 + aggettivo descrive una tendenza. Non serve nominare l'altra metà.",
      ),
    ],
  },
  {
    id: "grammar-chule",
    hskLevel: 3,
    title: "除了",
    pinyin: "chúle",
    meaning: "Eccezione e inclusione: 除了…以外",
    grammarPattern: "除了 + X + 以外 + Frase",
    explanation:
      "除了…以外… (chúle… yǐwài…) mette da parte un elemento e poi dice che cosa succede al resto. Il senso della seconda frase lo decide l'avverbio. Con 都 (o 全) è un'eccezione: 除了咖啡以外，我都不喝, «a parte il caffè, non bevo niente». Con 还 (o 也) è un'aggiunta: 除了咖啡以外，我还喝茶, «oltre al caffè, bevo anche il tè». 以外 si può omettere nel parlato, ma all'inizio tienilo: rende visibile il confine di X. X può essere un nome o una frase intera. Non scambiare 还 e 都: ribaltano il significato.",
    examples: [
      { zh: "除了咖啡以外，我还喝茶。", pinyin: "Chúle kāfēi yǐwài, wǒ hái hē chá.", it: "Oltre al caffè, bevo anche il tè." },
      { zh: "除了我以外，他们都去。", pinyin: "Chúle wǒ yǐwài, tāmen dōu qù.", it: "A parte me, ci vanno tutti." },
      { zh: "除了星期天以外，他每天工作。", pinyin: "Chúle xīngqītiān yǐwài, tā měitiān gōngzuò.", it: "Tranne la domenica, lavora ogni giorno." },
    ],
    after: ["除了", "以外"],
    exercises: [
      order(
        "order",
        "Metti in ordine: «A parte me, ci vanno tutti».",
        ["除了", "我", "以外", "他们都去"],
        [
          ["我", "除了", "以外", "他们都去"],
          ["除了", "以外", "我", "他们都去"],
          ["他们都去", "除了", "我", "以外"],
        ],
        "除了 apre l'elemento escluso; 以外 lo chiude; poi arriva la frase sul resto.",
      ),
      cloze(
        "cloze",
        "____中文以外，她还会日语。",
        "除了",
        "除了中文以外，她还会日语。",
        "Oltre al cinese, sa anche il giapponese.",
        ["为了", "关于", "根据"],
        "除了…以外 isola 中文. 还 nella seconda parte segnala l'aggiunta.",
      ),
      choice(
        "rule",
        "Nella seconda frase, 都 che cosa fa?",
        "Dice che tutti gli altri seguono la stessa sorte: è un'eccezione.",
        ["Aggiunge un elemento in più, come 还.", "Introduce il comparativo.", "Negare il verbo 是."],
        "都 generalizza sul resto (eccezione). 还 aggiunge (inclusione).",
      ),
    ],
  },
  {
    id: "grammar-ruguo",
    hskLevel: 3,
    title: "如果",
    pinyin: "rúguǒ",
    meaning: "Condizionale: 如果…就…",
    grammarPattern: "如果 + Condizione + Soggetto + 就 + Risultato",
    explanation:
      "如果…就… (rúguǒ… jiù…) è il «se… allora…». 如果 apre l'ipotesi; 就, nella frase principale, introduce la conseguenza e sta dopo il soggetto di quella frase. 如果明天下雨，我就不去, «se domani piove, allora non ci vado». Il soggetto della conseguenza può essere diverso: 如果你有时间，我们就见面. 就 non si sposta davanti al soggetto e non sostituisce 如果. Nel parlato 如果 può cadere e restare solo 就, ma in questo nodo tienili entrambi, così la cerniera si vede. Non è 虽然…但是…: lì il fatto è già vero e si contrappone, qui è ipotetico.",
    examples: [
      { zh: "如果明天下雨，我就不去。", pinyin: "Rúguǒ míngtiān xià yǔ, wǒ jiù bú qù.", it: "Se domani piove, non ci vado." },
      { zh: "如果你有时间，我们就见面。", pinyin: "Rúguǒ nǐ yǒu shíjiān, wǒmen jiù jiànmiàn.", it: "Se hai tempo, ci vediamo." },
      { zh: "如果太贵，我就不买了。", pinyin: "Rúguǒ tài guì, wǒ jiù bù mǎi le.", it: "Se è troppo caro, non lo compro." },
    ],
    after: ["如果", "就"],
    exercises: [
      order(
        "order",
        "Metti in ordine: «Se hai tempo, allora ci vediamo».",
        ["如果", "你有时间", "我们", "就", "见面"],
        [
          ["如果", "就", "你有时间", "我们", "见面"],
          ["你有时间", "如果", "就", "我们", "见面"],
          ["我们", "如果", "就", "你有时间", "见面"],
        ],
        "如果 regge l'ipotesi. Nella principale il soggetto precede 就.",
      ),
      cloze(
        "cloze",
        "____太晚了，我就坐出租车。",
        "如果",
        "如果太晚了，我就坐出租车。",
        "Se si fa troppo tardi, prendo un taxi.",
        ["虽然", "因为", "除了"],
        "如果 apre la condizione. 因为 aprirebbe una causa già data, non un'ipotesi.",
      ),
      choice(
        "rule",
        "Dove sta 就 nella conseguenza?",
        "Dopo il soggetto della frase principale.",
        ["Prima di 如果.", "In fondo, al posto di 了.", "Davanti a tutti e due i soggetti."],
        "我就不去: 就 è un avverbio e segue il soggetto di cui predica.",
      ),
    ],
  },
  {
    id: "grammar-direction",
    hskLevel: 3,
    title: "进来",
    pinyin: "jìnlái",
    meaning: "Direzione composta: 进来、出去、回来",
    grammarPattern: "Verbo + Direzione (来/去)",
    explanation:
      "I complementi di direzione dicono verso dove si muove l'azione, rispetto a chi parla. Il primo carattere è il verso: 进 entrare, 出 uscire, 回 tornare. Il secondo è il punto di vista: 来 verso di me, 去 lontano da me. 进来 «entra (qui da me)», 出去 «esci (via da qui)», 回来 «torna qui». Si attaccano anche a un verbo di modo: 走进来, 跑出去, 拿回来. 请进来 è un invito verso chi parla; a una persona già in casa che deve andare in cucina dici 进去, non 进来. Il 了 di cambiamento può chiudere: 他回来了, «è tornato (adesso è qui)».",
    examples: [
      { zh: "请进来。", pinyin: "Qǐng jìnlái.", it: "Entra pure." },
      { zh: "他跑出去了。", pinyin: "Tā pǎo chūqù le.", it: "È corso fuori." },
      { zh: "你什么时候回来？", pinyin: "Nǐ shénme shíhou huílái?", it: "Quando torni?" },
    ],
    after: ["进来", "出去", "回来"],
    exercises: [
      order(
        "order",
        "Metti in ordine: «È corso fuori».",
        ["他", "跑", "出去", "了"],
        [
          ["他", "出去", "跑", "了"],
          ["他", "跑", "进来", "了"],
          ["跑", "他", "出去", "了"],
        ],
        "Il verbo di modo precede la direzione. 出去 allontana da chi parla; 进来 avvicina.",
      ),
      cloze(
        "cloze",
        "外面冷，你快____吧。",
        "进来",
        "外面冷，你快进来吧。",
        "Fuori fa freddo, entra.",
        ["出去", "回来", "起来"],
        "L'invito è verso chi parla, quindi 来 e non 去. 出去 manderebbe la persona al freddo.",
      ),
      choice(
        "rule",
        "Sei in casa e vuoi che un amico torni da te. Quale complemento usi?",
        "回来",
        ["回去", "出去", "进来"],
        "回 è «tornare» e 来 è «verso di me». 回去 sarebbe «tornare laggiù», lontano da te.",
      ),
    ],
  },
];
