"use client";

import React, { useState, useEffect } from "react";
import { X } from "lucide-react";
import { api } from "../utils/api";
import LedgerReportView from "./LedgerReportView";
import InlineSelect from "./InlineSelect";
import { getISTDateString } from "../utils/dateHelpers";

export interface LedgerTarget {
  id: string;
  bank_account_name: string;
  bank_name: string;
  bank_account_no: string;
  ifsc_code: string;
  isGroupLedger?: boolean; // true = consolidated Portal wallet, false/undefined = single Bank Account
}

interface BankAccountLedgerModalProps {
  target: LedgerTarget | null;
  onClose: () => void;
  portalDirectory: any[];
  retailerDirectory: any[];
  userDirectory: any[];
  showToastNotification: (msg: string) => void;
  fetchData?: () => void;
}

export default function BankAccountLedgerModal({
  target,
  onClose,
  portalDirectory,
  retailerDirectory,
  userDirectory,
  showToastNotification,
  fetchData
}: BankAccountLedgerModalProps) {
  const [ledgerData, setLedgerData] = useState<any[]>([]);
  const [ledgerOutstanding, setLedgerOutstanding] = useState(0);
  const [loadingLedger, setLoadingLedger] = useState(false);

  // Edit Entry states (Bank Account Ledger)
  const [isEditEntryModalOpen, setIsEditEntryModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<any | null>(null);
  const [editingIsDeposit, setEditingIsDeposit] = useState(false);

  const [selectedNewRetailerId, setSelectedNewRetailerId] = useState("");
  const [selectedNewStoreId, setSelectedNewStoreId] = useState("");
  const [availableStores, setAvailableStores] = useState<any[]>([]);
  const [selectedNewPortalId, setSelectedNewPortalId] = useState("");
  const [selectedNewBankAccountId, setSelectedNewBankAccountId] = useState("");
  const [selectedNewRecipientStaffId, setSelectedNewRecipientStaffId] = useState("");
  const [selectedNewToOffice, setSelectedNewToOffice] = useState(false);
  const [selectedNewDepositType, setSelectedNewDepositType] = useState("");
  const [selectedNewPaymentMode, setSelectedNewPaymentMode] = useState("");
  const [selectedNewAmount, setSelectedNewAmount] = useState(0);
  const [selectedNewDate, setSelectedNewDate] = useState("");
  const [selectedNewRefNo, setSelectedNewRefNo] = useState("");
  const [selectedNewRemarks, setSelectedNewRemarks] = useState("");
  const [selectedNewVirtualTargetType, setSelectedNewVirtualTargetType] = useState("retailer");
  const [isSavingEntry, setIsSavingEntry] = useState(false);

  const [selectedNewDenoms, setSelectedNewDenoms] = useState({
    note_500: 0,
    note_200: 0,
    note_100: 0,
    note_50: 0,
    note_20: 0,
    note_10: 0,
    coins: 0,
    online_amount: 0,
  });

  useEffect(() => {
    const fetchStores = async () => {
      if (selectedNewRetailerId) {
        try {
          const stores = await api.getRetailerStores(selectedNewRetailerId);
          setAvailableStores(stores || []);
          if (editingEntry && (editingEntry.retailer_id === selectedNewRetailerId || editingEntry.retailerId === selectedNewRetailerId)) {
            setSelectedNewStoreId(editingEntry.store_id || editingEntry.storeId || "");
          } else {
            setSelectedNewStoreId("");
          }
        } catch (err) {
          console.error("Failed to fetch stores in edit modal:", err);
          setAvailableStores([]);
          setSelectedNewStoreId("");
        }
      } else {
        setAvailableStores([]);
        setSelectedNewStoreId("");
      }
    };
    fetchStores();
  }, [selectedNewRetailerId, editingEntry]);

  const reloadLedger = async (t: LedgerTarget) => {
    setLoadingLedger(true);
    try {
      const res = t.isGroupLedger
        ? await api.getPortalLedger(t.id)
        : await api.getBankAccountLedger(t.id);
      setLedgerData(res.statement_history || []);
      setLedgerOutstanding(res.outstanding_balance || 0);
    } catch (err: any) {
      showToastNotification("Failed to reload ledger: " + err.message);
    } finally {
      setLoadingLedger(false);
    }
  };

  useEffect(() => {
    if (target) {
      setLoadingLedger(true);
      const load = async () => {
        try {
          const res = target.isGroupLedger
            ? await api.getPortalLedger(target.id)
            : await api.getBankAccountLedger(target.id);
          setLedgerData(res.statement_history || []);
          setLedgerOutstanding(res.outstanding_balance || 0);
        } catch (err: any) {
          console.error("Failed to load ledger:", err);
          alert("Failed to load ledger: " + err.message);
          onClose();
        } finally {
          setLoadingLedger(false);
        }
      };
      load();
    } else {
      setLedgerData([]);
      setLedgerOutstanding(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.id, target?.isGroupLedger]);

  const handleDenomValChange = (key: string, value: string) => {
    const val = value === "" ? 0 : parseFloat(value) || 0;
    setSelectedNewDenoms(prev => {
      const updated = {
        ...prev,
        [key]: val
      };

      const totalCash = (
        (updated.note_500 || 0) * 500 +
        (updated.note_200 || 0) * 200 +
        (updated.note_100 || 0) * 100 +
        (updated.note_50 || 0) * 50 +
        (updated.note_20 || 0) * 20 +
        (updated.note_10 || 0) * 10 +
        (updated.coins || 0)
      );
      setSelectedNewAmount(totalCash);
      return updated;
    });
  };

  const handleStartEditEntry = (item: any) => {
    const isDeposit = item.deposit_id != null;
    setEditingIsDeposit(isDeposit);
    setEditingEntry(item);

    setSelectedNewRetailerId(item.retailer_id || "");
    setSelectedNewStoreId(item.store_id || item.storeId || "");
    setSelectedNewPortalId(""); // re-derived from bank_account_id below via effectiveEditPortalId
    setSelectedNewBankAccountId(item.bank_account_id || "");
    setSelectedNewRemarks(item.remarks || "");
    setSelectedNewDate((item.date || "").split(" ")[0]);

    const isOnlineCol = !isDeposit && (item.bank_account_id != null || (item.denominations && Number(item.denominations.online_amount || 0) > 0));
    const initialPaymentMode = isDeposit ? (item.payment_mode || "online") : (isOnlineCol ? "online" : "cash");
    setSelectedNewPaymentMode(initialPaymentMode);
    setSelectedNewAmount(Number(item.amount || 0));

    if (isDeposit) {
      setSelectedNewDepositType(item.deposit_type || "retailer");
      setSelectedNewRefNo(item.reference_no || "");
      setSelectedNewRecipientStaffId(item.recipient_staff_id || "");
      setSelectedNewToOffice(item.to_office === true);
      const hasStaff = !!(item.recipient_staff_id || item.recipientStaffId);
      setSelectedNewVirtualTargetType(hasStaff ? "staff" : "retailer");
    }

    if (item.denominations) {
      setSelectedNewDenoms({
        note_500: Number(item.denominations.note_500 || 0),
        note_200: Number(item.denominations.note_200 || 0),
        note_100: Number(item.denominations.note_100 || 0),
        note_50: Number(item.denominations.note_50 || 0),
        note_20: Number(item.denominations.note_20 || 0),
        note_10: Number(item.denominations.note_10 || 0),
        coins: Number(item.denominations.coins || 0),
        online_amount: Number(item.denominations.online_amount || 0),
      });
    } else {
      setSelectedNewDenoms({
        note_500: 0,
        note_200: 0,
        note_100: 0,
        note_50: 0,
        note_20: 0,
        note_10: 0,
        coins: 0,
        online_amount: initialPaymentMode === "online" ? Number(item.amount || 0) : 0,
      });
    }

    setIsEditEntryModalOpen(true);
  };

  const handleDeleteEntry = async (item: any) => {
    if (!window.confirm("Delete this entry? This will permanently update balances.")) return;
    try {
      const isDeposit = item.deposit_id != null;
      const targetId = item.collection_id || item.deposit_id;
      if (!targetId) return;

      if (isDeposit) {
        await api.deleteDeposit(targetId);
      } else {
        await api.deleteCollection(targetId);
      }
      showToastNotification("Entry deleted successfully.");
      if (target) {
        await reloadLedger(target);
      }
      if (fetchData) fetchData();
    } catch (err: any) {
      showToastNotification("Failed to delete entry: " + err.message);
    }
  };

  const handleSaveEntryEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEntry) return;
    setIsSavingEntry(true);

    try {
      const targetId = editingEntry.collection_id || editingEntry.deposit_id;
      if (!targetId) return;

      const payloadDenoms = selectedNewPaymentMode === "cash"
        ? { ...selectedNewDenoms, online_amount: 0 }
        : { note_500: 0, note_200: 0, note_100: 0, note_50: 0, note_20: 0, note_10: 0, coins: 0, online_amount: Number(selectedNewAmount) };

      if (editingIsDeposit) {
        const bankAccountId = selectedNewDepositType === "portal" || selectedNewDepositType === "virtual" ? selectedNewBankAccountId : null;
        const retailerId = selectedNewDepositType === "retailer" || (selectedNewDepositType === "virtual" && selectedNewVirtualTargetType === "retailer") ? selectedNewRetailerId : null;
        const recipientStaffId = (selectedNewDepositType === "staff" && !selectedNewToOffice) || (selectedNewDepositType === "virtual" && selectedNewVirtualTargetType === "staff") ? selectedNewRecipientStaffId : null;
        const toOffice = selectedNewDepositType === "staff" ? selectedNewToOffice : false;

        await api.updateDeposit(targetId, {
          deposit_type: selectedNewDepositType,
          bank_account_id: bankAccountId,
          retailer_id: retailerId,
          recipient_staff_id: recipientStaffId,
          to_office: toOffice,
          payment_mode: selectedNewPaymentMode,
          amount: Number(selectedNewAmount),
          deposit_date: selectedNewDate || getISTDateString(),
          reference_no: selectedNewRefNo || null,
          remarks: selectedNewRemarks || null,
          denominations: payloadDenoms
        });
      } else {
        await api.updateCollection(targetId, {
          retailer_id: selectedNewRetailerId || null,
          bank_account_id: selectedNewPaymentMode === "online" ? selectedNewBankAccountId : null,
          store_id: selectedNewStoreId || null,
          total_amount: selectedNewAmount,
          collection_date: selectedNewDate || getISTDateString(),
          remarks: selectedNewRemarks || "",
          denominations: payloadDenoms
        });
      }
      showToastNotification("Entry updated successfully.");
      setIsEditEntryModalOpen(false);
      if (target) {
        await reloadLedger(target);
      }
      if (fetchData) fetchData();
    } catch (err: any) {
      showToastNotification("Failed to update: " + err.message);
    } finally {
      setIsSavingEntry(false);
    }
  };

  // Edit modal's portal selector: once the user picks one, use it. Before
  // that -- e.g. right when the modal opens pre-filled from an existing
  // deposit -- derive it from whichever portal actually owns the already
  // selected bank account, so editing an entry doesn't force a re-selection.
  const effectiveEditPortalId = selectedNewPortalId
    || (portalDirectory || []).find((g: any) => (g.bankAccounts || []).some((ba: any) => ba.id === selectedNewBankAccountId))?.id
    || "";

  if (!target) return null;

  return (
    <>
      <div className="fixed inset-0 bg-slate-950 z-50 overflow-y-auto select-none">
        {loadingLedger ? (
          <div className="min-h-screen bg-slate-950 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-slate-300 border-t-slate-700 rounded-full animate-spin"></div>
          </div>
        ) : (
          <LedgerReportView
            title={target.bank_account_name}
            subtitle={`Bank: ${target.bank_name || 'N/A'} • A/C: ${target.bank_account_no || 'N/A'}`}
            data={ledgerData}
            outstandingBalance={ledgerOutstanding}
            isPublic={false}
            onBack={onClose}
            onEditEntry={handleStartEditEntry}
            onDeleteEntry={handleDeleteEntry}
          />
        )}
      </div>

      {/* EDIT TRANSACTION ENTRY MODAL */}
      {isEditEntryModalOpen && editingEntry && (
        <div className="fixed inset-0 bg-slate-900/60 z-[60] flex items-center justify-center p-4 select-none">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-sm w-full max-w-sm max-h-[90vh] overflow-y-auto p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">
                {editingIsDeposit ? "Edit Cash Out Entry" : "Edit Cash In Entry"}
              </h3>
              <button
                onClick={() => setIsEditEntryModalOpen(false)}
                className="p-1.5 rounded-sm bg-slate-100 dark:bg-slate-800 text-slate-500 cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveEntryEdit} className="space-y-4">
              <div className="space-y-3">

                {!editingIsDeposit && (
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Retailer</label>
                    <InlineSelect
                      value={selectedNewRetailerId}
                      onChange={setSelectedNewRetailerId}
                      options={[
                        { value: "", label: "No Retailer" },
                        ...retailerDirectory.map((r: any) => ({ value: String(r.id), label: r.name }))
                      ]}
                      placeholder="No Retailer"
                    />
                  </div>
                )}

                {!editingIsDeposit && (availableStores.length > 0 || editingEntry?.store_name) && (
                  <div className="space-y-1">
                    <div className="flex justify-between items-center px-1">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase">Parent Store (Shop/Branch)</label>
                      {editingEntry?.store_name && (
                        <span className="text-[9px] text-amber-500 font-bold">
                          (Original: {editingEntry.store_name})
                        </span>
                      )}
                    </div>
                    {availableStores.length > 0 ? (
                      <InlineSelect
                        value={selectedNewStoreId}
                        onChange={setSelectedNewStoreId}
                        options={[
                          { value: "", label: "None / Cash" },
                          ...availableStores.map((s: any) => ({ value: String(s.id), label: s.store_name }))
                        ]}
                        placeholder="None / Cash"
                      />
                    ) : (
                      <div className="text-[11px] text-slate-400 italic px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-sm border border-dashed border-slate-200 dark:border-slate-800">
                        No stores available for this retailer
                      </div>
                    )}
                  </div>
                )}

                {/* PAYMENT MODE SELECTOR (for Collections) */}
                {!editingIsDeposit && (
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Payment Mode</label>
                    <select
                      value={selectedNewPaymentMode}
                      onChange={(e) => {
                        const mode = e.target.value;
                        setSelectedNewPaymentMode(mode);
                        if (mode === "cash") {
                          setSelectedNewBankAccountId("");
                        }
                      }}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-sm text-xs font-semibold"
                    >
                      <option value="cash">Cash</option>
                      <option value="online">Online</option>
                    </select>
                  </div>
                )}

                {/* BANK ACCOUNT SELECTOR (only for Online collections) */}
                {!editingIsDeposit && selectedNewPaymentMode === "online" && (
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Bank Account Channel</label>
                    <InlineSelect
                      value={selectedNewBankAccountId}
                      onChange={setSelectedNewBankAccountId}
                      options={[
                        { value: "", label: "Select Bank Account" },
                        ...portalDirectory
                          .flatMap((group: any) =>
                            (group.bankAccounts || [])
                              .filter((ba: any) => ba.show_in_online_payment)
                              .map((ba: any) => ({
                                value: String(ba.id),
                                label: `${group.name} — ${ba.bank_account_name}`,
                              }))
                          )
                      ]}
                      placeholder="Select Bank Account"
                    />
                  </div>
                )}

                {/* DEPOSIT TYPE AND FIELDS (only for Deposits/Cash Out) */}
                {editingIsDeposit && (
                  <>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Deposit Type</label>
                      <select
                        value={selectedNewDepositType === "virtual" ? (selectedNewPaymentMode === "refund" ? "virtual-refund" : "virtual-load") : selectedNewDepositType}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === "virtual-load") {
                            setSelectedNewDepositType("virtual");
                            setSelectedNewPaymentMode("online");
                          } else if (val === "virtual-refund") {
                            setSelectedNewDepositType("virtual");
                            setSelectedNewPaymentMode("refund");
                          } else {
                            setSelectedNewDepositType(val);
                            if (val === "portal" || val === "retailer") {
                              setSelectedNewPaymentMode("online");
                            } else if (val === "staff") {
                              setSelectedNewPaymentMode("cash");
                            }
                          }
                        }}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-sm text-xs font-semibold"
                      >
                        <option value="portal">Cash Out</option>
                        <option value="retailer">Retailer Payout</option>
                        <option value="staff">Direct Handover</option>
                        <option value="virtual-load">Virtual Transfer</option>
                        <option value="virtual-refund">Move to Distributor</option>
                      </select>
                    </div>

                    {selectedNewDepositType === "portal" && (
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Target Bank Account</label>
                        <InlineSelect
                          value={selectedNewBankAccountId}
                          onChange={setSelectedNewBankAccountId}
                          options={[
                            { value: "", label: "Select Bank Account" },
                            ...portalDirectory
                              .flatMap((group: any) =>
                                (group.bankAccounts || []).map((ba: any) => ({
                                  value: String(ba.id),
                                  label: `${group.name} — ${ba.bank_account_name}`,
                                }))
                              )
                          ]}
                          placeholder="Select Bank Account"
                        />
                      </div>
                    )}

                    {selectedNewDepositType === "retailer" && (
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Target Retailer</label>
                        <InlineSelect
                          value={selectedNewRetailerId}
                          onChange={setSelectedNewRetailerId}
                          options={[
                            { value: "", label: "Select Retailer" },
                            ...retailerDirectory.map((r: any) => ({ value: String(r.id), label: r.name }))
                          ]}
                          placeholder="Select Retailer"
                        />
                      </div>
                    )}

                    {selectedNewDepositType === "staff" && (
                      <>
                        <div className="flex items-center gap-1.5 py-0.5">
                          <input
                            type="checkbox"
                            id="editToOfficeCheckboxDesktop"
                            checked={selectedNewToOffice}
                            onChange={(e) => setSelectedNewToOffice(e.target.checked)}
                            className="w-3.5 h-3.5 rounded-sm text-slate-800 border-slate-300 dark:border-slate-600"
                          />
                          <label htmlFor="editToOfficeCheckboxDesktop" className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase">Handover to Cashier</label>
                        </div>
                        {!selectedNewToOffice && (
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Recipient Staff</label>
                            <InlineSelect
                              value={selectedNewRecipientStaffId}
                              onChange={setSelectedNewRecipientStaffId}
                              options={[
                                { value: "", label: "Select Staff" },
                                ...(userDirectory || []).filter((u: any) => u.role === "staff").map((u: any) => ({ value: String(u.id), label: u.name }))
                              ]}
                              placeholder="Select Staff"
                            />
                          </div>
                        )}
                      </>
                    )}
                    {selectedNewDepositType === "virtual" && (
                      <>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                              {selectedNewPaymentMode === "refund" ? "Destination Portal" : "Source Portal"}
                            </label>
                            <InlineSelect
                              value={effectiveEditPortalId}
                              onChange={(val) => { setSelectedNewPortalId(val); setSelectedNewBankAccountId(""); }}
                              options={portalDirectory.map((group: any) => ({ value: String(group.id), label: group.name }))}
                              placeholder="Select Portal"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                              {selectedNewPaymentMode === "refund" ? "Destination Bank Account" : "Source Bank Account"}
                            </label>
                            <InlineSelect
                              value={selectedNewBankAccountId}
                              onChange={setSelectedNewBankAccountId}
                              disabled={!effectiveEditPortalId}
                              options={
                                (portalDirectory.find((group: any) => String(group.id) === effectiveEditPortalId)?.bankAccounts || [])
                                  .map((ba: any) => ({ value: String(ba.id), label: ba.bank_account_name }))
                              }
                              placeholder={effectiveEditPortalId ? "Select Bank Account" : "Select a portal first"}
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                            {selectedNewPaymentMode === "refund" ? "Source Type" : "Destination Type"}
                          </label>
                          <select
                            value={selectedNewVirtualTargetType}
                            onChange={(e) => setSelectedNewVirtualTargetType(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-sm text-xs font-semibold"
                          >
                            <option value="retailer">Retailer</option>
                            <option value="staff">Staff Member</option>
                          </select>
                        </div>

                        {selectedNewVirtualTargetType === "retailer" ? (
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                              {selectedNewPaymentMode === "refund" ? "Source Retailer" : "Destination Retailer"}
                            </label>
                            <InlineSelect
                              value={selectedNewRetailerId}
                              onChange={setSelectedNewRetailerId}
                              options={[
                                { value: "", label: "Select Retailer" },
                                ...retailerDirectory.map((r: any) => ({ value: String(r.id), label: r.name }))
                              ]}
                              placeholder="Select Retailer"
                            />
                          </div>
                        ) : (
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                              {selectedNewPaymentMode === "refund" ? "Source Staff Member" : "Destination Staff Member"}
                            </label>
                            <InlineSelect
                              value={selectedNewRecipientStaffId}
                              onChange={setSelectedNewRecipientStaffId}
                              options={[
                                { value: "", label: "Select Staff Member" },
                                ...(userDirectory || []).filter((u: any) => u.role === "staff").map((u: any) => ({ value: String(u.id), label: u.name }))
                              ]}
                              placeholder="Select Staff Member"
                            />
                          </div>
                        )}
                      </>
                    )}

                    {selectedNewDepositType !== "virtual" && (
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Payment Mode</label>
                        <select
                          value={selectedNewPaymentMode}
                          onChange={(e) => setSelectedNewPaymentMode(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-sm text-xs font-semibold"
                        >
                          <option value="cash">Cash</option>
                          <option value="online">Online</option>
                        </select>
                      </div>
                    )}

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Reference No</label>
                      <input
                        type="text"
                        value={selectedNewRefNo}
                        onChange={(e) => setSelectedNewRefNo(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-sm text-xs font-semibold"
                        placeholder="Optional reference number"
                      />
                    </div>
                  </>
                )}

                {/* DATE FIELD (Always visible) */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Transaction Date</label>
                  <input
                    type="date"
                    value={selectedNewDate}
                    onChange={(e) => setSelectedNewDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-sm text-xs font-semibold"
                    required
                  />
                </div>

                {/* AMOUNT FIELD - only shown for online mode */}
                {selectedNewPaymentMode !== "cash" && (
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Amount (₹)</label>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={selectedNewAmount}
                      onChange={(e) => setSelectedNewAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-sm text-right font-mono tabular-nums text-xs font-bold focus:outline-none focus:border-slate-500 dark:focus:border-slate-400"
                      required
                    />
                  </div>
                )}

                {/* DENOMINATIONS (for Cash Mode) - staff-style full-row layout */}
                {selectedNewPaymentMode === "cash" && (
                  <div className="bg-slate-50 dark:bg-slate-800 p-2 rounded-sm border border-slate-200 dark:border-slate-800 space-y-0 select-none">
                    <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-2">Counting Details (Notes)</label>
                    <div className="space-y-1">
                      {[
                        { label: "₹500 Notes", key: "note_500", multiplier: 500 },
                        { label: "₹200 Notes", key: "note_200", multiplier: 200 },
                        { label: "₹100 Notes", key: "note_100", multiplier: 100 },
                        { label: "₹50 Notes",  key: "note_50",  multiplier: 50  },
                        { label: "₹20 Notes",  key: "note_20",  multiplier: 20  },
                        { label: "₹10 Notes",  key: "note_10",  multiplier: 10  },
                        { label: "Coins / ₹1", key: "coins",    multiplier: 1   },
                      ].map((n) => (
                        <div key={n.key} className="flex items-center gap-2 justify-between py-0.5 border-b border-slate-100 dark:border-slate-800/40 last:border-b-0">
                          <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 w-20 shrink-0">{n.label}</span>
                          <span className="text-slate-400 dark:text-slate-600 text-xs font-bold">&times;</span>
                          <input
                            type="number"
                            inputMode="numeric"
                            placeholder="0"
                            min="0"
                            value={selectedNewDenoms[n.key as keyof typeof selectedNewDenoms] || ""}
                            onChange={(e) => handleDenomValChange(n.key, e.target.value)}
                            className="w-14 px-1.5 py-0.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-sm text-right font-mono tabular-nums text-xs font-extrabold outline-none focus:border-slate-500 dark:focus:border-slate-400"
                          />
                          <span className="text-slate-300 dark:text-slate-600 text-[9px] font-bold">＝</span>
                          <span className="text-xs font-black text-slate-700 dark:text-slate-300 text-right w-14 shrink-0 font-mono tabular-nums">
                            ₹{(Number(selectedNewDenoms[n.key as keyof typeof selectedNewDenoms] || 0) * n.multiplier).toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                    {/* Live total summary */}
                    <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                      <span className="text-[9px] uppercase font-black tracking-wider text-slate-400">Total (Cash)</span>
                      <span className="text-sm font-black text-slate-800 dark:text-white font-mono tabular-nums">₹{selectedNewAmount.toLocaleString()}</span>
                    </div>
                  </div>
                )}

                {/* REMARKS FIELD */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Remarks</label>
                  <textarea
                    value={selectedNewRemarks}
                    onChange={(e) => setSelectedNewRemarks(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-sm text-xs font-semibold"
                    rows={2}
                    placeholder="Remarks"
                  />
                </div>

              </div>
              <button
                type="submit"
                disabled={isSavingEntry}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-slate-200 text-white dark:text-slate-950 rounded-sm text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-50"
              >
                {isSavingEntry ? "Saving..." : "Save Changes"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
