/**
 * Modello dati di ChineseMaster.
 *
 * Il curriculum è modellato come un grafo di `LearningNode` collegati tramite
 * `prerequisites`. Lo stato di avanzamento dell'utente è tenuto separato nei
 * `NodeProgress`, così da poter sostituire facilmente il layer di persistenza
 * (vedi `src/services/storage.ts`) senza toccare i contenuti.
 */

/** Tipologia di contenuto di un nodo del curriculum. */
export type NodeType = "radical" | "hanzi" | "grammar" | "vocab";

/** Tipologia di esercizio proposto all'interno di un nodo. */
export type ExerciseType =
  | "multiple_choice"
  | "pinyin_match"
  | "sentence_order"
  | "stroke_order"
  | "cloze"
  | "listening"
  | "tone_builder"
  | "visual_contrast";

/** Un singolo esercizio di verifica della padronanza. */
export interface Exercise {
  id: string;
  type: ExerciseType;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation?: string;
  /**
   * Testo da pronunciare. Nell'ascolto è l'hanzi del nodo (la domanda non lo
   * mostra). Nel cloze è la frase completa, letta solo dopo la risposta.
   */
  audioText?: string;
  /** Traduzione o contesto della frase, mostrato nel cloze. */
  context?: string;
  /**
   * Sillabe senza tono, in ordine. Obbligatorie per `tone_builder`
   * (es. `["ni", "hao"]`). `correctAnswer` è la sequenza di toni
   * `"3-3"`: 1, 2, 3, 4 oppure 5 per il tono neutro.
   */
  syllables?: string[];
}

/** Esempio d'uso reale: cinese, pinyin e traduzione in italiano. */
export interface Example {
  zh: string;
  pinyin: string;
  it: string;
}

/** Un nodo del curriculum (radicale, hanzi, grammatica o vocabolo). */
export interface LearningNode {
  id: string;
  type: NodeType;
  hskLevel: number;
  orderIndex: number;
  title: string;
  /** Forma tradizionale, quando è nota. */
  traditional?: string;
  pinyin?: string;
  meaning: string;
  explanation: string;
  examples: Example[];
  exercises: Exercise[];
  prerequisites: string[];
  /** Unità didattica. `0` è il modulo introduttivo. */
  unit?: number;
  /** Titolo dell'unità, es. "HSK 1 · Unità 1: I Mattoni Fondamentali (学 · 上 · 天 · 一)". */
  unitTitle?: string;
  /** Formula sintattica visiva, es. "Soggetto + 很 + Aggettivo". */
  grammarPattern?: string;
  /** Nodo finale che ripassa l'unità con esercizi ad alto attrito. */
  isUnitChallenge?: boolean;
}

/** Stato di avanzamento dell'utente per un singolo nodo. */
export interface NodeProgress {
  nodeId: string;
  status: "locked" | "unlocked" | "mastered";
  masteryScore: number;
  streak: number;
  nextReviewAt: string | null;
  updatedAt: string;
  /**
   * Giorni fino al ripasso successivo. Scala: 1, 3, 7, 15, 30.
   * Facoltativo: i salvataggi precedenti all'SRS restano validi.
   */
  srsInterval?: number;
  /**
   * 0 = non ancora entrato in ripasso, 1–5 = livelli di consolidamento.
   * Facoltativo, per la stessa retrocompatibilità.
   */
  srsStage?: number;
}
