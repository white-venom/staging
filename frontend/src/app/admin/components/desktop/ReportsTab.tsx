"use client";

import React, { useState } from "react";
import { 
  FileText, 
  Download, 
  Search, 
  Filter, 
  Calendar,
  BarChart,
  PieChart,
  TrendingUp,
  ChevronRight,
  Book,
  Receipt,
  FileSpreadsheet,
  IndianRupee,
  Activity
} from "lucide-react";

interface ReportsTabProps {
  collections: any[];
  deposits: any[];
}

export default function ReportsTab({ collections, deposits }: ReportsTabProps) {
  const [dateRange, setDateRange] = useState("all");

  const safeCollections = collections || [];
  const safeDeposits = deposits || [];

  const handleExport = (type: string) => {
    let data: any[] = [];
    const reportName = type === "collections" ? "CASH_IN" : type === "deposits" ? "CASH_OUT" : type.toUpperCase();
    let filename = `DO_IT_${reportName}_REPORT.csv`;

    if (type === "collections") {
      data = safeCollections;
    } else if (type === "deposits") {
      data = safeDeposits;
    } else if (type === "daybook") {
      data = [...safeCollections, ...safeDeposits].sort((a, b) => new Date(b.date || b.created_at).getTime() - new Date(a.date || a.created_at).getTime());
    } else if (type === "cashbook") {
      data = safeDeposits.filter(d => d.paymentMode === "cash");
    } else if (type === "retailer_ledger") {
      data = safeCollections.map(c => ({
        Date: c.date,
        Retailer: c.retailerName,
        Amount: c.totalAmount,
        Staff: c.staffName,
        Remarks: c.remarks
      }));
    }

    if (data.length === 0) {
      alert("No data available for this report.");
      return;
    }
    
    // Clean data for CSV
    const headers = Object.keys(data[0]).join(",");
    const rows = data.map(obj => 
      Object.values(obj).map(v => {
        if (typeof v === 'string') return `"${v.replace(/"/g, '""')}"`;
        if (v === null || v === undefined) return '""';
        if (typeof v === 'object') return '""';
        return v;
      }).join(",")
    ).join("\n");
    
    const csvContent = "data:text/csv;charset=utf-8," + headers + "\n" + rows;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalCollected = safeCollections.reduce((sum, c) => sum + (c.totalAmount || 0), 0);
  const activeRetailers = new Set(safeCollections.map(c => c.retailerName)).size;
  const avgValue = safeCollections.length > 0 ? (totalCollected / safeCollections.length) : 0;

  const reportSections = [
    {
      title: "Accounting & GST",
      reports: [
        { name: "GSTR-1 (Sales/Cash In)", icon: Receipt, formats: "XLSX • CSV", color: "blue", type: "collections" },
        { name: "GSTR-3B Summary", icon: FileSpreadsheet, formats: "PDF • XLSX", color: "blue" },
        { name: "Tally Friendly Import (XML)", icon: Book, formats: "XML • CSV", color: "blue" },
      ]
    },
    {
      title: "Daily Statements",
      reports: [
        { name: "Daybook Summary", icon: Calendar, formats: "PDF", color: "emerald", type: "daybook" },
        { name: "Cashbook (Physical Flow)", icon: IndianRupee, formats: "PDF • XLSX", color: "emerald", type: "cashbook" },
        { name: "Staff Collection Efficiency", icon: Activity, formats: "PDF", color: "emerald" },
      ]
    },
    {
      title: "Retailer & Portals",
      reports: [
        { name: "Retailer Ledger (A-Z)", icon: FileText, formats: "PDF • XLSX", color: "purple", type: "retailer_ledger" },
        { name: "BankAccount Settlement Report", icon: PieChart, formats: "PDF • XLSX", color: "purple" },
      ]
    }
  ];

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg">
              <TrendingUp className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-black text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded-full uppercase tracking-tighter">Live Cash In</span>
          </div>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wide">Total Cash In</p>
          <h3 className="text-2xl font-black text-slate-800 dark:text-white mt-1">
            ₹{totalCollected.toLocaleString()}
          </h3>
        </div>

        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-lg">
              <FileText className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-black text-purple-600 bg-purple-50 dark:bg-purple-900/30 px-2 py-1 rounded-full uppercase tracking-tighter">Coverage</span>
          </div>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wide">Serviced Stores</p>
          <h3 className="text-2xl font-black text-slate-800 dark:text-white mt-1">
            {activeRetailers}
          </h3>
        </div>

        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-lg">
              <BarChart className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-black text-green-600 bg-green-50 dark:bg-green-900/30 px-2 py-1 rounded-full uppercase tracking-tighter">ATV</span>
          </div>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wide">Avg Cash In/Shop</p>
          <h3 className="text-2xl font-black text-slate-800 dark:text-white mt-1">
            ₹{avgValue.toFixed(0)}
          </h3>
        </div>
      </div>

      {/* Professional Report Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {reportSections.map((section, idx) => (
          <div key={idx} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
            <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wide flex items-center gap-2">
              <div className={`w-1 h-3 rounded-full ${section.title.includes('GST') ? 'bg-blue-500' : section.title.includes('Daily') ? 'bg-emerald-500' : 'bg-purple-500'}`} />
              {section.title}
            </h4>
            
            <div className="space-y-3">
              {section.reports.map((report, rIdx) => (
                <div key={rIdx} className="group flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl hover:border-slate-300 dark:hover:border-slate-700 transition-all cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white dark:bg-slate-900 rounded-lg shadow-sm text-slate-500 group-hover:text-slate-900 dark:group-hover:text-slate-100 transition-colors">
                      <report.icon className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-[11px] font-black text-slate-800 dark:text-slate-200 group-hover:text-blue-600 transition-colors">{report.name}</p>
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wide mt-0.5">{report.formats}</p>
                    </div>
                  </div>
                  <button 
                    onClick={(e) => {
                       e.stopPropagation();
                       report.type ? handleExport(report.type) : alert("Report generator for " + report.name + " is being prepared. It will use local balance data to generate PDF.");
                    }}
                    className={`p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity ${report.color === 'blue' ? 'bg-blue-600 text-white' : report.color === 'emerald' ? 'bg-emerald-600 text-white' : 'bg-purple-600 text-white'}`}
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
