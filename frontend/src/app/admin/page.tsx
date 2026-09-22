"use client";

import React from "react";
import { useAdmin } from "./context/AdminContext";
import OverviewTab from "./components/desktop/OverviewTab";
import MobileOverview from "./components/mobile/MobileOverview";
import { useDevice } from "../hooks/useDevice";

export default function AdminPage() {
  const { collections, deposits, retailerDirectory, portalDirectory, fetchData, userDirectory, staffComplianceLogs, businessSettings } = useAdmin();
  const { isMobile } = useDevice();

  // Precalculate field staff balances matching MobileOverview / OverviewTab logic
  const staffUsers = (userDirectory || []).filter((u: any) => u.role === "field_staff" || u.role === "staff");

  const totalStaffCash = staffUsers.reduce((sum: number, user: any) => {
    const name = user.name;
    const staffCols = (collections || []).filter((c: any) => c.staffName === name);
    const staffDeps = (deposits || []).filter((d: any) => 
      d.staffName === name && 
      d.depositType?.toLowerCase() !== 'virtual'
    );
    const receivedDeps = (deposits || []).filter((d: any) => 
      d.recipient_staff_id === user.id && 
      d.depositType === 'staff' && 
      !(collections || []).some((c: any) => (c.staff_id === user.id || c.staffName === name) && c.from_staff_id === d.staff_id && Number(c.totalAmount) === Number(d.amount))
    );

    const collected = staffCols.reduce((s: number, c: any) => s + (c.totalAmount || 0), 0) + receivedDeps.reduce((s: number, d: any) => s + (d.amount || 0), 0);
    const deposited = staffDeps.reduce((s: number, d: any) => s + (d.amount || 0), 0);
    return sum + (collected - deposited);
  }, 0);

  // Office safe cash: opening cash + handovers from staff to office - cash given from office to staff - office direct bank deposits
  const openingCash = businessSettings?.opening_cash_in_hand || 0;
  const handoversToOffice = (deposits || [])
    .filter((d: any) => d.depositType === 'staff' && (d.to_office || d.toOffice || !d.recipient_staff_id))
    .reduce((s: number, d: any) => s + (d.amount || 0), 0);
    
  const fieldStaffIds = new Set(staffUsers.map((u: any) => u.id));
  const fieldStaffNames = new Set(staffUsers.map((u: any) => u.name));

  const officeDirectCollections = (collections || [])
    .filter((c: any) => (!fieldStaffIds.has(c.staff_id) && !fieldStaffNames.has(c.staffName)) || c.from_office || c.fromOffice)
    .reduce((s: number, c: any) => s + (c.totalAmount || 0), 0);

  const officeDirectDeposits = (deposits || [])
    .filter((d: any) => 
      d.depositType?.toLowerCase() !== 'virtual' && 
      d.depositType !== 'staff' && 
      !fieldStaffIds.has(d.staff_id) && 
      !fieldStaffNames.has(d.staffName)
    )
    .reduce((s: number, d: any) => s + (d.amount || 0), 0);

  const officeSafeCash = openingCash + handoversToOffice + officeDirectCollections - officeDirectDeposits;
  const netCashBalanceVal = totalStaffCash + Math.max(0, officeSafeCash);

  // Today's specific totals for KPI blocks
  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  // Company Cash In today: Real external collections (not internal handovers between staff)
  const todayCollected = (collections || [])
    .filter((c: any) => c.date?.startsWith(todayStr) && !c.from_staff_id)
    .reduce((s: number, c: any) => s + (c.totalAmount || 0), 0);

  // Company Cash Out today: External deposits/payouts (Bank/Portal or Retailer), NOT internal staff handovers
  const todayDeposited = (deposits || [])
    .filter((d: any) => 
      d.date?.startsWith(todayStr) && 
      d.depositType?.toLowerCase() !== 'virtual' &&
      d.depositType !== 'staff'
    )
    .reduce((s: number, d: any) => s + (d.amount || 0), 0);

  const todayCount = (collections || []).filter((c: any) => c.date?.startsWith(todayStr)).length;

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

