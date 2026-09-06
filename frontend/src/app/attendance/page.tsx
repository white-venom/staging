"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "../utils/store";
import { api } from "../utils/api";
import {
  Clock,
  Camera,
  MapPin,
  ArrowLeft
} from "lucide-react";

export default function AttendancePage() {
  const router = useRouter();
  const { currentUser, attendance, checkIn, checkOut, restoreAttendance } = useAppStore();

  const [startKmInput, setStartKmInput] = useState("");
  const [endKmInput, setEndKmInput] = useState("");
  const [kmError, setKmError] = useState("");

  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [gpsCoords, setGpsCoords] = useState<{ latitude: number; longitude: number; accuracy: number } | null>(null);
  const [uploadedImageBase64, setUploadedImageBase64] = useState<string | null>(null);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Synchronize attendance status with backend on mount
  useEffect(() => {
    if (!mounted || !currentUser) return;
    const syncStatus = async () => {
      try {
        const status = await api.getMyAttendanceStatus();
        if (status && status.status === "active") {
          restoreAttendance({
            isCheckedIn: true,
            startKm: status.start_km,
            checkInTime: status.start_time.replace("T", " ").substring(0, 16),
          });
        }
      } catch (err: any) {
        if (err?.message === "No active shift found." || err?.message?.includes("not found")) {
          restoreAttendance({
            isCheckedIn: false,
            startKm: 0,
          });
        }
      }
    };
    syncStatus();
  }, [mounted, currentUser, restoreAttendance]);

  useEffect(() => {
    if (!mounted) return;
    if (!currentUser) {
      router.push("/");
      return;
    }
    if (typeof window !== "undefined" && navigator.geolocation) {
      setIsLocating(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setGpsCoords({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          });
          setLocationError("");
          setIsLocating(false);
        },
        (err) => {
          let errMsg = "Location access denied. GPS tracking is strictly required for shifts.";
          if (err.code === err.POSITION_UNAVAILABLE) {
            errMsg = "GPS location information is unavailable.";
          } else if (err.code === err.TIMEOUT) {
            errMsg = "Location request timed out. Please try again.";
          }
          setLocationError(errMsg);
          setIsLocating(false);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      setLocationError("Geolocation is not supported by this browser.");
    }
  }, [mounted, currentUser, router]);

  if (!mounted || !currentUser) return null;

  const fetchLiveGPS = (): Promise<{ latitude: number; longitude: number; accuracy: number }> => {
    return new Promise((resolve, reject) => {
      // If we already have accurate GPS cached from page load, use it as fallback
      if (gpsCoords && gpsCoords.latitude && gpsCoords.longitude) {
        setIsLocating(false);
        resolve(gpsCoords);
        return;
      }

      if (typeof window === "undefined" || !navigator.geolocation) {
        const err = new Error("Geolocation is not supported by your browser.");
        setLocationError(err.message);
        reject(err);
        return;
      }

      setIsLocating(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          };
          setGpsCoords(coords);
          setLocationError("");
          setIsLocating(false);
          resolve(coords);
        },
        (err) => {
          // Secondary fallback: attempt low accuracy (cell tower / wifi triangulation)
          navigator.geolocation.getCurrentPosition(
            (fallbackPos) => {
              const fallbackCoords = {
                latitude: fallbackPos.coords.latitude,
                longitude: fallbackPos.coords.longitude,
                accuracy: fallbackPos.coords.accuracy,
              };
              setGpsCoords(fallbackCoords);
              setLocationError("");
              setIsLocating(false);
              resolve(fallbackCoords);
            },
            () => {
              let errMsg = "Location access denied. Please enable device GPS permissions to proceed.";
              if (err.code === err.POSITION_UNAVAILABLE) {
                errMsg = "GPS signal weak or unavailable indoors. Please step near a window or retry.";
              } else if (err.code === err.TIMEOUT) {
                errMsg = "Location fetch timed out. Please tap retry or check GPS.";
              }
              setLocationError(errMsg);
              setIsLocating(false);
              reject(new Error(errMsg));
            },
            { enableHighAccuracy: false, timeout: 8000 }
          );
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  };

  const processImageWithLocation = async (file: File) => {
    try {
      const coords = await fetchLiveGPS();
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const maxDim = 1200;
          let width = img.width;
          let height = img.height;
          
          if (width > height) {
            if (width > maxDim) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            }
          } else {
            if (height > maxDim) {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            alert("Canvas 2D context not available");
            return;
          }
          
          ctx.drawImage(img, 0, 0, width, height);
          
          const barHeight = Math.max(70, Math.round(height * 0.08));
          ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
          ctx.fillRect(0, height - barHeight, width, barHeight);
          
          ctx.fillStyle = "#10b981";
          const dotRadius = Math.max(6, Math.round(barHeight * 0.08));
          ctx.beginPath();
          ctx.arc(30, height - barHeight / 2, dotRadius, 0, 2 * Math.PI);
          ctx.fill();
          
          const fontSize = Math.max(12, Math.round(barHeight * 0.22));
          ctx.font = `bold ${fontSize}px sans-serif`;
          ctx.fillStyle = "#ffffff";
          ctx.textAlign = "left";
          ctx.textBaseline = "middle";
          
          const gpsText = `GPS: ${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)} (±${coords.accuracy.toFixed(1)}m)`;
          const textX = 30 + dotRadius * 2;
          ctx.fillText(gpsText, textX, height - barHeight * 0.65);
          
          const istTimeStr = new Date().toLocaleString("en-IN", {
            timeZone: "Asia/Kolkata",
            dateStyle: "medium",
            timeStyle: "medium",
            hour12: false,
          });
          const timeText = `IST: ${istTimeStr} IST`;
          ctx.fillStyle = "#94a3b8";
          ctx.font = `${fontSize - 2}px sans-serif`;
          ctx.fillText(timeText, textX, height - barHeight * 0.35);
          
          ctx.textAlign = "right";
          ctx.fillStyle = "#60a5fa";
          ctx.font = `bold ${fontSize - 1}px sans-serif`;
          ctx.fillText("CREDIITFLOW", width - 30, height - barHeight / 2);
          
          const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
          setUploadedImageBase64(dataUrl);
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      alert("Verification Failed: " + err.message);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageWithLocation(file);
    }
  };

  const handleCheckInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadedImageBase64 || !gpsCoords) {
      alert("Odometer image and live GPS location are strictly required!");
      return;
    }
    const km = parseInt(startKmInput);
    if (!isNaN(km) && km > 0) {
      try {
        await api.checkIn(km, uploadedImageBase64, gpsCoords.latitude, gpsCoords.longitude);
        checkIn(km);
        router.push("/staff");
      } catch (err: any) {
        alert("Failed to check-in: " + err.message);
      }
    }
  };

  const handleCheckOutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setKmError("");
    if (!uploadedImageBase64 || !gpsCoords) {
      alert("Odometer image and live GPS location are strictly required!");
      return;
    }
    const end = parseInt(endKmInput);
    if (isNaN(end)) return;

    if (end <= attendance.startKm) {
      setKmError(`Ending KM must be greater than starting KM (${attendance.startKm}).`);
      return;
    }

    try {
      await api.checkOut(end, uploadedImageBase64, gpsCoords.latitude, gpsCoords.longitude);
      checkOut(end);
      router.push("/staff");
    } catch (err: any) {
      alert("Failed to check-out: " + err.message);
    }
  };

  const isSubmitDisabled = !uploadedImageBase64 || isLocating || !!locationError || !gpsCoords;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-white/70 dark:bg-slate-900/70 border-b border-slate-200/50 dark:border-slate-800/80">
        <div className="w-full max-w-md mx-auto px-2 h-12 flex items-center justify-between">
          <button 
            onClick={() => router.push("/staff")}
            className="w-8 h-8 flex items-center justify-center rounded-sm bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 transition-colors border border-slate-200/40 dark:border-slate-700/50"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-xs font-black uppercase tracking-widest text-slate-800 dark:text-slate-100">
            Duty Status
          </h1>
          <div className="w-8 h-8"></div>
        </div>
      </div>

      <div className="w-full max-w-md mx-auto px-2 py-4">
        <div className="bg-slate-900 rounded-sm p-3 relative text-left border border-slate-700/50">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-white/10 rounded-sm border border-white/5">
                  <Clock className="w-3.5 h-3.5 text-blue-300" />
                </div>
                <h2 className="text-[9px] font-black uppercase tracking-wider text-white/80">
                  Duty Status (Attendance)
                </h2>
              </div>
              <span className={`text-[8px] uppercase tracking-wide font-black px-2 py-1 rounded-sm border ${attendance.isCheckedIn
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                  : "bg-white/10 text-slate-300 border-white/20"
                }`}>
                {attendance.isCheckedIn ? "Checked In" : "Checked Out"}
              </span>
            </div>

            {/* Attendance form below */}
            {attendance.isCheckedIn ? (
              <form onSubmit={handleCheckOutSubmit} className="space-y-3">
                <div className="grid grid-cols-2 gap-2 bg-black/40 p-2.5 rounded-sm border border-white/5">
                  <div>
                    <span className="text-[7.5px] text-slate-400 font-bold uppercase tracking-widest block mb-0.5">Started At</span>
                    <span className="font-black text-sm text-white tracking-tight">{attendance.startKm} <span className="text-[9px] text-slate-500">KM</span></span>
                  </div>
                  <div className="text-right">
                    <span className="text-[7.5px] text-slate-400 font-bold uppercase tracking-widest block mb-0.5">Check-in Time</span>
                    <span className="font-black text-xs text-white">{attendance.checkInTime}</span>
                  </div>
                </div>

                {kmError && (
                  <p className="text-[9px] text-red-200 bg-red-950/80 px-3 py-1.5 rounded-sm border border-red-500/30 text-center font-bold">
                    {kmError}
                  </p>
                )}

                <div className="flex flex-col gap-2.5">
                  <input autoComplete="one-time-code"
                    type="number"
                    inputMode="numeric"
                    placeholder="Enter Ending KM"
                    value={endKmInput}
                    onChange={(e) => setEndKmInput(e.target.value)}
                    className="w-full px-3 py-2 bg-black/30 border border-white/10 focus:border-blue-500/50 rounded-sm focus:outline-none text-xs text-white font-bold placeholder-slate-600 transition-colors"
                    required
                  />

                  {/* Upload image capture element */}
                  {!uploadedImageBase64 ? (
                    <label className="flex flex-col items-center justify-center border border-dashed border-slate-700/80 hover:border-blue-500/50 bg-black/20 hover:bg-black/30 p-4 rounded-sm cursor-pointer transition-colors group">
                      <Camera className="w-6 h-6 text-slate-400 group-hover:text-blue-400 mb-1.5 transition-colors" />
                      <span className="text-[9px] font-black tracking-widest text-slate-400 group-hover:text-blue-300 uppercase select-none">Capture Ending Odometer</span>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handleFileChange}
                        className="hidden"
                        required
                      />
                    </label>
                  ) : (
                    <div className="relative rounded-sm overflow-hidden border border-slate-700/50 group">
                      <img src={uploadedImageBase64} alt="Meter Preview" className="w-full h-28 object-cover" />
                      <button
                        type="button"
                        onClick={() => setUploadedImageBase64(null)}
                        className="absolute top-1 right-1 bg-red-600/90 hover:bg-red-500 text-white p-1 rounded text-[8px] font-black uppercase tracking-wider px-2 border border-red-500/20 "
                      >
                        Retake
                      </button>
                      <div className="absolute bottom-1 left-1 bg-black/70 px-2 py-0.5 rounded text-[7.5px] font-black uppercase tracking-wider text-slate-300 border border-white/5 flex items-center gap-1">
                        <svg className="w-2.5 h-2.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                        <span>Watermark Overlay Succeeded</span>
                      </div>
                    </div>
                  )}

                  {/* Geolocation status and strict warning warnings */}
                  {isLocating && (
                    <div className="flex items-center justify-center gap-1.5 p-2 bg-blue-950/40 border border-blue-900/40 text-[8px] font-black uppercase tracking-wider text-blue-400 rounded-sm">
                      <span className="w-1 h-1 bg-blue-400 rounded-full animate-ping"></span>
                      <span>Fetching High Accuracy live GPS...</span>
                    </div>
                  )}

                  {locationError && (
                    <div className="p-2 bg-red-950/40 border border-red-900/40 rounded-sm text-center">
                      <p className="text-[8px] text-red-400 font-black uppercase tracking-wider mb-1.5 flex items-center justify-center gap-1">
                        <span className="flex items-center gap-0.5 justify-center"><svg className="w-3 h-3 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg><span>GPS Locked:</span></span> {locationError}
                      </p>
                      <button
                        type="button"
                        onClick={fetchLiveGPS}
                        className="text-[8px] font-black uppercase text-blue-400 hover:text-blue-300 tracking-wider bg-blue-950/20 border border-blue-900/30 px-2.5 py-1 rounded-md transition-colors"
                      >
                        Retry Fetching Location
                      </button>
                    </div>
                  )}

                  {gpsCoords && (
                    <div className="flex items-center gap-1.5 p-2 bg-emerald-950/20 border border-emerald-900/30 text-[8px] font-black uppercase tracking-wider text-emerald-400 rounded-sm">
                      <MapPin className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                      <span className="leading-tight">
                        GPS Logged: {gpsCoords.latitude.toFixed(6)}, {gpsCoords.longitude.toFixed(6)} (±{gpsCoords.accuracy.toFixed(1)}m)
                      </span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isSubmitDisabled}
                    className={`w-full py-2.5 text-white rounded-sm text-[9px] font-black uppercase tracking-[0.2em] transition-colors border border-white/10 ${
                      isSubmitDisabled
                        ? "bg-slate-800 text-slate-500 border-slate-700/40 cursor-not-allowed opacity-50"
                        : "bg-blue-600 hover:bg-blue-500"
                    }`}
                  >
                    {isSubmitDisabled ? "Verify Image & GPS to Check Out" : "End Shift & Log Out"}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleCheckInSubmit} className="space-y-3">
                <p className="text-[10px] text-slate-400 leading-relaxed font-bold mb-1.5 opacity-70">
                  Enter starting odometer KM, snap meter photo, and allow GPS access.
                </p>
                <div className="flex flex-col gap-2.5">
                  <input autoComplete="one-time-code"
                    type="number"
                    inputMode="numeric"
                    placeholder="Current Odometer KM"
                    value={startKmInput}
                    onChange={(e) => setStartKmInput(e.target.value)}
                    className="w-full px-3 py-2 bg-black/30 border border-white/10 focus:border-blue-500/50 rounded-sm focus:outline-none text-xs text-white font-bold placeholder-slate-600 transition-colors"
                    required
                  />

                  {/* Upload image capture element */}
                  {!uploadedImageBase64 ? (
                    <label className="flex flex-col items-center justify-center border border-dashed border-slate-700/80 hover:border-blue-500/50 bg-black/20 hover:bg-black/30 p-4 rounded-sm cursor-pointer transition-colors group">
                      <Camera className="w-6 h-6 text-slate-400 group-hover:text-blue-400 mb-1.5 transition-colors" />
                      <span className="text-[9px] font-black tracking-widest text-slate-400 group-hover:text-blue-300 uppercase select-none">Capture Starting Odometer</span>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handleFileChange}
                        className="hidden"
                        required
                      />
                    </label>
                  ) : (
                    <div className="relative rounded-sm overflow-hidden border border-slate-700/50 group">
                      <img src={uploadedImageBase64} alt="Meter Preview" className="w-full h-28 object-cover" />
                      <button
                        type="button"
                        onClick={() => setUploadedImageBase64(null)}
                        className="absolute top-1 right-1 bg-red-600/90 hover:bg-red-500 text-white p-1 rounded text-[8px] font-black uppercase tracking-wider px-2 border border-red-500/20 "
                      >
                        Retake
                      </button>
                      <div className="absolute bottom-1 left-1 bg-black/70 px-2 py-0.5 rounded text-[7.5px] font-black uppercase tracking-wider text-slate-300 border border-white/5 flex items-center gap-1">
                        <svg className="w-2.5 h-2.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                        <span>Watermark Overlay Succeeded</span>
                      </div>
                    </div>
                  )}

                  {/* Geolocation status and warnings */}
                  {isLocating && (
                    <div className="flex items-center justify-center gap-1.5 p-2 bg-blue-950/40 border border-blue-900/40 text-[8px] font-black uppercase tracking-wider text-blue-400 rounded-sm">
                      <span className="w-1 h-1 bg-blue-400 rounded-full animate-ping"></span>
                      <span>Fetching High Accuracy live GPS...</span>
                    </div>
                  )}

                  {locationError && (
                    <div className="p-2 bg-red-950/40 border border-red-900/40 rounded-sm text-center">
                      <p className="text-[8px] text-red-400 font-black uppercase tracking-wider mb-1.5 flex items-center justify-center gap-1">
                        <span className="flex items-center gap-0.5 justify-center"><svg className="w-3 h-3 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg><span>GPS Locked:</span></span> {locationError}
                      </p>
                      <button
                        type="button"
                        onClick={fetchLiveGPS}
                        className="text-[8px] font-black uppercase text-blue-400 hover:text-blue-300 tracking-wider bg-blue-950/20 border border-blue-900/30 px-2.5 py-1 rounded-md transition-colors"
                      >
                        Retry Fetching Location
                      </button>
                    </div>
                  )}

                  {gpsCoords && (
                    <div className="flex items-center gap-1.5 p-2 bg-emerald-950/20 border border-emerald-900/30 text-[8px] font-black uppercase tracking-wider text-emerald-400 rounded-sm">
                      <MapPin className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                      <span className="leading-tight">
                        GPS Logged: {gpsCoords.latitude.toFixed(6)}, {gpsCoords.longitude.toFixed(6)} (±{gpsCoords.accuracy.toFixed(1)}m)
                      </span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isSubmitDisabled}
                    className={`w-full py-2.5 text-white rounded-sm text-[9px] font-black uppercase tracking-[0.2em] transition-colors border border-white/10 ${
                      isSubmitDisabled
                        ? "bg-slate-800 text-slate-500 border-slate-700/40 cursor-not-allowed opacity-50"
                        : "bg-blue-600 hover:bg-blue-500"
                    }`}
                  >
                    {isSubmitDisabled ? "Verify Image & GPS to Check In" : "Start Shift"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
