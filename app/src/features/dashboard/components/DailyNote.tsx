import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { StickyNote, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { useAuthStore } from "@/store/useAuthStore";
import {
  dailyNoteQueryKey,
  fetchDailyNote,
  saveDailyNote,
} from "../api/dailyNote";

const DEBOUNCE_MS = 800;

function getTodayDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function DailyNote() {
  const uid = useAuthStore((s) => s.user?.uid);
  const todayDate = getTodayDate();
  const qc = useQueryClient();

  const { data: savedText } = useQuery({
    queryKey: dailyNoteQueryKey(uid ?? "", todayDate),
    queryFn: () => fetchDailyNote(uid!, todayDate),
    enabled: !!uid,
    staleTime: 60_000,
  });

  const [text, setText] = useState("");
  const [initialized, setInitialized] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync from server only on first load
  useEffect(() => {
    if (savedText != null && !initialized) {
      setText(savedText);
      setInitialized(true);
    }
  }, [savedText, initialized]);

  // Reset when day changes
  useEffect(() => {
    setInitialized(false);
  }, [todayDate]);

  const mutation = useMutation({
    mutationFn: (newText: string) => saveDailyNote(uid!, todayDate, newText),
    onSuccess: (_data, newText) => {
      qc.setQueryData(dailyNoteQueryKey(uid!, todayDate), newText);
    },
  });

  const debouncedSave = useCallback(
    (value: string) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        if (uid) mutation.mutate(value);
      }, DEBOUNCE_MS);
    },
    [uid, todayDate] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const handleChange = (value: string) => {
    setText(value);
    debouncedSave(value);
  };

  const handleBlur = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (uid && text !== savedText) {
      mutation.mutate(text);
    }
  };

  const handleClear = () => {
    if (!confirm("Wyczyścić notatkę na dziś?")) return;
    setText("");
    if (timerRef.current) clearTimeout(timerRef.current);
    if (uid) mutation.mutate("");
  };

  const formattedDate = format(new Date(), "EEEE, d MMMM yyyy", { locale: pl });

  if (!uid) return null;

  return (
    <section className={`rounded-xl border backdrop-blur-xl p-4 ${
      text.trim()
        ? "border-red-500/60 bg-red-500/5 animate-pulse"
        : "border-[var(--surface-8)] bg-[var(--surface-4)]"
    }`}>
      <div className="flex items-center justify-between mb-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <StickyNote className="h-4 w-4 text-amber-400" />
          <span className="capitalize">{formattedDate}</span>
        </h2>
        {text.trim() && (
          <button
            type="button"
            onClick={handleClear}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
            title="Wyczyść notatkę"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Wyczyść
          </button>
        )}
      </div>
      <textarea
        value={text}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={handleBlur}
        placeholder="Notatka na dziś..."
        rows={3}
        className="w-full resize-y rounded-lg border border-[var(--surface-8)] bg-[var(--surface-2)] px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary/50 transition-shadow"
      />
    </section>
  );
}
