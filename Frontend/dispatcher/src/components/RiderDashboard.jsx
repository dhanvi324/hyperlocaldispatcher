import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import io from "socket.io-client";
import useAuthStore from "../store/authstore";
import useTrackingStore from "../store/trackingstore";
import API from "../api";
import { toast } from "react-hot-toast";
import { 
  Package, 
  CheckCircle, 
  Compass, 
  Map, 
  Phone, 
  CircleDollarSign, 
  CheckCircle2, 
  Activity, 
  AlertCircle,
  Clock,
  ArrowRight,
  TrendingUp
} from "lucide-react";

const RiderDashboard = () => {
  const user = useAuthStore((state) => state.user);
  const [stats, setStats] = useState({
    assignedCount: 0,
    completedCount: 0,
    activeCount: 0,
    earnings: 0,
  });
  const [completedHistory, setCompletedHistory] = useState([]);
  const [activeOrder, setActiveOrder] = useState(null);

  const startTracking = useTrackingStore((state) => state.startTracking);
  const stopTracking = useTrackingStore((state) => state.stopTracking);
  const isTracking = useTrackingStore((state) => state.isTracking);

  useEffect(() => {
    if (!user?._id) return;

    fetchRiderData();
    const interval = setInterval(fetchRiderData, 5000);

    const socketUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:4000";
    const socket = io(socketUrl);

    socket.on("connect", () => {
      socket.emit("rider-join-personal", user._id);
    });

    socket.on("order:status-changed", () => {
      fetchRiderData();
    });

    socket.on("order:accepted", () => {
      fetchRiderData();
    });

    socket.on("order:new", () => {
      fetchRiderData();
    });

    return () => {
      clearInterval(interval);
      socket.disconnect();
    };
  }, [user?._id]);

  const fetchRiderData = async () => {
    try {
      // 1. Fetch assigned/active orders
      const ordersRes = await API.get("/api/rider/my-orders");
      const assigned = ordersRes.data;
      
      // Active orders are those with status "Accepted", "OutForDelivery", or "dispatched"
      const active = assigned.find(o => ["accepted", "outfordelivery", "dispatched"].includes(o.status?.toLowerCase()));
      setActiveOrder(active);

      // 2. Fetch earnings info
      const earningsRes = await API.get(`/api/earnings/${user._id}`);
      
      setStats({
        assignedCount: assigned.length,
        completedCount: earningsRes.data.completedOrders,
        activeCount: active ? 1 : 0,
        earnings: earningsRes.data.totalEarnings,
      });
      setCompletedHistory(earningsRes.data.history || []);
    } catch (err) {
      console.error("Error fetching rider data:", err);
    }
  };

  const handleUpdateStatus = async (orderId, newStatus) => {
    try {
      await API.put(`/api/rider/update-status/${orderId}`, { status: newStatus });
      const displayStatus = newStatus === "dispatched" ? "Dispatched" : (newStatus === "delivered" ? "Delivered" : (newStatus === "OutForDelivery" ? "Out For Delivery" : newStatus));
      toast.success(`Order status set to ${displayStatus}!`);

      // Geolocation Live tracking reaction:
      if (["outfordelivery", "dispatched"].includes(newStatus?.toLowerCase())) {
        console.log(`[RIDER DASHBOARD] Order ${orderId} dispatched (Start Delivery clicked). Starting location tracking.`);
        startTracking(orderId);
      } else if (newStatus?.toLowerCase() === "delivered") {
        console.log(`[RIDER DASHBOARD] Order ${orderId} delivered. Stopping location tracking.`);
        await stopTracking();
      }

      fetchRiderData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update status");
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">
            Rider Console
          </h1>
          <p className="text-slate-500 text-xs font-semibold mt-1">
            Welcome back, <strong className="text-slate-800">{user?.name}</strong>! Access dispatch disclaimers and accept active shipments.
          </p>
        </div>
        
        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider border shrink-0
          ${isTracking 
            ? "bg-green-50 text-green-700 border-green-200 animate-pulse" 
            : "bg-slate-50 text-slate-400 border-slate-200"
          }
        `}>
          <span className={`h-2 w-2 rounded-full ${isTracking ? "bg-green-500" : "bg-slate-400"}`}></span>
          {isTracking ? "GPS Broadcaster Active" : "GPS Broadcaster Idle"}
        </span>
      </div>

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* KPI 1: Assigned */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Assigned Orders</span>
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-2xl">
              <Package className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-black text-slate-900 mt-4">{stats.assignedCount}</p>
        </div>

        {/* KPI 2: Completed */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Completed Deliveries</span>
            <div className="p-2.5 bg-green-50 text-green-600 rounded-2xl">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-black text-slate-900 mt-4">{stats.completedCount}</p>
        </div>

        {/* KPI 3: Active deliveries */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Active Delivery</span>
            <div className="p-2.5 bg-amber-50 text-amber-600 rounded-2xl">
              <Activity className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-black text-slate-900 mt-4">{stats.activeCount}</p>
        </div>

        {/* KPI 4: Earnings */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Rider Earnings</span>
            <div className="p-2.5 bg-purple-50 text-purple-600 rounded-2xl">
              <CircleDollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <p className="text-3xl font-black text-slate-900">₹{stats.earnings}</p>
            <span className="text-[10px] font-extrabold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-0.5">
              <TrendingUp className="w-3.5 h-3.5" /> Statement
            </span>
          </div>
        </div>
      </div>

      {/* Active Order Card */}
      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-6">
        <h2 className="text-lg font-black text-slate-850 tracking-tight">Active Delivery Task</h2>

        {!activeOrder ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400">
            <span className="text-6xl mb-3 animate-pulse">📦</span>
            <h3 className="font-bold text-slate-700 text-sm">No Active Deliveries</h3>
            <p className="text-[10px] text-slate-400 mt-1 max-w-xs text-center leading-relaxed">
              Navigate to the orders log directory tab to check and accept incoming dispatch requests.
            </p>
          </div>
        ) : (
          <div className="bg-slate-50/50 rounded-2xl border border-slate-100 p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <span className="px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-250 rounded-full text-[10px] font-bold uppercase tracking-wider mr-2">
                  {activeOrder.status?.toLowerCase() === "dispatched" ? "Dispatched" : (activeOrder.status === "OutForDelivery" ? "Out For Delivery" : activeOrder.status)}
                </span>
                <span className="font-mono text-[10px] text-slate-400 font-semibold">ID: #{activeOrder._id.slice(-8)}</span>
              </div>
              <p className="text-[10px] text-slate-450 font-semibold flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> Assigned: {new Date(activeOrder.createdAt).toLocaleTimeString()}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-slate-700 font-semibold">
              <div className="space-y-4">
                <div>
                  <span className="text-[9px] text-slate-400 uppercase font-bold block">Customer Client</span>
                  <span className="text-sm font-extrabold text-slate-850 block mt-0.5">{activeOrder.customerName}</span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 uppercase font-bold block">Contact Phone</span>
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1 mt-0.5">
                    <Phone className="w-4 h-4 text-slate-450" /> {activeOrder.phone}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 uppercase font-bold block">Order particulars</span>
                  <span className="text-xs text-slate-600 block mt-0.5 italic">{activeOrder.orderDetails}</span>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <span className="text-[9px] text-slate-400 uppercase font-bold block">Delivery Locality Address</span>
                  <span className="text-xs text-slate-700 leading-relaxed block mt-0.5">
                    {activeOrder.address?.building}, {activeOrder.address?.area}, {activeOrder.address?.city}, {activeOrder.address?.state} - {activeOrder.address?.pincode}
                  </span>
                  {activeOrder.address?.landmark && (
                    <span className="text-[10px] text-slate-450 block mt-1.5 italic">Landmark: {activeOrder.address.landmark}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2 pt-4 border-t border-slate-100 select-none">
              {activeOrder.status?.toLowerCase() === "accepted" && (
                <button
                  onClick={() => handleUpdateStatus(activeOrder._id, "dispatched")}
                  className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-5 py-2.5 rounded-xl shadow-md text-xs uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
                >
                  <Compass className="w-4 h-4 animate-spin-slow" /> Start Delivery
                </button>
              )}
              {["outfordelivery", "dispatched"].includes(activeOrder.status?.toLowerCase()) && (
                <button
                  onClick={() => handleUpdateStatus(activeOrder._id, "delivered")}
                  className="bg-green-600 hover:bg-green-700 text-white font-bold px-5 py-2.5 rounded-xl shadow-md text-xs uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle className="w-4 h-4" /> Mark as Delivered
                </button>
              )}
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${activeOrder.deliveryLocation?.lat || 0},${activeOrder.deliveryLocation?.lng || 0}`}
                target="_blank"
                rel="noreferrer"
                className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-5 py-2.5 rounded-xl shadow-sm text-xs uppercase tracking-wider flex items-center gap-1.5"
              >
                <Map className="w-4 h-4" /> Open Maps
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Completed history summary logs */}
      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
        <div className="flex justify-between items-center border-b border-slate-50 pb-2">
          <div>
            <h3 className="font-bold text-slate-800 text-sm">Payout & Delivery statement</h3>
            <p className="text-[10px] text-slate-450 font-semibold mt-0.5">Summary of dynamic payouts and logging</p>
          </div>
          <Link
            to="/rider/earnings"
            className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-0.5"
          >
            Statement Ledger <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/70 text-slate-400 text-[9px] font-bold uppercase tracking-wider border-b border-slate-100">
                <th className="p-4 pl-6">Completed Date</th>
                <th className="p-4">Order ID</th>
                <th className="p-4">Customer</th>
                <th className="p-4">Distance Logged</th>
                <th className="p-4 text-right pr-6">Credited Earning</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-xs text-slate-700 font-semibold">
              {completedHistory.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center py-10 text-slate-400">
                    <div className="flex flex-col items-center">
                      <span className="text-4xl mb-2">💰</span>
                      <p className="text-xs font-bold text-slate-500">No payouts credited yet</p>
                    </div>
                  </td>
                </tr>
              ) : (
                completedHistory.slice(0, 4).map((record, index) => (
                  <tr key={record._id || index} className="hover:bg-slate-50/40 transition-colors">
                    <td className="p-4 pl-6 text-[10px] text-slate-500 font-semibold">
                      {new Date(record.date).toLocaleDateString()} at {new Date(record.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="p-4 font-mono text-[10px] text-slate-400">
                      #{record.orderId?._id?.slice(-5) || record.orderId?.toString()?.slice(-5) || "N/A"}
                    </td>
                    <td className="p-4 font-bold text-slate-800">
                      {record.customerName}
                    </td>
                    <td className="p-4 text-slate-650">
                      🚀 {record.distance ? `${record.distance} km` : "N/A"}
                    </td>
                    <td className="p-4 text-right pr-6 font-black text-green-600">
                      +₹{record.amount}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default RiderDashboard;