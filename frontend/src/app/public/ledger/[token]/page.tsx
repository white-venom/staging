"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

export default function LedgerReceiptPage() {
  const params = useParams();
  const token = params.token as string;

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // In a real application, you would fetch the ledger details using this token
    // from your backend API: `/api/public/ledger/${token}`
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1500);

    return () => clearTimeout(timer);
  }, [token]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 text-center border border-gray-100">
        <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
          </svg>
        </div>
        
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Transaction Successful</h1>
        
        {loading ? (
          <div className="animate-pulse space-y-4 mt-8">
            <div className="h-4 bg-gray-200 rounded w-3/4 mx-auto"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto"></div>
            <div className="h-8 bg-gray-200 rounded w-full mt-6"></div>
          </div>
        ) : (
          <div className="mt-8 text-left">
            <p className="text-gray-600 mb-6 text-center">
              Your ledger has been successfully updated. This is a secure digital receipt.
            </p>
            
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <div className="flex justify-between mb-2">
                <span className="text-gray-500">Secure Token:</span>
                <span className="font-mono text-xs text-gray-800 bg-gray-200 px-2 py-1 rounded">{token.substring(0, 8)}...</span>
              </div>
              <div className="flex justify-between mb-2">
                <span className="text-gray-500">Date:</span>
                <span className="font-medium text-gray-800">{new Date().toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Status:</span>
                <span className="font-medium text-green-600">Verified</span>
              </div>
            </div>

            <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-xl transition duration-200 ease-in-out">
              Download Full Statement
            </button>
          </div>
        )}
        
        <div className="mt-8 text-sm text-gray-400">
          Powered by DO IT SERVICES
        </div>
      </div>
    </div>
  );
}
