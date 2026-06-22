"use client";

import React from "react";
import { useAdmin } from "./context/AdminContext";
import OverviewTab from "./components/desktop/OverviewTab";
import MobileOverview from "./components/mobile/MobileOverview";
import { useDevice } from "../hooks/useDevice";

export default function AdminPage() {
  const { collections, deposits, retailerDirectory, portalDirectory, fetchData, userDirectory, staffComplianceLogs, businessSettings } = useAdmin();
  const { isMobile } = useDevice();

  const allTimeCollected = (collections || []).reduce((s, c) => s + (c.totalAmount || 0), 0);
  const allTimeDeposited = (deposits || []).filter(d => d.depositType?.toLowerCase() !== 'virtual').reduce((s, d) => s + (d.amount || 0), 0);
  
  const openingCash = businessSettings?.opening_cash_in_hand || 0;
  const netCashBalanceVal = openingCash + allTimeCollected - allTimeDeposited;

  // Today's specific totals for KPI blocks
  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  const todayCollected = (collections || []).filter(c => c.date?.startsWith(todayStr)).reduce((s, c) => s + (c.totalAmount || 0), 0);
  const todayDeposited = (deposits || []).filter(d => d.date?.startsWith(todayStr) && d.depositType?.toLowerCase() !== 'virtual').reduce((s, d) => s + (d.amount || 0), 0);
  const todayCount = (collections || []).filter(c => c.date?.startsWith(todayStr)).length;

  const totalToTake = 
    (retailerDirectory || []).reduce((s, r) => s + (r.opening_to_take || 0), 0) +
    (portalDirectory || []).reduce((s, p) => s + (p.opening_to_take || 0), 0);

  const totalToGive = 
    (retailerDirectory || []).reduce((s, r) => s + (r.opening_to_give || 0), 0) +
    (portalDirectory || []).reduce((s, p) => s + (p.opening_to_give || 0), 0);

  if (isMobile) {
    return (
      <MobileOverview 
        collections={collections}
        deposits={deposits}
        totalCollectedAmount={todayCollected}
        totalDepositedAmount={todayDeposited}
        netCashBalance={netCashBalanceVal}
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
      netCashBalance={netCashBalanceVal}
      totalToTake={totalToTake}
      totalToGive={totalToGive}
      fetchData={fetchData}
      todayCount={todayCount}
      userDirectory={userDirectory}
      staffComplianceLogs={staffComplianceLogs}
    />
  );
}

