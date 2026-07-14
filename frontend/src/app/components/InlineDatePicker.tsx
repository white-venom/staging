"use client";
import React, { useState, useEffect } from "react";
import { ChevronDown } from "lucide-react";

interface InlineDatePickerProps {
  value: string; // YYYY-MM-DD or empty
  onChange: (date: string) => void;
  label: string;
  type: "from" | "to";
}

const MONTHS_FULL = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

function getLastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export default function InlineDatePicker({ value, onChange, label, type }: InlineDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Parse current value
  const parsed = value ? value.split("-") : null;
  const currentSelectedYear = parsed ? parseInt(parsed[0]) : null;
  const currentSelectedMonth = parsed ? parseInt(parsed[1]) : null;
  const currentSelectedDay = parsed ? parseInt(parsed[2]) : null;

  const [expandedYear, setExpandedYear] = useState<number>(
    currentSelectedYear || new Date().getFullYear()
  );
  const [selectedMonthForDays, setSelectedMonthForDays] = useState<number>(
    currentSelectedMonth || (new Date().getMonth() + 1)
  );

  const startYear = 2024;
  const years = Array.from({ length: 10 }, (_, i) => startYear + i);

  useEffect(() => {
    if (currentSelectedYear) {
      setExpandedYear(currentSelectedYear);
    }
    if (currentSelectedMonth) {
      setSelectedMonthForDays(currentSelectedMonth);
    }
  }, [currentSelectedYear, currentSelectedMonth]);

  const handleDaySelect = (year: number, month: number, day: number) => {
    const mm = String(month).padStart(2, "0");
    const dd = String(day).padStart(2, "0");
    onChange(`${year}-${mm}-${dd}`);
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange("");
    setIsOpen(false);
  };

  // Format display text for trigger button (e.g. "May 15, 2026")
  const displayText = currentSelectedYear && currentSelectedMonth && currentSelectedDay
    ? `${MONTHS_FULL[currentSelectedMonth - 1]} ${currentSelectedDay}, ${currentSelectedYear}`
    : null;

  // Day calculations
  const daysInMonth = getLastDayOfMonth(expandedYear, selectedMonthForDays);
  const startDayOfWeek = new Date(expandedYear, selectedMonthForDays - 1, 1).getDay();

  return (
    <div className="w-full relative">
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 p-2.5 rounded-sm w-full text-left flex items-center justify-between"
      >
        <div>
          <p className="text-[7px] font-black text-slate-400 uppercase mb-1">{label}</p>
          <p className="text-sm leading-none font-bold dark:text-white">
            {displayText || <span className="text-slate-300 dark:text-slate-600">Select Date</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ChevronDown className="w-4 h-4 text-slate-400" />
        </div>
      </button>

      {/* Dropdown Picker */}
      {isOpen && (
        <div
          className="absolute left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-sm z-50 p-3 space-y-2 text-left"
        >
          {/* Header with Month & Year Dropdowns */}
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-1.5">
              <select
                value={selectedMonthForDays}
                onChange={(e) => setSelectedMonthForDays(parseInt(e.target.value))}
                className="text-xs font-black bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-sm px-2 py-1.5 outline-none cursor-pointer"
              >
                {MONTHS_FULL.map((m, idx) => (
                  <option key={m} value={idx + 1}>{m}</option>
                ))}
              </select>

              <select
                value={expandedYear}
                onChange={(e) => setExpandedYear(parseInt(e.target.value))}
                className="text-xs font-black bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-sm px-2 py-1.5 outline-none cursor-pointer"
              >
                {years.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-[9px] font-black text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 uppercase px-2 py-1 rounded-sm cursor-pointer transition-colors"
            >
              Close
            </button>
          </div>

          {/* Weekdays */}
          <div className="grid grid-cols-7 gap-1 text-center text-[9px] font-black text-slate-400 uppercase mb-1">
            <span>S</span><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span>
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: startDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const isSelected = currentSelectedYear === expandedYear && currentSelectedMonth === selectedMonthForDays && currentSelectedDay === day;
              const isToday = new Date().getDate() === day && (new Date().getMonth() + 1) === selectedMonthForDays && new Date().getFullYear() === expandedYear;
              
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => handleDaySelect(expandedYear, selectedMonthForDays, day)}
                  className={`py-1.5 text-xs font-bold rounded-sm transition-colors flex items-center justify-center cursor-pointer ${
                    isSelected
                      ? "bg-blue-600 text-white font-black"
                      : isToday
                      ? "border border-blue-500 text-blue-600 dark:text-blue-400 font-black hover:bg-slate-50 dark:hover:bg-slate-800"
                      : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
