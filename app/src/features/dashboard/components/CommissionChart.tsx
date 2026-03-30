import { useMemo, useState } from "react";
import { BarChart3 } from "lucide-react";
import type { DealDTO } from "@/features/deals/types/deal";

const MONTH_LABELS = [
  "Sty", "Lut", "Mar", "Kwi", "Maj", "Cze",
  "Lip", "Sie", "Wrz", "Paź", "Lis", "Gru",
];

function formatPLN(value: number): string {
  return value.toLocaleString("pl-PL", {
    style: "currency",
    currency: "PLN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

interface Props {
  deals: DealDTO[];
}

export function CommissionChart({ deals }: Props) {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth(); // 0-indexed
  const [selectedYear, setSelectedYear] = useState(currentYear);

  // Available years from deal payoutDates
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    years.add(currentYear);
    for (const d of deals) {
      if (d.payoutDate) {
        const y = parseInt(d.payoutDate.slice(0, 4), 10);
        if (!isNaN(y)) years.add(y);
      }
    }
    return Array.from(years).sort((a, b) => b - a);
  }, [deals, currentYear]);

  // Monthly commission data
  const { months, maxValue, totalValue } = useMemo(() => {
    const monthlyTotals = new Array(12).fill(0) as number[];

    for (const d of deals) {
      if (d.stage !== "wyplata" || !d.payoutDate || !d.commissionValue) continue;
      const [yearStr, monthStr] = d.payoutDate.split("-");
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10) - 1; // 0-indexed
      if (year === selectedYear && month >= 0 && month < 12) {
        monthlyTotals[month] += d.commissionValue;
      }
    }

    const maxVal = Math.max(...monthlyTotals, 0);
    const total = monthlyTotals.reduce((s, v) => s + v, 0);

    return {
      months: monthlyTotals.map((value, i) => ({
        label: MONTH_LABELS[i],
        value,
        index: i,
      })),
      maxValue: maxVal,
      totalValue: total,
    };
  }, [deals, selectedYear]);

  return (
    <section className="rounded-xl border border-[var(--surface-8)] bg-[var(--surface-4)] backdrop-blur-xl p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <BarChart3 className="h-4 w-4 text-emerald-400" />
            Prowizje {selectedYear}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Łącznie: <span className="text-emerald-400 font-semibold">{formatPLN(totalValue)}</span>
          </p>
        </div>
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(Number(e.target.value))}
          className="rounded-md border border-[var(--surface-8)] bg-[var(--surface-2)] px-2 py-1 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary/50"
        >
          {availableYears.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {/* Chart */}
      <div className="flex items-end gap-1.5 sm:gap-2 h-48">
        {months.map((m) => {
          const heightPercent = maxValue > 0 ? (m.value / maxValue) * 100 : 0;
          const isCurrentMonth = selectedYear === currentYear && m.index === currentMonth;
          const hasValue = m.value > 0;

          return (
            <div key={m.index} className="flex-1 flex flex-col items-center gap-1 h-full justify-end group">
              {/* Bar */}
              <div
                className={`w-full rounded-t-md transition-all duration-300 cursor-default ${
                  isCurrentMonth
                    ? "bg-primary hover:bg-primary/80"
                    : hasValue
                      ? "bg-emerald-500/60 hover:bg-emerald-500/80"
                      : "bg-[var(--surface-8)]"
                }`}
                style={{ height: hasValue ? `${Math.max(heightPercent, 4)}%` : "2px" }}
                title={hasValue ? `${m.label} ${selectedYear}: ${formatPLN(m.value)}` : `${m.label}: brak`}
              />
              {/* Label */}
              <span className={`text-[10px] leading-none ${
                isCurrentMonth ? "text-primary font-bold" : "text-muted-foreground"
              }`}>
                {m.label}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
