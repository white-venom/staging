"use client";

import React from "react";
import { useParams, useRouter } from "next/navigation";
import { useAdmin } from "../context/AdminContext";

// Modular Admin Components
import CollectionsTab from "../components/CollectionsTab";
import DepositsTab from "../components/DepositsTab";
import LedgerTab from "../components/LedgerTab";
import RetailersTab from "../components/RetailersTab";
import StaffTab from "../components/StaffTab";
import AdministrationTab from "../components/AdministrationTab";
import PortalsTab from "../components/PortalsTab";
import ReportsTab from "../components/ReportsTab";
import AttendanceTab from "../components/AttendanceTab";

export default function AdminTabPage() {
  const params = useParams();
  const tab = params.tab as string;
  const { 
    collections, 
    deposits, 
    retailerDirectory, 
    portalDirectory, 
    userDirectory, 
    staffComplianceLogs,
    showToastNotification,
    fetchData,
    setShowRetailerDrawer,
    setShowPortalDrawer
  } = useAdmin();

  const renderTab = () => {
    switch (tab) {
      case "collections":
        return (
          <CollectionsTab 
            collections={collections}
            showToastNotification={showToastNotification}
            fetchData={fetchData}
          />
        );
      case "deposits":
        return (
          <DepositsTab 
            deposits={deposits}
            showToastNotification={showToastNotification}
            fetchData={fetchData}
          />
        );
      case "ledger":
        return (
          <LedgerTab 
            collections={collections}
            deposits={deposits}
            retailerDirectory={retailerDirectory}
          />
        );
      case "portals":
        return (
          <PortalsTab 
            portalDirectory={portalDirectory}
            showToastNotification={showToastNotification}
            setShowPortalDrawer={setShowPortalDrawer}
            fetchData={fetchData}
          />
        );
      case "retailers":
        return (
          <RetailersTab 
            retailerDirectory={retailerDirectory}
            setShowRetailerDrawer={setShowRetailerDrawer}
            showToastNotification={showToastNotification}
            fetchData={fetchData}
          />
        );
      case "staff":
        return (
          <StaffTab 
            staffComplianceLogs={staffComplianceLogs}
          />
        );
      case "administration":
        return (
          <AdministrationTab 
            userDirectory={userDirectory}
            portalDirectory={portalDirectory}
            fetchData={fetchData}
            showToastNotification={showToastNotification}
          />
        );
      case "reports":
        return (
          <ReportsTab 
            collections={collections}
            deposits={deposits}
          />
        );
      case "attendance":
        return (
          <AttendanceTab 
            showToastNotification={showToastNotification}
          />
        );
      default:
        return <div>Tab not found</div>;
    }
  };

  return <div className="animate-fade-in">{renderTab()}</div>;
}
