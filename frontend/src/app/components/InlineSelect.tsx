"use client";

import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Check, Search } from "lucide-react";

interface InlineSelectOption {
  value: string;
  label: string;
}

interface InlineSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: InlineSelectOption[];
  placeholder?: string;
  icon?: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

export default function InlineSelect({
  value,
  onChange,
  options,
  placeholder = "Select an option",
  icon,
  className = "",
  disabled = false,
}: InlineSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside as any);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside as any);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery("");
    } else {
      // Small delay to ensure the input is rendered before focusing
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  const selectedOption = options.find((o) => o.value === value);
  const displayLabel = selectedOption?.label || placeholder;

  const filteredOptions = options.filter(opt => 
    opt.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Trigger button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        className={`relative w-full flex items-center gap-2 ${icon ? 'pl-10' : 'pl-4'} pr-10 py-2 bg-white dark:bg-slate-800 border ${isOpen ? 'border-slate-500 dark:border-slate-400' : 'border-slate-300 dark:border-slate-600'} rounded-sm text-left text-[13px] font-semibold transition-colors ${
          disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
        } ${
          selectedOption
            ? "text-slate-800 dark:text-slate-200"
            : "text-slate-400 dark:text-slate-500"
        }`}
      >
        {icon && (
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500">
            {icon}
          </span>
        )}
        <span className="truncate flex-1">{displayLabel}</span>
        <ChevronDown
          className={`absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Dropdown list – rendered inline below the trigger */}
      {isOpen && (
        <div className="mt-1 absolute top-full left-0 w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-sm overflow-hidden z-[100] flex flex-col">
          <div className="p-1.5 border-b border-slate-100 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900 z-10 shrink-0">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input autoComplete="one-time-code"
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-sm text-xs font-semibold outline-none focus:border-slate-500 dark:focus:border-slate-400"
              />
            </div>
          </div>
          <div className="max-h-56 overflow-y-auto overscroll-contain">
            {filteredOptions.length === 0 ? (
              <div className="px-4 py-2.5 text-xs text-slate-400 italic font-medium">
                No matching options
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 text-left text-[13px] font-semibold transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400"
                        : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 active:bg-slate-100 dark:active:bg-slate-800"
                    }`}
                  >
                    <span className="truncate pr-2">{opt.label}</span>
                    {isSelected && (
                      <Check className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
