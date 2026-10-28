import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
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
  MapPin,
  Phone, 
  CircleDollarSign, 
  CheckCircle2, 
  Activity, 
  AlertCircle,
  Clock,
  ArrowRight,
  TrendingUp,
  ThumbsUp,
  ThumbsDown,
  X,
  Navigation,
  Loader2
} from "lucide-react";

// ============================
// FIX LEAFLET DEFAULT ICON
// ============================
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const customerIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const shopIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Helper component to auto-fit bounds to markers
const FitMapBounds = ({ markers }) => {
  const map = useMap();
  useEffect(() => {
    if (markers && markers.length > 0) {
      const validCoords = markers.filter((m) => m && m[0] && m[1] && m[0] !== 0 && m[1] !== 0);
      if (validCoords.length > 1) {
        const bounds = L.latLngBounds(validCoords);
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
      } else if (validCoords.length === 1) {
        map.setView(validCoords[0], 15);
      }
    }
  }, [markers, map]);
  return null;
};

const RiderDashboard = () => {
  const user = useAuthStore((state) => state.user);
  const [stats, setStats] = useState({
    assignedCount: 0,
    completedCount: 0,
    activeCount: 0,
    earnings: 0,
  });
  const [completedHistory, setCompletedHistory] = useState([]);
  const [availableOrders, setAvailableOrders] = useState([]);
  const [activeOrder, setActiveOrder] = useState(null);
  const [deliveredOrders, setDeliveredOrders] = useState([]);
  const [viewLocationOrder, setViewLocationOrder] = useState(null);
  const [actionLoading, setActionLoading] = useState({});

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
      if (user.shopId) {
        socket.emit("rider-join-shop", user.shopId);
      }
    });

    socket.on("order:new", () => {
      fetchRiderData();
    });

    socket.on("order:accepted", (data) => {
      setAvailableOrders((prev) => prev.filter((o) => o._id !== data.orderId));
      fetchRiderData();
    });

    socket.on("order:status-changed", () => {
      fetchRiderData();
    });

    return () => {
      clearInterval(interval);
      socket.disconnect();
    };
  }, [user?._id, user?.shopId]);

  const fetchRiderData = async () => {
    try {
      // 1. Fetch available orders for this rider
      try {
        const availableRes = await API.get("/api/rider/available-orders");
        setAvailableOrders(availableRes.data || []);
      } catch (err) {
        console.error("Error fetching available orders:", err);
      }

      // 2. Fetch assigned/active orders
      const ordersRes = await API.get("/api/rider/my-orders");
      const assigned = ordersRes.data || [];
      
      // Active orders are those with status "Accepted", "OutForDelivery", "dispatched", or "Assigned"
      const active = assigned.find((o) =>
        ["accepted", "outfordelivery", "dispatched", "assigned"].includes(o.status?.toLowerCase())
      );
      setActiveOrder(active || null);

      // 3. Fetch delivered orders
      try {
        const deliveredRes = await API.get("/api/rider/my-orders?status=delivered");
        setDeliveredOrders(deliveredRes.data || []);
      } catch (err) {
        console.error("Error fetching delivered orders:", err);
      }

      // 4. Fetch earnings info
      const earningsRes = await API.get(`/api/earnings/${user._id}`);
      
      setStats({
        assignedCount: assigned.length,
        completedCount: earningsRes.data.completedOrders || 0,
        activeCount: active ? 1 : 0,
        earnings: earningsRes.data.totalEarnings || 0,
      });
      setCompletedHistory(earningsRes.data.history || []);
    } catch (err) {
      console.error("Error fetching rider data:", err);
    }
  };

  const handleAcceptOrder = async (orderId) => {
    setActionLoading((prev) => ({ ...prev, [orderId]: "accept" }));
    try {
      await API.put(`/api/rider/respond-order/${orderId}`, { action: "accept" });
      toast.success("Order accepted! Moved to your active deliveries.");
      await fetchRiderData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to accept order");
      await fetchRiderData();
    } finally {
      setActionLoading((prev) => ({ ...prev, [orderId]: null }));
    }
  };

  const handleRejectOrder = async (orderId) => {
    setActionLoading((prev) => ({ ...prev, [orderId]: "reject" }));
    try {
      await API.put(`/api/rider/respond-order/${orderId}`, { action: "reject" });
      toast.success("Order request rejected.");
      setAvailableOrders((prev) => prev.filter((o) => o._id !== orderId));
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to reject order");
    } finally {
      setActionLoading((prev) => ({ ...prev, [orderId]: null }));
    }
  };

  const handleStartDelivery = async (orderId) => {
    setActionLoading((prev) => ({ ...prev, [orderId]: "start" }));
    try {
      await API.put(`/api/rider/update-status/${orderId}`, { status: "dispatched" });
      toast.success("Delivery started! Status updated to Dispatched.");
      startTracking(orderId);
      await fetchRiderData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to start delivery");
    } finally {
      setActionLoading((prev) => ({ ...prev, [orderId]: null }));
    }
  };

  const handleMarkDelivered = async (orderId) => {
    setActionLoading((prev) => ({ ...prev, [orderId]: "deliver" }));
    try {
      await API.put(`/api/rider/update-status/${orderId}`, { status: "delivered" });
      toast.success("Order successfully marked as Delivered!");
      await stopTracking();
      if (viewLocationOrder?._id === orderId) {
        setViewLocationOrder(null);
      }
      await fetchRiderData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to mark delivered");
    } finally {
      setActionLoading((prev) => ({ ...prev, [orderId]: null }));
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

      {/* ==================================================== */}
      {/* 1. AVAILABLE ORDERS (Nearby requests to Accept/Reject) */}
      {/* ==================================================== */}
      {availableOrders.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black text-amber-600 flex items-center gap-2 px-1">
              <AlertCircle className="w-5 h-5 text-amber-500 animate-pulse" />
              Available Order Requests ({availableOrders.length})
            </h2>
            <span className="text-[11px] font-semibold text-slate-400">
              Orders from your shop awaiting rider acceptance
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {availableOrders.map((order) => {
              const fullAddr = order.address
                ? `${order.address.building || ""}, ${order.address.area || ""}, ${order.address.city || ""}`
                : order.deliveryAddress?.fullAddress || "No address details";

              const isLoadingAccept = actionLoading[order._id] === "accept";
              const isLoadingReject = actionLoading[order._id] === "reject";

              return (
                <div
                  key={order._id}
                  className="bg-white rounded-3xl p-6 border-2 border-amber-300/80 shadow-md flex flex-col justify-between relative overflow-hidden transition-all hover:shadow-lg"
                >
                  <div className="space-y-4">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                      <div>
                        <h3 className="font-extrabold text-slate-900 text-sm">{order.customerName}</h3>
                        <p className="text-[10px] text-slate-450 font-semibold font-mono">ID: #{order._id.slice(-8)}</p>
                      </div>
                      <span className="bg-amber-100 text-amber-800 border border-amber-200 px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider">
                        Available Request
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-semibold text-slate-700">
                      <div className="space-y-2">
                        <div>
                          <span className="text-[9px] text-slate-400 uppercase font-bold block">Contact Phone</span>
                          <span className="text-slate-800 flex items-center gap-1 mt-0.5">
                            <Phone className="w-3.5 h-3.5 text-slate-400" /> {order.phone}
                          </span>
                        </div>
                        <div>
                          <span className="text-[9px] text-slate-400 uppercase font-bold block">Order Details</span>
                          <span className="text-slate-800 italic block mt-0.5">{order.orderDetails}</span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div>
                          <span className="text-[9px] text-slate-400 uppercase font-bold block">Customer Address</span>
                          <span className="text-slate-700 leading-relaxed block mt-0.5">
                            {fullAddr}
                          </span>
                        </div>
                        {order.shopId?.shopName && (
                          <div>
                            <span className="text-[9px] text-slate-400 uppercase font-bold block">Shop</span>
                            <span className="text-indigo-600 font-bold block mt-0.5">{order.shopId.shopName}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions: Accept & Reject */}
                  <div className="flex gap-3 mt-6 border-t border-slate-100 pt-4 select-none">
                    <button
                      onClick={() => handleAcceptOrder(order._id)}
                      disabled={isLoadingAccept || isLoadingReject}
                      className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-bold py-2.5 px-4 rounded-xl text-xs uppercase tracking-wider shadow-sm flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                    >
                      {isLoadingAccept ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <ThumbsUp className="w-4 h-4" />
                      )}
                      <span>Accept Order</span>
                    </button>

                    <button
                      onClick={() => handleRejectOrder(order._id)}
                      disabled={isLoadingAccept || isLoadingReject}
                      className="bg-slate-100 hover:bg-slate-200 disabled:bg-slate-50 text-slate-700 font-bold py-2.5 px-4 rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer transition-all border border-slate-200"
                    >
                      {isLoadingReject ? (
                        <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
                      ) : (
                        <ThumbsDown className="w-4 h-4 text-slate-500" />
                      )}
                      <span>Reject</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* 2. ACTIVE DELIVERY TASK (Accepted or In-Delivery) */}
      {/* ==================================================== */}
      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-6">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-lg font-black text-slate-850 tracking-tight">Active Delivery Task</h2>
            <p className="text-slate-400 text-xs font-semibold">Your current assigned delivery assignment</p>
          </div>
          {activeOrder && (
            <span className="font-mono text-xs text-slate-400 font-bold">
              ID: #{activeOrder._id.slice(-8)}
            </span>
          )}
        </div>

        {!activeOrder ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400">
            <span className="text-6xl mb-3 animate-pulse">📦</span>
            <h3 className="font-bold text-slate-700 text-sm">No Active Deliveries</h3>
            <p className="text-[10px] text-slate-400 mt-1 max-w-xs text-center leading-relaxed">
              {availableOrders.length > 0 
                ? "You have incoming order requests above! Click Accept to start a delivery."
                : "New orders created by your shop will appear here automatically as available requests."
              }
            </p>
          </div>
        ) : (
          <div className="bg-slate-50/50 rounded-2xl border border-slate-100 p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider border
                  ${activeOrder.status?.toLowerCase() === "accepted" ? "bg-blue-50 text-blue-700 border-blue-200" : ""}
                  ${["outfordelivery", "dispatched"].includes(activeOrder.status?.toLowerCase()) ? "bg-amber-50 text-amber-700 border-amber-200" : ""}
                  ${activeOrder.status?.toLowerCase() === "delivered" ? "bg-green-50 text-green-700 border-green-200" : ""}
                `}>
                  {activeOrder.status?.toLowerCase() === "dispatched" ? "Dispatched" : (activeOrder.status === "OutForDelivery" ? "Out For Delivery" : activeOrder.status)}
                </span>
                <span className="text-xs text-slate-400 font-semibold">
                  {activeOrder.status?.toLowerCase() === "accepted" && "• Ready to depart"}
                  {["outfordelivery", "dispatched"].includes(activeOrder.status?.toLowerCase()) && "• Currently en route"}
                </span>
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
                  <span className="text-[9px] text-slate-400 uppercase font-bold block">Order Particulars</span>
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
                {activeOrder.shopId && (
                  <div>
                    <span className="text-[9px] text-slate-400 uppercase font-bold block">Pickup Shop</span>
                    <span className="text-xs text-indigo-700 font-bold block mt-0.5">
                      {activeOrder.shopId.shopName} {activeOrder.shopId.address ? `(${activeOrder.shopId.address})` : ""}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Actions: Start Delivery, View Pinned Location, Mark as Delivered */}
            <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-slate-100 select-none">
              {/* If Accepted: Show Start Delivery */}
              {activeOrder.status?.toLowerCase() === "accepted" && (
                <button
                  onClick={() => handleStartDelivery(activeOrder._id)}
                  disabled={actionLoading[activeOrder._id] === "start"}
                  className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-5 py-2.5 rounded-xl shadow-md text-xs uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-all disabled:bg-purple-400"
                >
                  {actionLoading[activeOrder._id] === "start" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Compass className="w-4 h-4 animate-spin-slow" />
                  )}
                  <span>Start Delivery</span>
                </button>
              )}

              {/* In-Delivery (Dispatched / OutForDelivery): Show Mark as Delivered */}
              {["outfordelivery", "dispatched"].includes(activeOrder.status?.toLowerCase()) && (
                <button
                  onClick={() => handleMarkDelivered(activeOrder._id)}
                  disabled={actionLoading[activeOrder._id] === "deliver"}
                  className="bg-green-600 hover:bg-green-700 text-white font-bold px-5 py-2.5 rounded-xl shadow-md text-xs uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-all disabled:bg-green-400"
                >
                  {actionLoading[activeOrder._id] === "deliver" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4" />
                  )}
                  <span>Mark as Delivered</span>
                </button>
              )}

              {/* View Pinned Location Button (Reusable Leaflet Map) */}
              <button
                onClick={() => setViewLocationOrder(activeOrder)}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2.5 rounded-xl shadow-sm text-xs uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-all"
              >
                <MapPin className="w-4 h-4" /> View Pinned Location
              </button>

              {/* External Google Maps fallback */}
              {activeOrder.deliveryLocation?.lat !== 0 && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${activeOrder.deliveryLocation?.lat || 0},${activeOrder.deliveryLocation?.lng || 0}`}
                  target="_blank"
                  rel="noreferrer"
                  className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-4 py-2.5 rounded-xl shadow-sm text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all"
                >
                  <Navigation className="w-3.5 h-3.5" /> Navigate
                </a>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ==================================================== */}
      {/* 3. PINNED LOCATION LEAFLET MODAL */}
      {/* ==================================================== */}
      {viewLocationOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-3xl w-full border border-slate-100 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-100 text-blue-600 rounded-xl">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">Customer Pinned Delivery Location</h3>
                  <p className="text-slate-400 text-xs font-semibold">
                    Delivery coordinates pinned by shop owner: {viewLocationOrder.deliveryLocation?.lat?.toFixed(5)}, {viewLocationOrder.deliveryLocation?.lng?.toFixed(5)}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setViewLocationOrder(null)}
                className="p-2 hover:bg-slate-200 text-slate-400 hover:text-slate-700 rounded-full transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: Leaflet Map */}
            <div className="relative w-full h-[380px] bg-slate-100">
              {viewLocationOrder.deliveryLocation?.lat && viewLocationOrder.deliveryLocation?.lng ? (
                <MapContainer
                  center={[viewLocationOrder.deliveryLocation.lat, viewLocationOrder.deliveryLocation.lng]}
                  zoom={15}
                  scrollWheelZoom={true}
                  className="w-full h-full z-0"
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />

                  {/* Customer Pinned Location Marker */}
                  <Marker
                    position={[viewLocationOrder.deliveryLocation.lat, viewLocationOrder.deliveryLocation.lng]}
                    icon={customerIcon}
                  >
                    <Popup>
                      <div className="p-1 space-y-1 text-xs">
                        <strong className="block text-red-600 font-bold">📍 Customer Destination</strong>
                        <p className="font-semibold text-slate-800">{viewLocationOrder.customerName}</p>
                        <p className="text-[11px] text-slate-650">{viewLocationOrder.phone}</p>
                        <p className="text-[10px] text-slate-500">
                          {viewLocationOrder.address?.building}, {viewLocationOrder.address?.area}
                        </p>
                      </div>
                    </Popup>
                  </Marker>

                  {/* Shop Marker if available */}
                  {viewLocationOrder.shopId?.latitude && viewLocationOrder.shopId?.longitude && (
                    <Marker
                      position={[viewLocationOrder.shopId.latitude, viewLocationOrder.shopId.longitude]}
                      icon={shopIcon}
                    >
                      <Popup>
                        <div className="p-1 space-y-1 text-xs">
                          <strong className="block text-blue-600 font-bold">🏪 Pickup Shop</strong>
                          <p className="font-semibold text-slate-800">{viewLocationOrder.shopId.shopName}</p>
                          <p className="text-[10px] text-slate-500">{viewLocationOrder.shopId.address}</p>
                        </div>
                      </Popup>
                    </Marker>
                  )}

                  <FitMapBounds
                    markers={[
                      [viewLocationOrder.deliveryLocation.lat, viewLocationOrder.deliveryLocation.lng],
                      viewLocationOrder.shopId?.latitude && viewLocationOrder.shopId?.longitude
                        ? [viewLocationOrder.shopId.latitude, viewLocationOrder.shopId.longitude]
                        : null
                    ]}
                  />
                </MapContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 text-xs font-semibold">
                  No GPS coordinates available for this delivery.
                </div>
              )}
            </div>

            {/* Modal Footer: Address details */}
            <div className="p-5 border-t border-slate-100 bg-white flex flex-col sm:flex-row justify-between gap-4 items-start sm:items-center">
              <div className="text-xs text-slate-700">
                <span className="text-[10px] font-bold text-slate-450 uppercase block">Delivery Address</span>
                <p className="font-semibold text-slate-800 mt-0.5">
                  {viewLocationOrder.address?.building}, {viewLocationOrder.address?.area}, {viewLocationOrder.address?.city} - {viewLocationOrder.address?.pincode}
                </p>
                {viewLocationOrder.address?.landmark && (
                  <p className="text-[11px] text-slate-500 mt-0.5">Landmark: {viewLocationOrder.address.landmark}</p>
                )}
              </div>

              <div className="flex gap-2 self-end sm:self-center">
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${viewLocationOrder.deliveryLocation?.lat || 0},${viewLocationOrder.deliveryLocation?.lng || 0}`}
                  target="_blank"
                  rel="noreferrer"
                  className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-all"
                >
                  <Navigation className="w-3.5 h-3.5" /> Google Maps
                </a>
                <button
                  onClick={() => setViewLocationOrder(null)}
                  className="border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold px-4 py-2 rounded-xl text-xs transition-all cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* 4. COMPLETED / DELIVERED ORDERS SECTION */}
      {/* ==================================================== */}
      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
        <div className="flex justify-between items-center border-b border-slate-50 pb-2">
          <div>
            <h3 className="font-bold text-slate-800 text-sm">Delivered Orders & Payout Ledger</h3>
            <p className="text-[10px] text-slate-450 font-semibold mt-0.5">Completed delivery history (no active delivery actions)</p>
          </div>
          <Link
            to="/rider/earnings"
            className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-0.5"
          >
            Full Ledger <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/70 text-slate-400 text-[9px] font-bold uppercase tracking-wider border-b border-slate-100">
                <th className="p-4 pl-6">Completed Date</th>
                <th className="p-4">Order ID</th>
                <th className="p-4">Customer</th>
                <th className="p-4">Status</th>
                <th className="p-4">Distance Logged</th>
                <th className="p-4 text-right pr-6">Credited Earning</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-xs text-slate-700 font-semibold">
              {completedHistory.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-10 text-slate-400">
                    <div className="flex flex-col items-center">
                      <span className="text-4xl mb-2">💰</span>
                      <p className="text-xs font-bold text-slate-500">No delivered orders yet</p>
                    </div>
                  </td>
                </tr>
              ) : (
                completedHistory.slice(0, 5).map((record, index) => (
                  <tr key={record._id || index} className="hover:bg-slate-50/40 transition-colors">
                    <td className="p-4 pl-6 text-[10px] text-slate-500 font-semibold">
                      {new Date(record.date).toLocaleDateString()} at {new Date(record.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="p-4 font-mono text-[10px] text-slate-400">
                      #{record.orderId?._id?.slice(-6) || record.orderId?.toString()?.slice(-6) || "N/A"}
                    </td>
                    <td className="p-4 font-bold text-slate-800">
                      {record.customerName}
                    </td>
                    <td className="p-4">
                      <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase border bg-green-50 text-green-700 border-green-200">
                        Delivered
                      </span>
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