"use client";

import React from "react";
import { useAdmin } from "./context/AdminContext";
import OverviewTab from "./components/desktop/OverviewTab";
import MobileOverview from "./components/mobile/MobileOverview";
import { useDevice } from "../hooks/useDevice";

export default function AdminPage() {
  const { collections, deposits, retailerDirectory, portalDirectory, fetchData, userDirectory, staffComplianceLogs } = useAdmin();
  const { isMobile } = useDevice();

  const totalCollectedAmount = (collections || []).reduce((s, c) => s + (c.totalAmount || 0), 0);
  const totalDepositedAmount = (deposits || []).reduce((s, d) => s + (d.amount || 0), 0);
  const netCashBalance = totalCollectedAmount - totalDepositedAmount;
  
  // Today's specific totals for KPI blocks
  const todayStr = new Date().toISOString().split('T')[0];
  const todayCollected = (collections || []).filter(c => c.date?.startsWith(todayStr)).reduce((s, c) => s + (c.totalAmount || 0), 0);
  const todayDeposited = (deposits || []).filter(d => d.date?.startsWith(todayStr)).reduce((s, d) => s + (d.amount || 0), 0);
  const todayNet = todayCollected - todayDeposited;
  const todayCount = (collections || []).filter(c => c.date?.startsWith(todayStr)).length;

  const totalToTake = 
    (retailerDirectory || []).reduce((s, r) => s + (r.balance > 0 ? r.balance : 0), 0) +
    (portalDirectory || []).reduce((s, p) => s + (p.balance > 0 ? p.balance : 0), 0);

  const totalToGive = 
    (retailerDirectory || []).reduce((s, r) => s + (r.balance < 0 ? Math.abs(r.balance) : 0), 0) +
    (portalDirectory || []).reduce((s, p) => s + (p.balance < 0 ? Math.abs(p.balance) : 0), 0);

  if (isMobile) {
    return (
      <MobileOverview 
        collections={collections}
        deposits={deposits}
        totalCollectedAmount={todayCollected}
        totalDepositedAmount={todayDeposited}
        netCashBalance={todayNet}
        totalToTake={totalToTake}
        totalToGive={totalToGive}
        fetchData={fetchData}
        todayCount={todayCount}
        userDirectory={userDirectory}
        staffComplianceLogs={staffComplianceLogs}
      />
    );
  }

  return (
    <OverviewTab 
      collections={collections}
      deposits={deposits}
      totalCollectedAmount={todayCollected}
      totalDepositedAmount={todayDeposited}
      netCashBalance={todayNet}
      totalToTake={totalToTake}
      totalToGive={totalToGive}
      fetchData={fetchData}
      todayCount={todayCount}
      userDirectory={userDirectory}
      staffComplianceLogs={staffComplianceLogs}
    />
  );
}

