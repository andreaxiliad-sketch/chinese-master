"use client";

import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { Check, Volume2, X } from "lucide-react";

import { HanziCanvas } from "@/components/HanziCanvas";
import { recordReviewOutcome, type ProgressMap } from "@/services/storage";
import type { Exercise, ExerciseType, LearningNode } from "@/types/learning";
import { speakChinese } from "@/utils/speech";

const SESSION_CAP = 10;

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

/** Ascolto e tratti prima; il cloze copre i nodi senza scrittura. */
const PREFERRED: readonly ExerciseType[] = [
  "listening",
  "stroke_order",
  "cloze",
  "visual_contrast",
  "multiple_choice",
  "pinyin_match",
];

type Phase = "quiz" | "done";

type Feedback = {
  correct: boolean;
  selected: string;
};

type ReviewItem = {
  node: LearningNode;
  exercise: Exercise;
};

type Outcome = {
  node: LearningNode;
  hadMistakes: boolean;
};

export function ReviewSession({
  nodes,
  mode,
  onClose,
  onProgressChange,
}: {
  nodes: LearningNode[];
  mode: "daily" | "practice";
  onClose: () => void;
  onProgressChange: (progress: ProgressMap) => void;
}) {
  const built = buildSession(nodes);
  const [sessionNodes] = useState(built.nodes);
  const [queue, setQueue] = useState<ReviewItem[]>(built.queue);
  const [phase, setPhase] = useState<Phase>(built.queue.length === 0 ? "done" : "quiz");
  const [cleared, setCleared] = useState(0);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [promptKey, setPromptKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);

  const total = built.queue.length;
  const title = mode === "daily" ? "Ripasso Giornaliero" : "Allenamento";
  const current = queue[0];
  const aliveRef = useRef(true);
  const advancingRef = useRef(false);
  const mistakesRef = useRef(new Set<string>());
  const recordedRef = useRef(new Set<string>());
  const scrollRef = useRef<HTMLDivElement>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);

  const progress = phase === "done" || total === 0 ? 1 : Math.min(1, cleared / total);

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
    if (phase !== "quiz" || !feedback?.correct || current?.exercise.type !== "stroke_order") return;
    if (feedback.selected === "__skip__") return;
    const timer = window.setTimeout(() => {
      handleContinue();
    }, 700);
    return () => window.clearTimeout(timer);
    // handleContinue chiude il tentativo corrente; il timer va legato solo all'esito.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, feedback, current]);

  function reveal(nextQueue: ReviewItem[]) {
    cancelSpeech();
    setQueue(nextQueue);
    setFeedback(null);
    setPromptKey((value) => value + 1);
  }

  function lockAnswer(correct: boolean, selected: string) {
    if (feedback || saving) return;
    setFeedback({ correct, selected });
    if (correct) setCleared((count) => count + 1);
  }

  function handleOption(option: string) {
    if (!current || feedback || saving) return;
    lockAnswer(option === current.exercise.correctAnswer, option);
  }

  function handleStrokeComplete(result?: { skipped?: boolean; mistakes?: number }) {
    if (!current || current.exercise.type !== "stroke_order" || feedback || saving) return;
    if (result?.skipped) {
      lockAnswer(true, "__skip__");
      return;
    }
    if ((result?.mistakes ?? 0) > 0) {
      lockAnswer(false, "__strokes__");
      return;
    }
    lockAnswer(true, current.exercise.correctAnswer);
  }

  function handleContinue() {
    if (advancingRef.current) return;
    if (!feedback || saving || !current) return;
    advancingRef.current = true;

    if (!feedback.correct) {
      mistakesRef.current.add(current.node.id);
      reveal([...queue.slice(1), current]);
      return;
    }

    const rest = queue.slice(1);
    const nodeFinished = !rest.some((item) => item.node.id === current.node.id);
    if (!nodeFinished) {
      reveal(rest);
      return;
    }

    void persistNode(current.node, mistakesRef.current.has(current.node.id), rest);
  }

  async function persistNode(node: LearningNode, hadMistakes: boolean, rest: ReviewItem[]) {
    setSaving(true);
    setSaveError(null);
    try {
      if (!recordedRef.current.has(node.id)) {
        const updated = await recordReviewOutcome(node.id, hadMistakes);
        recordedRef.current.add(node.id);
        onProgressChange(updated);
      }
      if (!aliveRef.current) return;
      setOutcomes((items) =>
        items.some((item) => item.node.id === node.id) ? items : [...items, { node, hadMistakes }],
      );
      if (rest.length === 0) {
        setQueue([]);
        setPhase("done");
        return;
      }
      reveal(rest);
    } catch {
      advancingRef.current = false;
      if (!aliveRef.current) return;
      setSaveError("Salvataggio non riuscito. Premi Continua per riprovare.");
    } finally {
      if (aliveRef.current) setSaving(false);
    }
  }

  const reinforced = outcomes.filter((item) => !item.hadMistakes);
  const lapsed = outcomes.filter((item) => item.hadMistakes);

  return (
    <div className="fixed inset-0 z-50 bg-slate-50" role="dialog" aria-modal="true" aria-labelledby="review-session-title">
      <div ref={scrollRef} className="h-full overflow-y-auto overscroll-contain">
        <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 pb-32">
          <header
            className="sticky top-0 z-10 -mx-4 bg-slate-50/95 px-4 pb-3 backdrop-blur"
            style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}
          >
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="mb-1.5 flex items-center justify-between gap-3 text-xs font-medium text-slate-500">
                  <span className="truncate">{title}</span>
                  {phase === "quiz" && total > 0 && (
                    <span className="flex-shrink-0">
                      {Math.min(cleared, total)}/{total}
                    </span>
                  )}
                </div>
                <div
                  className="h-1.5 overflow-hidden rounded-full bg-slate-200"
                  role="progressbar"
                  aria-valuenow={Math.round(progress * 100)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Avanzamento del ripasso"
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

          {phase === "quiz" && current && (
            <ReviewQuiz
              item={current}
              promptKey={promptKey}
              feedback={feedback}
              feedbackRef={feedbackRef}
              onOption={handleOption}
              onStrokeComplete={handleStrokeComplete}
            />
          )}

          {phase === "done" && (
            <div className="flex flex-1 flex-col items-center px-2 pb-6 pt-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <Check size={30} />
              </div>
              <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-emerald-700">
                {mode === "daily" ? "Ripasso chiuso" : "Allenamento chiuso"}
              </p>
              <h2 id="review-session-title" className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
                {title}
              </h2>
              <p className="mt-4 max-w-xs text-sm leading-relaxed text-slate-500">
                {sessionNodes.length === 0
                  ? "Nessun esercizio disponibile per questi nodi."
                  : `${reinforced.length} consolidati, ${lapsed.length} da rivedere domani.`}
              </p>
              {lapsed.length > 0 && <OutcomeList title="Da rivedere domani" items={lapsed} />}
              {reinforced.length > 0 && <OutcomeList title="Consolidati" items={reinforced} />}
            </div>
          )}
        </div>
      </div>

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20">
        <div
          className="pointer-events-auto mx-auto w-full max-w-md border-t border-slate-200 bg-white/95 px-4 pt-3 backdrop-blur"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        >
          {saveError && <p className="mb-2 text-center text-xs font-medium text-red-600">{saveError}</p>}

          {phase === "quiz" && !feedback && current?.exercise.type === "stroke_order" && (
            <p className="py-3 text-center text-sm text-slate-400">Traccia i tratti nel riquadro</p>
          )}

          {phase === "quiz" && !feedback && current?.exercise.type === "visual_contrast" && (
            <p className="py-3 text-center text-sm text-slate-400">Tocca il carattere giusto</p>
          )}

          {phase === "quiz" && !feedback && current && current.exercise.type !== "stroke_order" && current.exercise.type !== "visual_contrast" && (
            <p className="py-3 text-center text-sm text-slate-400">Tocca una risposta</p>
          )}

          {phase === "quiz" && feedback && (
            <PrimaryButton onClick={handleContinue} disabled={saving} tone={feedback.correct ? "success" : "default"}>
              {saving ? "Salvataggio…" : "Continua"}
            </PrimaryButton>
          )}

          {phase === "done" && <PrimaryButton onClick={onClose}>Torna alla mappa</PrimaryButton>}
        </div>
      </div>
    </div>
  );
}

function ReviewQuiz({
  item,
  promptKey,
  feedback,
  feedbackRef,
  onOption,
  onStrokeComplete,
}: {
  item: ReviewItem;
  promptKey: number;
  feedback: Feedback | null;
  feedbackRef: RefObject<HTMLDivElement>;
  onOption: (option: string) => void;
  onStrokeComplete: (result?: { skipped?: boolean; mistakes?: number }) => void;
}) {
  const { exercise } = item;
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
        <h2 id="review-session-title" className="mt-3 font-serif text-3xl leading-relaxed text-slate-900">
          {renderBlank(exercise.question, feedback ? exercise.correctAnswer : null)}
        </h2>
      ) : (
        <h2 id="review-session-title" className="mt-2 text-xl font-semibold leading-snug text-slate-900">
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
            key={`${exercise.id}-${promptKey}`}
            character={exercise.correctAnswer}
            mode="quiz"
            onComplete={onStrokeComplete}
          />
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

      {exercise.type !== "stroke_order" && exercise.type !== "visual_contrast" && (
        <div className="mt-5 flex flex-col gap-3">
          {exercise.options.map((option, index) => {
            const revealed = feedback !== null;
            const isCorrectOption = option === exercise.correctAnswer;
            const isSelected = feedback?.selected === option;
            const han = hasHan(option);
            let tone = "border-slate-200 bg-white text-slate-900 active:bg-slate-50";
            if (revealed && isCorrectOption) tone = "border-emerald-500 bg-emerald-50 text-emerald-950";
            else if (revealed && isSelected) tone = "border-red-400 bg-red-50 text-red-950";
            else if (revealed) tone = "border-slate-200 bg-white text-slate-400";
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
                {revealed && isCorrectOption && <Check size={18} className="flex-shrink-0 text-emerald-600" />}
                {revealed && isSelected && !isCorrectOption && <X size={18} className="flex-shrink-0 text-red-500" />}
              </button>
            );
          })}
        </div>
      )}

      {feedback && (
        <div
          ref={feedbackRef}
          aria-live="polite"
          className={[
            "mt-5 rounded-2xl border p-4",
            feedback.correct ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50",
          ].join(" ")}
        >
          <p className={["text-sm font-semibold", feedback.correct ? "text-emerald-800" : "text-red-800"].join(" ")}>
            {feedback.correct
              ? feedback.selected === "__skip__"
                ? "Scrittura non disponibile"
                : "Corretto"
              : feedback.selected === "__strokes__"
                ? "Tratti da rifare"
                : "Non corretto"}
          </p>
          {feedback.correct && feedback.selected === "__skip__" && (
            <p className="mt-2 text-sm leading-relaxed text-emerald-950">
              I tratti di questo simbolo non sono disponibili offline. Il ripasso continua.
            </p>
          )}
          {!feedback.correct && feedback.selected !== "__strokes__" && (
            <p className="mt-2 text-sm leading-relaxed text-red-950">
              Risposta corretta: <span className="font-semibold">{exercise.correctAnswer}</span>
            </p>
          )}
          {!feedback.correct && feedback.selected === "__strokes__" && (
            <p className="mt-2 text-sm leading-relaxed text-red-950">
              Rifai il carattere senza sbagliare un tratto.
            </p>
          )}
          {exercise.type === "cloze" && exercise.audioText && (
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className={["text-sm leading-relaxed", feedback.correct ? "text-emerald-950" : "text-red-950"].join(" ")}>
                Frase completa
              </p>
              <SpeakButton text={exercise.audioText} label="Ascolta la frase completa" />
            </div>
          )}
          {exercise.explanation && feedback.selected !== "__strokes__" && (
            <p className={["mt-2 text-sm leading-relaxed", feedback.correct ? "text-emerald-950" : "text-red-950"].join(" ")}>
              {exercise.explanation}
            </p>
          )}
          {!feedback.correct && (
            <p className="mt-3 text-xs leading-relaxed text-red-700">
              Questo esercizio torna in coda. Il nodo si chiude solo quando lo superi.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function OutcomeList({ title, items }: { title: string; items: Outcome[] }) {
  return (
    <section className="mt-6 w-full rounded-2xl border border-slate-200 bg-white p-4 text-left">
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{title}</h3>
      <ul className="mt-3 flex flex-col gap-2">
        {items.map((item) => (
          <li key={item.node.id} className="flex items-center gap-3">
            <span className="flex h-11 min-w-11 flex-shrink-0 items-center justify-center rounded-xl bg-slate-900 px-2 font-serif text-lg text-white">
              {item.node.title}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-slate-900">{item.node.meaning}</span>
              {item.node.pinyin && <span className="block text-xs text-slate-500">{item.node.pinyin}</span>}
            </span>
          </li>
        ))}
      </ul>
    </section>
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

function pickReviewExercises(node: LearningNode): Exercise[] {
  const picked: Exercise[] = [];
  const used = new Set<string>();
  for (const type of PREFERRED) {
    const match = node.exercises.find((exercise) => exercise.type === type);
    if (!match || used.has(match.id)) continue;
    picked.push(match);
    used.add(match.id);
    if (picked.length === 2) return picked;
  }
  for (const exercise of node.exercises) {
    if (used.has(exercise.id)) continue;
    if (!exercise.options.includes(exercise.correctAnswer)) continue;
    if (exercise.type === "stroke_order" || exercise.type === "tone_builder") continue;
    picked.push(exercise);
    used.add(exercise.id);
    if (picked.length === 2) break;
  }
  return picked;
}

function buildSession(nodes: LearningNode[]): { nodes: LearningNode[]; queue: ReviewItem[] } {
  const sessionNodes: LearningNode[] = [];
  const queue: ReviewItem[] = [];
  for (const node of nodes.slice(0, SESSION_CAP)) {
    const exercises = pickReviewExercises(node);
    if (exercises.length === 0) continue;
    sessionNodes.push(node);
    for (const exercise of exercises) queue.push({ node, exercise });
  }
  return { nodes: sessionNodes, queue };
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

function hasHan(value: string): boolean {
  return /[\u4e00-\u9fff]/.test(value);
}

function cancelSpeech(): void {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    /* ignore */
  }
}
