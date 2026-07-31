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

  // Live "Due" totals derived from each entity's current running balance.
  // Retailer receivables/payables:
  const retailerToTake = (retailerDirectory || []).reduce((s, r) => s + (r.balance < 0 ? -r.balance : 0), 0);
  const retailerToGive = (retailerDirectory || []).reduce((s, r) => s + (r.balance > 0 ? r.balance : 0), 0);

  // Portal receivables/payables (positive = asset/to-take, negative = liability/to-give):
  const portalToTake = (portalDirectory || []).reduce((s, p) => s + (p.balance > 0 ? p.balance : 0), 0);
  const portalToGive = (portalDirectory || []).reduce((s, p) => s + (p.balance < 0 ? -p.balance : 0), 0);

  const totalToTake = retailerToTake + portalToTake;
  const totalToGive = retailerToGive + portalToGive;


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
        retailerToTake={retailerToTake}
        retailerToGive={retailerToGive}
        portalToTake={portalToTake}
        portalToGive={portalToGive}
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
      retailerToTake={retailerToTake}
      retailerToGive={retailerToGive}
      portalToTake={portalToTake}
      portalToGive={portalToGive}
      fetchData={fetchData}
      todayCount={todayCount}
      userDirectory={userDirectory}
      staffComplianceLogs={staffComplianceLogs}
    />
  );
}

