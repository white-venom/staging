"use client";

import React from "react";
import { useParams } from "next/navigation";
import { useAdmin } from "../../../context/AdminContext";
import { useDevice } from "../../../../hooks/useDevice";
import RetailersTab from "../../../components/desktop/RetailersTab";
import MobileRetailers from "../../../components/mobile/MobileRetailers";

// Gives an individual retailer's ledger its own persistent URL
// (/admin/retailers/[ledger_token]/ledger) so refreshing the page -- or
// sharing/bookmarking the link -- lands back on that specific ledger instead
// of the bare retailer list. Renders the exact same tab component as
// /admin/retailers, just telling it which ledger to auto-open on mount.
export default function RetailerLedgerPage() {
  const params = useParams();
  const token = params.token as string;
  const { isMobile } = useDevice();
  const {
    retailerDirectory,
    setShowRetailerDrawer,
    showToastNotification,
    fetchData
  } = useAdmin();

  if (isMobile) {
    return (
      <MobileRetailers
        retailerDirectory={retailerDirectory}
        showToastNotification={showToastNotification}
        fetchData={fetchData}
        initialLedgerToken={token}
      />
    );
  }

  return (
    <RetailersTab
      retailerDirectory={retailerDirectory}
      setShowRetailerDrawer={setShowRetailerDrawer}
      showToastNotification={showToastNotification}
      fetchData={fetchData}
      initialLedgerToken={token}
    />
  );
}
