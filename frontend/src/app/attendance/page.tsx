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
  const { currentUser, attendance, checkIn, checkOut } = useAppStore();

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
          let errMsg = "Location access denied. Location is strictly required to proceed.";
          if (err.code === err.POSITION_UNAVAILABLE) {
            errMsg = "GPS signal lost or unavailable.";
          } else if (err.code === err.TIMEOUT) {
            errMsg = "Location fetch timed out. Please retry.";
          }
          setLocationError(errMsg);
          setGpsCoords(null);
          setIsLocating(false);
          reject(new Error(errMsg));
        },
        { enableHighAccuracy: true, timeout: 15000 }
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
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#020617] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-100 via-slate-50 to-slate-100 dark:from-slate-900 dark:via-slate-950 dark:to-black">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-800/80">
        <div className="w-full max-w-md mx-auto px-4 h-16 flex items-center justify-between">
          <button 
            onClick={() => router.push("/staff")}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors active:scale-95"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-slate-100">
            Duty Status
          </h1>
          <div className="w-10 h-10"></div>
        </div>
      </div>

      <div className="w-full max-w-md mx-auto px-4 py-8">
        <div className="bg-slate-900 rounded-[2.5rem] p-6 shadow-2xl relative overflow-hidden text-left border border-slate-700/50">
          <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none -mr-10 -mt-10"></div>

          <div className="relative z-10">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white/10 rounded-xl backdrop-blur-md shadow-inner border border-white/5">
                  <Clock className="w-4 h-4 text-blue-300" />
                </div>
                <h2 className="text-[10px] font-black uppercase tracking-wider text-white/80">
                  Duty Status (Attendance)
                </h2>
              </div>
              <span className={`text-[9px] uppercase tracking-wide font-black px-3 py-1.5 rounded-full backdrop-blur-md border ${attendance.isCheckedIn
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                  : "bg-white/10 text-slate-300 border-white/20"
                }`}>
                {attendance.isCheckedIn ? "Checked In" : "Checked Out"}
              </span>
            </div>

            {/* Attendance form below */}
            {attendance.isCheckedIn ? (
              <form onSubmit={handleCheckOutSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3 bg-black/40 p-4 rounded-2xl border border-white/5 backdrop-blur-md">
                  <div>
                    <span className="text-[8px] text-slate-400 font-bold uppercase tracking-widest block mb-1">Started At</span>
                    <span className="font-black text-lg text-white tracking-tight">{attendance.startKm} <span className="text-[10px] text-slate-500">KM</span></span>
                  </div>
                  <div className="text-right">
                    <span className="text-[8px] text-slate-400 font-bold uppercase tracking-widest block mb-1">Check-in Time</span>
                    <span className="font-black text-sm text-white">{attendance.checkInTime}</span>
                  </div>
                </div>

                {kmError && (
                  <p className="text-[10px] text-red-200 bg-red-950/80 px-4 py-2 rounded-xl border border-red-500/30 text-center font-bold">
                    {kmError}
                  </p>
                )}

                <div className="flex flex-col gap-3">
                  <input
                    type="number"
                    placeholder="Enter Ending KM"
                    value={endKmInput}
                    onChange={(e) => setEndKmInput(e.target.value)}
                    className="w-full px-4 py-3.5 bg-black/30 border border-white/10 focus:border-blue-500/50 rounded-xl focus:outline-none text-sm text-white font-bold placeholder-slate-600 transition-colors shadow-inner"
                    required
                  />

                  {/* Upload image capture element */}
                  {!uploadedImageBase64 ? (
                    <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-700/80 hover:border-blue-500/50 bg-black/20 hover:bg-black/30 p-5 rounded-2xl cursor-pointer transition-all duration-300 group">
                      <Camera className="w-8 h-8 text-slate-400 group-hover:text-blue-400 mb-2 transition-colors" />
                      <span className="text-[10px] font-black tracking-widest text-slate-400 group-hover:text-blue-300 uppercase select-none">Capture Ending Odometer</span>
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
                    <div className="relative rounded-2xl overflow-hidden border border-slate-700/50 group">
                      <img src={uploadedImageBase64} alt="Meter Preview" className="w-full h-36 object-cover" />
                      <button
                        type="button"
                        onClick={() => setUploadedImageBase64(null)}
                        className="absolute top-2 right-2 bg-red-600/90 hover:bg-red-500 text-white p-1.5 rounded-lg shadow-lg text-[9px] font-black uppercase tracking-wider px-3 backdrop-blur-md border border-red-500/20 active:scale-95 transition-transform"
                      >
                        Retake
                      </button>
                      <div className="absolute bottom-2 left-2 bg-black/70 backdrop-blur-sm px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-wider text-slate-300 border border-white/5">
                        ✓ Watermark Overlay Succeeded
                      </div>
                    </div>
                  )}

                  {/* Geolocation status and strict warning warnings */}
                  {isLocating && (
                    <div className="flex items-center justify-center gap-2 p-3 bg-blue-950/40 border border-blue-900/40 text-[9px] font-black uppercase tracking-wider text-blue-400 rounded-2xl animate-pulse">
                      <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-ping"></span>
                      <span>Fetching High Accuracy live GPS...</span>
                    </div>
                  )}

                  {locationError && (
                    <div className="p-3 bg-red-950/40 border border-red-900/40 rounded-2xl text-center">
                      <p className="text-[9px] text-red-400 font-black uppercase tracking-wider mb-2 flex items-center justify-center gap-1.5">
                        <span>⚠️ GPS Locked:</span> {locationError}
                      </p>
                      <button
                        type="button"
                        onClick={fetchLiveGPS}
                        className="text-[9px] font-black uppercase text-blue-400 hover:text-blue-300 tracking-wider bg-blue-950/20 border border-blue-900/30 px-3.5 py-1.5 rounded-xl transition-all active:scale-95"
                      >
                        Retry Fetching Location
                      </button>
                    </div>
                  )}

                  {gpsCoords && (
                    <div className="flex items-center gap-2 p-3 bg-emerald-950/20 border border-emerald-900/30 text-[9px] font-black uppercase tracking-wider text-emerald-400 rounded-2xl">
                      <MapPin className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                      <span className="leading-tight">
                        GPS Logged: {gpsCoords.latitude.toFixed(6)}, {gpsCoords.longitude.toFixed(6)} (±{gpsCoords.accuracy.toFixed(1)}m)
                      </span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isSubmitDisabled}
                    className={`w-full py-3.5 text-white rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all active:scale-[0.98] shadow-lg border border-white/10 ${
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
              <form onSubmit={handleCheckInSubmit} className="space-y-4">
                <p className="text-[11px] text-slate-400 leading-relaxed font-bold mb-2 opacity-70">
                  Enter starting odometer KM, snap meter photo, and allow GPS access.
                </p>
                <div className="flex flex-col gap-3">
                  <input
                    type="number"
                    placeholder="Current Odometer KM"
                    value={startKmInput}
                    onChange={(e) => setStartKmInput(e.target.value)}
                    className="w-full px-4 py-3.5 bg-black/30 border border-white/10 focus:border-blue-500/50 rounded-xl focus:outline-none text-sm text-white font-bold placeholder-slate-600 transition-colors shadow-inner"
                    required
                  />

                  {/* Upload image capture element */}
                  {!uploadedImageBase64 ? (
                    <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-700/80 hover:border-blue-500/50 bg-black/20 hover:bg-black/30 p-5 rounded-2xl cursor-pointer transition-all duration-300 group">
                      <Camera className="w-8 h-8 text-slate-400 group-hover:text-blue-400 mb-2 transition-colors" />
                      <span className="text-[10px] font-black tracking-widest text-slate-400 group-hover:text-blue-300 uppercase select-none">Capture Starting Odometer</span>
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
                    <div className="relative rounded-2xl overflow-hidden border border-slate-700/50 group">
                      <img src={uploadedImageBase64} alt="Meter Preview" className="w-full h-36 object-cover" />
                      <button
                        type="button"
                        onClick={() => setUploadedImageBase64(null)}
                        className="absolute top-2 right-2 bg-red-600/90 hover:bg-red-500 text-white p-1.5 rounded-lg shadow-lg text-[9px] font-black uppercase tracking-wider px-3 backdrop-blur-md border border-red-500/20 active:scale-95 transition-transform"
                      >
                        Retake
                      </button>
                      <div className="absolute bottom-2 left-2 bg-black/70 backdrop-blur-sm px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-wider text-slate-300 border border-white/5">
                        ✓ Watermark Overlay Succeeded
                      </div>
                    </div>
                  )}

                  {/* Geolocation status and warnings */}
                  {isLocating && (
                    <div className="flex items-center justify-center gap-2 p-3 bg-blue-950/40 border border-blue-900/40 text-[9px] font-black uppercase tracking-wider text-blue-400 rounded-2xl animate-pulse">
                      <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-ping"></span>
                      <span>Fetching High Accuracy live GPS...</span>
                    </div>
                  )}

                  {locationError && (
                    <div className="p-3 bg-red-950/40 border border-red-900/40 rounded-2xl text-center">
                      <p className="text-[9px] text-red-400 font-black uppercase tracking-wider mb-2 flex items-center justify-center gap-1.5">
                        <span>⚠️ GPS Locked:</span> {locationError}
                      </p>
                      <button
                        type="button"
                        onClick={fetchLiveGPS}
                        className="text-[9px] font-black uppercase text-blue-400 hover:text-blue-300 tracking-wider bg-blue-950/20 border border-blue-900/30 px-3.5 py-1.5 rounded-xl transition-all active:scale-95"
                      >
                        Retry Fetching Location
                      </button>
                    </div>
                  )}

                  {gpsCoords && (
                    <div className="flex items-center gap-2 p-3 bg-emerald-950/20 border border-emerald-900/30 text-[9px] font-black uppercase tracking-wider text-emerald-400 rounded-2xl">
                      <MapPin className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                      <span className="leading-tight">
                        GPS Logged: {gpsCoords.latitude.toFixed(6)}, {gpsCoords.longitude.toFixed(6)} (±{gpsCoords.accuracy.toFixed(1)}m)
                      </span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isSubmitDisabled}
                    className={`w-full py-3.5 text-white rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all active:scale-[0.98] shadow-lg border border-white/10 ${
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
