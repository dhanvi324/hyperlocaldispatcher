import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import io from "socket.io-client";
import useShopStore from "../store/shopstore";
import useApprovalStore from "../store/approvalstore";
import { 
  Store, 
  Copy, 
  Check, 
  Users, 
  ShoppingBag, 
  CheckCircle2, 
  Clock, 
  UserCheck, 
  TrendingUp,
  ChevronRight,
  UserCheck2,
  Trash2,
  AlertCircle
} from "lucide-react";
import { toast } from "react-hot-toast";

const ShopDashboard = () => {
  const navigate = useNavigate();

  // Shop Store Actions
  const { 
    shop, 
    stats, 
    fetchShop, 
    fetchStats, 
    fetchRiders, 
    fetchOrders, 
    assignRider, 
    deleteOrder 
  } = useShopStore();

  // Approval Store Actions
  const { 
    pendingRequests, 
    fetchRequests, 
    approveRider, 
    rejectRider 
  } = useApprovalStore();

  const [copied, setCopied] = useState(false);
  const [assigningOrderId, setAssigningOrderId] = useState(null);
  const [selectedRiderId, setSelectedRiderId] = useState("");

  useEffect(() => {
    const initDashboard = async () => {
      await fetchShop();
      fetchStats();
      fetchRiders();
      fetchRequests("Pending");
      fetchOrders({ limit: 5 });
    };
    initDashboard();
  }, []);

  useEffect(() => {
    if (!shop?._id) return;

    const socketUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:4000";
    const socket = io(socketUrl);

    socket.on("connect", () => {
      socket.emit("join-shop", shop._id);
    });

    socket.on("order:status-changed", () => {
      fetchStats();
      fetchOrders({ limit: 5 });
    });

    socket.on("order:new-assigned", () => {
      fetchStats();
      fetchOrders({ limit: 5 });
    });

    socket.on("order:new", () => {
      fetchStats();
      fetchOrders({ limit: 5 });
    });

    socket.on("order:accepted", () => {
      fetchStats();
      fetchOrders({ limit: 5 });
    });

    return () => {
      socket.disconnect();
    };
  }, [shop?._id]);

  const handleCopyCode = () => {
    if (shop?.shopCode) {
      navigator.clipboard.writeText(shop.shopCode);
      setCopied(true);
      toast.success("Shop code copied!");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleApprove = async (riderId) => {
    try {
      await approveRider(riderId);
      toast.success("Rider approved successfully!");
      fetchRiders(); // Refresh active list
      fetchStats();  // Refresh count
    } catch (err) {
      toast.error(err.message || "Failed to approve rider");
    }
  };

  const handleReject = async (riderId) => {
    try {
      await rejectRider(riderId);
      toast.success("Rider request rejected.");
      fetchStats();  // Refresh count
    } catch (err) {
      toast.error(err.message || "Failed to reject rider");
    }
  };

  const handleAssignSubmit = async (orderId) => {
    if (!selectedRiderId) {
      toast.error("Please select a rider");
      return;
    }
    try {
      await assignRider(orderId, selectedRiderId);
      toast.success("Order assigned to rider!");
      setAssigningOrderId(null);
      setSelectedRiderId("");
      fetchOrders({ limit: 5 });
      fetchStats();
    } catch (err) {
      toast.error(err.message || "Failed to assign order");
    }
  };

  const handleCancelOrder = async (orderId) => {
    if (window.confirm("Are you sure you want to cancel this order?")) {
      try {
        await deleteOrder(orderId);
        toast.success("Order cancelled successfully");
        fetchOrders({ limit: 5 });
        fetchStats();
      } catch (err) {
        toast.error(err.message || "Failed to cancel order");
      }
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Welcome & Shop Code Header */}
      {shop && (
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center border border-indigo-100/50 shrink-0">
              <Store className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">{shop.shopName}</h1>
              <p className="text-slate-500 text-xs font-semibold mt-0.5">{shop.address}</p>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-150/50 px-4 py-3 rounded-2xl flex items-center gap-4 w-fit select-none">
            <div>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Share Shop Code</p>
              <p className="text-sm font-black text-slate-800 font-mono mt-0.5 tracking-wider">{shop.shopCode}</p>
            </div>
            <button
              onClick={handleCopyCode}
              className="p-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-500 hover:text-slate-800 rounded-xl transition-all cursor-pointer"
              title="Copy code"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Orders */}
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex justify-between items-start">
            <div className="w-9 h-9 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
              <ShoppingBag className="w-4.5 h-4.5" />
            </div>
            <TrendingUp className="w-4 h-4 text-slate-350" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">Total Orders</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">{stats?.totalOrders || 0}</h3>
          </div>
        </div>

        {/* Active Orders */}
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex justify-between items-start">
            <div className="w-9 h-9 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
              <Clock className="w-4.5 h-4.5 animate-pulse" />
            </div>
            <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Live</span>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">Active Orders</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">{stats?.activeOrders || 0}</h3>
          </div>
        </div>

        {/* Delivered Orders */}
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex justify-between items-start">
            <div className="w-9 h-9 bg-green-50 text-green-700 rounded-xl flex items-center justify-center">
              <CheckCircle2 className="w-4.5 h-4.5" />
            </div>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">Delivered</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">{stats?.deliveredOrders || 0}</h3>
          </div>
        </div>

        {/* Approved Riders */}
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex justify-between items-start">
            <div className="w-9 h-9 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
              <Users className="w-4.5 h-4.5" />
            </div>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">Active Riders</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">{stats?.totalRiders || 0}</h3>
          </div>
        </div>

        {/* Pending Approval Requests */}
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-4 col-span-2 lg:col-span-1">
          <div className="flex justify-between items-start">
            <div className="w-9 h-9 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center">
              <UserCheck className="w-4.5 h-4.5" />
            </div>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">Pending Riders</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">{stats?.pendingRiders || 0}</h3>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left/Middle: Orders & Requests (col-span 2) */}
        <div className="xl:col-span-2 space-y-6">
          
          {/* Rider Requests Panel (Awaiting approvals) */}
          {pendingRequests.length > 0 && (
            <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-4 animate-fadeIn">
              <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                <UserCheck2 className="w-5 h-5 text-indigo-600 animate-pulse" />
                Rider Join Requests ({pendingRequests.length})
              </h2>

              <div className="divide-y divide-slate-100">
                {pendingRequests.map((request) => (
                  <div key={request._id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 first:pt-0 last:pb-0">
                    <div>
                      <h4 className="text-sm font-bold text-slate-805">{request.userId?.name}</h4>
                      <p className="text-slate-450 text-[10px] font-semibold mt-0.5">{request.userId?.email} • {request.userId?.phone || "No Phone"}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleReject(request._id)}
                        className="px-3.5 py-1.5 border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => handleApprove(request._id)}
                        className="px-3.5 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-[10px] font-bold uppercase tracking-wider shadow-sm transition-all cursor-pointer"
                      >
                        Approve
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Orders Panel */}
          <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-slate-900 tracking-tight">Recent Orders</h2>
              <button
                onClick={() => navigate("/shop/orders")}
                className="text-indigo-650 hover:text-indigo-800 text-xs font-bold flex items-center gap-0.5 hover:underline"
              >
                View all orders <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {useShopStore.getState().orders.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs font-semibold">
                No orders registered yet. Click Create Order to begin.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      <th className="pb-3">Customer</th>
                      <th className="pb-3">Items</th>
                      <th className="pb-3">Status</th>
                      <th className="pb-3">Rider</th>
                      <th className="pb-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {useShopStore.getState().orders.map((order) => {
                      const statusColors = {
                        Pending: "bg-blue-50 text-blue-600 border-blue-100",
                        Assigned: "bg-purple-50 text-purple-600 border-purple-100",
                        Accepted: "bg-indigo-50 text-indigo-600 border-indigo-100",
                        OutForDelivery: "bg-amber-50 text-amber-700 border-amber-100",
                        Delivered: "bg-green-50 text-green-700 border-green-100",
                        Cancelled: "bg-slate-50 text-slate-500 border-slate-100",
                      };

                      return (
                        <tr key={order._id} className="align-middle">
                          <td className="py-3.5 font-bold text-slate-800">
                            {order.customerName}
                            <span className="block text-[9px] text-slate-400 font-semibold mt-0.5">{order.phone}</span>
                          </td>
                          <td className="py-3.5 text-slate-500 max-w-[150px] truncate">{order.orderDetails}</td>
                          <td className="py-3.5">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border ${statusColors[order.status] || ""}`}>
                              {order.status}
                            </span>
                          </td>
                          <td className="py-3.5 font-semibold text-slate-650">
                            {order.assignedRider?.name || (
                              <span className="text-slate-400 text-[10px]">Unassigned</span>
                            )}
                          </td>
                          <td className="py-3.5 text-right space-x-2">
                            {order.status === "Pending" && (
                              <button
                                onClick={() => setAssigningOrderId(order._id)}
                                className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[10px] font-bold uppercase transition-all cursor-pointer"
                              >
                                Assign
                              </button>
                            )}
                            {["Pending", "Assigned", "Accepted"].includes(order.status) && (
                              <button
                                onClick={() => handleCancelOrder(order._id)}
                                className="p-1.5 hover:bg-rose-50 text-rose-500 hover:text-rose-600 rounded-lg transition-all cursor-pointer inline-flex items-center"
                                title="Cancel order"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel: Approved Active Riders list */}
        <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-4 h-fit">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black text-slate-900 tracking-tight">Active Riders</h2>
            <button
              onClick={() => navigate("/shop/riders")}
              className="text-indigo-650 hover:text-indigo-850 text-xs font-bold hover:underline"
            >
              Manage
            </button>
          </div>

          {useShopStore.getState().riders.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs font-semibold">
              No active riders linked.
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {useShopStore.getState().riders.map((rider) => (
                <div key={rider._id} className="py-3 flex items-center justify-between first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-slate-800 truncate">{rider.userId?.name}</h4>
                    <p className="text-[9px] text-slate-400 font-semibold mt-0.5">{rider.vehicleType} • {rider.userId?.phone || "No phone"}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                    rider.isAvailable 
                      ? "bg-green-50 text-green-700 border border-green-100" 
                      : "bg-amber-50 text-amber-700 border border-amber-100"
                  }`}>
                    {rider.isAvailable ? "Available" : "Busy"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Rider Assignment Modal (Modal dialog) */}
      {assigningOrderId && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white border border-slate-100 rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-6">
            <div className="space-y-1">
              <h3 className="text-lg font-black text-slate-900 tracking-tight">Assign Rider</h3>
              <p className="text-slate-500 text-xs font-semibold">Select an approved active rider to deliver this order.</p>
            </div>

            <div className="space-y-3">
              <select
                value={selectedRiderId}
                onChange={(e) => setSelectedRiderId(e.target.value)}
                className="w-full border border-slate-200 p-3.5 rounded-xl text-xs outline-none bg-slate-50 cursor-pointer"
              >
                <option value="">-- Select Rider --</option>
                {Array.isArray(useShopStore.getState().riders) && useShopStore.getState().riders
                  .filter((r) => r.isAvailable)
                  .map((r) => (
                    <option key={r.userId?._id} value={r.userId?._id}>
                      {r.userId?.name} ({r.vehicleType})
                    </option>
                  ))}
              </select>

              {(Array.isArray(useShopStore.getState().riders) ? useShopStore.getState().riders : []).filter((r) => r.isAvailable).length === 0 && (
                <div className="flex gap-2 p-3 bg-rose-50 text-rose-700 border border-rose-100/50 rounded-xl text-[10px] font-bold uppercase items-center">
                  <AlertCircle className="w-4.5 h-4.5 shrink-0" />
                  <span>No available riders right now.</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-105 pt-4">
              <button
                onClick={() => {
                  setAssigningOrderId(null);
                  setSelectedRiderId("");
                }}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-550 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleAssignSubmit(assigningOrderId)}
                disabled={!selectedRiderId}
                className="px-4 py-2 bg-slate-950 hover:bg-slate-850 disabled:bg-slate-350 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShopDashboard;
