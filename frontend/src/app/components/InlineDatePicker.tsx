"use client";

import React, { useState, useEffect } from "react";
import { ChevronDown, Calendar } from "lucide-react";

interface InlineDatePickerProps {
  value: string; // YYYY-MM-DD or empty
  onChange: (date: string) => void;
  label: string;
  type: "from" | "to";
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sept", "Oct", "Nov", "Dec"
];

const MONTHS_FULL = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

function getLastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export default function InlineDatePicker({ value, onChange, label, type }: InlineDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedYear, setExpandedYear] = useState<number>(new Date().getFullYear());

  // Parse current value
  const parsed = value ? value.split("-") : null;
  const currentSelectedYear = parsed ? parseInt(parsed[0]) : null;
  const currentSelectedMonth = parsed ? parseInt(parsed[1]) : null;

  const [yearsCount, setYearsCount] = useState(15);
  const startYear = 2026;
  const years = Array.from({ length: yearsCount }, (_, i) => startYear + i);

  useEffect(() => {
    if (currentSelectedYear) {
      setExpandedYear(currentSelectedYear);
      if (currentSelectedYear >= startYear) {
        const neededYears = currentSelectedYear - startYear + 5;
        if (neededYears > yearsCount) {
          setYearsCount(neededYears);
        }
      }
    }
  }, [currentSelectedYear]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    // When scrolled near the bottom, load 10 more years
    if (target.scrollHeight - target.scrollTop <= target.clientHeight + 60) {
      setYearsCount((prev) => prev + 10);
    }
  };

  const handleMonthSelect = (year: number, monthIdx: number) => {
    const monthNum = monthIdx + 1;
    if (type === "from") {
      // First day of the selected month
      const mm = String(monthNum).padStart(2, "0");
      onChange(`${year}-${mm}-01`);
    } else {
      // Last day of the selected month
      const lastDay = getLastDayOfMonth(year, monthNum);
      const mm = String(monthNum).padStart(2, "0");
      const dd = String(lastDay).padStart(2, "0");
      onChange(`${year}-${mm}-${dd}`);
    }
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange("");
    setIsOpen(false);
  };

  // Format display text for trigger button (e.g. "May 2026")
  const displayText = currentSelectedYear && currentSelectedMonth
    ? `${MONTHS_FULL[currentSelectedMonth - 1]} ${currentSelectedYear}`
    : null;

  return (
    <div className="w-full">
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl w-full text-left active:scale-[0.98] transition-transform flex items-center justify-between"
      >
        <div>
          <p className="text-[7px] font-black text-slate-400 uppercase mb-1">{label}</p>
          <p className="text-sm leading-none font-bold dark:text-white">
            {displayText || <span className="text-slate-300 dark:text-slate-600">Select month</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {value && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleClear();
              }}
              className="text-[8px] font-black text-red-400 uppercase px-2 py-1 bg-red-50 dark:bg-red-950/30 rounded-lg"
            >
              Clear
            </button>
          )}
          <ChevronDown className="w-4 h-4 text-slate-400" />
        </div>
      </button>

      {/* Accordion Dropdown Picker */}
      {isOpen && (
        <div 
          onScroll={handleScroll}
          className="mt-2 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 p-4 max-h-[350px] overflow-y-auto scrollbar-hide"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-3">
            <span className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
              {displayText ? `${displayText} ▾` : "Select Date ▾"}
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-[9px] font-black text-slate-400 uppercase px-2 py-1 rounded-lg"
            >
              Cancel
            </button>
          </div>

          {/* Years list (Accordion style) */}
          <div className="space-y-2">
            {years.map((year) => {
              const isExpanded = expandedYear === year;
              return (
                <div key={year} className="overflow-hidden rounded-2xl">
                  {/* Year selector bar */}
                  <button
                    type="button"
                    onClick={() => setExpandedYear(isExpanded ? 0 : year)}
                    className="w-full py-2.5 px-4 bg-slate-50 dark:bg-slate-800/60 text-slate-800 dark:text-slate-200 text-sm font-black text-left flex items-center justify-between"
                  >
                    <span>{year}</span>
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Months Grid if expanded */}
                  {isExpanded && (
                    <div className="grid grid-cols-4 gap-2 p-3 bg-white dark:bg-slate-900 border border-t-0 border-slate-50 dark:border-slate-800 rounded-b-2xl">
                      {MONTHS.map((month, idx) => {
                        const isSelected = currentSelectedYear === year && currentSelectedMonth === idx + 1;
                        return (
                          <button
                            key={month}
                            type="button"
                            onClick={() => handleMonthSelect(year, idx)}
                            className={`py-3 text-xs font-black rounded-xl transition-all active:scale-90 ${
                              isSelected
                                ? "bg-blue-600 text-white ring-2 ring-blue-900 dark:ring-blue-400"
                                : "text-slate-650 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-800"
                            }`}
                          >
                            {month}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
