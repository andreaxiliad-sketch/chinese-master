"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Download,
  Lock,
  RotateCcw,
  Search,
  Upload,
} from "lucide-react";

import { ReviewSession } from "@/components/ReviewSession";
import { StudySession } from "@/components/StudySession";
import { CURRICULUM } from "@/data/curriculum";
import { getDueReviewNodes, storage, type ProgressMap } from "@/services/storage";
import type { LearningNode, NodeProgress, NodeType } from "@/types/learning";

/** Etichette leggibili per il tipo di nodo. */
const NODE_TYPE_LABEL: Record<NodeType, string> = {
  radical: "Radicale",
  hanzi: "Hanzi",
  grammar: "Grammatica",
  vocab: "Vocabolo",
};

type FilterId = "all" | "1" | "2" | "3" | "unlocked";

const FILTERS: ReadonlyArray<{ id: FilterId; label: string }> = [
  { id: "all", label: "Tutti" },
  { id: "1", label: "HSK 1" },
  { id: "2", label: "HSK 2" },
  { id: "3", label: "HSK 3" },
  { id: "unlocked", label: "Sbloccati ora" },
];

const LEVEL_META: ReadonlyArray<{ level: number; label: string; bar: string }> = [
  { level: 1, label: "HSK 1", bar: "bg-sky-500" },
  { level: 2, label: "HSK 2", bar: "bg-violet-500" },
  { level: 3, label: "HSK 3", bar: "bg-amber-500" },
];

/** Nodi ordinati per presentazione. */
const ORDERED_NODES: LearningNode[] = [...CURRICULUM].sort(
  (a, b) => a.orderIndex - b.orderIndex,
);

const NODES_BY_ID = new Map(ORDERED_NODES.map((node) => [node.id, node]));

type IndexedNode = {
  node: LearningNode;
  haystack: string;
  compact: string;
};

function fold(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
}

const SEARCH_INDEX: IndexedNode[] = ORDERED_NODES.map((node) => {
  const haystack = fold(
    [node.title, node.traditional, node.pinyin, node.meaning, node.grammarPattern].filter(Boolean).join(" "),
  );
  return {
    node,
    haystack,
    compact: haystack.replace(/[\s'’\-]+/g, ""),
  };
});

type UnitGroup = {
  key: string;
  title: string;
  nodes: LearningNode[];
};

function unitKey(node: LearningNode): string {
  return node.unitTitle ?? `hsk-${node.hskLevel}`;
}

export default function Home() {
  const [progress, setProgress] = useState<ProgressMap>({});
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [reviewSession, setReviewSession] = useState<{
    mode: "daily" | "practice";
    nodes: LearningNode[];
  } | null>(null);
  const [filter, setFilter] = useState<FilterId>("all");
  const [query, setQuery] = useState("");
  const [manualOpen, setManualOpen] = useState<Record<string, boolean>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrolledRef = useRef(false);

  const activeNode =
    ORDERED_NODES.find((node) => node.id === activeNodeId) ?? null;

  useEffect(() => {
    let active = true;
    storage.getAllProgress().then((p) => {
      if (active) {
        setProgress(p);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const total = ORDERED_NODES.length;
  const masteredCount = useMemo(
    () => ORDERED_NODES.filter((node) => progress[node.id]?.status === "mastered").length,
    [progress],
  );
  const percent = total > 0 ? Math.round((masteredCount / total) * 100) : 0;

  const levelStats = useMemo(
    () =>
      LEVEL_META.map((meta) => {
        const nodes = ORDERED_NODES.filter((node) => node.hskLevel === meta.level);
        const mastered = nodes.filter((node) => progress[node.id]?.status === "mastered").length;
        const levelTotal = nodes.length;
        return {
          ...meta,
          mastered,
          total: levelTotal,
          percent: levelTotal > 0 ? Math.round((mastered / levelTotal) * 100) : 0,
        };
      }),
    [progress],
  );

  const unlockedCount = useMemo(
    () => ORDERED_NODES.filter((node) => progress[node.id]?.status === "unlocked").length,
    [progress],
  );

  const dueNodes = useMemo(() => getDueReviewNodes(ORDERED_NODES, progress), [progress]);
  const dueCount = dueNodes.length;

  const activeUnitTitle = useMemo(() => {
    const unlocked = ORDERED_NODES.find((node) => progress[node.id]?.status === "unlocked");
    if (unlocked) return unitKey(unlocked);
    const pending = ORDERED_NODES.find((node) => progress[node.id]?.status !== "mastered");
    return pending ? unitKey(pending) : unitKey(ORDERED_NODES[0]);
  }, [progress]);

  const groups = useMemo(() => {
    const needle = fold(query.trim());
    const needleCompact = needle.replace(/[\s'’\-]+/g, "");
    const matched = new Set<string>();
    if (needle) {
      for (const entry of SEARCH_INDEX) {
        if (entry.haystack.includes(needle) || entry.compact.includes(needleCompact)) {
          matched.add(entry.node.id);
        }
      }
    }

    const visible = ORDERED_NODES.filter((node) => {
      if (needle && !matched.has(node.id)) return false;
      if (filter === "unlocked") return progress[node.id]?.status === "unlocked";
      if (filter === "1" || filter === "2" || filter === "3") {
        return node.hskLevel === Number(filter);
      }
      return true;
    });

    const grouped: UnitGroup[] = [];
    for (const node of visible) {
      const key = unitKey(node);
      const last = grouped[grouped.length - 1];
      if (!last || last.key !== key) {
        grouped.push({ key, title: node.unitTitle ?? key, nodes: [node] });
      } else {
        last.nodes.push(node);
      }
    }
    return grouped;
  }, [filter, progress, query]);

  const forceOpen = query.trim().length > 0 || filter === "unlocked";
  const visibleKeys = groups.map((group) => group.key);
  const preferredKey = visibleKeys.includes(activeUnitTitle) ? activeUnitTitle : visibleKeys[0];

  useEffect(() => {
    if (loading || scrolledRef.current || !preferredKey) return;
    scrolledRef.current = true;
    if (groups[0]?.key === preferredKey) return;
    document.getElementById(domId(preferredKey))?.scrollIntoView({ block: "start" });
  }, [groups, loading, preferredKey]);

  function isOpen(key: string): boolean {
    if (forceOpen) return true;
    if (key in manualOpen) return manualOpen[key];
    return key === preferredKey;
  }

  function toggleUnit(key: string) {
    setManualOpen((current) => ({ ...current, [key]: !isOpen(key) }));
  }

  function flash(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(null), 2600);
  }

  function handleSessionProgress(updated: ProgressMap) {
    setProgress({ ...updated });
  }

  async function handleExport() {
    const json = await storage.exportProgressJSON();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "chinesemaster-progress.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    flash("Backup esportato ✓");
  }

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  async function handleImportFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const text = await file.text();
    const ok = await storage.importProgressJSON(text);
    if (ok) {
      const fresh = await storage.getAllProgress();
      setProgress({ ...fresh });
      flash("Backup importato ✓");
    } else {
      flash("File JSON non valido ✗");
    }
  }

  async function handleReset() {
    const confirmed = window.confirm(
      "Vuoi davvero azzerare tutti i progressi? L'operazione non è reversibile.",
    );
    if (!confirmed) return;
    await storage.resetProgress();
    const fresh = await storage.getAllProgress();
    setProgress({ ...fresh });
    flash("Progressi azzerati");
  }

  function startDailyReview() {
    if (dueNodes.length === 0) return;
    setActiveNodeId(null);
    setReviewSession({ mode: "daily", nodes: dueNodes.slice(0, 10) });
  }

  function startExtraPractice() {
    const mastered = ORDERED_NODES.filter((node) => progress[node.id]?.status === "mastered");
    if (mastered.length === 0) return;
    setActiveNodeId(null);
    setReviewSession({ mode: "practice", nodes: shuffle(mastered).slice(0, 8) });
  }

  const dueLabel = loading
    ? "Controllo i ripassi di oggi…"
    : dueCount === 0
      ? "Nessun nodo in scadenza."
      : dueCount === 1
        ? "1 nodo in scadenza."
        : `${dueCount} nodi in scadenza.`;

  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-col px-4 pb-10 pt-6">
      <header className="mb-4">
        <div className="flex items-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-xl text-white">
            好
          </span>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              ChineseMaster
            </h1>
            <p className="text-xs text-slate-500">
              Mastery-Based Learning · HSK 1–3
            </p>
          </div>
        </div>

        <div className="mt-5">
          <div className="mb-1.5 flex items-center justify-between text-xs font-medium text-slate-600">
            <span>Avanzamento totale</span>
            <span>
              {masteredCount}/{total} nodi
            </span>
          </div>
          <div
            className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200"
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Avanzamento totale"
          >
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-2">
          {levelStats.map((level) => (
            <div key={level.level}>
              <div className="mb-1 flex items-center justify-between text-[11px] font-medium text-slate-500">
                <span>{level.label}</span>
                <span>
                  {level.mastered}/{level.total}
                </span>
              </div>
              <div
                className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200"
                role="progressbar"
                aria-valuenow={level.percent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Avanzamento ${level.label}`}
              >
                <div
                  className={["h-full rounded-full transition-all duration-500", level.bar].join(" ")}
                  style={{ width: `${level.percent}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </header>

      <section className="mb-4 rounded-2xl bg-slate-900 px-4 py-4 text-white shadow-sm" aria-busy={loading}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Oggi</p>
            <h2 className="mt-1 text-lg font-bold tracking-tight">Ripasso Giornaliero</h2>
            <p className="mt-1 text-sm text-slate-300">{dueLabel}</p>
          </div>
          <span className="flex h-11 min-w-11 items-center justify-center rounded-full bg-white/10 px-3 text-lg font-bold tabular-nums">
            {loading ? "…" : dueCount}
          </span>
        </div>
        {!loading && dueCount > 10 && (
          <p className="mt-2 text-xs text-slate-400">Questa sessione ne prende 10, i più in ritardo.</p>
        )}
        <button
          type="button"
          onClick={startDailyReview}
          disabled={loading || dueCount === 0}
          className="mt-4 flex min-h-12 w-full items-center justify-center rounded-xl bg-white px-4 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-100 disabled:opacity-40"
        >
          Ripasso Giornaliero
        </button>
        <button
          type="button"
          onClick={startExtraPractice}
          disabled={loading || masteredCount === 0}
          className="mt-2 flex min-h-11 w-full items-center justify-center rounded-xl border border-white/20 px-4 text-sm font-semibold text-white transition-colors hover:bg-white/10 disabled:opacity-40"
        >
          Allena comunque
        </button>
      </section>

      <div className="sticky top-0 z-20 -mx-4 bg-slate-50/95 px-4 pb-3 backdrop-blur">
        <div className="flex gap-2 overflow-x-auto pb-2" role="tablist" aria-label="Filtra il percorso">
          {FILTERS.map((item) => {
            const selected = filter === item.id;
            const label =
              item.id === "unlocked" ? `${item.label} (${unlockedCount})` : item.label;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setFilter(item.id)}
                className={[
                  "whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                  selected
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-600",
                ].join(" ")}
              >
                {label}
              </button>
            );
          })}
        </div>
        <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
          <Search size={16} className="flex-shrink-0 text-slate-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cerca hanzi, pinyin o significato"
            className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
            aria-label="Cerca hanzi, pinyin o significato"
          />
        </label>
      </div>

      <section className="mt-3 flex flex-col gap-3">
        {loading ? (
          <p className="py-10 text-center text-sm text-slate-400">Caricamento…</p>
        ) : groups.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400">
            Nessun nodo corrisponde alla ricerca.
          </p>
        ) : (
          groups.map((group) => (
            <UnitSection
              key={group.key}
              group={group}
              open={isOpen(group.key)}
              onToggle={() => toggleUnit(group.key)}
              progress={progress}
              onOpen={setActiveNodeId}
            />
          ))
        )}
      </section>

      <section className="mt-8 border-t border-slate-200 pt-5">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Backup dei progressi
        </h2>
        <div className="grid grid-cols-3 gap-2">
          <ActionButton onClick={handleExport} icon={<Download size={16} />}>
            Esporta
          </ActionButton>
          <ActionButton onClick={handleImportClick} icon={<Upload size={16} />}>
            Importa
          </ActionButton>
          <ActionButton
            onClick={handleReset}
            icon={<RotateCcw size={16} />}
            variant="danger"
          >
            Reset
          </ActionButton>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={handleImportFile}
        />
      </section>

      {activeNode && (
        <StudySession
          key={activeNode.id}
          node={activeNode}
          onClose={() => setActiveNodeId(null)}
          onProgressChange={handleSessionProgress}
        />
      )}

      {reviewSession && (
        <ReviewSession
          key={`${reviewSession.mode}:${reviewSession.nodes.map((node) => node.id).join("|")}`}
          mode={reviewSession.mode}
          nodes={reviewSession.nodes}
          onClose={() => setReviewSession(null)}
          onProgressChange={handleSessionProgress}
        />
      )}

      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 flex justify-center px-4">
          <div className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-lg">
            {toast}
          </div>
        </div>
      )}
    </main>
  );
}

function reviewStatusLabel(entry: NodeProgress | undefined): string | null {
  if (!entry || entry.status !== "mastered" || !entry.nextReviewAt) return null;
  const dueAt = Date.parse(entry.nextReviewAt);
  if (!Number.isFinite(dueAt)) return null;
  const remaining = dueAt - Date.now();
  if (remaining <= 0) return "Da ripassare";
  const days = Math.ceil(remaining / 86_400_000);
  return `Ripasso tra ${days}g`;
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

function domId(key: string): string {
  return `unit-${Array.from(key).map((char) => char.codePointAt(0)?.toString(16) ?? "").join("")}`;
}

function UnitSection({
  group,
  open,
  onToggle,
  progress,
  onOpen,
}: {
  group: UnitGroup;
  open: boolean;
  onToggle: () => void;
  progress: ProgressMap;
  onOpen: (id: string) => void;
}) {
  const mastered = group.nodes.filter((node) => progress[node.id]?.status === "mastered").length;
  const percent = group.nodes.length > 0 ? Math.round((mastered / group.nodes.length) * 100) : 0;

  return (
    <section id={domId(group.key)} className="scroll-mt-28 rounded-2xl border border-slate-200 bg-white">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full px-4 py-3 text-left"
      >
        <div className="flex items-start gap-2">
          <ChevronDown
            size={16}
            className={[
              "mt-0.5 flex-shrink-0 text-slate-400 transition-transform",
              open ? "rotate-0" : "-rotate-90",
            ].join(" ")}
          />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold leading-snug text-slate-900">
              {group.title}
            </span>
            <span className="mt-0.5 block text-[11px] font-medium text-slate-500">
              {mastered}/{group.nodes.length} padroneggiati
            </span>
          </span>
        </div>
        <div
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Completamento ${group.title}`}
        >
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-500"
            style={{ width: `${percent}%` }}
          />
        </div>
      </button>
      {open && (
        <div className="flex flex-col gap-2 border-t border-slate-100 p-3">
          {group.nodes.map((node) => (
            <NodeCard
              key={node.id}
              node={node}
              progress={progress[node.id]}
              missingPrereqs={missingPrereqTitles(node, progress)}
              onOpen={() => onOpen(node.id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function missingPrereqTitles(node: LearningNode, progress: ProgressMap): string[] {
  const titles = node.prerequisites
    .filter((id) => progress[id]?.status !== "mastered")
    .map((id) => NODES_BY_ID.get(id)?.title ?? id);
  return [...new Set(titles)];
}

function NodeCard({
  node,
  progress,
  missingPrereqs,
  onOpen,
}: {
  node: LearningNode;
  progress: NodeProgress | undefined;
  missingPrereqs: string[];
  onOpen: () => void;
}) {
  const status = progress?.status ?? "locked";
  const isLocked = status === "locked";
  const isMastered = status === "mastered";
  const glyphs = Array.from(node.title).length;
  const glyphSize =
    glyphs >= 4 ? "text-sm" : glyphs === 3 ? "text-base" : glyphs === 2 ? "text-xl" : "text-3xl";
  const glyphBox = glyphs >= 3 ? "h-14 w-[4.5rem]" : "h-14 w-14";
  const shownPrereqs = missingPrereqs.slice(0, 4);
  const hiddenPrereqs = missingPrereqs.length - shownPrereqs.length;
  const reviewLabel = reviewStatusLabel(progress);

  const shell = [
    "w-full rounded-2xl border p-4 text-left transition-colors",
    isLocked
      ? "border-slate-200 bg-slate-50 opacity-70"
      : isMastered
        ? "cursor-pointer border-emerald-200 bg-emerald-50 hover:border-emerald-300 active:bg-emerald-100/60"
        : node.isUnitChallenge
          ? "cursor-pointer border-amber-300 bg-amber-50 hover:border-amber-400 active:bg-amber-100/70"
          : "cursor-pointer border-slate-200 bg-white shadow-sm hover:border-slate-300 active:bg-slate-50",
  ].join(" ");

  const body = (
    <>
      <div className="flex items-start gap-3">
        <div
          className={[
            "flex flex-shrink-0 items-center justify-center rounded-xl font-serif",
            glyphBox,
            glyphSize,
            isLocked
              ? "bg-slate-200 text-slate-400"
              : isMastered
                ? "bg-emerald-600 text-white"
                : "bg-slate-900 text-white",
          ].join(" ")}
        >
          {node.title}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={[
                "rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                node.isUnitChallenge ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-500",
              ].join(" ")}
            >
              {node.isUnitChallenge ? "Sfida" : NODE_TYPE_LABEL[node.type]}
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              HSK {node.hskLevel}
            </span>
            {node.pinyin && (
              <span className="truncate text-sm font-medium text-slate-500">{node.pinyin}</span>
            )}
          </div>
          <p className="mt-1 truncate text-sm font-semibold text-slate-900">{node.meaning}</p>
          {node.grammarPattern && (
            <p className="mt-1 truncate text-[11px] font-medium text-violet-700">{node.grammarPattern}</p>
          )}

          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <StatusBadge status={status} />
              {isMastered && reviewLabel && (
                <span
                  className={[
                    "text-[10px] font-medium",
                    reviewLabel === "Da ripassare" ? "text-amber-700" : "text-slate-400",
                  ].join(" ")}
                >
                  {reviewLabel}
                </span>
              )}
            </span>
            {!isLocked && (
              <ChevronRight size={16} className="flex-shrink-0 text-slate-400" />
            )}
          </div>
        </div>
      </div>

      {isLocked && shownPrereqs.length > 0 && (
        <p className="mt-3 text-xs leading-relaxed text-slate-500">
          Richiede: {shownPrereqs.join(", ")}
          {hiddenPrereqs > 0 ? ` +${hiddenPrereqs}` : ""}
        </p>
      )}
    </>
  );

  if (isLocked) {
    return <article className={shell}>{body}</article>;
  }

  return (
    <button type="button" onClick={onOpen} className={shell}>
      {body}
    </button>
  );
}

function StatusBadge({ status }: { status: NodeProgress["status"] }) {
  if (status === "mastered") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
        <CheckCircle2 size={13} />
        Padroneggiato
      </span>
    );
  }
  if (status === "unlocked") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-700">
        <BookOpen size={13} />
        Sbloccato
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-500">
      <Lock size={13} />
      Bloccato
    </span>
  );
}

function ActionButton({
  onClick,
  icon,
  children,
  variant = "default",
}: {
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
  variant?: "default" | "danger";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex flex-col items-center justify-center gap-1 rounded-xl border px-2 py-3 text-xs font-medium transition-colors",
        variant === "danger"
          ? "border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
      ].join(" ")}
    >
      {icon}
      {children}
    </button>
  );
}
