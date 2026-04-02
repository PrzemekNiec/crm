import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { StickyNote, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { format, addDays, subDays } from "date-fns";
import { pl } from "date-fns/locale";
import { useAuthStore } from "@/store/useAuthStore";
import {
  dailyNoteQueryKey,
  fetchDailyNote,
  saveDailyNote,
} from "../api/dailyNote";

const DEBOUNCE_MS = 800;

function formatDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isSameDay(a: Date, b: Date) {
  return formatDateKey(a) === formatDateKey(b);
}

export function DailyNote() {
  const uid = useAuthStore((s) => s.user?.uid);
  const qc = useQueryClient();

  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const dateKey = formatDateKey(selectedDate);
  const isToday = isSameDay(selectedDate, new Date());

  const { data: savedText } = useQuery({
    queryKey: dailyNoteQueryKey(uid ?? "", dateKey),
    queryFn: () => fetchDailyNote(uid!, dateKey),
    enabled: !!uid,
    staleTime: 60_000,
  });

  const [text, setText] = useState("");
  const [initialized, setInitialized] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync from server on load or date change
  useEffect(() => {
    if (savedText != null && !initialized) {
      setText(savedText);
      setInitialized(true);
    }
  }, [savedText, initialized]);

  // Reset when date changes
  useEffect(() => {
    setInitialized(false);
  }, [dateKey]);

  const mutation = useMutation({
    mutationFn: (newText: string) => saveDailyNote(uid!, dateKey, newText),
    onSuccess: (_data, newText) => {
      qc.setQueryData(dailyNoteQueryKey(uid!, dateKey), newText);
    },
  });

  const debouncedSave = useCallback(
    (value: string) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        if (uid) mutation.mutate(value);
      }, DEBOUNCE_MS);
    },
    [uid, dateKey] // eslint-disable-line react-hooks/exhaustive-deps
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
    if (!confirm("Wyczyścić notatkę na ten dzień?")) return;
    setText("");
    if (timerRef.current) clearTimeout(timerRef.current);
    if (uid) mutation.mutate("");
  };

  const goDay = (offset: number) => {
    // Save current before navigating
    handleBlur();
    setSelectedDate((d) => (offset > 0 ? addDays(d, 1) : subDays(d, 1)));
  };

  const goToday = () => {
    handleBlur();
    setSelectedDate(new Date());
  };

  const formattedDate = format(selectedDate, "EEEE, d MMMM yyyy", { locale: pl });

  if (!uid) return null;

  return (
    <section className={`rounded-xl border backdrop-blur-xl p-4 ${
      isToday && text.trim()
        ? "border-red-500/60 bg-red-500/5 animate-pulse"
        : "border-[var(--surface-8)] bg-[var(--surface-4)]"
    }`}>
      <div className="flex items-center justify-between mb-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <StickyNote className="h-4 w-4 text-amber-400" />
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => goDay(-1)}
              className="rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-[var(--surface-6)] transition-colors cursor-pointer"
              title="Poprzedni dzień"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={goToday}
              className={`px-1.5 py-0.5 rounded text-xs transition-colors cursor-pointer ${
                isToday
                  ? "text-foreground font-semibold"
                  : "text-primary hover:bg-primary/10 font-medium"
              }`}
              title="Wróć do dziś"
            >
              <span className="capitalize">{formattedDate}</span>
            </button>
            <button
              type="button"
              onClick={() => goDay(1)}
              disabled={isToday}
              className="rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-[var(--surface-6)] transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-default"
              title="Następny dzień"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
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
        placeholder={isToday ? "Notatka na dziś..." : "Notatka na ten dzień..."}
        rows={3}
        className="w-full resize-y rounded-lg border border-[var(--surface-8)] bg-[var(--surface-2)] px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary/50 transition-shadow"
      />
    </section>
  );
}
