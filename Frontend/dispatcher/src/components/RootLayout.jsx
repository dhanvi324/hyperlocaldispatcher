import React, { useState, useEffect } from "react";

import {
  Outlet,
  useLocation,
} from "react-router-dom";

import Header from "./Header";
import Footer from "./Footer";
import Sidebar from "./Sidebar";

import useAuthStore from "../store/authstore";
import useTrackingStore from "../store/trackingstore";
import API from "../api";
import { motion } from "framer-motion";
import { ShieldAlert, Clock } from "lucide-react";

const RootLayout = () => {

  const user =
    useAuthStore((state) => state.user);

  const checkAuth = useAuthStore((state) => state.checkAuth);

  const logout = useAuthStore((state) => state.logout);

  const startTracking = useTrackingStore((state) => state.startTracking);
  const stopTracking = useTrackingStore((state) => state.stopTracking);
  const isTracking = useTrackingStore((state) => state.isTracking);

  const location = useLocation();

  const [isBlocked, setIsBlocked] = useState(false);

  // Trigger checkAuth on mount
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Global Rider Live Geolocation Tracking Manager
  useEffect(() => {
    let isSubscribed = true;

    const checkActiveDelivery = async () => {
      // 1. If user is not logged in or is not a rider, ensure we are not tracking
      if (!user || user.role !== "rider") {
        if (isTracking) {
          console.log("[ROOT TRACKING MANAGER] User is not a rider. Stopping background tracking.");
          stopTracking();
        }
        return;
      }

      // 2. Fetch rider's orders to check if any are in 'outfordelivery' (Out for delivery) status
      try {
        console.log("[ROOT TRACKING MANAGER] Querying active dispatch tasks for rider location sync...");
        const res = await API.get("/api/rider/my-orders");
        if (!isSubscribed) return;

        const dispatchedOrder = res.data.find(order => ["outfordelivery", "dispatched"].includes(order.status?.toLowerCase()));

        if (dispatchedOrder) {
          console.log(`[ROOT TRACKING MANAGER] Dispatched order found: ${dispatchedOrder._id}. Resuming tracking.`);
          startTracking(dispatchedOrder._id);
        } else {
          console.log("[ROOT TRACKING MANAGER] No active dispatched orders found.");
          if (isTracking) {
            console.log("[ROOT TRACKING MANAGER] Live tracking active but no dispatched order found in DB. Stopping.");
            stopTracking();
          }
        }
      } catch (err) {
        console.error("[ROOT TRACKING MANAGER] Sync query failed:", err.message);
      }
    };

    // Run check on mount/updates
    checkActiveDelivery();

    // Poll every 15 seconds to ensure sync is maintained
    const interval = setInterval(checkActiveDelivery, 15000);

    return () => {
      isSubscribed = false;
      clearInterval(interval);
    };
  }, [user, isTracking, startTracking, stopTracking]);

  // Handle expired session event
  useEffect(() => {
    const handleAuthExpired = () => {
      stopTracking();
      logout();
    };
    window.addEventListener("auth-expired", handleAuthExpired);
    return () => {
      window.removeEventListener("auth-expired", handleAuthExpired);
    };
  }, [logout, stopTracking]);

  useEffect(() => {
    if (user && (user.isBlocked || user.isActive === false) && user.role === "rider") {
      setIsBlocked(true);
    } else {
      setIsBlocked(false);
    }
  }, [user]);

  useEffect(() => {
    const handleBlockedEvent = () => {
      setIsBlocked(true);
    };
    window.addEventListener("rider-blocked", handleBlockedEvent);
    return () => {
      window.removeEventListener("rider-blocked", handleBlockedEvent);
    };
  }, []);


  // AUTH PAGES
  const hideSidebarRoutes = [
    "/",
    "/login",
    "/register",
    "/create-shop",
    "/join-shop",
    "/pending-approval",
  ];


  const hideSidebar =
    hideSidebarRoutes.includes(
      location.pathname
    );


  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans text-slate-800 relative">
      {/* BLOCKED MODAL FOR RESTRICTED RIDERS */}
      {isBlocked && (
        <div className="fixed inset-0 z-[99999] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-6 select-none">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-slate-100 text-center space-y-6"
          >
            <div className="w-20 h-20 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto border border-rose-100 shadow-sm">
              <ShieldAlert className="w-10 h-10" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">Rider Account Blocked</h2>
              <p className="text-xs text-slate-400 leading-relaxed font-semibold">
                Your delivery access privileges have been temporarily restricted by administrators. Active tracking is disabled.
              </p>
            </div>
            <div className="bg-rose-50/50 p-4 rounded-2xl border border-rose-50 text-xs font-bold text-rose-700 flex items-center justify-center gap-1.5">
              <Clock className="w-4 h-4" /> Please contact operations team to resolve.
            </div>
            <button 
              onClick={() => {
                setIsBlocked(false);
                stopTracking();
                logout();
              }}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 rounded-2xl text-xs transition-all shadow-md"
            >
              Sign Out Account
            </button>
          </motion.div>
        </div>
      )}

      {/* HEADER TOP BAR */}
      <Header />

      {/* MAIN LAYOUT */}
      <div className="flex flex-1 relative">
        {/* SIDEBAR NAVIGATION */}
        {user && !hideSidebar && <Sidebar />}

        {/* PAGE OUTLET */}
        <main className="flex-1 p-6 overflow-y-auto max-h-[calc(100vh-70px)] bg-slate-50/30">
          <div className="max-w-[1600px] mx-auto w-full h-full">
            <Outlet />
          </div>
        </main>
      </div>

      {/* FOOTER */}
      <Footer />
    </div>
  );

};

export default RootLayout;