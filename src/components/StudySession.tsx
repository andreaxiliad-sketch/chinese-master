"use client";

import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { Check, Volume2, X } from "lucide-react";

import { HanziCanvas } from "@/components/HanziCanvas";
import { CURRICULUM } from "@/data/curriculum";
import { storage, type ProgressMap } from "@/services/storage";
import type {
  Exercise,
  ExerciseType,
  LearningNode,
  NodeType,
} from "@/types/learning";
import { speakChinese } from "@/utils/speech";

const NODE_TYPE_LABEL: Record<NodeType, string> = {
  radical: "Radicale",
  hanzi: "Hanzi",
  grammar: "Grammatica",
  vocab: "Vocabolo",
};

const NODE_TYPE_BADGE: Record<NodeType, string> = {
  radical: "bg-amber-100 text-amber-800",
  hanzi: "bg-sky-100 text-sky-800",
  grammar: "bg-violet-100 text-violet-800",
  vocab: "bg-emerald-100 text-emerald-800",
};

const EXERCISE_LABEL: Record<ExerciseType, string> = {
  multiple_choice: "Scelta multipla",
  pinyin_match: "Abbina il pinyin",
  sentence_order: "Ordina la frase",
  stroke_order: "Ordine dei tratti",
  cloze: "Completa la frase",
  listening: "Ascolto",
  tone_builder: "Toni",
  visual_contrast: "Contrasto visivo",
};

const TONE_CHOICES: ReadonlyArray<{ id: number; label: string }> = [
  { id: 1, label: "1" },
  { id: 2, label: "2" },
  { id: 3, label: "3" },
  { id: 4, label: "4" },
  { id: 5, label: "·" },
];

const CHOICE_TYPES = new Set<ExerciseType>([
  "multiple_choice",
  "pinyin_match",
  "listening",
  "cloze",
]);

/** Primo nodo (radicale o hanzi) che insegna ciascun carattere singolo. */
const CHARACTER_BRICKS = new Map<string, LearningNode>();
for (const item of [...CURRICULUM].sort((a, b) => a.orderIndex - b.orderIndex)) {
  if ([...item.title].length === 1 && !CHARACTER_BRICKS.has(item.title)) {
    CHARACTER_BRICKS.set(item.title, item);
  }
}

function wordBricks(title: string): Array<{ char: string; source?: LearningNode }> {
  const chars = [...title].filter((char) => /\p{Script=Han}/u.test(char));
  if (chars.length < 2) return [];
  return chars.map((char) => ({ char, source: CHARACTER_BRICKS.get(char) }));
}

type Phase = "theory" | "quiz" | "done";

type Feedback = {
  correct: boolean;
  selected: string;
};

type Piece = {
  id: string;
  text: string;
};

export function StudySession({
  node,
  onClose,
  onProgressChange,
}: {
  node: LearningNode;
  onClose: () => void;
  onProgressChange: (progress: ProgressMap) => void;
}) {
  const total = node.exercises.length;
  const [phase, setPhase] = useState<Phase>("theory");
  const [queue, setQueue] = useState<Exercise[]>(() => [...node.exercises]);
  const [cleared, setCleared] = useState(0);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [bank, setBank] = useState<Piece[]>([]);
  const [picked, setPicked] = useState<Piece[]>([]);
  const [tones, setTones] = useState<Array<number | null>>([]);
  const [promptKey, setPromptKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [newlyUnlocked, setNewlyUnlocked] = useState<LearningNode[]>([]);

  const savedRef = useRef(false);
  const aliveRef = useRef(true);
  const advancingRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);

  const current = queue[0];
  const expectedTokens = current ? tokensOf(current.correctAnswer) : [];
  const orderReady =
    current?.type === "sentence_order" && picked.length === expectedTokens.length;
  const toneReady =
    current?.type === "tone_builder" &&
    tones.length > 0 &&
    tones.every((tone) => tone !== null);

  const progress =
    phase === "done"
      ? 1
      : phase === "theory" || total === 0
        ? 0.06
        : Math.min(1, cleared / total);

  useEffect(() => {
    aliveRef.current = true;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      aliveRef.current = false;
      document.body.style.overflow = previousOverflow;
      cancelSpeech();
    };
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !saving) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, saving]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
    advancingRef.current = false;
  }, [phase, promptKey]);

  useEffect(() => {
    if (!feedback) return;
    feedbackRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [feedback]);

  useEffect(() => {
    if (phase !== "quiz" || !feedback?.correct || current?.type !== "stroke_order") return;
    const timer = window.setTimeout(() => {
      handleContinue();
    }, 900);
    return () => window.clearTimeout(timer);
    // handleContinue legge lo stato di questo render; il timer va azzerato solo se cambia l'esito.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, feedback, current]);

  function beginQuiz() {
    cancelSpeech();
    const initial = [...node.exercises];
    setCleared(0);
    setSaveError(null);
    if (initial.length === 0) {
      setQueue([]);
      void completeSession();
      return;
    }
    revealPrompt(initial);
    setPhase("quiz");
  }

  function revealPrompt(nextQueue: Exercise[]) {
    cancelSpeech();
    setQueue(nextQueue);
    setFeedback(null);
    prepareComposer(nextQueue[0]);
    setPromptKey((value) => value + 1);
  }

  function prepareComposer(exercise: Exercise | undefined) {
    if (exercise?.type === "sentence_order") {
      const pieces = shuffle(tokenPool(exercise)).map((text, index) => ({
        id: `${exercise.id}-${promptSalt()}-${index}`,
        text,
      }));
      setBank(pieces);
    } else {
      setBank([]);
    }
    setPicked([]);
    setTones(exercise?.type === "tone_builder" ? (exercise.syllables ?? []).map(() => null) : []);
  }

  function lockAnswer(correct: boolean, selected: string) {
    if (feedback || saving) return;
    setFeedback({ correct, selected });
    if (correct) setCleared((count) => count + 1);
  }

  function handleOption(option: string) {
    if (!current || feedback || saving) return;
    lockAnswer(option === current.correctAnswer, option);
  }

  function handleConfirmOrder() {
    if (!current || feedback || saving || !orderReady) return;
    const attempt = picked.map((piece) => piece.text).join(" → ");
    lockAnswer(attempt === expectedTokens.join(" → "), attempt);
  }

  function handleConfirmTones() {
    if (!current || feedback || saving || !toneReady) return;
    const attempt = tones.join("-");
    lockAnswer(attempt === current.correctAnswer, attempt);
  }

  function setTone(index: number, tone: number) {
    if (feedback || saving) return;
    setTones((currentTones) => currentTones.map((value, toneIndex) => (toneIndex === index ? tone : value)));
  }

  function takePiece(piece: Piece) {
    if (feedback || saving) return;
    setBank((items) => items.filter((item) => item.id !== piece.id));
    setPicked((items) => [...items, piece]);
  }

  function returnPiece(piece: Piece) {
    if (feedback || saving) return;
    setPicked((items) => items.filter((item) => item.id !== piece.id));
    setBank((items) => [...items, piece]);
  }

  function handleStrokeComplete(result?: { skipped?: boolean }) {
    if (!current || current.type !== "stroke_order" || feedback || saving) return;
    lockAnswer(true, result?.skipped ? "__skip__" : current.correctAnswer);
  }

  function handleContinue() {
    if (advancingRef.current) return;
    if (!feedback || saving || !current) return;
    advancingRef.current = true;

    if (feedback.correct) {
      const rest = queue.slice(1);
      if (rest.length === 0) {
        void completeSession();
        return;
      }
      revealPrompt(rest);
      return;
    }

    revealPrompt([...queue.slice(1), current]);
  }

  async function completeSession() {
    if (savedRef.current) return;
    savedRef.current = true;
    setSaving(true);
    setSaveError(null);

    try {
      const before = await storage.getAllProgress();
      const previousStatus = new Map(
        Object.entries(before).map(([id, entry]) => [id, entry.status] as const),
      );
      const updated = await storage.saveNodeAttempt(node.id, true);
      const unlocked = CURRICULUM.filter((item) => {
        const prev = previousStatus.get(item.id);
        const next = updated[item.id]?.status;
        return prev === "locked" && next === "unlocked";
      }).sort((a, b) => a.orderIndex - b.orderIndex);

      onProgressChange(updated);
      if (!aliveRef.current) return;
      setNewlyUnlocked(unlocked);
      setPhase("done");
    } catch {
      savedRef.current = false;
      advancingRef.current = false;
      if (!aliveRef.current) return;
      setSaveError("Salvataggio non riuscito. Premi Continua per riprovare.");
    } finally {
      if (aliveRef.current) setSaving(false);
    }
  }

  const stepLabel =
    phase === "theory"
      ? "1 · Decodifica"
      : phase === "quiz"
        ? "2 · Prova di padronanza"
        : "Completato";

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="study-session-title"
    >
      <div
        ref={scrollRef}
        className="h-full overflow-y-auto overscroll-contain"
      >
        <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 pb-32">
          <header
            className="sticky top-0 z-10 -mx-4 bg-slate-50/95 px-4 pb-3 backdrop-blur"
            style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}
          >
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="mb-1.5 flex items-center justify-between text-xs font-medium text-slate-500">
                  <span>{stepLabel}</span>
                  {phase === "quiz" && total > 0 && (
                    <span>
                      {Math.min(cleared, total)}/{total} corretti
                    </span>
                  )}
                </div>
                <div
                  className="h-1.5 overflow-hidden rounded-full bg-slate-200"
                  role="progressbar"
                  aria-valuenow={Math.round(progress * 100)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Avanzamento della sessione"
                >
                  <div
                    className="h-full rounded-full bg-slate-900 transition-all duration-300"
                    style={{ width: `${Math.round(progress * 100)}%` }}
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="inline-flex h-11 flex-shrink-0 items-center gap-1 rounded-full px-2 text-sm font-semibold text-slate-500 transition-colors hover:bg-slate-200/70 hover:text-slate-800 disabled:opacity-40"
              >
                <X size={16} />
                Chiudi
              </button>
            </div>
          </header>

          {phase === "theory" && (
            <TheoryStep node={node} />
          )}

          {phase === "quiz" && current && (
            <QuizStep
              exercise={current}
              promptKey={promptKey}
              feedback={feedback}
              feedbackRef={feedbackRef}
              bank={bank}
              picked={picked}
              tones={tones}
              expectedCount={expectedTokens.length}
              onOption={handleOption}
              onTake={takePiece}
              onReturn={returnPiece}
              onTone={setTone}
              onStrokeComplete={handleStrokeComplete}
            />
          )}

          {phase === "done" && (
            <DoneStep node={node} newlyUnlocked={newlyUnlocked} />
          )}
        </div>
      </div>

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20">
        <div
          className="pointer-events-auto mx-auto w-full max-w-md border-t border-slate-200 bg-white/95 px-4 pt-3 backdrop-blur"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        >
          {saveError && (
            <p className="mb-2 text-center text-xs font-medium text-red-600">
              {saveError}
            </p>
          )}

          {phase === "theory" && (
            <PrimaryButton onClick={beginQuiz} disabled={saving}>
              {saving ? "Salvataggio…" : "Inizia la prova di padronanza →"}
            </PrimaryButton>
          )}

          {phase === "quiz" && !feedback && current?.type === "sentence_order" && (
            <PrimaryButton onClick={handleConfirmOrder} disabled={!orderReady || saving}>
              Conferma l&apos;ordine
            </PrimaryButton>
          )}

          {phase === "quiz" && !feedback && current?.type === "tone_builder" && (
            <PrimaryButton onClick={handleConfirmTones} disabled={!toneReady || saving}>
              Conferma i toni
            </PrimaryButton>
          )}

          {phase === "quiz" && !feedback && current?.type === "visual_contrast" && (
            <p className="py-3 text-center text-sm text-slate-400">
              Tocca il carattere giusto
            </p>
          )}

          {phase === "quiz" && !feedback && current?.type === "stroke_order" && (
            <p className="py-3 text-center text-sm text-slate-400">
              Traccia i tratti nel riquadro
            </p>
          )}

          {phase === "quiz" && !feedback && current && CHOICE_TYPES.has(current.type) && (
            <p className="py-3 text-center text-sm text-slate-400">
              Tocca una risposta
            </p>
          )}

          {phase === "quiz" && feedback && (
            <PrimaryButton
              onClick={handleContinue}
              disabled={saving}
              tone={feedback.correct ? "success" : "default"}
            >
              {saving ? "Salvataggio…" : "Continua"}
            </PrimaryButton>
          )}

          {phase === "done" && (
            <PrimaryButton onClick={onClose}>Torna alla mappa</PrimaryButton>
          )}
        </div>
      </div>
    </div>
  );
}

function TheoryStep({ node }: { node: LearningNode }) {
  const bricks = node.isUnitChallenge ? [] : wordBricks(node.title);
  const showTraditional = Boolean(node.traditional && node.traditional !== node.title);
  const badgeLabel = node.isUnitChallenge ? "Sfida di unità" : NODE_TYPE_LABEL[node.type];
  const badgeTone = node.isUnitChallenge ? "bg-amber-100 text-amber-800" : NODE_TYPE_BADGE[node.type];

  return (
    <div className="flex flex-1 flex-col pb-4 pt-6">
      <div className="flex justify-center">
        <span
          className={[
            "rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide",
            badgeTone,
          ].join(" ")}
        >
          {badgeLabel}
        </span>
      </div>

      <div className="mt-5 flex items-center justify-center gap-3">
        <h2
          id="study-session-title"
          className="text-center font-serif text-6xl leading-none text-slate-900"
        >
          {node.title}
        </h2>
        <SpeakButton text={node.title} label={`Ascolta ${node.title}`} />
      </div>

      {node.pinyin && (
        <p className="mt-4 text-center text-lg font-medium text-sky-700">
          {node.pinyin}
        </p>
      )}
      <p className="mt-1 text-center text-base font-medium text-slate-700">
        {node.meaning}
      </p>
      {showTraditional && (
        <p className="mt-1 text-center text-sm text-slate-500">
          Tradizionale: <span className="font-serif text-base text-slate-700">{node.traditional}</span>
        </p>
      )}

      {node.isUnitChallenge && (
        <p className="mx-auto mt-5 max-w-sm rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm leading-relaxed text-amber-950">
          Sfida di fine unità: toni, caratteri simili e frasi di quello che hai appena studiato.
        </p>
      )}

      {node.grammarPattern && <GrammarFormula pattern={node.grammarPattern} />}

      {!node.isUnitChallenge && hanGlyphs(node.title).length > 0 && (
        <div className="mt-6">
          <HanziCanvas character={node.title} mode="demo" />
        </div>
      )}

      {bricks.length > 0 && (
        <section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-amber-800">
            Mattoni della parola
          </h3>
          <ul className="mt-3 flex flex-col gap-2">
            {bricks.map(({ char, source }, index) => (
              <li
                key={`${node.id}-${index}-${char}`}
                className="flex items-center gap-3 rounded-xl bg-white px-3 py-2.5 ring-1 ring-amber-100"
              >
                <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-slate-900 font-serif text-2xl text-white">
                  {char}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-sky-700">
                    {source?.pinyin ?? "—"}
                  </span>
                  <span className="block truncate text-sm text-slate-600">
                    {source?.meaning ?? "Non ancora nel percorso"}
                  </span>
                </span>
                <SpeakButton text={char} label={`Ascolta ${char}`} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-6 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          Come è fatto
        </h3>
        <p className="mt-2 text-[15px] leading-relaxed text-slate-700">
          {node.explanation}
        </p>
      </section>

      <section className="mt-5">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          Esempi
        </h3>
        <ul className="mt-2 flex flex-col gap-3">
          {node.examples.map((example) => (
            <li
              key={`${example.zh}-${example.pinyin}`}
              className="rounded-2xl border border-slate-200 bg-white p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="font-serif text-2xl leading-tight text-slate-900">
                  {example.zh}
                </p>
                <SpeakButton
                  text={example.zh}
                  label={`Ascolta ${example.zh}`}
                />
              </div>
              <p className="mt-2 text-sm font-medium text-sky-700">
                {example.pinyin}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">
                {example.it}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function QuizStep({
  exercise,
  promptKey,
  feedback,
  feedbackRef,
  bank,
  picked,
  tones,
  expectedCount,
  onOption,
  onTake,
  onReturn,
  onTone,
  onStrokeComplete,
}: {
  exercise: Exercise;
  promptKey: number;
  feedback: Feedback | null;
  feedbackRef: RefObject<HTMLDivElement>;
  bank: Piece[];
  picked: Piece[];
  tones: Array<number | null>;
  expectedCount: number;
  onOption: (option: string) => void;
  onTake: (piece: Piece) => void;
  onReturn: (piece: Piece) => void;
  onTone: (index: number, tone: number) => void;
  onStrokeComplete: (result?: { skipped?: boolean }) => void;
}) {
  const choice = CHOICE_TYPES.has(exercise.type);
  const spokenText = exercise.audioText || exercise.correctAnswer;

  useEffect(() => {
    if (exercise.type !== "listening") return;
    speakChinese(spokenText);
  }, [exercise.type, spokenText, promptKey]);

  useEffect(() => {
    if (exercise.type !== "cloze" || !feedback || !exercise.audioText) return;
    speakChinese(exercise.audioText);
  }, [exercise.type, exercise.audioText, feedback, promptKey]);

  const heading =
    exercise.type === "listening"
      ? "Ascolta la pronuncia e scegli la parola che hai sentito."
      : exercise.question;

  return (
    <div className="flex flex-1 flex-col pt-6">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {EXERCISE_LABEL[exercise.type]}
      </p>
      {exercise.type === "cloze" ? (
        <h2
          id="study-session-title"
          className="mt-3 font-serif text-3xl leading-relaxed text-slate-900"
        >
          {renderBlank(exercise.question, feedback ? exercise.correctAnswer : null)}
        </h2>
      ) : (
        <h2
          id="study-session-title"
          className="mt-2 text-xl font-semibold leading-snug text-slate-900"
        >
          {heading}
        </h2>
      )}

      {exercise.type === "cloze" && exercise.context && (
        <p className="mt-3 text-sm leading-relaxed text-slate-600">{exercise.context}</p>
      )}

      {exercise.type === "listening" && (
        <button
          type="button"
          onClick={() => speakChinese(spokenText)}
          className="mx-auto mt-6 flex min-h-28 w-full max-w-xs flex-col items-center justify-center gap-2 rounded-3xl bg-slate-900 px-6 text-white shadow-lg transition-colors hover:bg-slate-700 active:bg-slate-800"
        >
          <Volume2 size={36} />
          <span className="text-base font-semibold">Ascolta pronuncia</span>
        </button>
      )}

      {exercise.type === "stroke_order" && (
        <div className="mt-5">
          <HanziCanvas
            key={exercise.id}
            character={exercise.correctAnswer}
            mode="quiz"
            onComplete={onStrokeComplete}
          />
        </div>
      )}

      {exercise.type === "tone_builder" && (
        <div className="mt-5 flex flex-col gap-3">
          {(exercise.syllables ?? []).map((syllable, index) => {
            const selected = tones[index] ?? null;
            const shown = selected ? applyTone(syllable, selected) : syllable;
            return (
              <div
                key={`${exercise.id}-${index}-${syllable}`}
                className="rounded-2xl border border-slate-200 bg-white p-3"
              >
                <p
                  className={[
                    "text-center text-2xl font-semibold tracking-wide",
                    selected ? "text-sky-700" : "text-slate-400",
                  ].join(" ")}
                >
                  {shown}
                </p>
                <div className="mt-3 grid grid-cols-5 gap-2">
                  {TONE_CHOICES.map((tone) => {
                    const active = selected === tone.id;
                    return (
                      <button
                        key={tone.id}
                        type="button"
                        disabled={feedback !== null}
                        onClick={() => onTone(index, tone.id)}
                        aria-pressed={active}
                        aria-label={`Tono ${tone.id === 5 ? "neutro" : tone.id} per ${syllable}`}
                        className={[
                          "flex h-11 items-center justify-center rounded-xl border text-sm font-semibold transition-colors disabled:cursor-default",
                          active
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-200 bg-white text-slate-700 active:bg-slate-50",
                        ].join(" ")}
                      >
                        {tone.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {exercise.type === "visual_contrast" && (
        <div className="mt-5 grid grid-cols-3 gap-3">
          {exercise.options.map((option, index) => {
            const revealed = feedback !== null;
            const isCorrectOption = option === exercise.correctAnswer;
            const isSelected = feedback?.selected === option;
            let tone = "border-slate-200 bg-white text-slate-900 active:bg-slate-50";
            if (revealed && isCorrectOption) tone = "border-emerald-500 bg-emerald-50 text-emerald-950";
            else if (revealed && isSelected) tone = "border-red-400 bg-red-50 text-red-950";
            else if (revealed) tone = "border-slate-200 bg-white text-slate-300";
            return (
              <button
                key={`${option}-${index}`}
                type="button"
                disabled={revealed}
                onClick={() => onOption(option)}
                className={[
                  "flex aspect-square items-center justify-center rounded-2xl border font-serif text-5xl transition-colors disabled:cursor-default",
                  tone,
                ].join(" ")}
              >
                {option}
              </button>
            );
          })}
        </div>
      )}

      {choice && (
        <div className="mt-5 flex flex-col gap-3">
          {exercise.options.map((option, index) => {
            const revealed = feedback !== null;
            const isCorrectOption = option === exercise.correctAnswer;
            const isSelected = feedback?.selected === option;
            const han = hasHan(option);

            let tone =
              "border-slate-200 bg-white text-slate-900 active:bg-slate-50";
            if (revealed && isCorrectOption) {
              tone = "border-emerald-500 bg-emerald-50 text-emerald-950";
            } else if (revealed && isSelected) {
              tone = "border-red-400 bg-red-50 text-red-950";
            } else if (revealed) {
              tone = "border-slate-200 bg-white text-slate-400";
            }

            return (
              <button
                key={`${option}-${index}`}
                type="button"
                disabled={revealed}
                onClick={() => onOption(option)}
                className={[
                  "flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl border px-4 py-4 text-left font-medium leading-snug transition-colors disabled:cursor-default",
                  han ? "font-serif text-xl" : "text-base",
                  tone,
                ].join(" ")}
              >
                <span>{option}</span>
                {revealed && isCorrectOption && (
                  <Check size={18} className="flex-shrink-0 text-emerald-600" />
                )}
                {revealed && isSelected && !isCorrectOption && (
                  <X size={18} className="flex-shrink-0 text-red-500" />
                )}
              </button>
            );
          })}
        </div>
      )}

      {exercise.type === "sentence_order" && (
        <div className="mt-5">
          <p className="text-xs font-medium text-slate-500">La tua frase</p>
          <div
            className={[
              "mt-2 flex min-h-16 flex-wrap gap-2 rounded-2xl border px-3 py-3",
              feedback?.correct
                ? "border-emerald-400 bg-emerald-50"
                : feedback
                  ? "border-red-400 bg-red-50"
                  : "border-dashed border-slate-300 bg-white",
            ].join(" ")}
          >
            {picked.length === 0 && (
              <span className="self-center text-sm text-slate-400">
                Tocca le parole nell&apos;ordine giusto
              </span>
            )}
            {picked.map((piece) => (
              <button
                key={piece.id}
                type="button"
                onClick={() => onReturn(piece)}
                disabled={feedback !== null}
                className={[
                  "min-h-12 rounded-xl bg-slate-900 px-3 text-white disabled:opacity-80",
                  hasHan(piece.text) ? "font-serif text-xl" : "text-base font-medium",
                ].join(" ")}
              >
                {piece.text}
              </button>
            ))}
          </div>
          {!feedback && (
            <p className="mt-2 text-xs text-slate-400">
              {picked.length}/{expectedCount} · tocca una parola scelta per toglierla
            </p>
          )}

          <p className="mt-5 text-xs font-medium text-slate-500">Parole</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {bank.map((piece) => (
              <button
                key={piece.id}
                type="button"
                onClick={() => onTake(piece)}
                disabled={feedback !== null}
                className={[
                  "min-h-12 rounded-xl border border-slate-200 bg-white px-3 text-slate-900 shadow-sm active:bg-slate-50 disabled:opacity-60",
                  hasHan(piece.text) ? "font-serif text-xl" : "text-base font-medium",
                ].join(" ")}
              >
                {piece.text}
              </button>
            ))}
          </div>
        </div>
      )}

      {feedback && (
        <div
          ref={feedbackRef}
          aria-live="polite"
          className={[
            "mt-5 rounded-2xl border p-4",
            feedback.correct
              ? "border-emerald-200 bg-emerald-50"
              : "border-red-200 bg-red-50",
          ].join(" ")}
        >
          <p
            className={[
              "text-sm font-semibold",
              feedback.correct ? "text-emerald-800" : "text-red-800",
            ].join(" ")}
          >
            {feedback.correct
              ? feedback.selected === "__skip__"
                ? "Scrittura non disponibile"
                : "Corretto"
              : "Non corretto"}
          </p>
          {feedback.correct && feedback.selected === "__skip__" && (
            <p className="mt-2 text-sm leading-relaxed text-emerald-950">
              I tratti di questo simbolo non sono disponibili offline. La prova continua.
            </p>
          )}
          {!feedback.correct && (
            <p className="mt-2 text-sm leading-relaxed text-red-950">
              Risposta corretta:{" "}
              <span className="font-semibold">
                {exercise.type === "tone_builder" ? formatToneAnswer(exercise) : exercise.correctAnswer}
              </span>
            </p>
          )}
          {exercise.type === "cloze" && exercise.audioText && (
            <div className="mt-3 flex items-center justify-between gap-3">
              <p
                className={[
                  "text-sm leading-relaxed",
                  feedback.correct ? "text-emerald-950" : "text-red-950",
                ].join(" ")}
              >
                Frase completa
              </p>
              <SpeakButton
                text={exercise.audioText}
                label="Ascolta la frase completa"
              />
            </div>
          )}
          {exercise.explanation && (
            <p
              className={[
                "mt-2 text-sm leading-relaxed",
                feedback.correct ? "text-emerald-950" : "text-red-950",
              ].join(" ")}
            >
              {exercise.explanation}
            </p>
          )}
          {!feedback.correct && (
            <p className="mt-3 text-xs leading-relaxed text-red-700">
              Questo esercizio torna in coda. La prova finisce solo quando rispondi
              correttamente a tutti.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function DoneStep({
  node,
  newlyUnlocked,
}: {
  node: LearningNode;
  newlyUnlocked: LearningNode[];
}) {
  return (
    <div className="flex flex-1 flex-col items-center px-2 pb-6 pt-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
        <Check size={30} />
      </div>
      <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-emerald-700">
        Padronanza acquisita
      </p>
      <h2
        id="study-session-title"
        className="mt-3 font-serif text-6xl leading-none text-slate-900"
      >
        {node.title}
      </h2>
      {node.pinyin && (
        <p className="mt-3 text-base font-medium text-sky-700">{node.pinyin}</p>
      )}
      <p className="mt-1 text-base text-slate-600">{node.meaning}</p>
      <p className="mt-4 max-w-xs text-sm leading-relaxed text-slate-500">
        Hai risposto correttamente a tutti gli esercizi di questo nodo.
      </p>

      {newlyUnlocked.length > 0 && (
        <section className="mt-8 w-full rounded-2xl border border-slate-200 bg-white p-4 text-left">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Nuovi nodi sbloccati
          </h3>
          <ul className="mt-3 flex flex-col gap-3">
            {newlyUnlocked.map((item) => (
              <li key={item.id} className="flex items-center gap-3">
                <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-slate-900 font-serif text-lg text-white">
                  {item.title}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-slate-900">
                    {item.meaning}
                  </span>
                  <span className="block text-xs text-slate-500">
                    {NODE_TYPE_LABEL[item.type]}
                    {item.pinyin ? ` · ${item.pinyin}` : ""}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function SpeakButton({ text, label }: { text: string; label: string }) {
  return (
    <button
      type="button"
      onClick={() => speakChinese(text)}
      aria-label={label}
      className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition-colors hover:bg-slate-50 active:bg-slate-100"
    >
      <Volume2 size={18} />
    </button>
  );
}

function PrimaryButton({
  children,
  onClick,
  disabled = false,
  tone = "default",
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone?: "default" | "success";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "flex min-h-12 w-full items-center justify-center rounded-xl px-4 text-sm font-semibold text-white transition-colors disabled:opacity-40",
        tone === "success"
          ? "bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700"
          : "bg-slate-900 hover:bg-slate-700 active:bg-slate-800",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function GrammarFormula({ pattern }: { pattern: string }) {
  const parts = pattern.split(/\s*\+\s*/).filter(Boolean);
  return (
    <section className="mt-5 rounded-2xl border border-violet-200 bg-violet-50 p-4">
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-violet-800">
        Formula
      </h3>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {parts.map((part, index) => (
          <span key={`${part}-${index}`} className="flex items-center gap-2">
            {index > 0 && <span className="text-sm font-semibold text-violet-400">+</span>}
            <span
              className={[
                "rounded-xl bg-white px-3 py-2 text-sm font-medium text-slate-900 ring-1 ring-violet-200",
                hasHan(part) ? "font-serif text-lg" : "",
              ].join(" ")}
            >
              {part}
            </span>
          </span>
        ))}
      </div>
    </section>
  );
}

const VOWEL_TONE_MARKS: Record<string, string[]> = {
  a: ["a", "ā", "á", "ǎ", "à"],
  e: ["e", "ē", "é", "ě", "è"],
  i: ["i", "ī", "í", "ǐ", "ì"],
  o: ["o", "ō", "ó", "ǒ", "ò"],
  u: ["u", "ū", "ú", "ǔ", "ù"],
  ü: ["ü", "ǖ", "ǘ", "ǚ", "ǜ"],
};

function applyTone(base: string, tone: number): string {
  const normalized = base.replace(/u:/g, "ü").replace(/v/g, "ü");
  if (!tone || tone === 5) return normalized;
  const chars = [...normalized];
  const vowelIndexes = chars
    .map((glyph, index) => ("aeiouü".includes(glyph) ? index : -1))
    .filter((index) => index >= 0);
  if (!vowelIndexes.length) return normalized;
  let markAt = vowelIndexes[vowelIndexes.length - 1] ?? 0;
  const has = (vowel: string) => vowelIndexes.some((index) => chars[index] === vowel);
  if (has("a")) markAt = chars.indexOf("a");
  else if (has("e")) markAt = chars.indexOf("e");
  else if (has("o") && has("u") && chars.indexOf("o") < chars.indexOf("u")) markAt = chars.indexOf("o");
  const forms = VOWEL_TONE_MARKS[chars[markAt] ?? ""];
  if (!forms?.[tone]) return normalized;
  chars[markAt] = forms[tone] ?? chars[markAt];
  return chars.join("");
}

function formatToneAnswer(exercise: Exercise): string {
  const syllables = exercise.syllables ?? [];
  const picked = exercise.correctAnswer.split("-").map((tone) => Number(tone));
  const marked = syllables.map((syllable, index) => applyTone(syllable, picked[index] ?? 5)).join(" ");
  const labels = picked.map((tone) => (tone === 5 ? "neutro" : String(tone))).join("-");
  return `${marked} (${labels})`;
}

function hanGlyphs(value: string): string[] {
  return [...value].filter((glyph) => /\p{Script=Han}/u.test(glyph));
}

function renderBlank(sentence: string, filled: string | null) {
  const parts = sentence.split("____");
  if (parts.length === 1) return sentence;
  return parts.map((part, index) => (
    <span key={`${index}-${part}`}>
      {part}
      {index < parts.length - 1 && (
        <span
          className={[
            "mx-1 inline-block min-w-[4.5rem] border-b-2 px-1 text-center align-baseline",
            filled ? "border-emerald-500 text-emerald-700" : "border-sky-500 text-sky-600",
          ].join(" ")}
        >
          {filled ?? "____"}
        </span>
      )}
    </span>
  ));
}

function tokensOf(value: string): string[] {
  const trimmed = value.trim();
  if (!trimmed) return [];
  if (trimmed.includes("→")) {
    return trimmed
      .split("→")
      .map((part) => part.trim())
      .filter(Boolean);
  }
  const bySpace = trimmed.split(/\s+/).filter(Boolean);
  if (bySpace.length > 1) return bySpace;
  const chars = trimmed.match(/[\u4e00-\u9fff]/g);
  if (chars && chars.length > 1) return chars;
  return [trimmed];
}

function countTokens(tokens: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const token of tokens) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  return counts;
}

/** Token della risposta giusta, più le copie in eccesso presenti nei distrattori. */
function tokenPool(exercise: Exercise): string[] {
  const correct = tokensOf(exercise.correctAnswer);
  const needed = countTokens(correct);
  const extras: string[] = [];
  const extraCounts = new Map<string, number>();

  for (const option of exercise.options) {
    if (option === exercise.correctAnswer) continue;
    const counts = countTokens(tokensOf(option));
    for (const [token, count] of counts) {
      const surplus = Math.max(0, count - (needed.get(token) ?? 0));
      const already = extraCounts.get(token) ?? 0;
      if (surplus > already) {
        for (let copy = 0; copy < surplus - already; copy += 1) {
          extras.push(token);
        }
        extraCounts.set(token, surplus);
      }
    }
  }

  return [...correct, ...extras];
}

function shuffle<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    const current = copy[index];
    copy[index] = copy[swap] as T;
    copy[swap] = current as T;
  }
  return copy;
}

function hasHan(value: string): boolean {
  return /[\u4e00-\u9fff]/.test(value);
}

function promptSalt(): string {
  return Math.random().toString(36).slice(2, 8);
}

function cancelSpeech(): void {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    /* ignore */
  }
}
