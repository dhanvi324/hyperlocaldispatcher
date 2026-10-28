import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import io from "socket.io-client";
import { getAdminStats } from "../api";
import { 
  Users, 
  Store, 
  Bike, 
  Package, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  TrendingUp,
  ShieldCheck,
  ChevronRight
} from "lucide-react";
import { SkeletonKPI } from "./ui/Skeleton";

const AdminDashboard = () => {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalShops: 0,
    totalRiders: 0,
    totalOrders: 0,
    deliveredOrders: 0,
    activeOrders: 0,
    approvedRiders: 0,
    pendingRiders: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchDashboardStats = async () => {
    try {
      const res = await getAdminStats();
      if (res.data.success) {
        setStats(res.data);
      }
      setLoading(false);
    } catch (err) {
      console.error("Error fetching admin stats:", err);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardStats();
    const interval = setInterval(fetchDashboardStats, 10000);

    const socketUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:4000";
    const socket = io(socketUrl);

    socket.on("connect", () => {
      socket.emit("join-admin");
    });

    socket.on("order:status-changed", () => {
      fetchDashboardStats();
    });

    socket.on("order:new", () => {
      fetchDashboardStats();
    });

    socket.on("order:accepted", () => {
      fetchDashboardStats();
    });

    return () => {
      clearInterval(interval);
      socket.disconnect();
    };
  }, []);

  const getPercentage = (part, total) => {
    if (total === 0) return 0;
    return ((part / total) * 100).toFixed(1);
  };

  const cancelledOrders = stats.totalOrders - stats.deliveredOrders - stats.activeOrders;
  const completedPct = getPercentage(stats.deliveredOrders, stats.totalOrders);
  const cancelledPct = getPercentage(cancelledOrders, stats.totalOrders);

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Top Welcome Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">
            Platform Overview
          </h1>
          <p className="text-slate-550 mt-1.5 text-xs font-semibold flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-blue-600 animate-spin" />
            Global metrics active • Auto-syncing every 10s
          </p>
        </div>
        
        <div className="flex gap-2">
          <Link
            to="/admin/users"
            className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
          >
            <ShieldCheck className="w-4 h-4" /> Manage Users
          </Link>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => <SkeletonKPI key={i} />)
        ) : (
        <>
        {/* KPI 1: Total Users */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition-all">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Total Users
            </span>
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-2xl">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-end justify-between">
            <div>
              <p className="text-3xl font-black text-slate-900">{stats.totalUsers}</p>
              <p className="text-[10px] text-slate-450 mt-1 font-semibold">Registered accounts</p>
            </div>
            <span className="flex items-center gap-0.5 text-[10px] font-extrabold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
              <TrendingUp className="w-3.5 h-3.5" /> All
            </span>
          </div>
        </div>

        {/* KPI 2: Total Shops */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition-all">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Total Shops
            </span>
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-2xl">
              <Store className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-end justify-between">
            <div>
              <p className="text-3xl font-black text-slate-900">{stats.totalShops}</p>
              <p className="text-[10px] text-slate-450 mt-1 font-semibold">Partner merchants</p>
            </div>
          </div>
        </div>

        {/* KPI 3: Total Riders */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition-all">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Total Riders
            </span>
            <div className="p-2.5 bg-purple-50 text-purple-600 rounded-2xl">
              <Bike className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-end justify-between">
            <div>
              <p className="text-3xl font-black text-slate-900">{stats.totalRiders}</p>
              <p className="text-[10px] text-slate-450 mt-1 font-semibold">Delivery personnel</p>
            </div>
            <div className="flex flex-col items-end">
                <span className="text-[10px] font-extrabold text-blue-600">
                {stats.approvedRiders} Approved
                </span>
                <span className="text-[10px] font-extrabold text-amber-600 mt-0.5">
                {stats.pendingRiders} Pending
                </span>
            </div>
          </div>
        </div>

        {/* KPI 4: Total Orders */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition-all">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Total Orders
            </span>
            <div className="p-2.5 bg-orange-50 text-orange-600 rounded-2xl">
              <Package className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-end justify-between">
            <div>
              <p className="text-3xl font-black text-slate-900">{stats.totalOrders}</p>
              <p className="text-[10px] text-slate-450 mt-1 font-semibold">Lifetime volume</p>
            </div>
             <span className="text-[10px] font-extrabold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
               {stats.activeOrders} Active
             </span>
          </div>
        </div>

        {/* KPI 5: Completed Orders % */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition-all">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Completion Rate
            </span>
            <div className="p-2.5 bg-green-50 text-green-600 rounded-2xl">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-end justify-between">
            <div>
              <p className="text-3xl font-black text-slate-900">{completedPct}%</p>
              <p className="text-[10px] text-slate-450 mt-1 font-semibold">{stats.deliveredOrders} Delivered</p>
            </div>
          </div>
        </div>

        {/* KPI 6: Cancelled Orders % */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition-all">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Cancellation Rate
            </span>
            <div className="p-2.5 bg-red-50 text-red-600 rounded-2xl">
              <XCircle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-end justify-between">
            <div>
              <p className="text-3xl font-black text-slate-900">{cancelledPct}%</p>
              <p className="text-[10px] text-slate-450 mt-1 font-semibold">{cancelledOrders} Cancelled</p>
            </div>
          </div>
        </div>

        </>
        )}
      </div>

    </div>
  );
};

export default AdminDashboard;