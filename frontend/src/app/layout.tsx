import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import PWARegister from "./components/PWARegister";
import QueryProvider from "./components/QueryProvider";
import MaintenanceGuard from "./components/MaintenanceGuard";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "DO IT SERVICES | Operational Platform",
  description: "Next-generation cashless ledger sheets, physical denomination tracking, and real-time pocket-cash balance calculations.",
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col font-sans transition-colors duration-200" suppressHydrationWarning>
        <PWARegister />
        <QueryProvider>
          <MaintenanceGuard>
            {children}
          </MaintenanceGuard>
        </QueryProvider>
      </body>
    </html>
  );
}
