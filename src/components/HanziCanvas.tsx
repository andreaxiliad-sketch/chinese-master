"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import HanziWriter from "hanzi-writer";

const LOAD_TIMEOUT_MS = 8000;

type Notice = {
  tone: "error" | "hint";
  text: string;
};

export function HanziCanvas({
  character,
  mode,
  onComplete,
}: {
  character: string;
  mode: "demo" | "quiz";
  /**
   * Chiamata quando ogni carattere è stato tracciato, o saltato perché i dati
   * tratti non sono disponibili. `mistakes` conta i tratti sbagliati nel tentativo.
   */
  onComplete?: (result?: { skipped?: boolean; mistakes?: number }) => void;
}) {
  const glyphs = useMemo(
    () => [...character].filter((glyph) => /\p{Script=Han}/u.test(glyph)),
    [character],
  );
  const sessionKey = `${mode}:${character}`;
  const [activeSession, setActiveSession] = useState(sessionKey);
  const [index, setIndex] = useState(0);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const padRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef<HTMLDivElement>(null);
  const writerRef = useRef<HanziWriter | null>(null);
  const onCompleteRef = useRef(onComplete);
  const indexRef = useRef(0);
  const finishedRef = useRef(false);
  const skippedAnyRef = useRef(false);
  const steppingRef = useRef(false);
  const strokeMistakesRef = useRef(0);

  onCompleteRef.current = onComplete;
  indexRef.current = index;

  if (activeSession !== sessionKey) {
    setActiveSession(sessionKey);
    setIndex(0);
    setReady(false);
    setFailed(false);
    setNotice(null);
    finishedRef.current = false;
    skippedAnyRef.current = false;
    steppingRef.current = false;
    strokeMistakesRef.current = 0;
    indexRef.current = 0;
  }

  const glyph = glyphs[index] ?? "";

  function goNext(skipped: boolean) {
    if (finishedRef.current || steppingRef.current) return;
    steppingRef.current = true;
    if (skipped) skippedAnyRef.current = true;
    const next = indexRef.current + 1;
    if (next >= glyphs.length) {
      finishedRef.current = true;
      onCompleteRef.current?.({
        skipped: skippedAnyRef.current,
        mistakes: strokeMistakesRef.current,
      });
      return;
    }
    indexRef.current = next;
    setNotice(null);
    setIndex(next);
  }

  useEffect(() => {
    const el = targetRef.current;
    const pad = padRef.current;
    if (!el || !glyph) return;

    let cancelled = false;
    let settled = false;
    steppingRef.current = false;
    setReady(false);
    setFailed(false);
    setNotice(null);
    el.replaceChildren();

    const fail = () => {
      if (cancelled || settled) return;
      settled = true;
      window.clearTimeout(timer);
      setReady(false);
      setFailed(true);
    };

    const timer = window.setTimeout(fail, LOAD_TIMEOUT_MS);

    const succeed = () => {
      if (cancelled || settled) return;
      settled = true;
      window.clearTimeout(timer);
      setFailed(false);
      setReady(true);
      el.querySelectorAll("svg").forEach((svg) => {
        svg.style.touchAction = "none";
      });
    };

    let writer: HanziWriter | null = null;
    try {
      const size = Math.max(1, Math.floor(pad?.clientWidth || el.clientWidth || 280));
      writer = HanziWriter.create(el, glyph, {
        width: size,
        height: size,
        padding: 16,
        showOutline: mode === "demo",
        showCharacter: false,
        strokeAnimationSpeed: 0.85,
        delayBetweenStrokes: 420,
        strokeColor: "#0f172a",
        radicalColor: "#0369a1",
        outlineColor: "#cbd5e1",
        drawingColor: "#0f172a",
        highlightColor: "#0284c7",
        highlightCompleteColor: "#059669",
        drawingWidth: 56,
        showHintAfterMisses: mode === "quiz" ? 3 : false,
        leniency: 1.2,
        highlightOnComplete: true,
        charDataLoader: loadCharData,
        onLoadCharDataSuccess: succeed,
        onLoadCharDataError: fail,
      });
      writerRef.current = writer;
      el.style.touchAction = "none";
      el.querySelectorAll("svg").forEach((svg) => {
        svg.style.touchAction = "none";
        svg.style.display = "block";
      });

      if (mode === "quiz") {
        void writer
          .quiz({
            leniency: 1.2,
            showHintAfterMisses: 3,
            highlightOnComplete: true,
            onMistake: (stroke) => {
              if (cancelled) return;
              strokeMistakesRef.current += 1;
              const attempts = stroke.totalMistakes;
              setNotice({
                tone: "error",
                text:
                  attempts > 1
                    ? `Tratto non corretto (${attempts} errori). Riprova.`
                    : "Tratto non corretto. Riprova.",
              });
            },
            onCorrectStroke: () => {
              if (!cancelled) setNotice(null);
            },
            onComplete: () => {
              if (!cancelled) goNext(false);
            },
          })
          .catch(() => fail());
      }
    } catch {
      fail();
    }

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      try {
        writer?.cancelQuiz();
      } catch {
        /* quiz già chiuso */
      }
      writerRef.current = null;
      el.replaceChildren();
    };
    // goNext legge solo i ref: non va rieseguito a ogni render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [glyph, index, mode]);

  if (glyphs.length === 0) return null;

  function animate() {
    const writer = writerRef.current;
    if (!writer || failed) return;
    void writer.animateCharacter();
  }

  function showHint() {
    const writer = writerRef.current;
    if (!writer || failed) return;
    void writer.showOutline();
    setNotice({
      tone: "hint",
      text: "Contorno visibile: segui i tratti evidenziati.",
    });
  }

  return (
    <div className="w-full">
      {glyphs.length > 1 && (
        <ol className="mb-3 flex flex-wrap items-center justify-center gap-2" aria-label="Sequenza dei caratteri">
          {glyphs.map((item, glyphIndex) => {
            const done = glyphIndex < index;
            const current = glyphIndex === index;
            return (
              <li key={`${item}-${glyphIndex}`}>
                <button
                  type="button"
                  disabled={mode !== "demo"}
                  onClick={() => {
                    if (mode !== "demo" || glyphIndex === index) return;
                    finishedRef.current = false;
                    indexRef.current = glyphIndex;
                    setNotice(null);
                    setIndex(glyphIndex);
                  }}
                  aria-current={current ? "true" : undefined}
                  className={[
                    "flex h-12 min-w-12 items-center justify-center rounded-xl px-2 font-serif text-2xl transition-colors",
                    current
                      ? "bg-slate-900 text-white"
                      : done
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-white text-slate-400 ring-1 ring-slate-200",
                    mode === "demo" ? "active:bg-slate-800" : "cursor-default",
                  ].join(" ")}
                >
                  {item}
                </button>
              </li>
            );
          })}
        </ol>
      )}

      {glyphs.length > 1 && (
        <p className="mb-2 text-center text-xs font-medium text-slate-500">
          Carattere {Math.min(index + 1, glyphs.length)} di {glyphs.length}
        </p>
      )}

      <div
        ref={padRef}
        className="relative mx-auto aspect-square w-full max-w-[280px] touch-none select-none"
        style={{ touchAction: "none" }}
      >
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="absolute inset-0 border-2 border-rose-300" />
          <div className="absolute bottom-0 left-1/2 top-0 border-l border-dashed border-rose-300" />
          <div className="absolute left-0 right-0 top-1/2 border-t border-dashed border-rose-300" />
        </div>
        <div
          ref={targetRef}
          className="absolute inset-0 z-[1] touch-none [&_svg]:touch-none"
          style={{ touchAction: "none" }}
        />
        {failed && (
          <div className="absolute inset-0 z-[2] flex items-center justify-center bg-white/80">
            <span className="font-serif text-7xl text-slate-300">{glyph}</span>
          </div>
        )}
        {!ready && !failed && (
          <p className="pointer-events-none absolute inset-x-0 bottom-3 z-[2] text-center text-xs font-medium text-slate-400">
            Caricamento tratti…
          </p>
        )}
      </div>

      {notice && (
        <p
          aria-live="polite"
          className={[
            "mx-auto mt-3 max-w-[280px] text-center text-sm font-medium",
            notice.tone === "error" ? "text-red-600" : "text-sky-700",
          ].join(" ")}
        >
          {notice.text}
        </p>
      )}

      {failed && (
        <p className="mx-auto mt-3 max-w-xs text-center text-sm leading-relaxed text-slate-500">
          Tratti non disponibili per questo simbolo. Puoi continuare anche offline.
        </p>
      )}

      <div className="mt-4">
        {mode === "demo" && !failed && (
          <button
            type="button"
            onClick={animate}
            disabled={!ready}
            className="flex min-h-12 w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 shadow-sm transition-colors hover:bg-slate-50 active:bg-slate-100 disabled:opacity-40"
          >
            Anima tratti
          </button>
        )}

        {mode === "quiz" && !failed && (
          <button
            type="button"
            onClick={showHint}
            disabled={!ready}
            className="flex min-h-12 w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 shadow-sm transition-colors hover:bg-slate-50 active:bg-slate-100 disabled:opacity-40"
          >
            Suggerimento
          </button>
        )}

        {mode === "quiz" && failed && (
          <button
            type="button"
            onClick={() => goNext(true)}
            className="flex min-h-12 w-full items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition-colors hover:bg-slate-700 active:bg-slate-800"
          >
            Salta scrittura per questo simbolo
          </button>
        )}
      </div>
    </div>
  );
}

function loadCharData(
  char: string,
  onLoad: (data: { strokes: string[]; medians: number[][][] }) => void,
  onError: (error?: unknown) => void,
) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 7000);
  // Relativo alla pagina, così resta valido anche in una sottocartella di GitHub Pages.
  const url = `./hanzi-data/${encodeURIComponent(char)}.json`;
  fetch(url, { signal: controller.signal })
    .then((response) => {
      if (!response.ok) throw new Error(`Dati tratti assenti per ${char}`);
      return response.json();
    })
    .then((data) => {
      window.clearTimeout(timer);
      onLoad(data);
    })
    .catch((error: unknown) => {
      window.clearTimeout(timer);
      onError(error);
    });
}
