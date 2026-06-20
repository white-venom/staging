"use client";

import React, { useState, useEffect } from "react";
import { ChevronDown } from "lucide-react";

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
  const [selectedMonthForDays, setSelectedMonthForDays] = useState<number | null>(null); // 1-indexed or null

  // Parse current value
  const parsed = value ? value.split("-") : null;
  const currentSelectedYear = parsed ? parseInt(parsed[0]) : null;
  const currentSelectedMonth = parsed ? parseInt(parsed[1]) : null;
  const currentSelectedDay = parsed ? parseInt(parsed[2]) : null;

  const [yearsCount, setYearsCount] = useState(15);
  const startYear = 2026;
  const years = Array.from({ length: yearsCount }, (_, i) => startYear + i);

  useEffect(() => {
    if (currentSelectedYear) {
      setExpandedYear(currentSelectedYear);
      if (currentSelectedMonth) {
        setSelectedMonthForDays(currentSelectedMonth);
      }
      if (currentSelectedYear >= startYear) {
        const neededYears = currentSelectedYear - startYear + 5;
        if (neededYears > yearsCount) {
          setYearsCount(neededYears);
        }
      }
    }
  }, [currentSelectedYear, currentSelectedMonth]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (target.scrollHeight - target.scrollTop <= target.clientHeight + 60) {
      setYearsCount((prev) => prev + 10);
    }
  };

  const handleYearToggle = (year: number) => {
    if (expandedYear === year) {
      setExpandedYear(0);
    } else {
      setExpandedYear(year);
    }
    setSelectedMonthForDays(null);
  };

  const handleMonthSelect = (monthIdx: number) => {
    setSelectedMonthForDays(monthIdx + 1);
  };

  const handleDaySelect = (year: number, month: number, day: number) => {
    const mm = String(month).padStart(2, "0");
    const dd = String(day).padStart(2, "0");
    onChange(`${year}-${mm}-${dd}`);
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange("");
    setSelectedMonthForDays(null);
    setIsOpen(false);
  };

  // Format display text for trigger button (e.g. "May 15, 2026")
  const displayText = currentSelectedYear && currentSelectedMonth && currentSelectedDay
    ? `${MONTHS_FULL[currentSelectedMonth - 1]} ${currentSelectedDay}, ${currentSelectedYear}`
    : null;

  // Day calculations
  const daysInMonth = selectedMonthForDays ? getLastDayOfMonth(expandedYear, selectedMonthForDays) : 0;
  const startDayOfWeek = selectedMonthForDays ? new Date(expandedYear, selectedMonthForDays - 1, 1).getDay() : 0;

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
            {displayText || <span className="text-slate-300 dark:text-slate-600">Select Date</span>}
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
              {displayText || "Select Date"}
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
                    onClick={() => handleYearToggle(year)}
                    className="w-full py-2.5 px-4 bg-slate-50 dark:bg-slate-800/60 text-slate-800 dark:text-slate-200 text-sm font-black text-left flex items-center justify-between"
                  >
                    <span>{year}</span>
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Months/Days view if expanded */}
                  {isExpanded && (
                    <>
                      {selectedMonthForDays === null ? (
                        /* Month selection grid */
                        <div className="grid grid-cols-4 gap-2 p-3 bg-white dark:bg-slate-900 border border-t-0 border-slate-50 dark:border-slate-800 rounded-b-2xl">
                          {MONTHS.map((month, idx) => {
                            const isSelected = currentSelectedYear === year && currentSelectedMonth === idx + 1;
                            return (
                              <button
                                key={month}
                                type="button"
                                onClick={() => handleMonthSelect(idx)}
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
                      ) : (
                        /* Day selection grid */
                        <div className="p-3 bg-white dark:bg-slate-900 border border-t-0 border-slate-50 dark:border-slate-800 rounded-b-2xl">
                          {/* Navigation breadcrumb */}
                          <div className="flex items-center justify-between mb-3 border-b border-slate-100 dark:border-slate-800 pb-2">
                            <button
                              type="button"
                              onClick={() => setSelectedMonthForDays(null)}
                              className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase flex items-center gap-1 active:scale-95 transition-transform"
                            >
                              ← Change Month
                            </button>
                            <span className="text-[10px] font-black text-slate-450 dark:text-slate-300 uppercase">
                              {MONTHS_FULL[selectedMonthForDays - 1]} {year}
                            </span>
                          </div>

                          {/* Weekdays */}
                          <div className="grid grid-cols-7 gap-1 text-center text-[9px] font-black text-slate-400 uppercase mb-1.5">
                            <span>S</span><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span>
                          </div>

                          {/* Days Grid */}
                          <div className="grid grid-cols-7 gap-1">
                            {Array.from({ length: startDayOfWeek }).map((_, i) => (
                              <div key={`empty-${i}`} />
                            ))}
                            {Array.from({ length: daysInMonth }).map((_, i) => {
                              const day = i + 1;
                              const isSelected = currentSelectedYear === year && currentSelectedMonth === selectedMonthForDays && currentSelectedDay === day;
                              return (
                                <button
                                  key={day}
                                  type="button"
                                  onClick={() => handleDaySelect(year, selectedMonthForDays, day)}
                                  className={`py-2 text-[11px] font-black rounded-lg transition-all active:scale-90 flex items-center justify-center ${
                                    isSelected
                                      ? "bg-blue-600 text-white ring-2 ring-blue-900 dark:ring-blue-400"
                                      : "text-slate-650 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-800"
                                  }`}
                                >
                                  {day}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </>
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
