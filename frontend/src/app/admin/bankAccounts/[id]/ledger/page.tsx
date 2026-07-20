"use client";

import React from "react";
import { useParams } from "next/navigation";
import { useAdmin } from "../../../context/AdminContext";
import { useDevice } from "../../../../hooks/useDevice";
import PortalsTab from "../../../components/desktop/PortalsTab";
import MobilePortals from "../../../components/mobile/MobilePortals";

// Gives an individual portal's ledger its own persistent URL
// (/admin/bankAccounts/[portal_id]/ledger) so refreshing the page lands back
// on that specific ledger instead of the bare portal list. Renders the exact
// same tab component as /admin/bankAccounts, just telling it which portal's
// ledger to auto-open on mount.
export default function PortalLedgerPage() {
  const params = useParams();
  const portalId = params.id as string;
  const { isMobile } = useDevice();
  const {
    portalDirectory,
    showToastNotification,
    setShowPortalDrawer,
    fetchData
  } = useAdmin();

  if (isMobile) {
    return (
      <MobilePortals
        portalDirectory={portalDirectory}
        showToastNotification={showToastNotification}
        fetchData={fetchData}
        initialPortalLedgerId={portalId}
      />
    );
  }

  return (
    <PortalsTab
      portalDirectory={portalDirectory}
      showToastNotification={showToastNotification}
      setShowPortalDrawer={setShowPortalDrawer}
      fetchData={fetchData}
      initialPortalLedgerId={portalId}
    />
  );
}
