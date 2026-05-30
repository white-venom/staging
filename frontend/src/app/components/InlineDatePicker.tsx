"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronLeft, Calendar, Check } from "lucide-react";

interface InlineDatePickerProps {
  value: string; // YYYY-MM-DD or empty
  onChange: (date: string) => void;
  label: string;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export default function InlineDatePicker({ value, onChange, label }: InlineDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<"year" | "month" | "day">("year");
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

  // Parse current value
  const parsed = value ? value.split("-") : null;
  const displayText = parsed
    ? `${parsed[2]} ${MONTHS[parseInt(parsed[1]) - 1]?.slice(0, 3)} ${parsed[0]}`
    : null;

  const currentYear = new Date().getFullYear();
  const years = [currentYear]; // current year only

  const handleOpen = () => {
    setIsOpen(true);
    setStep("year");
    setSelectedYear(null);
    setSelectedMonth(null);
  };

  const handleYearSelect = (year: number) => {
    setSelectedYear(year);
    setStep("month");
  };

  const handleMonthSelect = (month: number) => {
    setSelectedMonth(month);
    setStep("day");
  };

  const handleDaySelect = (day: number) => {
    if (selectedYear && selectedMonth) {
      const mm = String(selectedMonth).padStart(2, "0");
      const dd = String(day).padStart(2, "0");
      onChange(`${selectedYear}-${mm}-${dd}`);
    }
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange("");
    setIsOpen(false);
  };

  return (
    <div className="w-full">
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => (isOpen ? setIsOpen(false) : handleOpen())}
        className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl w-full text-left active:scale-[0.98] transition-transform flex items-center justify-between"
      >
        <div>
          <p className="text-[7px] font-black text-slate-400 uppercase mb-1">{label}</p>
          <p className="text-sm leading-none font-bold dark:text-white">
            {displayText || <span className="text-slate-300 dark:text-slate-600">Select date</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {value && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleClear(); }}
              className="text-[8px] font-black text-red-400 uppercase px-2 py-1 bg-red-50 dark:bg-red-950/30 rounded-lg"
            >
              Clear
            </button>
          )}
          <Calendar className="w-4 h-4 text-slate-400" />
        </div>
      </button>

      {/* Dropdown picker */}
      {isOpen && (
        <div className="mt-2 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Header with back navigation */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
            <div className="flex items-center gap-2">
              {step !== "year" && (
                <button
                  type="button"
                  onClick={() => setStep(step === "day" ? "month" : "year")}
                  className="p-1 rounded-lg bg-white dark:bg-slate-800 text-slate-500 active:scale-90 transition-transform"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              )}
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                {step === "year" && "Select Year"}
                {step === "month" && `${selectedYear} › Select Month`}
                {step === "day" && `${selectedYear} › ${MONTHS[(selectedMonth || 1) - 1]?.slice(0, 3)} › Select Day`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-[8px] font-black text-slate-400 uppercase px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
          </div>

          {/* Year selection */}
          {step === "year" && (
            <div className="grid grid-cols-3 gap-2 p-3 max-h-[200px] overflow-y-auto">
              {years.map((year) => (
                <button
                  key={year}
                  type="button"
                  onClick={() => handleYearSelect(year)}
                  className={`py-3 rounded-xl text-sm font-black transition-all active:scale-95 ${
                    parsed && parseInt(parsed[0]) === year
                      ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                      : "bg-slate-50 dark:bg-slate-700/50 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                  }`}
                >
                  {year}
                </button>
              ))}
            </div>
          )}

          {/* Month selection */}
          {step === "month" && (
            <div className="grid grid-cols-3 gap-2 p-3 max-h-[250px] overflow-y-auto">
              {MONTHS.map((month, idx) => (
                <button
                  key={month}
                  type="button"
                  onClick={() => handleMonthSelect(idx + 1)}
                  className={`py-3 rounded-xl text-xs font-black transition-all active:scale-95 ${
                    parsed && parseInt(parsed[0]) === selectedYear && parseInt(parsed[1]) === idx + 1
                      ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                      : "bg-slate-50 dark:bg-slate-700/50 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                  }`}
                >
                  {month.slice(0, 3)}
                </button>
              ))}
            </div>
          )}

          {/* Day selection */}
          {step === "day" && selectedYear && selectedMonth && (
            <div className="grid grid-cols-7 gap-1 p-3 max-h-[250px] overflow-y-auto">
              {/* Day header labels */}
              {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
                <div key={d} className="text-center text-[8px] font-black text-slate-400 uppercase py-1">
                  {d}
                </div>
              ))}
              {/* Empty cells for offset */}
              {Array.from({ length: new Date(selectedYear, selectedMonth - 1, 1).getDay() }, (_, i) => (
                <div key={`empty-${i}`} />
              ))}
              {/* Day buttons */}
              {Array.from({ length: getDaysInMonth(selectedYear, selectedMonth) }, (_, i) => {
                const day = i + 1;
                const isSelected =
                  parsed &&
                  parseInt(parsed[0]) === selectedYear &&
                  parseInt(parsed[1]) === selectedMonth &&
                  parseInt(parsed[2]) === day;
                const isToday =
                  new Date().getFullYear() === selectedYear &&
                  new Date().getMonth() + 1 === selectedMonth &&
                  new Date().getDate() === day;
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => handleDaySelect(day)}
                    className={`w-full aspect-square rounded-xl text-xs font-bold flex items-center justify-center transition-all active:scale-90 ${
                      isSelected
                        ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                        : isToday
                        ? "bg-blue-50 dark:bg-blue-950/30 text-blue-600 ring-1 ring-blue-200 dark:ring-blue-800"
                        : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
