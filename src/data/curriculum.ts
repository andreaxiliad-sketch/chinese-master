import type { LearningNode } from "@/types/learning";
import generated from "./generated-curriculum.json";

/**
 * Curriculum di ChineseMaster.
 *
 * Prodotto da `node scripts/import-hsk.mjs`: il Modulo 0 (Unità 0: Primi Passi)
 * più il grafo HSK 1 → HSK 2 → HSK 3. `orderIndex` è l'ordine di presentazione;
 * `prerequisites` è il grafo di sblocco mastery-based.
 */
export const CURRICULUM = generated as unknown as LearningNode[];
