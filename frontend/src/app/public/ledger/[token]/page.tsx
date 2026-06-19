"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "../../../utils/api";
import LedgerReportView from "../../../components/LedgerReportView";

export default function PublicRetailerLedgerPage() {
  const params = useParams();
  const token = params.token as string;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (token) {
      api.getPublicLedger(token)
        .then((res) => {
          setData(res);
          setLoading(false);
          if (res && res.retailer_name) {
            document.title = `Report of ${res.retailer_name}`;
          }
        })
        .catch((err) => {
          setError(err.message || "Failed to load ledger statement.");
          setLoading(false);
        });
    }
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="text-center text-red-500 font-bold bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-sm w-full">
          <p className="text-sm">{error || "Invalid or expired secure statement link."}</p>
        </div>
      </div>
    );
  }

  const formattedHistory = (data.statement_history || []).map((tx: any) => ({
    id: String(tx.id),
    date: tx.date,
    transaction_type: tx.transaction_type, // 'credit' or 'debit'
    amount: Number(tx.amount),
    running_balance: Number(tx.running_balance),
    description: tx.description,
    remarks: tx.remarks,
    reference_no: tx.reference_no,
    store_name: tx.store_name,
    portal_name: tx.portal_name,
    portal_bank_name: tx.portal_bank_name,
    deposit_type: tx.deposit_type
  }));

  const publicLink = typeof window !== "undefined" 
    ? `${window.location.origin}/public/ledger/${token}`
    : "";

  return (
    <LedgerReportView 
      title={data.retailer_name}
      subtitle={data.phone ? `Phone: ${data.phone}` : `Route: ${data.address}`}
      data={formattedHistory}
      outstandingBalance={data.outstanding_balance}
      isPublic={true}
      publicLink={publicLink}
    />
  );
}
