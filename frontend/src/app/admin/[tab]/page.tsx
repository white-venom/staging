"use client";

import React from "react";
import { useParams } from "next/navigation";
import { useAdmin } from "../context/AdminContext";
import { useDevice } from "../../hooks/useDevice";

// Desktop Components
import CollectionsTab from "../components/desktop/CollectionsTab";
import DepositsTab from "../components/desktop/DepositsTab";
import LedgerTab from "../components/desktop/LedgerTab";
import RetailersTab from "../components/desktop/RetailersTab";
import StaffTab from "../components/desktop/StaffTab";
import AdministrationTab from "../components/desktop/AdministrationTab";
import PortalsTab from "../components/desktop/PortalsTab";
import ReportsTab from "../components/desktop/ReportsTab";
import AttendanceTab from "../components/desktop/AttendanceTab";
import WalletTransferTab from "../components/desktop/WalletTransferTab";

// Mobile Components
import MobileCollections from "../components/mobile/MobileCollections";
import MobileDeposits from "../components/mobile/MobileDeposits";
import MobileLedger from "../components/mobile/MobileLedger";
import MobileStaff from "../components/mobile/MobileStaff";
import MobileRetailers from "../components/mobile/MobileRetailers";
import MobilePortals from "../components/mobile/MobilePortals";

export default function AdminTabPage() {
  const params = useParams();
  const tab = params.tab as string;
  const { isMobile } = useDevice();
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
        return isMobile ? (
          <MobileCollections 
            collections={collections}
            showToastNotification={showToastNotification}
            fetchData={fetchData}
          />
        ) : (
          <CollectionsTab 
            collections={collections}
            showToastNotification={showToastNotification}
            fetchData={fetchData}
          />
        );
      case "deposits":
        return isMobile ? (
          <MobileDeposits 
            deposits={deposits}
            showToastNotification={showToastNotification}
            fetchData={fetchData}
          />
        ) : (
          <DepositsTab 
            deposits={deposits}
            showToastNotification={showToastNotification}
            fetchData={fetchData}
          />
        );
      case "ledger":
        return isMobile ? (
          <MobileLedger />
        ) : (
          <LedgerTab 
            collections={collections}
            deposits={deposits}
            retailerDirectory={retailerDirectory}
          />
        );
      case "portals":
        return isMobile ? (
          <MobilePortals 
            portalDirectory={portalDirectory}
            showToastNotification={showToastNotification}
            fetchData={fetchData}
          />
        ) : (
          <PortalsTab 
            portalDirectory={portalDirectory}
            showToastNotification={showToastNotification}
            setShowPortalDrawer={setShowPortalDrawer}
            fetchData={fetchData}
          />
        );
      case "retailers":
        return isMobile ? (
          <MobileRetailers 
            retailerDirectory={retailerDirectory}
            showToastNotification={showToastNotification}
            fetchData={fetchData}
          />
        ) : (
          <RetailersTab 
            retailerDirectory={retailerDirectory}
            setShowRetailerDrawer={setShowRetailerDrawer}
            showToastNotification={showToastNotification}
            fetchData={fetchData}
          />
        );
      case "staff":
        return isMobile ? (
          <MobileStaff />
        ) : (
          <StaffTab 
            staffComplianceLogs={staffComplianceLogs}
            userDirectory={userDirectory}
            showToastNotification={showToastNotification}
            fetchData={fetchData}
          />
        );
      case "wallet-transfer":
        return <WalletTransferTab />;
      case "administration":
        return isMobile ? null : (
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
