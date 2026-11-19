import { CURRICULUM } from "@/data/curriculum";
import type { LearningNode, NodeProgress } from "@/types/learning";

/**
 * Storage adapter di ChineseMaster.
 *
 * Questo è l'UNICO file che conosce *dove* vengono salvati i progressi.
 * Oggi usa `localStorage` (per il funzionamento 100% offline della PWA), ma
 * espone un'API completamente asincrona basata su `Promise`: quando in futuro
 * passeremo a un database remoto (es. Supabase/Firestore/API REST), basterà
 * riscrivere l'implementazione di questi metodi senza toccare UI e logica.
 */

const STORAGE_KEY = "chinesemaster.progress.v1";

/** Stati ammessi per un nodo (usato anche in fase di validazione import). */
const VALID_STATUSES: ReadonlyArray<NodeProgress["status"]> = [
  "locked",
  "unlocked",
  "mastered",
];

/** Soglia di streak oltre la quale un nodo è considerato padroneggiato.
 *  Per questo prototipo basta 1 risposta corretta "piena". */
const MASTERY_STREAK_THRESHOLD = 1;

/** Giorni di attesa per gli stadi SRS 1 → 5. */
const SRS_INTERVAL_DAYS = [1, 3, 7, 15, 30] as const;

const DAY_MS = 24 * 60 * 60 * 1000;

function scheduleReview(stage: number): Pick<NodeProgress, "srsStage" | "srsInterval" | "nextReviewAt"> {
  const srsStage = Math.min(SRS_INTERVAL_DAYS.length, Math.max(1, stage));
  const srsInterval = SRS_INTERVAL_DAYS[srsStage - 1];
  return {
    srsStage,
    srsInterval,
    nextReviewAt: new Date(Date.now() + srsInterval * DAY_MS).toISOString(),
  };
}

type ProgressMap = Record<string, NodeProgress>;

/** True solo lato client: evita crash durante lo static export / SSR. */
function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function nowISO(): string {
  return new Date().toISOString();
}

/** Progresso di default per un singolo nodo: sbloccato se non ha prerequisiti. */
function defaultProgressForNode(node: LearningNode): NodeProgress {
  return {
    nodeId: node.id,
    status: node.prerequisites.length === 0 ? "unlocked" : "locked",
    masteryScore: 0,
    streak: 0,
    nextReviewAt: null,
    updatedAt: nowISO(),
  };
}

/** Costruisce la mappa di progresso iniziale per l'intero curriculum. */
function buildInitialProgress(): ProgressMap {
  const map: ProgressMap = {};
  for (const node of CURRICULUM) {
    map[node.id] = defaultProgressForNode(node);
  }
  return map;
}

/**
 * Garantisce che ogni nodo del curriculum abbia una voce di progresso.
 * Utile quando il curriculum cresce dopo che l'utente ha già dei salvataggi.
 * Ritorna `true` se ha aggiunto qualcosa.
 */
function ensureAllNodesPresent(map: ProgressMap): boolean {
  let changed = false;
  for (const node of CURRICULUM) {
    if (!map[node.id]) {
      map[node.id] = defaultProgressForNode(node);
      changed = true;
    }
  }
  return changed;
}

/** Legge la mappa grezza dal localStorage (o `null` se assente/corrotta). */
function readRaw(): ProgressMap | null {
  if (!isBrowser()) return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return parsed as ProgressMap;
    }
    return null;
  } catch {
    return null;
  }
}

/** Scrive la mappa nel localStorage (no-op durante export statico/SSR). */
function writeRaw(map: ProgressMap): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

/**
 * Applica lo sblocco a cascata: ogni nodo ancora `locked` i cui prerequisiti
 * sono TUTTI `mastered` passa a `unlocked`. Itera finché non ci sono più
 * cambiamenti (così una catena lunga si sblocca in un colpo solo).
 * Muta `map` e ritorna `true` se qualcosa è cambiato.
 */
function applyCascadeUnlock(map: ProgressMap): boolean {
  let changedAtAll = false;
  let changedThisPass = true;

  while (changedThisPass) {
    changedThisPass = false;
    for (const node of CURRICULUM) {
      const progress = map[node.id];
      if (!progress || progress.status !== "locked") continue;

      const allPrereqsMastered =
        node.prerequisites.length > 0 &&
        node.prerequisites.every((prereqId) => map[prereqId]?.status === "mastered");

      if (allPrereqsMastered) {
        progress.status = "unlocked";
        progress.updatedAt = nowISO();
        changedThisPass = true;
        changedAtAll = true;
      }
    }
  }

  return changedAtAll;
}

/** Validazione minima ma robusta di una mappa di progresso importata. */
function isValidProgressMap(value: unknown): value is ProgressMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;

  for (const entry of Object.values(value as Record<string, unknown>)) {
    if (!entry || typeof entry !== "object") return false;
    const p = entry as Partial<NodeProgress>;
    if (typeof p.nodeId !== "string") return false;
    if (typeof p.status !== "string" || !VALID_STATUSES.includes(p.status as NodeProgress["status"])) {
      return false;
    }
    if (typeof p.masteryScore !== "number") return false;
    if (typeof p.streak !== "number") return false;
    if (!(p.nextReviewAt === null || typeof p.nextReviewAt === "string")) return false;
    if (typeof p.updatedAt !== "string") return false;
    if (p.srsInterval !== undefined && typeof p.srsInterval !== "number") return false;
    if (p.srsStage !== undefined && typeof p.srsStage !== "number") return false;
  }
  return true;
}

export const storage = {
  /**
   * Ritorna tutti i progressi. Alla prima chiamata (o se mancano nodi)
   * inizializza automaticamente: nodi senza prerequisiti = `unlocked`,
   * tutti gli altri = `locked`. Persiste eventuali inizializzazioni.
   */
  async getAllProgress(): Promise<ProgressMap> {
    const existing = readRaw();

    if (!existing) {
      const fresh = buildInitialProgress();
      // Applica subito l'eventuale cascata (nel caso di curriculum senza
      // radici multiple resta comunque coerente).
      applyCascadeUnlock(fresh);
      writeRaw(fresh);
      return fresh;
    }

    const addedMissing = ensureAllNodesPresent(existing);
    const cascaded = applyCascadeUnlock(existing);
    if (addedMissing || cascaded) {
      writeRaw(existing);
    }
    return existing;
  },

  /**
   * Registra un tentativo su un nodo e aggiorna lo stato.
   * - `passed === true`  → streak +1, masteryScore cresce; se streak ≥ soglia
   *   il nodo diventa `mastered` e scatta lo sblocco a cascata dei successivi.
   *   Alla prima padronanza parte l'SRS: stadio 1, intervallo 1 giorno.
   * - `passed === false` → streak azzerato, masteryScore ridotto, nessun downgrade
   *   di uno stato già `mastered` (la padronanza, una volta ottenuta, resta).
   * I ripassi successivi non riprogrammano l'SRS: lo fa `recordReviewOutcome`.
   * Ritorna la mappa aggiornata.
   */
  async saveNodeAttempt(nodeId: string, passed: boolean): Promise<ProgressMap> {
    const map = await this.getAllProgress();
    const current = map[nodeId];

    // Nodo sconosciuto: nessun effetto, ritorna lo stato corrente.
    if (!current) return map;

    if (passed) {
      const wasMastered = current.status === "mastered";
      current.streak += 1;
      current.masteryScore = Math.min(100, current.masteryScore + 50);
      if (current.streak >= MASTERY_STREAK_THRESHOLD) {
        current.status = "mastered";
        if (!wasMastered) {
          const first = scheduleReview(1);
          current.srsStage = first.srsStage;
          current.srsInterval = first.srsInterval;
          current.nextReviewAt = first.nextReviewAt;
        }
      }
    } else {
      current.streak = 0;
      current.masteryScore = Math.max(0, current.masteryScore - 25);
      // Non si retrocede da 'mastered': si conserva la padronanza acquisita.
    }

    current.updatedAt = nowISO();

    // Un nuovo 'mastered' può sbloccare i nodi successivi.
    applyCascadeUnlock(map);

    writeRaw(map);
    return map;
  },

  /** Esporta i progressi come stringa JSON formattata (per backup/condivisione). */
  async exportProgressJSON(): Promise<string> {
    const map = await this.getAllProgress();
    return JSON.stringify(map, null, 2);
  },

  /**
   * Importa e SOVRASCRIVE i progressi a partire da una stringa JSON.
   * Valida la struttura prima di scrivere. Ritorna `true` se l'import è andato
   * a buon fine, `false` se il JSON è invalido.
   */
  async importProgressJSON(jsonString: string): Promise<boolean> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonString);
    } catch {
      return false;
    }

    if (!isValidProgressMap(parsed)) return false;

    const map = parsed as ProgressMap;
    // Mantiene la coerenza con il curriculum attuale.
    ensureAllNodesPresent(map);
    applyCascadeUnlock(map);
    writeRaw(map);
    return true;
  },

  /**
   * Esito di un nodo nel ripasso.
   * Senza errori si sale di stadio (1 → 3 → 7 → 15 → 30 giorni, massimo 30).
   * Con errori si torna allo stadio 1 e il ripasso è tra 24 ore.
   * Non tocca lo status `mastered`.
   */
  async recordReviewOutcome(nodeId: string, hadMistakes: boolean): Promise<ProgressMap> {
    const map = await this.getAllProgress();
    const current = map[nodeId];
    if (!current || current.status !== "mastered") return map;

    const knownStage = current.srsStage && current.srsStage > 0 ? current.srsStage : 1;
    const scheduled = scheduleReview(hadMistakes ? 1 : knownStage + 1);
    current.srsStage = scheduled.srsStage;
    current.srsInterval = scheduled.srsInterval;
    current.nextReviewAt = scheduled.nextReviewAt;
    current.updatedAt = nowISO();
    writeRaw(map);
    return map;
  },

  /** Azzera completamente i progressi (riparte dall'inizializzazione). */
  async resetProgress(): Promise<void> {
    if (!isBrowser()) return;
    window.localStorage.removeItem(STORAGE_KEY);
  },
};

/**
 * Nodi già padroneggiati il cui ripasso è scaduto, dal più in ritardo.
 * I salvataggi senza `nextReviewAt` non entrano in coda: non si inventa una scadenza.
 */
export function getDueReviewNodes(
  curriculum: readonly LearningNode[],
  progress: ProgressMap,
): LearningNode[] {
  const now = Date.now();
  return curriculum
    .filter((node) => {
      const entry = progress[node.id];
      if (!entry || entry.status !== "mastered" || !entry.nextReviewAt) return false;
      const dueAt = Date.parse(entry.nextReviewAt);
      return Number.isFinite(dueAt) && dueAt <= now;
    })
    .sort((a, b) => {
      const aDue = Date.parse(progress[a.id]?.nextReviewAt ?? "") || 0;
      const bDue = Date.parse(progress[b.id]?.nextReviewAt ?? "") || 0;
      if (aDue !== bDue) return aDue - bDue;
      return a.orderIndex - b.orderIndex;
    });
}

export async function recordReviewOutcome(
  nodeId: string,
  hadMistakes: boolean,
): Promise<ProgressMap> {
  return storage.recordReviewOutcome(nodeId, hadMistakes);
}

export type { ProgressMap };
