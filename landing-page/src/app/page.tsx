"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useInView } from "framer-motion";
import {
  Shield,
  Smartphone,
  CheckCircle2,
  Clock,
  Layers,
  Database,
  RefreshCw,
  ChevronDown,
  ArrowRight,
  Check,
  FileText,
  Users,
  TrendingUp,
  AlertCircle,
  Lock,
  Send,
  Mail,
  Phone,
  Search,
  Wifi,
  WifiOff,
  Building,
  CreditCard,
  Grid,
  Coins,
  Activity,
  ArrowUpRight,
  ChevronRight,
  DatabaseZap,
  HardDrive,
  X,
  Sparkles,
  Briefcase,
  Loader2
} from "lucide-react";

// Mock data reflecting actual application schemas with completely fake names
interface Retailer {
  id: string;
  name: string;
  phone: string;
  address: string;
  balance: number;
}

const mockRetailers: Retailer[] = [
  { id: "r1", name: "Apex Grocers #12", phone: "9876543210", address: "Sector 62, Noida", balance: 14500 },
  { id: "r2", name: "Metro Finance Branch", phone: "9812345678", address: "Indiranagar, Bangalore", balance: 84000 },
  { id: "r3", name: "Astra Enterprises", phone: "9560123456", address: "Karol Bagh, New Delhi", balance: 5200 },
  { id: "r4", name: "Nova Retailers", phone: "9910245678", address: "Gachibowli, Hyderabad", balance: 27900 }
];

interface LogEntry {
  id: string;
  retailer: string;
  staff: string;
  amount: number;
  status: "pending" | "verified";
  time: string;
}

const initialLogs: LogEntry[] = [
  { id: "l1", retailer: "Apex Grocers #12", staff: "Ramesh Kumar", amount: 12500, status: "verified", time: "10:14 AM" },
  { id: "l2", retailer: "Nova Retailers", staff: "Amit Singh", amount: 8400, status: "pending", time: "11:30 AM" },
  { id: "l3", retailer: "Astra Enterprises", staff: "Suresh P.", amount: 5200, status: "verified", time: "11:45 AM" }
];

// ── FLOATING NODES CANVAS BACKGROUND ──
function FloatingNodesCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let mouse = { x: -9999, y: -9999 };

    const onMouseMove = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };
    window.addEventListener("mousemove", onMouseMove, { passive: true });

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const COUNT = 45;
    type Node = { x: number; y: number; vx: number; vy: number; r: number };
    const nodes: Node[] = Array.from({ length: COUNT }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vx: (Math.random() - 0.5) * 0.45,
      vy: (Math.random() - 0.5) * 0.45,
      r: 1.8 + Math.random() * 2.2,
    }));

    const CONNECT_DIST = 140;

    function draw() {
      const W = canvas!.width;
      const H = canvas!.height;
      ctx!.clearRect(0, 0, W, H);

      // Update positions
      for (const n of nodes) {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < 0 || n.x > W) n.vx *= -1;
        if (n.y < 0 || n.y > H) n.vy *= -1;

        // Mouse repulsion
        const dx = n.x - mouse.x;
        const dy = n.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 110 && dist > 0) {
          n.x += (dx / dist) * 1.3;
          n.y += (dy / dist) * 1.3;
        }
      }

      // Draw edges
      for (let i = 0; i < COUNT; i++) {
        for (let j = i + 1; j < COUNT; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < CONNECT_DIST) {
            const alpha = (1 - d / CONNECT_DIST) * 0.16;
            ctx!.beginPath();
            ctx!.strokeStyle = `rgba(6, 182, 212, ${alpha})`;
            ctx!.lineWidth = 0.8;
            ctx!.moveTo(nodes[i].x, nodes[i].y);
            ctx!.lineTo(nodes[j].x, nodes[j].y);
            ctx!.stroke();
          }
        }
      }

      // Draw nodes
      for (const n of nodes) {
        ctx!.beginPath();
        const grad = ctx!.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r * 2.2);
        grad.addColorStop(0, "rgba(6, 182, 212, 0.45)");
        grad.addColorStop(1, "rgba(14, 165, 233, 0)");
        ctx!.fillStyle = grad;
        ctx!.arc(n.x, n.y, n.r * 2.2, 0, Math.PI * 2);
        ctx!.fill();

        ctx!.beginPath();
        ctx!.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx!.fillStyle = "rgba(6, 182, 212, 0.35)";
        ctx!.fill();
      }

      animId = requestAnimationFrame(draw);
    }

    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-0 pointer-events-none"
      aria-hidden="true"
    />
  );
}

// ── ANIMATED COUNTER COMPONENT ──
function Counter({ value, suffix = "" }: { value: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  useEffect(() => {
    if (isInView) {
      let start = 0;
      const end = value;
      const duration = 2000;
      const increment = end / (duration / 16);

      const timer = setInterval(() => {
        start += increment;
        if (start >= end) {
          setCount(end);
          clearInterval(timer);
        } else {
          setCount(Math.floor(start));
        }
      }, 16);
      return () => clearInterval(timer);
    }
  }, [isInView, value]);

  return (
    <span ref={ref} className="font-extrabold tracking-tight">
      {count.toLocaleString()}{suffix}
    </span>
  );
}

export default function LandingPage() {
  const [mounted, setMounted] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Interactive Workspace State
  const [workspaceName, setWorkspaceName] = useState("");
  const [workspaceMessage, setWorkspaceMessage] = useState("");

  // PWA Simulator State
  const [isOffline, setIsOffline] = useState(false);
  const [sourceType, setSourceType] = useState<"retailer" | "staff" | "office">("retailer");
  const [selectedRetailer, setSelectedRetailer] = useState<Retailer>(mockRetailers[0]);
  const [notes500, setNotes500] = useState<number>(8);
  const [notes200, setNotes200] = useState<number>(2);
  const [notes100, setNotes100] = useState<number>(1);
  const [notes50, setNotes50] = useState<number>(0);
  const [notes20, setNotes20] = useState<number>(0);
  const [notes10, setNotes10] = useState<number>(0);
  const [coinsVal, setCoinsVal] = useState<number>(0);
  const [onlineAmount, setOnlineAmount] = useState<number>(0);
  const [remarks, setRemarks] = useState<string>("Fully Collected");
  const [pwaMessage, setPwaMessage] = useState<{ type: "success" | "warning" | "info"; text: string } | null>(null);

  // Offline sync queue mock
  const [offlineQueue, setOfflineQueue] = useState<any[]>([]);

  // Admin Dashboard State
  const [logs, setLogs] = useState<LogEntry[]>(initialLogs);
  const [totalToday, setTotalToday] = useState<number>(84200);
  const [faqOpen, setFaqOpen] = useState<number | null>(null);

  // Demo Form State
  const [demoName, setDemoName] = useState("");
  const [demoEmail, setDemoEmail] = useState("");
  const [demoPhone, setDemoPhone] = useState("");
  const [demoSubmitted, setDemoSubmitted] = useState(false);

  // Configure 3-Day Demo Modal State
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);
  const [demoCompanyName, setDemoCompanyName] = useState("");
  const [demoSubdomain, setDemoSubdomain] = useState("");
  const [demoAdminName, setDemoAdminName] = useState("");
  const [demoEmailAddress, setDemoEmailAddress] = useState("");
  const [demoPhoneNumber, setDemoPhoneNumber] = useState("");
  const [demoPackagePlan, setDemoPackagePlan] = useState("Professional Plan (Trial)");
  const [isDemoBuilding, setIsDemoBuilding] = useState(false);
  const [demoBuildStep, setDemoBuildStep] = useState(0);
  const [demoBuildSuccess, setDemoBuildSuccess] = useState(false);

  const handleCompanyNameChange = (val: string) => {
    setDemoCompanyName(val);
    const slug = val
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    setDemoSubdomain(slug);
  };

  const handleBuildDemoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!demoCompanyName || !demoSubdomain || !demoAdminName || !demoEmailAddress || !demoPhoneNumber) return;
    setIsDemoBuilding(true);
    setDemoBuildStep(0);
    
    // Simulate steps:
    // Step 0: "Allocating database schema..."
    // Step 1: "Creating secure master tenant tables..."
    // Step 2: "Initializing admin profile..."
    const interval = setInterval(() => {
      setDemoBuildStep(prev => {
        if (prev >= 2) {
          clearInterval(interval);
          setIsDemoBuilding(false);
          setDemoBuildSuccess(true);
          return 3;
        }
        return prev + 1;
      });
    }, 1200);
  };

  const resetDemoModal = () => {
    setIsDemoModalOpen(false);
    setDemoCompanyName("");
    setDemoSubdomain("");
    setDemoAdminName("");
    setDemoEmailAddress("");
    setDemoPhoneNumber("");
    setDemoPackagePlan("Professional Plan (Trial)");
    setIsDemoBuilding(false);
    setDemoBuildStep(0);
    setDemoBuildSuccess(false);
  };

  // Active step in process timeline
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    setMounted(true);
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Compute total denomination sum
  const totalCashAmount =
    (notes500 * 500) +
    (notes200 * 200) +
    (notes100 * 100) +
    (notes50 * 50) +
    (notes20 * 20) +
    (notes10 * 10) +
    coinsVal;

  const totalCollectionAmount = totalCashAmount + onlineAmount;

  // Handle PWA Mock submission
  const handlePwaSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (totalCollectionAmount === 0) {
      alert("Please enter at least one denomination.");
      return;
    }

    if (isOffline) {
      const newQueueItem = {
        id: `q-${Date.now()}`,
        retailer: selectedRetailer.name,
        staff: "Demo Agent",
        amount: totalCollectionAmount,
        status: "pending"
      };
      setOfflineQueue([...offlineQueue, newQueueItem]);
      setPwaMessage({
        type: "warning",
        text: `⚠️ Saved offline! Item added to local sync queue (${offlineQueue.length + 1} pending).`
      });
    } else {
      const newLog: LogEntry = {
        id: `l-${Date.now()}`,
        retailer: selectedRetailer.name,
        staff: "Demo Agent",
        amount: totalCollectionAmount,
        status: "pending",
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setLogs([newLog, ...logs]);
      setTotalToday(prev => prev + totalCollectionAmount);
      setPwaMessage({
        type: "success",
        text: "✓ Collection synced successfully to Central Database!"
      });
      resetPwaForm();
    }
  };

  const resetPwaForm = () => {
    setNotes500(0);
    setNotes200(0);
    setNotes100(0);
    setNotes50(0);
    setNotes20(0);
    setNotes10(0);
    setCoinsVal(0);
    setOnlineAmount(0);
    setRemarks("Fully Collected");
  };

  // Trigger background sync simulation when toggled back online
  useEffect(() => {
    if (!isOffline && offlineQueue.length > 0) {
      setPwaMessage({ type: "info", text: "🔄 Connection restored. Syncing offline queue..." });

      const timer = setTimeout(() => {
        const syncedLogs: LogEntry[] = offlineQueue.map((item, idx) => ({
          id: `l-sync-${idx}-${Date.now()}`,
          retailer: item.retailer,
          staff: item.staff,
          amount: item.amount,
          status: "pending",
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }));

        setLogs(prev => [...syncedLogs, ...prev]);
        const addedTotal = offlineQueue.reduce((acc, curr) => acc + curr.amount, 0);
        setTotalToday(prev => prev + addedTotal);
        setOfflineQueue([]);
        setPwaMessage({ type: "success", text: `✓ Background Sync complete! ${syncedLogs.length} items verified.` });
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [isOffline]);

  // Admin verifies a record
  const verifyRecord = (id: string, amount: number) => {
    setLogs(prev => prev.map(log =>
      log.id === id ? { ...log, status: "verified" } : log
    ));
    setPwaMessage({ type: "success", text: `✓ Admin verified. Ledger entry generated + Email notification sent.` });
  };

  // Handles subdomain finder simulation
  const handleWorkspaceLookup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceName.trim()) return;
    const cleanWorkspace = workspaceName.toLowerCase().replace(/[^a-z0-9-]/g, "");
    setWorkspaceMessage(`Redirecting to https://${cleanWorkspace}.crediiflow.in...`);
    setTimeout(() => {
      window.open(`https://${cleanWorkspace}.crediiflow.in`, "_blank");
      setWorkspaceMessage("");
    }, 1500);
  };

  // Handles Mock Demo Booking
  const handleDemoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!demoName || !demoEmail || !demoPhone) return;
    setDemoSubmitted(true);
  };

  const handleQuickDemoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!demoEmail) return;
    setDemoSubmitted(true);
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen relative bg-gradient-to-br from-blue-50/25 via-white to-white text-slate-900 overflow-hidden font-sans scroll-smooth">

      {/* Floating nodes canvas */}
      <FloatingNodesCanvas />

      {/* Fine grid pattern overlay */}
      <div className="absolute inset-0 bg-grid-pattern opacity-40 pointer-events-none z-0" />

      {/* ── BACKGROUND LIGHT GLOWS (Subtle premium SaaS gradients) ── */}
      <div className="absolute top-[-150px] left-1/4 w-[800px] h-[800px] bg-cyan-200/10 rounded-full blur-[140px] pointer-events-none z-0" />
      <div className="absolute top-[300px] right-1/4 w-[700px] h-[700px] bg-sky-200/10 rounded-full blur-[120px] pointer-events-none z-0" />
      <div className="absolute top-[1200px] left-1/3 w-[900px] h-[900px] bg-indigo-100/5 rounded-full blur-[160px] pointer-events-none z-0" />
      <div className="absolute top-[2500px] right-1/3 w-[800px] h-[800px] bg-cyan-200/5 rounded-full blur-[150px] pointer-events-none z-0" />
      <div className="absolute top-[3800px] left-1/4 w-[900px] h-[900px] bg-sky-200/5 rounded-full blur-[160px] pointer-events-none z-0" />

      {/* ── STICKY GLASS NAVBAR ── */}
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${scrolled ? 'bg-white/75 backdrop-blur-md shadow-sm py-2.5' : 'bg-transparent py-6'}`}>
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6">
          <div className="flex items-center">
            {/* Logo and Brand Name combination */}
            <a href="#" className={`flex items-center transition-all duration-500 group ${scrolled ? 'gap-3' : 'gap-5'}`}>
              <img
                src="/logo-icon.png"
                alt="CrediiFlow Logo"
                className={`transition-all duration-500 object-contain group-hover:scale-[1.03] ${scrolled ? 'h-10' : 'h-20'}`}
              />
              <span className={`transition-all duration-500 tracking-tight text-slate-955 select-none font-display ${scrolled ? 'text-2xl' : 'text-5xl'}`}>
                <span className="font-extrabold text-slate-900">Credii</span>
                <span className="font-semibold text-cyan-600">Flow</span>
              </span>
            </a>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-xs font-bold tracking-wider text-slate-500 font-display">
            {[
              { name: "FEATURES", link: "#features" },
              { name: "PRICING", link: "#overview" },
              { name: "FAQ", link: "#faq" }
            ].map((item) => (
              <a
                key={item.name}
                href={item.link}
                className="relative py-1 transition-colors hover:text-slate-900 group"
              >
                {item.name}
                <span className="absolute bottom-0 left-0 w-full h-[1.5px] bg-gradient-to-r from-cyan-500 to-sky-500 scale-x-0 origin-left transition-transform duration-250 group-hover:scale-x-100" />
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-6">
            <a
              href="#subdomains"
              className="text-xs font-bold tracking-wider text-slate-600 hover:text-slate-900 transition-colors hidden sm:inline-block font-display"
            >
              SIGN IN
            </a>
            <button
              onClick={() => setIsDemoModalOpen(true)}
              className="bg-gradient-to-r from-blue-800 to-cyan-600 hover:from-blue-900 hover:to-cyan-700 text-white px-6 py-2.5 rounded-xl text-xs font-bold tracking-wider shadow-xs hover:shadow-md active:scale-[0.98] transition-all flex items-center gap-1.5 font-display cursor-pointer"
            >
              <span>START DEMO</span>
              <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
            </button>
          </div>
        </div>
      </header>


      <main className="relative z-10 pt-28">

        {/* ── REDESIGNED HERO SECTION ── */}
        <section className="relative pt-16 pb-24 md:pt-28 md:pb-36 px-6 bg-grid-pattern overflow-hidden">
          <div className="max-w-7xl mx-auto text-center relative z-10">


            {/* Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 25 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-5xl sm:text-6xl md:text-7xl lg:text-[76px] font-extrabold tracking-tight text-slate-900 max-w-5xl mx-auto leading-[1.08] mb-8 font-sans"
            >
              The Operations Engine for <span className="bg-gradient-to-r from-blue-600 via-cyan-550 to-teal-500 bg-clip-text text-transparent font-black">Cash Turnovers.</span>
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0, y: 25 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-sm sm:text-base md:text-lg text-slate-500 max-w-2xl mx-auto font-normal leading-relaxed mb-12"
            >
              Automate secure cash collection routes, track precise physical denominations, manage running retailer ledger sheets, and streamline bank deposit auditing.
            </motion.p>

            {/* modern floating email capture CTA */}
            <motion.div
              initial={{ opacity: 0, y: 25 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="max-w-xl mx-auto mb-20"
            >
              <form onSubmit={handleQuickDemoSubmit} className="flex flex-col sm:flex-row items-stretch gap-2.5 p-2 bg-white/95 backdrop-blur-md border border-slate-200 shadow-xl rounded-2xl group focus-within:border-cyan-500/85 focus-within:ring-4 focus-within:ring-cyan-500/10 transition-all duration-300">
                <div className="relative flex-1 flex items-center min-w-0 pl-4 py-2.5 sm:py-0">
                  <Mail className="w-4 h-4 text-slate-400 shrink-0 mr-2.5" />
                  <input
                    type="email"
                    required
                    placeholder="Enter your professional email"
                    value={demoEmail}
                    onChange={(e) => setDemoEmail(e.target.value)}
                    className="w-full bg-transparent text-sm font-semibold text-slate-800 focus:outline-none placeholder-slate-450 font-display"
                  />
                </div>
                <button
                  type="submit"
                  className="bg-gradient-to-r from-blue-800 to-cyan-600 hover:from-blue-900 hover:to-cyan-700 text-white px-7 py-3.5 rounded-xl text-xs font-bold tracking-wider active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 shadow-sm whitespace-nowrap cursor-pointer font-display"
                >
                  <span>BOOK A DEMO</span>
                  <ArrowRight className="w-3.5 h-3.5 text-white" />
                </button>
              </form>
              
              <div className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-400 font-medium">
                <span>Or test the software now:</span>
                <a
                  href="#demo-pwa"
                  className="font-bold text-cyan-600 hover:text-cyan-700 hover:underline transition-all flex items-center gap-0.5"
                >
                  Try Live Simulator &rarr;
                </a>
              </div>

              {demoSubmitted && (
                <motion.p
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-xs text-emerald-600 font-bold mt-3 text-center"
                >
                  ✓ Thank you! We will reach out to you shortly.
                </motion.p>
              )}
            </motion.div>

            {/* MacBook/Browser Mockup Wrapper with floating widgets */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 50 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="relative w-full max-w-5xl mx-auto rounded-[2.5rem] border border-slate-200 bg-white shadow-2xl p-4 md:p-6"
            >
              <div className="relative rounded-[1.8rem] border border-slate-200 overflow-hidden bg-slate-50 shadow-inner">
                {/* Browser window top bar */}
                <div className="h-10 bg-slate-100 border-b border-slate-200 px-5 flex items-center justify-between">
                  <div className="flex gap-2">
                    <span className="w-3 h-3 bg-red-400 rounded-full" />
                    <span className="w-3 h-3 bg-yellow-400 rounded-full" />
                    <span className="w-3 h-3 bg-green-400 rounded-full" />
                  </div>
                  <div className="bg-white border border-slate-200 rounded px-16 py-0.5 text-[10px] text-slate-400 font-mono select-none">
                    https://workspace.crediiflow.in/dashboard
                  </div>
                  <div className="w-10" />
                </div>

                {/* Dashboard Showcase Mockup UI */}
                <div className="flex flex-col md:flex-row bg-white text-left h-auto md:h-[500px]">
                  {/* Mock Sidebar */}
                  <div className="w-full md:w-56 bg-slate-50 border-b md:border-b-0 md:border-r border-slate-200 p-5 flex flex-col justify-between shrink-0 select-none">
                    <div className="space-y-6">
                      <div className="flex items-center gap-2 px-1 font-display">
                        <img src="/logo-icon.png" alt="Icon" className="h-5.5 w-auto object-contain" />
                        <span className="text-sm tracking-tight text-slate-900 select-none">
                          <span className="font-extrabold text-slate-850">Credii</span>
                          <span className="font-semibold text-cyan-600">Flow</span>
                        </span>
                      </div>
                      <nav className="space-y-1">
                        {[
                          { label: "Dashboard", icon: Grid, active: true },
                          { label: "Retailer Ledgers", icon: FileText, active: false },
                          { label: "Staff Routing", icon: Users, active: false },
                          { label: "Sync Monitor", icon: Activity, active: false },
                          { label: "Vault Analytics", icon: Coins, active: false },
                        ].map((item, idx) => (
                          <div
                            key={idx}
                            className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                              item.active
                                ? "bg-cyan-600/10 text-cyan-700 shadow-xs"
                                : "text-slate-500 hover:text-slate-800 hover:bg-slate-100/80"
                            }`}
                          >
                            <item.icon className={`w-3.5 h-3.5 ${item.active ? "text-cyan-600" : "text-slate-400"}`} />
                            <span>{item.label}</span>
                          </div>
                        ))}
                      </nav>
                    </div>

                    <div className="mt-6 md:mt-0 p-2.5 bg-slate-100 border border-slate-200 rounded-xl flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-cyan-600 text-white font-extrabold text-[9px] flex items-center justify-center">
                        SK
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-black text-slate-800 truncate leading-tight">Sanjay Kumar</p>
                        <span className="text-[8px] text-slate-400 font-bold leading-none block uppercase">Admin Role</span>
                      </div>
                    </div>
                  </div>

                  {/* Mock Main Panel */}
                  <div className="flex-1 p-6 lg:p-8 overflow-y-auto space-y-6 bg-slate-50/50">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">Management</h4>
                        <h2 className="text-lg font-extrabold text-slate-900 mt-1">Operational Overview</h2>
                      </div>
                      <span className="text-[9px] bg-emerald-55 border border-emerald-200 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider animate-pulse flex items-center gap-1 text-emerald-600">
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span> Live
                      </span>
                    </div>

                    {/* KPI Cards Grid */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs hover:shadow-sm transition-all">
                        <span className="text-[9px] uppercase font-bold tracking-widest text-slate-400">Total Today</span>
                        <h4 className="text-lg lg:text-xl font-black text-slate-800 mt-0.5">₹ 84,200</h4>
                        <span className="text-[8px] text-emerald-605 font-bold block mt-0.5">● Synced</span>
                      </div>
                      <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs hover:shadow-sm transition-all">
                        <span className="text-[9px] uppercase font-bold tracking-widest text-slate-400">Compliance</span>
                        <h4 className="text-lg lg:text-xl font-black text-slate-800 mt-0.5">99.8%</h4>
                        <span className="text-[8px] text-slate-500 font-medium block mt-0.5">Tally correct</span>
                      </div>
                      <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs hover:shadow-sm transition-all">
                        <span className="text-[9px] uppercase font-bold tracking-widest text-slate-400">Routes</span>
                        <h4 className="text-lg lg:text-xl font-black text-slate-800 mt-0.5">12 / 12</h4>
                        <span className="text-[8px] text-emerald-605 font-bold block mt-0.5">Active</span>
                      </div>
                    </div>

                    {/* Grid for activity graph and logs */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                      {/* Graph Column */}
                      <div className="lg:col-span-7 bg-white p-4.5 rounded-xl border border-slate-200/80 shadow-xs flex flex-col justify-between h-44">
                        <div className="flex justify-between items-center">
                          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Sync Daemon Activity</span>
                          <span className="text-[8px] text-emerald-606 font-mono font-bold">● 25 txns/sec</span>
                        </div>
                        <div className="h-24 flex items-end gap-1.5 pt-2">
                          {[30, 45, 60, 50, 75, 90, 85, 95, 70, 85, 100].map((h, idx) => (
                            <div key={idx} className="flex-1 bg-gradient-to-t from-blue-600 to-cyan-500 rounded-t-sm" style={{ height: `${h}%` }} />
                          ))}
                        </div>
                      </div>

                      {/* Log Column */}
                      <div className="lg:col-span-5 bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex flex-col justify-between h-44">
                        <div>
                          <h4 className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-2">Verification Log</h4>
                          <div className="space-y-1.5">
                            {mockRetailers.slice(0, 2).map((r, i) => (
                              <div key={i} className="p-2 bg-slate-50 border border-slate-100 rounded-lg flex items-center justify-between text-[9px]">
                                <div className="min-w-0 pr-2">
                                  <p className="font-extrabold text-slate-700 truncate leading-tight">{r.name}</p>
                                  <p className="text-[8px] text-slate-400 truncate mt-0.5 leading-none">{r.address}</p>
                                </div>
                                <span className="text-[8px] text-emerald-600 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider shrink-0">Verified</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="text-[8px] text-slate-400 font-bold border-t border-slate-100 pt-2 flex justify-between">
                          <span>SMTP Receipts: On</span>
                          <span>v2.1.0</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              {/* Floating UI Widget 1 (Live Collections Activity Feed) */}
              <motion.div
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                className="absolute top-12 left-[-60px] hidden xl:flex items-center gap-3 bg-[#0d1b3e] text-white p-4 rounded-2xl shadow-xl border border-white/10 w-64 text-left select-none"
              >
                <div className="bg-cyan-500/25 p-2 rounded-xl text-cyan-400">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <h5 className="text-xs font-bold text-white leading-none mb-1 font-sans">Live Collection synced</h5>
                  <p className="text-[10px] text-slate-400 font-sans">₹8,400 from Nova Retailers</p>
                  <span className="text-[8px] text-cyan-400 block mt-1 font-sans">2 seconds ago</span>
                </div>
              </motion.div>

              {/* Floating UI Widget 2 (KM Odometer Status Badge) */}
              <motion.div
                animate={{ y: [0, 8, 0] }}
                transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                className="absolute bottom-16 right-[-70px] hidden xl:flex items-center gap-3 bg-white p-4 rounded-2xl shadow-xl border border-slate-200/80 w-60 text-left select-none"
              >
                <div className="bg-emerald-50 p-2.5 rounded-xl text-emerald-600 border border-emerald-200">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h5 className="text-xs font-bold text-slate-800 leading-none mb-1 font-sans">Odometer Complied</h5>
                  <p className="text-[10px] text-slate-500 font-sans">Ramesh K. checked out</p>
                  <span className="text-[9px] text-emerald-600 font-bold block mt-1 font-sans">Start: 124km | End: 145km</span>
                </div>
              </motion.div>

              {/* Floating UI Widget 3 (Database Routing Shield) */}
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut", delay: 2 }}
                className="absolute top-36 right-[-80px] hidden xl:flex items-center gap-3 bg-[#0d1b3e] text-white px-4 py-3 rounded-xl shadow-lg border border-white/10 w-56 text-left select-none"
              >
                <div className="bg-cyan-500/20 p-2 rounded-lg text-cyan-400">
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <h5 className="text-[11px] font-bold text-white leading-none font-sans">Secure Workspace</h5>
                  <p className="text-[9px] text-cyan-400 font-mono mt-1">workspace.crediiflow.in</p>
                </div>
              </motion.div>

            </motion.div>

          </div>
        </section>

        {/* ── STORYTELLING PRODUCT TOUR (Alternating Showcase) ── */}
        <section id="overview" className="py-28 px-6 bg-slate-50/30 border-y border-slate-100 relative">
          <div className="max-w-7xl mx-auto">

            <div className="text-center max-w-2xl mx-auto mb-20">
              <span className="text-xs font-bold text-cyan-600 uppercase tracking-widest font-sans">Product Tour</span>
              <h2 className="text-3xl sm:text-5xl font-black text-slate-900 mt-2 font-display">
                Built for High-Velocity Field Operations
              </h2>
              <p className="text-slate-500 font-light mt-4 text-sm leading-relaxed font-sans">
                Discover how CrediiFlow synchronizes data from remote field sites directly into secure audit ledgers.
              </p>
            </div>

            {/* Tour Block 1: Offline Synchronization */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center py-16">
              <div className="space-y-6 text-left">
                <div className="bg-cyan-50 p-2.5 rounded-xl text-cyan-600 border border-cyan-100 w-fit">
                  <RefreshCw className="w-5 h-5" />
                </div>
                <h3 className="text-3xl font-extrabold text-slate-900 font-display">Background Offline-Sync Daemon</h3>
                <p className="text-slate-500 font-light leading-relaxed font-sans">
                  Field collections often happen in cellular dead zones, basements, or rural markets. Our Progressive Web App features an offline interception layer that caches transaction entries locally inside the browser's IndexedDB.
                </p>
                <ul className="space-y-3 text-sm text-slate-600 font-medium font-sans">
                  <li className="flex items-center gap-2.5"><Check className="w-4 h-4 text-emerald-600" /> Automatic queue retry on network recovery</li>
                  <li className="flex items-center gap-2.5"><Check className="w-4 h-4 text-emerald-600" /> Dexie.js database schema layer protection</li>
                  <li className="flex items-center gap-2.5"><Check className="w-4 h-4 text-emerald-600" /> Double-entry checks run locally before sync</li>
                </ul>
              </div>

              {/* Graphic Mock 1 */}
              <div className="bg-white/60 backdrop-blur-md p-8 rounded-3xl border border-slate-200/80 shadow-lg relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-3 bg-amber-50 rounded-bl-2xl border-l border-b border-slate-200 text-amber-500 font-bold text-[10px] flex items-center gap-1.5 animate-pulse font-sans"><WifiOff className="w-3.5 h-3.5" /> Offline Mode Active</div>
                <div className="space-y-4 pt-4 text-left">
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-black text-slate-400 uppercase font-sans">Sync Queue</span>
                      <h4 className="text-lg font-black text-slate-800 font-sans">2 Transactions Pending</h4>
                    </div>
                    <span className="text-xs bg-amber-100 text-amber-600 px-3 py-1 rounded-full font-bold font-sans">Awaiting Signal</span>
                  </div>
                  <div className="space-y-2.5 opacity-60">
                    <div className="p-3 bg-slate-50/50 border border-slate-200 rounded-xl flex items-center justify-between text-xs font-sans">
                      <span>Apex Grocers</span>
                      <span className="font-extrabold">₹12,500</span>
                    </div>
                    <div className="p-3 bg-slate-50/50 border border-slate-200 rounded-xl flex items-center justify-between text-xs font-sans">
                      <span>Nova Retailers</span>
                      <span className="font-extrabold">₹8,400</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Tour Block 2: Running Khatabook Ledger Sheet (Reverse Grid) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center py-16">
              {/* Graphic Mock 2 */}
              <div className="bg-white/60 backdrop-blur-md p-8 rounded-3xl border border-slate-200/80 shadow-lg text-left order-2 lg:order-1">
                <h4 className="text-xs font-bold text-slate-400 uppercase mb-4 tracking-wider font-sans">Retailer Statement Sheet</h4>
                <div className="space-y-3">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex justify-between items-center">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase font-sans">Outstanding Balance</p>
                      <h3 className="text-2xl font-black text-slate-900 font-sans">₹ 84,000</h3>
                    </div>
                    <button className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer font-sans">
                      <FileText className="w-3.5 h-3.5" /> PDF Statement
                    </button>
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                    <div className="bg-slate-50 p-2.5 border-b border-slate-200 font-bold flex justify-between text-[9px] text-slate-400 uppercase font-sans">
                      <span>Date / Type</span>
                      <span>Collection</span>
                      <span>Balance</span>
                    </div>
                    <div className="p-3 flex justify-between border-b border-slate-100 last:border-b-0 font-sans">
                      <div>
                        <p className="font-bold text-slate-800">30-06-2026</p>
                        <span className="text-[9px] text-slate-400 block font-sans">Cash Payment</span>
                      </div>
                      <span className="text-emerald-600 font-extrabold">- ₹12,500</span>
                      <span className="font-bold text-slate-700">₹71,500</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-6 text-left order-1 lg:order-2">
                <div className="bg-cyan-50 p-2.5 rounded-xl text-cyan-600 border border-cyan-100 w-fit">
                  <FileText className="w-5 h-5" />
                </div>
                <h3 className="text-3xl font-extrabold text-slate-900 font-display">Outstanding Ledger Sheets</h3>
                <p className="text-slate-500 font-light leading-relaxed font-sans">
                  Avoid ledger discrepancies and dispute claims. The platform maintains a running balance record per retailer organization. Crediting and debiting entries are computed automatically based on physical collection receipts.
                </p>
                <ul className="space-y-3 text-sm text-slate-600 font-medium font-sans">
                  <li className="flex items-center gap-2.5"><Check className="w-4 h-4 text-emerald-600" /> Export print-ready statement PDFs in seconds</li>
                  <li className="flex items-center gap-2.5"><Check className="w-4 h-4 text-emerald-600" /> Secure read-only link access tokens</li>
                  <li className="flex items-center gap-2.5"><Check className="w-4 h-4 text-emerald-600" /> Live balance checking at the door</li>
                </ul>
              </div>
            </div>

            {/* Tour Block 3: Dynamic Tenant Workspace Routing */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center py-16">
              <div className="space-y-6 text-left">
                <div className="bg-cyan-50 p-2.5 rounded-xl text-cyan-600 border border-cyan-100 w-fit">
                  <Layers className="w-5 h-5" />
                </div>
                <h3 className="text-3xl font-extrabold text-slate-900 font-display">Multi-Tenant Routing Layer</h3>
                <p className="text-slate-500 font-light leading-relaxed font-sans">
                  Database isolation is essential for enterprise financial systems. CrediiFlow operates a master domain routing engine: subdomains dynamically connect to isolated schema targets.
                </p>
                <ul className="space-y-3 text-sm text-slate-600 font-medium font-sans">
                  <li className="flex items-center gap-2.5"><Check className="w-4 h-4 text-emerald-600" /> Zero database cross-contamination</li>
                  <li className="flex items-center gap-2.5"><Check className="w-4 h-4 text-emerald-600" /> Custom SMTP credentials per organization</li>
                  <li className="flex items-center gap-2.5"><Check className="w-4 h-4 text-emerald-600" /> Independent staff logins and shifts</li>
                </ul>
              </div>

              {/* Graphic Mock 3 */}
              <div className="bg-slate-900 text-white p-8 rounded-3xl border border-white/5 shadow-lg text-left relative overflow-hidden">
                <div className="absolute top-0 right-0 p-3 bg-cyan-950 text-cyan-400 rounded-bl-2xl border-l border-b border-white/5 text-[9px] font-mono">Routing Guard</div>
                <div className="space-y-4 pt-4">
                  <div className="p-3.5 bg-slate-800/50 rounded-xl border border-white/5 font-mono text-xs flex justify-between items-center">
                    <span className="text-slate-400">Request Host:</span>
                    <span className="text-white font-bold">workspace.crediiflow.in</span>
                  </div>
                  <div className="h-0.5 bg-gradient-to-r from-cyan-500 to-transparent my-2" />
                  <div className="space-y-2">
                    <div className="p-3 bg-slate-800/40 rounded-lg text-xs font-mono flex justify-between items-center">
                      <span className="text-slate-400">Tenant Workspace:</span>
                      <span className="text-cyan-400">WORKSPACE Operations</span>
                    </div>
                    <div className="p-3 bg-slate-800/40 rounded-lg text-xs font-mono flex justify-between items-center">
                      <span className="text-slate-400">Connection Pool:</span>
                      <span className="text-emerald-400">Isolated schema OK</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* ── INTERACTIVE MOCK SIMULATOR ── */}
        <section id="demo-pwa" className="py-24 px-6 relative border-b border-slate-200 z-10">
          <div className="max-w-7xl mx-auto">

            <div className="text-center max-w-2xl mx-auto mb-16">
              <span className="text-xs font-bold text-cyan-600 uppercase tracking-widest font-sans">Try it yourself</span>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 mt-2 font-display">
                Live Interactive Application Simulator
              </h2>
              <p className="text-slate-500 font-light mt-4 text-sm leading-relaxed font-sans">
                Test the actual software flow. Simulate a staff member logging cash in the field, then see how the admin verifies it and aggregates dashboards in real-time.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">

              {/* LEFT CONTAINER: PWA SIMULATOR (Col-span 5) */}
              <div className="lg:col-span-5 flex flex-col justify-between p-4 bg-white/70 backdrop-blur-md border border-slate-200 rounded-[2rem] shadow-md relative overflow-hidden select-none group/device text-left">

                {/* Simulated Glass Reflection overlay */}
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent -translate-x-full group-hover/device:translate-x-full transition-transform duration-[1200ms] pointer-events-none" />

                <div>
                  {/* Status Bar (Boxed logo in portal style bg-slate-950) */}
                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 shrink-0 font-display">
                        <img src="/logo-icon.png" alt="Logo" className="h-6 w-auto object-contain" />
                        <span className="text-sm tracking-tight text-slate-900 select-none">
                          <span className="font-extrabold text-slate-900">Credii</span>
                          <span className="font-semibold text-cyan-600">Flow</span>
                        </span>
                      </div>
                      <div>
                        <h1 className="text-[11px] font-black text-slate-800 uppercase tracking-wider leading-none mb-1 font-sans">Cash In Entry</h1>
                        <p className="text-[9px] text-slate-400 font-bold leading-none font-sans">Record payment details.</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 font-sans">
                      <label className="flex items-center gap-1 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={isOffline}
                          onChange={(e) => setIsOffline(e.target.checked)}
                          className="w-3.5 h-3.5 accent-cyan-600 cursor-pointer"
                        />
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider">Simulate Offline</span>
                      </label>
                      <div className={`flex items-center justify-center p-1 rounded-md border ${isOffline ? 'bg-amber-50 border-amber-200 text-amber-500 animate-pulse' : 'bg-slate-100 border-slate-200 text-emerald-605'}`}>
                        {isOffline ? <WifiOff className="w-3.5 h-3.5" /> : <Wifi className="w-3.5 h-3.5" />}
                      </div>
                    </div>
                  </div>

                  {/* Form Mock */}
                  <div className="space-y-3">

                    {/* Source Selector Tabs */}
                    <div className="p-1 rounded-lg bg-slate-100 border border-slate-200 flex gap-1 font-sans">
                      <button
                        type="button"
                        onClick={() => setSourceType("retailer")}
                        className={`flex-1 py-1.5 rounded-md text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer ${sourceType === "retailer" ? "bg-white text-slate-900 shadow-sm" : "text-slate-400"}`}
                      >
                        Retailer
                      </button>
                      <button
                        type="button"
                        onClick={() => setSourceType("staff")}
                        className={`flex-1 py-1.5 rounded-md text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer ${sourceType === "staff" ? "bg-white text-slate-900 shadow-sm" : "text-slate-400"}`}
                      >
                        Staff
                      </button>
                      <button
                        type="button"
                        onClick={() => setSourceType("office")}
                        className={`flex-1 py-1.5 rounded-md text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer ${sourceType === "office" ? "bg-white text-slate-900 shadow-sm" : "text-slate-400"}`}
                      >
                        Super Distributor
                      </button>
                    </div>

                    {/* Source selection */}
                    {sourceType === "retailer" ? (
                      <div className="p-3 rounded-lg bg-white border border-slate-200 shadow-xs space-y-2 font-sans">
                        <div>
                          <label className="block text-[8px] uppercase tracking-wider font-black text-slate-400 mb-1">Select Retailer</label>
                          <div className="relative">
                            <select
                              value={selectedRetailer.id}
                              onChange={(e) => {
                                const match = mockRetailers.find(r => r.id === e.target.value);
                                if (match) setSelectedRetailer(match);
                              }}
                              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-bold text-slate-800 focus:outline-none appearance-none cursor-pointer focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 transition-all"
                            >
                              {mockRetailers.map(r => (
                                <option key={r.id} value={r.id}>{r.name} ({r.phone})</option>
                              ))}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                          </div>
                        </div>

                        <div className="p-2 bg-slate-50 rounded-lg border border-slate-200/60 flex items-center gap-1.5 text-[10px]">
                          <CheckCircle2 className="w-3.5 h-3.5 text-slate-400" />
                          <div>
                            <span className="font-extrabold text-slate-700">{selectedRetailer.name}</span>
                            <span className="text-slate-400 block text-[8px] font-bold">Balance: ₹{selectedRetailer.balance.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    ) : sourceType === "staff" ? (
                      <div className="p-3 rounded-lg bg-white border border-slate-200 shadow-xs font-sans">
                        <label className="block text-[8px] uppercase tracking-wider font-black text-slate-400 mb-1">Select Staff Member</label>
                        <select className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-bold text-slate-800 focus:outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 transition-all">
                          <option>Ramesh Kumar</option>
                          <option>Amit Singh</option>
                          <option>Suresh P.</option>
                        </select>
                      </div>
                    ) : (
                      <div className="p-3 bg-slate-100 rounded-lg border border-slate-200 text-[10px] font-bold text-slate-500 text-center font-sans">
                        Super Distributor Office Source Selected
                      </div>
                    )}

                    {/* Denominations card */}
                    <div className="p-3 rounded-lg bg-white border border-slate-200 shadow-xs font-sans">
                      <div className="flex items-center gap-1.5 mb-2">
                        <Coins className="w-3.5 h-3.5 text-slate-500" />
                        <h2 className="text-[10px] font-black uppercase tracking-wider text-slate-700">Counting Details (Notes)</h2>
                      </div>

                      <div className="space-y-2">
                        {/* 500 notes row with +/- increment adjusters */}
                        <div className="flex items-center gap-2 justify-between py-0.5 border-b border-slate-100 last:border-b-0">
                          <span className="text-[11px] font-bold text-slate-800 w-20 text-left">₹500 Notes</span>
                          <span className="text-slate-300 text-xs font-bold">&times;</span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setNotes500(Math.max(0, notes500 - 1))}
                              className="w-5 h-5 rounded bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-xs font-black text-slate-600 transition-colors cursor-pointer select-none"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              value={notes500 === 0 ? "" : notes500}
                              onChange={(e) => setNotes500(Math.max(0, parseInt(e.target.value) || 0))}
                              className="w-10 py-0.5 bg-slate-50 border border-slate-200 rounded text-center text-xs text-slate-800 font-extrabold focus:outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 transition-all"
                              placeholder="0"
                            />
                            <button
                              type="button"
                              onClick={() => setNotes500(notes500 + 1)}
                              className="w-5 h-5 rounded bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-xs font-black text-slate-600 transition-colors cursor-pointer select-none"
                            >
                              +
                            </button>
                          </div>
                          <span className="text-slate-300 text-[9px] font-bold">＝</span>
                          <span className="text-xs font-black text-slate-700 text-right w-16 font-sans">₹{(notes500 * 500).toLocaleString()}</span>
                        </div>

                        {/* 200 notes row with +/- increment adjusters */}
                        <div className="flex items-center gap-2 justify-between py-0.5 border-b border-slate-100 last:border-b-0">
                          <span className="text-[11px] font-bold text-slate-800 w-20 text-left">₹200 Notes</span>
                          <span className="text-slate-300 text-xs font-bold">&times;</span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setNotes200(Math.max(0, notes200 - 1))}
                              className="w-5 h-5 rounded bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-xs font-black text-slate-600 transition-colors cursor-pointer select-none"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              value={notes200 === 0 ? "" : notes200}
                              onChange={(e) => setNotes200(Math.max(0, parseInt(e.target.value) || 0))}
                              className="w-10 py-0.5 bg-slate-50 border border-slate-200 rounded text-center text-xs text-slate-800 font-extrabold focus:outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 transition-all"
                              placeholder="0"
                            />
                            <button
                              type="button"
                              onClick={() => setNotes200(notes200 + 1)}
                              className="w-5 h-5 rounded bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-xs font-black text-slate-600 transition-colors cursor-pointer select-none"
                            >
                              +
                            </button>
                          </div>
                          <span className="text-slate-300 text-[9px] font-bold">＝</span>
                          <span className="text-xs font-black text-slate-700 text-right w-16 font-sans">₹{(notes200 * 200).toLocaleString()}</span>
                        </div>

                        {/* 100 notes row with +/- increment adjusters */}
                        <div className="flex items-center gap-2 justify-between py-0.5 border-b border-slate-100 last:border-b-0">
                          <span className="text-[11px] font-bold text-slate-800 w-20 text-left">₹100 Notes</span>
                          <span className="text-slate-300 text-xs font-bold">&times;</span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setNotes100(Math.max(0, notes100 - 1))}
                              className="w-5 h-5 rounded bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-xs font-black text-slate-600 transition-colors cursor-pointer select-none"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              value={notes100 === 0 ? "" : notes100}
                              onChange={(e) => setNotes100(Math.max(0, parseInt(e.target.value) || 0))}
                              className="w-10 py-0.5 bg-slate-50 border border-slate-200 rounded text-center text-xs text-slate-800 font-extrabold focus:outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 transition-all"
                              placeholder="0"
                            />
                            <button
                              type="button"
                              onClick={() => setNotes100(notes100 + 1)}
                              className="w-5 h-5 rounded bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-xs font-black text-slate-600 transition-colors cursor-pointer select-none"
                            >
                              +
                            </button>
                          </div>
                          <span className="text-slate-300 text-[9px] font-bold">＝</span>
                          <span className="text-xs font-black text-slate-700 text-right w-16 font-sans">₹{(notes100 * 100).toLocaleString()}</span>
                        </div>

                        {/* UPI online row */}
                        {sourceType === "retailer" && (
                          <div className="flex flex-col gap-1.5 pt-2 border-t border-slate-200">
                            <div className="flex items-center gap-2 justify-between">
                              <span className="text-[11px] font-black text-slate-600 w-24">Online (UPI)</span>
                              <span className="text-slate-300 text-xs font-bold">+</span>
                              <input
                                type="number"
                                placeholder="₹0.00"
                                value={onlineAmount || ""}
                                onChange={(e) => setOnlineAmount(Math.max(0, parseInt(e.target.value) || 0))}
                                className="w-28 px-2 py-1 bg-slate-50 border border-slate-200 rounded text-center text-xs text-slate-850 font-extrabold focus:outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 transition-all"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Total display card */}
                    <div className="p-3 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-between font-sans">
                      <div>
                        <span className="text-[8px] uppercase font-black tracking-wider text-slate-400">Total Amount</span>
                        <div className="text-[9px] text-slate-500 mt-0.5 font-bold">
                          Cash: ₹{totalCashAmount.toLocaleString()} | UPI: ₹{onlineAmount.toLocaleString()}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-black text-slate-800">
                          ₹{totalCollectionAmount.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {/* Collection Date */}
                    <div className="space-y-1 font-sans">
                      <label className="block text-[8px] uppercase tracking-wider font-black text-slate-400 px-1">Collection Date</label>
                      <input
                        type="date"
                        value={new Date().toISOString().substring(0, 10)}
                        readOnly
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 font-bold focus:outline-none cursor-pointer"
                      />
                    </div>

                    {/* Remarks Input */}
                    <div className="space-y-1 font-sans">
                      <label className="block text-[8px] uppercase tracking-wider font-black text-slate-400 px-1">Remarks</label>
                      <div className="relative">
                        <FileText className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
                        <input
                          type="text"
                          value={remarks}
                          onChange={(e) => setRemarks(e.target.value)}
                          className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 font-bold focus:outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 transition-all"
                        />
                      </div>
                    </div>

                  </div>
                </div>

                {/* Submit button */}
                <div className="mt-6 pt-3 border-t border-slate-200 font-sans">
                  <button
                    onClick={handlePwaSubmit}
                    disabled={totalCollectionAmount === 0}
                    className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold rounded-lg text-xs uppercase tracking-wider active:scale-[0.98] transition-all cursor-pointer disabled:cursor-not-allowed"
                  >
                    Submit Cash In Entry
                  </button>
                </div>

              </div>

              {/* RIGHT CONTAINER: ADMIN COMMAND CENTER (Col-span 7) */}
              <div className="lg:col-span-7 flex flex-col justify-between p-6 bg-white/70 backdrop-blur-md border border-slate-200 rounded-[2rem] shadow-md text-left relative overflow-hidden group/admin font-sans">
                {/* Admin Screen highlight reflection */}
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent -translate-x-full group-hover/admin:translate-x-full transition-transform duration-[1200ms] pointer-events-none" />

                <div>
                  <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-200">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Admin Verification Panel</span>
                    </div>

                    <span className="text-[10px] text-slate-400 font-mono">Database: production-replica</span>
                  </div>

                  {/* Status Banner notification */}
                  <AnimatePresence>
                    {pwaMessage && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className={`p-3 rounded-xl mb-6 text-xs font-bold flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 bg-green-500/10`}
                      >
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{pwaMessage.text}</span>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Top KPIs Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                    <div className="bg-white/80 border border-slate-200 rounded-2xl p-4 hover:bg-slate-100 transition-colors">
                      <p className="text-[9px] uppercase font-bold text-slate-400 tracking-widest">Today's Total</p>
                      <h4 className="text-lg font-black text-slate-900 mt-1">₹ {totalToday.toLocaleString()}</h4>
                    </div>

                    <div className="bg-white/80 border border-slate-200 rounded-2xl p-4 hover:bg-slate-100 transition-colors">
                      <p className="text-[9px] uppercase font-bold text-slate-400 tracking-widest">Local Queue</p>
                      <h4 className={`text-lg font-black mt-1 ${offlineQueue.length > 0 ? 'text-amber-500' : 'text-slate-400'}`}>{offlineQueue.length} Logged</h4>
                    </div>

                    <div className="bg-white/80 border border-slate-200 rounded-2xl p-4 hover:bg-slate-100 transition-colors">
                      <p className="text-[9px] uppercase font-bold text-slate-400 tracking-widest">Shifts Active</p>
                      <h4 className="text-lg font-black text-slate-900 mt-1">4 / 5 Staff</h4>
                    </div>

                    <div className="bg-white/80 border border-slate-200 rounded-2xl p-4 hover:bg-slate-100 transition-colors">
                      <p className="text-[9px] uppercase font-bold text-slate-400 tracking-widest">Tally Match</p>
                      <h4 className="text-lg font-black text-emerald-600 mt-1">100%</h4>
                    </div>
                  </div>

                  {/* Ledger Logs Table */}
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Collections Log Verification</h4>
                      <span className="text-[9px] text-slate-400 font-bold">Auto-sync updates live</span>
                    </div>

                    <div className="bg-white/80 border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-slate-200 text-slate-400 bg-slate-50/50 font-bold uppercase text-[9px] tracking-wider">
                              <th className="p-3">Retailer / Store</th>
                              <th className="p-3">Agent</th>
                              <th className="p-3">Amount</th>
                              <th className="p-3 text-center">Status</th>
                              <th className="p-3 text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {logs.map((log) => (
                              <tr key={log.id} className="border-b border-slate-150 hover:bg-slate-50/50 transition-colors">
                                <td className="p-3 font-semibold text-slate-800">
                                  {log.retailer}
                                  <span className="block text-[9px] text-slate-400 mt-0.5 font-medium">{log.time}</span>
                                </td>
                                <td className="p-3 text-slate-500 font-medium">{log.staff}</td>
                                <td className="p-3 font-black text-slate-900">₹ {log.amount.toLocaleString()}</td>
                                <td className="p-3 text-center">
                                  <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${log.status === "verified" ? 'bg-green-50 text-emerald-600 border border-green-200' : 'bg-amber-50 text-amber-500 border border-amber-200'
                                    }`}>
                                    {log.status}
                                  </span>
                                </td>
                                <td className="p-3 text-right">
                                  {log.status === "pending" ? (
                                    <button
                                      type="button"
                                      onClick={() => verifyRecord(log.id, log.amount)}
                                      className="px-2.5 py-1 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer"
                                    >
                                      Verify
                                    </button>
                                  ) : (
                                    <span className="text-[9px] text-slate-400 font-medium flex items-center justify-end gap-1"><CheckCircle2 className="w-3 h-3 text-emerald-500" /> Logged</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                </div>

                <div className="mt-8 pt-4 border-t border-slate-200 text-[10px] text-slate-400 flex justify-between">
                  <span>© CrediiFlow Ledger Engine</span>
                  <span className="flex items-center gap-1 font-semibold text-cyan-600"><Lock className="w-3 h-3" /> Secure AES-256 Session</span>
                </div>

              </div>

            </div>

          </div>
        </section>

        {/* ── STATISTICS SECTION WITH COUNT-UP COUNTERS ── */}
        <section className="py-20 bg-[#0d1b3e] text-white relative border-y border-slate-900 overflow-hidden">
          <div className="absolute inset-0 bg-dot-pattern opacity-10 pointer-events-none" />
          <div className="max-w-7xl mx-auto px-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-10 text-center">

              <div>
                <p className="text-[10px] uppercase font-bold tracking-widest text-cyan-400 mb-2 font-sans">Ledger Entries Managed</p>
                <h3 className="text-4xl sm:text-5xl font-extrabold text-white">
                  <Counter value={25} suffix="K+" />
                </h3>
                <span className="text-[10px] text-slate-400 mt-1 block font-sans">Real-time balances</span>
              </div>

              <div>
                <p className="text-[10px] uppercase font-bold tracking-widest text-cyan-400 mb-2 font-sans">Active Workspaces</p>
                <h3 className="text-4xl sm:text-5xl font-extrabold text-white">
                  <Counter value={120} suffix="+" />
                </h3>
                <span className="text-[10px] text-slate-400 mt-1 block font-sans">Tenant organizations</span>
              </div>

              <div>
                <p className="text-[10px] uppercase font-bold tracking-widest text-cyan-400 mb-2 font-sans">Recovery Efficiency</p>
                <h3 className="text-4xl sm:text-5xl font-extrabold text-white">
                  <Counter value={99} suffix=".9%" />
                </h3>
                <span className="text-[10px] text-slate-400 mt-1 block font-sans">Zero tally mismatch</span>
              </div>

              <div>
                <p className="text-[10px] uppercase font-bold tracking-widest text-cyan-400 mb-2 font-sans">Sync Time</p>
                <h3 className="text-4xl sm:text-5xl font-extrabold text-white">
                  &lt; <Counter value={2} suffix="s" />
                </h3>
                <span className="text-[10px] text-slate-400 mt-1 block font-sans">Offline sync speed</span>
              </div>

            </div>
          </div>
        </section>

        {/* ── CONNECTED PROCESS TIMELINE (A Day with CrediiFlow) ── */}
        <section id="timeline" className="py-24 px-6 relative border-b border-slate-200">
          <div className="max-w-7xl mx-auto">
            <div className="text-center max-w-2xl mx-auto mb-20">
              <span className="text-xs font-bold text-cyan-600 uppercase tracking-widest font-sans">A Day with CrediiFlow</span>
              <h2 className="text-3xl sm:text-5xl font-black text-slate-900 mt-2 font-display">
                A Day with CrediiFlow
              </h2>
              <p className="text-slate-500 font-light mt-4 text-sm leading-relaxed font-sans">
                Follow the complete workflow from morning check-in to end-of-day reports
              </p>
            </div>

            {/* Interactive Timeline */}
            <div className="relative">
              {/* Connected Line */}
              <div className="absolute top-[40px] left-[7%] right-[7%] h-[3px] bg-slate-200 hidden md:block" />

              {/* Progress Line */}
              <div
                className="absolute top-[40px] left-[7%] h-[3px] bg-cyan-600 hidden md:block transition-all duration-500"
                style={{ width: `${(activeStep / 6) * 86}%` }}
              />

              <div className="grid grid-cols-2 md:grid-cols-7 gap-6 font-sans">
                {[
                  { title: "Day Start", desc: "Staff begins their daily route", step: "01" },
                  { title: "Attendance Check-In", desc: "Photo verification & odometer capture", step: "02" },
                  { title: "Cash Collection", desc: "Collect from retailers with denomination entry", step: "03" },
                  { title: "Cash Deposit", desc: "Deposit at bank or portal", step: "04" },
                  { title: "Ledger Update", desc: "Automatic ledger reconciliation", step: "05" },
                  { title: "Admin Dashboard", desc: "Real-time visibility for admins", step: "06" },
                  { title: "Financial Reports", desc: "Generate audit-ready reports", step: "07" }
                ].map((item, index) => (
                  <div
                    key={index}
                    onClick={() => setActiveStep(index)}
                    className="relative z-10 text-center space-y-4 group cursor-pointer"
                  >
                    <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mx-auto text-base font-black transition-all duration-300 border ${activeStep === index
                        ? 'bg-[#0d1b3e] text-cyan-400 border-slate-950 shadow-lg scale-110 shadow-cyan-500/10'
                        : 'bg-white text-slate-400 border-slate-200 group-hover:border-slate-300 group-hover:scale-105'
                      }`}>
                      {item.step}
                    </div>
                    <div>
                      <h4 className={`text-xs sm:text-sm font-extrabold transition-colors duration-300 ${activeStep === index ? 'text-cyan-600' : 'text-slate-800'}`}>{item.title}</h4>
                      <p className="text-[10px] text-slate-400 mt-2 px-1 font-light leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── FEATURES SECTION (Lively and Interactive cards) ── */}
        <section id="features" className="py-24 px-6 relative border-b border-slate-200">
          <div className="max-w-7xl mx-auto">

            <div className="text-center max-w-2xl mx-auto mb-20">
              <span className="text-xs font-bold text-cyan-600 uppercase tracking-widest font-sans">Capabilities</span>
              <h2 className="text-3xl sm:text-5xl font-black text-slate-900 mt-2 font-display">
                Operational Modules Built for Verification
              </h2>
              <p className="text-slate-500 font-light mt-4 text-sm leading-relaxed font-sans">
                Every feature card below represents functional database schemas and frontend interfaces within the active application.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[
                {
                  icon: <Smartphone className="w-6 h-6 text-cyan-600 transition-transform group-hover:scale-110 duration-300" />,
                  title: "Denomination Multipliers",
                  desc: "Input fields mapped to standard note values (₹500, ₹200, ₹100, coins). Real-time calculator totalizes automatically, validating notes values matches cash entries before submission is allowed."
                },
                {
                  icon: <RefreshCw className="w-6 h-6 text-cyan-600 transition-transform group-hover:scale-110 duration-300" />,
                  title: "IndexedDB Offline Sync",
                  desc: "Built on Dexie.js browser schema layers. When internet connectivity drops, field submissions are intercepted, queued, and retried automatically once connection is recovered."
                },
                {
                  icon: <FileText className="w-6 h-6 text-cyan-600 transition-transform group-hover:scale-110 duration-300" />,
                  title: "Khatabook Ledger Sheet",
                  desc: "Running outstanding balances and complete ledger credits/debits per retailer. Secured read-only statement receipt links generated using hex-based UUID token routing."
                },
                {
                  icon: <Clock className="w-6 h-6 text-cyan-600 transition-transform group-hover:scale-110 duration-300" />,
                  title: "Shift Odometer Tracking",
                  desc: "Shift check-in and check-out logs requiring staff check-in start KM and check-out end KM entries. Tracks shift compliance and aggregates total daily travel distances."
                },
                {
                  icon: <Database className="w-6 h-6 text-cyan-600 transition-transform group-hover:scale-110 duration-300" />,
                  title: "Dual-Destination Deposits",
                  desc: "Logs cash turnovers: Option A (depositing cash to portal bank accounts with reference numbers) or Option B (returning payout cash to retailers with payment modes)."
                },
                {
                  icon: <Layers className="w-6 h-6 text-cyan-600 transition-transform group-hover:scale-110 duration-300" />,
                  title: "Multi-Tenant Routing",
                  desc: "Dynamically connects subdomains to isolated database schemas. Every company has an isolated dashboard, independent staff listings, and custom portal profiles."
                }
              ].map((feat, index) => (
                <div
                  key={index}
                  className="bg-white/40 backdrop-blur-xs p-8 rounded-3xl border border-slate-200/40 shadow-xs hover:shadow-xl hover:shadow-cyan-500/5 hover:border-slate-300 hover:bg-white transition-all duration-300 group space-y-4 text-left"
                >
                  <div className="bg-cyan-50 group-hover:bg-cyan-100 p-3 rounded-2xl border border-cyan-100 text-cyan-600 w-fit transition-colors duration-300">
                    {feat.icon}
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 group-hover:text-cyan-600 transition-colors duration-300 font-display">{feat.title}</h3>
                  <p className="text-xs text-slate-500 leading-relaxed font-light font-sans">
                    {feat.desc}
                  </p>
                </div>
              ))}
            </div>

          </div>
        </section>

        {/* ── SECURITY SECTION (Dark Mode Grid) ── */}
        <section id="security" className="py-24 px-6 relative border-t border-blue-950 bg-[#0d1b3e] text-white overflow-hidden">
          {/* Subtle neon glows */}
          <div className="absolute top-1/2 left-1/4 w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none" />

          <div className="max-w-7xl mx-auto relative z-10">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

              {/* visual Mock of Security */}
              <div className="space-y-4 order-2 lg:order-1 text-slate-900">
                <div className="bg-slate-900/60 p-6 rounded-2xl text-left border border-white/5 shadow-sm relative overflow-hidden hover:border-cyan-500/30 transition-all duration-300">
                  <div className="absolute top-0 right-0 p-3 bg-cyan-950 rounded-bl-2xl border-l border-b border-white/5 text-cyan-400"><Lock className="w-4 h-4" /></div>
                  <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-widest font-sans">Database Cryptography</h4>
                  <h3 className="text-lg font-bold text-white mt-1 font-display">Argon2id Hashing Profiles</h3>
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed font-light font-sans">All passwords and user profile records are protected with cryptographic salts.</p>
                </div>

                <div className="bg-slate-900/60 p-6 rounded-2xl text-left border border-white/5 shadow-sm hover:border-cyan-500/30 transition-all duration-300">
                  <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-widest font-sans">Authentication</h4>
                  <h3 className="text-lg font-bold text-white mt-1 font-display">JWT Bearer Cookie Rotation</h3>
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed font-light font-sans">Access tokens and rotating HTTPOnly refresh cookies isolate user sessions, reducing data leak vulnerability.</p>
                </div>

                <div className="bg-slate-900/60 p-6 rounded-2xl text-left border border-white/5 shadow-sm hover:border-cyan-500/30 transition-all duration-300">
                  <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-widest font-sans">Infrastructure</h4>
                  <h3 className="text-lg font-bold text-white mt-1 font-display">Cloudflare WAF Rate Limiting</h3>
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed font-light font-sans">DDoS protection filters and Web Application Firewall rules shield APIs from automated brute-force attacks.</p>
                </div>
              </div>

              {/* Security text explanation */}
              <div className="text-left space-y-6 order-1 lg:order-2">
                <span className="text-xs font-bold text-cyan-400 uppercase tracking-widest font-sans">Enterprise Guard</span>
                <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white leading-tight font-display">
                  Bank-Grade Architecture and Isolation
                </h2>
                <p className="text-slate-300 font-light leading-relaxed font-sans">
                  Our architecture is engineered from the ground up to support strict financial regulations. We enforce schema isolation, cryptographically hashed passwords, and automated physical database backups directly to Cloudflare R2 storage.
                </p>

                <ul className="space-y-3.5 pt-4 text-xs font-bold text-slate-200 font-sans">
                  <li className="flex items-center gap-3"><Check className="w-4 h-4 text-emerald-400" /> Automatic daily database backups</li>
                  <li className="flex items-center gap-3"><Check className="w-4 h-4 text-emerald-400" /> Full audit logs of all verified collections</li>
                  <li className="flex items-center gap-3"><Check className="w-4 h-4 text-emerald-400" /> HTTPS SSL certificates issued via Let's Encrypt</li>
                </ul>
              </div>

            </div>
          </div>
        </section>

        {/* ── TESTIMONIALS SECTION (Stripe/Mercury Style) ── */}
        <section className="py-24 px-6 relative border-b border-slate-200">
          <div className="max-w-7xl mx-auto">
            <div className="text-center max-w-2xl mx-auto mb-20">
              <span className="text-xs font-bold text-cyan-600 uppercase tracking-widest font-sans">Case Studies</span>
              <h2 className="text-3xl sm:text-5xl font-black text-slate-900 mt-2 font-display">
                Operational Success Stories
              </h2>
              <p className="text-slate-500 font-light mt-4 text-sm leading-relaxed font-sans">
                See how operations directors and CFOs verify collections with CrediiFlow.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 font-sans">
              {/* Testimonial 1 */}
              <div className="bg-white/60 backdrop-blur-md p-8 rounded-3xl border border-slate-200 shadow-sm text-left flex flex-col justify-between hover:border-slate-350 transition-all duration-300">
                <p className="text-slate-600 font-light italic leading-relaxed text-sm">
                  "Before CrediiFlow, verifying cash denominations across 45 collection routes meant auditing paper books until midnight. The IndexedDB offline feature solved all connection drop issues in rural markets. Our settlements are completed 10x faster now."
                </p>
                <div className="flex items-center gap-3.5 mt-8 border-t border-slate-100 pt-6">
                  <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-cyan-600 to-sky-500 text-white flex items-center justify-center font-black text-sm">
                    SK
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-slate-800">Sanjay K.</h5>
                    <p className="text-[10px] text-slate-400">Head of Operations, Apex Distributors</p>
                  </div>
                </div>
              </div>

              {/* Testimonial 2 */}
              <div className="bg-white/60 backdrop-blur-md p-8 rounded-3xl border border-slate-200 shadow-sm text-left flex flex-col justify-between hover:border-slate-300 transition-all duration-300">
                <p className="text-slate-600 font-light italic leading-relaxed text-sm">
                  "Having isolated logical database schemas for each super-distributor workspace ensures our bank audits are completely seamless. Our field agents simply adjust note multipliers in the app simulator interface, eliminating accounting mismatch cases."
                </p>
                <div className="flex items-center gap-3.5 mt-8 border-t border-slate-100 pt-6">
                  <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-teal-500 to-emerald-500 text-white flex items-center justify-center font-black text-sm">
                    VP
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-slate-800">Vikram P.</h5>
                    <p className="text-[10px] text-slate-400">Director of Finance, Metro NBFC</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── SUBDOMAINS ACCESS SECTION (Workspace Sign In) ── */}
        <section id="subdomains" className="py-28 px-6 bg-[#0d1b3e] text-white relative border-y border-blue-950 overflow-hidden">
          {/* Neon glows */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none" />

          <div className="max-w-7xl mx-auto relative z-10 text-center">
            <span className="text-xs font-bold text-cyan-400 uppercase tracking-widest font-sans">Secure Portal Access</span>
            <h2 className="text-3xl sm:text-5xl font-black text-white mt-2 font-display">
              Sign In to Your Workspace
            </h2>
            <p className="text-slate-400 font-light mt-4 text-sm max-w-xl mx-auto leading-relaxed font-sans">
              Enter your company's custom subdomain below to access your isolated database, staff shifts, and cash ledger records.
            </p>

            <div className="mt-12 max-w-lg mx-auto bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-[2rem] p-8 sm:p-10 shadow-[0_0_50px_rgba(6,182,212,0.05)] text-left font-sans">
              <form onSubmit={handleWorkspaceLookup} className="space-y-6">
                <div>
                  <label className="block text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-2">Workspace Subdomain</label>
                  <div className="relative flex items-center bg-slate-950/80 border border-white/10 rounded-2xl focus-within:border-cyan-500 focus-within:ring-4 focus-within:ring-cyan-500/15 transition-all overflow-hidden p-1">
                    <span className="pl-4 text-sm font-bold text-slate-500 select-none shrink-0">https://</span>
                    <input
                      type="text"
                      placeholder="your-company"
                      value={workspaceName}
                      onChange={(e) => setWorkspaceName(e.target.value)}
                      className="w-full px-2 py-3 bg-transparent text-sm font-bold text-white focus:outline-none placeholder-slate-600"
                      required
                    />
                    <span className="pr-4 text-sm font-bold text-cyan-400 select-none shrink-0">
                      .crediiflow.in
                    </span>
                  </div>
                </div>

                {workspaceMessage && (
                  <p className="text-xs text-cyan-400 font-semibold animate-pulse text-center">
                    {workspaceMessage}
                  </p>
                )}

                <button
                  type="submit"
                  className="w-full py-4 bg-gradient-to-r from-cyan-500 to-sky-600 hover:from-cyan-400 hover:to-sky-500 text-white font-bold rounded-2xl text-xs uppercase tracking-widest active:scale-[0.98] transition-all cursor-pointer shadow-lg shadow-cyan-500/10 text-center"
                >
                  Continue to Workspace &rarr;
                </button>
              </form>
            </div>
          </div>
        </section>

        {/* ── FAQ SECTION ── */}
        <section id="faq" className="py-24 px-6 relative border-b border-slate-200">
          <div className="max-w-4xl mx-auto">

            <div className="text-center mb-16">
              <span className="text-xs font-bold text-cyan-600 uppercase tracking-widest text-center font-sans">Got Questions?</span>
              <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mt-2 font-display">
                Frequently Asked Questions
              </h2>
            </div>

            <div className="space-y-4">
              {[
                {
                  q: "How does multi-tenancy work on the platform?",
                  a: "The platform uses a master routing database. When a client visits a subdomain (e.g. company.crediiflow.in), our backend FastAPI server extracts the hostname, checks the master registry to fetch their specific database connection string, and establishes a secure connection pool exclusively for that tenant."
                },
                {
                  q: "Can my company request its own subdomain?",
                  a: "Yes. During registration and onboarding, your company defines its unique workspace subdomain. Once verified by a super admin, the tenant becomes active instantly."
                },
                {
                  q: "Is my operational data isolated from other organizations?",
                  a: "Absolutely. We enforce logical schema separation or separate PostgreSQL database clusters. There is zero sharing of transaction logs, retailers, or staff lists between organizations."
                },
                {
                  q: "How does the offline mode cache collection logs?",
                  a: "If field workers lose connection, our frontend PWA intercepts form submission, caches details inside Dexie.js (an IndexedDB wrapper), and displays a local pending badge. The moment connection state recovers, a background sync daemon executes, uploading all pending collections sequentially."
                },
                {
                  q: "Does the platform support PDF exports and statements?",
                  a: "Yes, admins can export comprehensive collection spreadsheets in Excel formats or trigger print-ready PDF summaries of retailer ledgers. Automated PDF statement emails can also be sent directly to retailers upon collection verification."
                }
              ].map((faq, idx) => (
                <div key={idx} className="bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden text-left">
                  <button
                    onClick={() => setFaqOpen(faqOpen === idx ? null : idx)}
                    className="w-full px-6 py-5 flex items-center justify-between text-sm font-bold text-slate-800 focus:outline-none cursor-pointer font-sans"
                  >
                    <span>{faq.q}</span>
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${faqOpen === idx ? 'rotate-180' : ''}`} />
                  </button>

                  <AnimatePresence>
                    {faqOpen === idx && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="px-6 pb-6 text-xs text-slate-500 font-normal leading-relaxed border-t border-slate-200 pt-4 font-sans">
                          {faq.a}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>

          </div>
        </section>


      </main>

      {/* ── FOOTER (Stripe/Linear Inspired layout) ── */}
      <footer className="bg-slate-50 pt-20 relative z-10 text-left border-t border-slate-200">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12 px-6 pb-20">

          <div className="space-y-4">
            <div className="flex items-center">
              <div className="flex items-center gap-2.5 shrink-0 group font-display">
                <img 
                  src="/logo-icon.png" 
                  alt="CrediiFlow Logo Icon" 
                  className="h-7 w-auto object-contain transition-transform duration-300 group-hover:scale-[1.03]" 
                />
                <span className="text-lg tracking-tight text-slate-900 select-none">
                  <span className="font-extrabold text-slate-900">Credii</span>
                  <span className="font-semibold text-cyan-600">Flow</span>
                </span>
              </div>
            </div>
            <p className="text-[11px] text-slate-400 font-normal leading-relaxed max-w-xs font-sans">
              Enterprise-grade cash collection, denomination tallies, and retailer ledgers. Dynamic tenant database routing, secure isolation.
            </p>
          </div>

          <div>
            <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-5 font-sans">Product</h5>
            <ul className="space-y-3.5 text-xs text-slate-500 font-semibold font-sans">
              <li><a href="#overview" className="hover:text-slate-900 transition-colors">Overview</a></li>
              <li><a href="#features" className="hover:text-slate-900 transition-colors">Features</a></li>
              <li><a href="#demo-pwa" className="hover:text-slate-900 transition-colors">Interactive Demo</a></li>
            </ul>
          </div>

          <div>
            <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-5 font-sans">System</h5>
            <ul className="space-y-3.5 text-xs text-slate-500 font-semibold font-sans">
              <li><a href="#security" className="hover:text-slate-900 transition-colors">Security Guard</a></li>
              <li><a href="#subdomains" className="hover:text-slate-900 transition-colors">Multi-Tenant Subdomains</a></li>
              <li><a href="#" className="hover:text-slate-900 transition-colors">Privacy Policy</a></li>
              <li><a href="#" className="hover:text-slate-900 transition-colors">Terms of Service</a></li>
              <li><a href="#" className="hover:text-slate-900 transition-colors">DPA Agreement</a></li>
            </ul>
          </div>

          <div>
            <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-5 font-sans">Contact Info</h5>
            <ul className="space-y-3.5 text-xs text-slate-500 font-semibold font-sans">
              <li className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                <a href="mailto:info@xcplllp.com" className="hover:underline">info@xcplllp.com</a>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                <a href="tel:+918010115618" className="hover:underline">+91 80101 15618</a>
              </li>
              <li className="text-[10px] text-slate-400 leading-relaxed pt-1.5 font-normal">
                1908 Iconic Corenthum,<br />
                Sector 62, Noida,<br />
                Uttar Pradesh - 201309
              </li>
              <li className="text-[10px] text-slate-400 uppercase font-bold tracking-wider pt-2">Security: AES-256 / SHA-256</li>
            </ul>
          </div>

        </div>

        {/* Clean, centered copyright bar on dark background matching user screenshot */}
        <div className="bg-[#0d1b3e] py-7 border-t border-blue-900/40 flex items-center justify-center text-center text-xs sm:text-sm text-slate-200 font-medium">
          <div className="max-w-7xl mx-auto px-6 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 font-sans">
            <span>© {new Date().getFullYear()} CrediiFlow Platform. All Rights Reserved.</span>
            <span className="text-slate-700 hidden sm:inline">|</span>
            <div className="flex items-center gap-2">
              <span>Developed and managed by</span>
              <a href="https://xcplllp.com" target="_blank" rel="noopener noreferrer" className="inline-flex items-center hover:opacity-80 transition-opacity">
                <img
                  src="/logo-xc.png"
                  alt="Xenelasia Group Logo"
                  className="h-5.5 w-auto object-contain align-middle"
                />
              </a>
            </div>
          </div>
        </div>
      </footer>

      {/* ── CONFIGURE 3-DAY DEMO MODAL ── */}
      <AnimatePresence>
        {isDemoModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs select-none">
            {/* Modal Backdrop click to close */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={isDemoBuilding ? undefined : resetDemoModal}
              className="absolute inset-0 cursor-default"
            />

            {/* Modal Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="bg-white rounded-[2rem] border border-slate-100 shadow-2xl max-w-2xl w-full p-8 relative overflow-hidden z-10 text-left"
            >
              {/* Sparkle background details */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-200/10 rounded-full blur-2xl pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-200/10 rounded-full blur-2xl pointer-events-none" />

              {/* Close Button */}
              {!isDemoBuilding && (
                <button
                  type="button"
                  onClick={resetDemoModal}
                  className="absolute top-6 right-6 p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              )}

              {/* Loading State */}
              {isDemoBuilding && (
                <div className="py-16 flex flex-col items-center justify-center text-center space-y-6">
                  <div className="relative flex items-center justify-center">
                    <div className="w-16 h-16 rounded-full border-4 border-cyan-150 border-t-cyan-500 animate-spin" />
                    <Sparkles className="w-6 h-6 text-cyan-500 absolute animate-pulse" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-bold text-slate-800 font-display uppercase tracking-wider">
                      {demoBuildStep === 0 && "Allocating Database Schema..."}
                      {demoBuildStep === 1 && "Creating Secure Master Tenant Tables..."}
                      {demoBuildStep === 2 && "Initializing Admin Profile..."}
                    </h3>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto font-sans leading-relaxed">
                      Deploying isolated postgres structures, setting up custom API routers, and initializing secure sub-domain workspace directories.
                    </p>
                  </div>
                </div>
              )}

              {/* Success State */}
              {!isDemoBuilding && demoBuildSuccess && (
                <div className="py-8 flex flex-col items-center justify-center text-center space-y-6">
                  <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-500">
                    <Check className="w-8 h-8 font-black" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-2xl font-bold text-slate-800 font-display">Demo Instance Built!</h3>
                    <p className="text-sm text-slate-500 max-w-md mx-auto font-sans leading-relaxed">
                      Your 3-day trial workspace for <span className="font-bold text-slate-800">{demoCompanyName}</span> has been deployed. You can now access your sandbox dashboard.
                    </p>
                  </div>

                  <div className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 font-mono text-center relative overflow-hidden group">
                    <span className="text-xs text-slate-400 block mb-1 uppercase font-bold tracking-wider font-sans">WORKSPACE LINK</span>
                    <a
                      href={`https://${demoSubdomain}.crediiflow.in`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cyan-600 hover:text-cyan-700 font-bold text-sm sm:text-base break-all flex items-center justify-center gap-1 hover:underline"
                    >
                      <span>https://{demoSubdomain}.crediiflow.in</span>
                      <ArrowUpRight className="w-4 h-4" />
                    </a>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-3 w-full pt-4">
                    <a
                      href={`https://${demoSubdomain}.crediiflow.in`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-3.5 bg-gradient-to-r from-blue-700 via-blue-600 to-cyan-600 hover:from-blue-800 hover:to-cyan-700 text-white font-bold rounded-xl text-xs uppercase tracking-widest active:scale-[0.98] transition-all cursor-pointer shadow-md text-center"
                    >
                      Enter Dashboard &rarr;
                    </a>
                    <button
                      type="button"
                      onClick={resetDemoModal}
                      className="w-full sm:w-auto px-6 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs uppercase tracking-widest active:scale-[0.98] transition-all cursor-pointer text-center"
                    >
                      Close Window
                    </button>
                  </div>
                </div>
              )}

              {/* Form Input State */}
              {!isDemoBuilding && !demoBuildSuccess && (
                <form onSubmit={handleBuildDemoSubmit} className="space-y-6">
                  {/* Modal Header */}
                  <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
                    <div className="w-10 h-10 rounded-xl bg-cyan-50 border border-cyan-100 flex items-center justify-center text-cyan-500 shrink-0">
                      <Sparkles className="w-5 h-5 animate-pulse" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-slate-800 tracking-wider font-display uppercase">Configure 3-Day Demo</h2>
                      <p className="text-[10px] text-slate-400 font-semibold tracking-wider font-sans uppercase">Create your sandboxed multi-tenant workspace</p>
                    </div>
                  </div>

                  {/* Form Inputs Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 font-sans">
                    {/* Company Name */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Business / Company Name</label>
                      <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus-within:border-cyan-500 focus-within:ring-4 focus-within:ring-cyan-500/10 focus-within:bg-white transition-all">
                        <Briefcase className="w-4 h-4 text-slate-400 shrink-0" />
                        <input
                          type="text"
                          required
                          placeholder="e.g. Apex Grocers"
                          value={demoCompanyName}
                          onChange={(e) => handleCompanyNameChange(e.target.value)}
                          className="bg-transparent text-sm font-semibold text-slate-800 focus:outline-none placeholder-slate-400 w-full"
                        />
                      </div>
                    </div>

                    {/* Subdomain Prefix */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Subdomain Prefix</label>
                      <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus-within:border-cyan-500 focus-within:ring-4 focus-within:ring-cyan-500/10 focus-within:bg-white transition-all min-w-0">
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <Building className="w-4 h-4 text-slate-400 shrink-0" />
                          <input
                            type="text"
                            required
                            placeholder="subdomain"
                            value={demoSubdomain}
                            onChange={(e) => setDemoSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                            className="bg-transparent text-sm font-semibold text-slate-800 focus:outline-none placeholder-slate-400 w-full"
                          />
                        </div>
                        <span className="text-xs font-bold text-cyan-600 shrink-0 select-none">.crediiflow.in</span>
                      </div>
                    </div>

                    {/* Admin Full Name */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Admin Full Name</label>
                      <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus-within:border-cyan-500 focus-within:ring-4 focus-within:ring-cyan-500/10 focus-within:bg-white transition-all">
                        <Users className="w-4 h-4 text-slate-400 shrink-0" />
                        <input
                          type="text"
                          required
                          placeholder="e.g. Sanjay Kumar"
                          value={demoAdminName}
                          onChange={(e) => setDemoAdminName(e.target.value)}
                          className="bg-transparent text-sm font-semibold text-slate-800 focus:outline-none placeholder-slate-400 w-full"
                        />
                      </div>
                    </div>

                    {/* Professional Email */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Professional Email</label>
                      <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus-within:border-cyan-500 focus-within:ring-4 focus-within:ring-cyan-500/10 focus-within:bg-white transition-all">
                        <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                        <input
                          type="email"
                          required
                          placeholder="e.g. sanjay@apex.com"
                          value={demoEmailAddress}
                          onChange={(e) => setDemoEmailAddress(e.target.value)}
                          className="bg-transparent text-sm font-semibold text-slate-800 focus:outline-none placeholder-slate-400 w-full"
                        />
                      </div>
                    </div>

                    {/* Phone Number */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Phone Number</label>
                      <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus-within:border-cyan-500 focus-within:ring-4 focus-within:ring-cyan-500/10 focus-within:bg-white transition-all">
                        <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                        <input
                          type="tel"
                          required
                          placeholder="e.g. +91 99999-99999"
                          value={demoPhoneNumber}
                          onChange={(e) => setDemoPhoneNumber(e.target.value)}
                          className="bg-transparent text-sm font-semibold text-slate-800 focus:outline-none placeholder-slate-400 w-full"
                        />
                      </div>
                    </div>

                    {/* Demo Package Level */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Demo Package Level</label>
                      <div className="relative flex items-center bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus-within:border-cyan-500 focus-within:ring-4 focus-within:ring-cyan-500/10 focus-within:bg-white transition-all">
                        <HardDrive className="w-4 h-4 text-slate-400 shrink-0 mr-2.5" />
                        <select
                          value={demoPackagePlan}
                          onChange={(e) => setDemoPackagePlan(e.target.value)}
                          className="w-full bg-transparent text-sm font-semibold text-slate-800 focus:outline-none cursor-pointer pr-8"
                        >
                          <option value="Professional Plan (Trial)">Professional Plan (Trial)</option>
                          <option value="Enterprise Plan (Trial)">Enterprise Plan (Trial)</option>
                          <option value="Starter Plan (Trial)">Starter Plan (Trial)</option>
                        </select>
                        <ChevronDown className="w-4 h-4 text-slate-400 absolute right-4 pointer-events-none" />
                      </div>
                    </div>
                  </div>

                  {/* Modal Footer */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-100">
                    <span className="text-xs text-slate-500 flex items-center gap-1 font-semibold">
                      💡 No credit card required. Free for 3 days.
                    </span>
                    <button
                      type="submit"
                      className="w-full sm:w-auto px-7 py-3.5 bg-gradient-to-r from-blue-700 via-blue-600 to-cyan-600 hover:from-blue-800 hover:via-blue-700 hover:to-cyan-700 text-white font-bold rounded-xl text-xs uppercase tracking-widest active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-cyan-500/5 font-display"
                    >
                      <span>Build Demo Instance</span>
                      <Sparkles className="w-4 h-4" />
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
