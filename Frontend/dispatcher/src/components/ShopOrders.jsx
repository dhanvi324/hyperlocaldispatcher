import React, { useEffect, useState } from "react";
import io from "socket.io-client";
import useShopStore from "../store/shopstore";
import { 
  Package, 
  Search, 
  Trash2, 
  AlertCircle,
  Filter,
  CheckCircle,
  Clock,
  Navigation,
  Compass
} from "lucide-react";
import { toast } from "react-hot-toast";

const ShopOrders = () => {
  const { shop, fetchShop, orders, riders, fetchOrders, fetchRiders, assignRider, deleteOrder, loading } = useShopStore();

  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [assigningOrderId, setAssigningOrderId] = useState(null);
  const [selectedRiderId, setSelectedRiderId] = useState("");

  useEffect(() => {
    if (!shop) fetchShop();
    fetchOrders({ status: statusFilter, search: searchQuery });
    fetchRiders();

    const socketUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:4000";
    const socket = io(socketUrl);

    socket.on("connect", () => {
      if (shop?._id) {
        socket.emit("join-shop", shop._id);
      }
    });

    socket.on("order:status-changed", () => {
      fetchOrders({ status: statusFilter, search: searchQuery });
    });
    socket.on("order:new", () => {
      fetchOrders({ status: statusFilter, search: searchQuery });
    });
    socket.on("order:accepted", () => {
      fetchOrders({ status: statusFilter, search: searchQuery });
    });
    socket.on("order:deleted", () => {
      fetchOrders({ status: statusFilter, search: searchQuery });
    });

    return () => {
      socket.disconnect();
    };
  }, [shop?._id, statusFilter, searchQuery]);

  const handleAssignSubmit = async (orderId) => {
    if (!selectedRiderId) {
      toast.error("Please select a rider");
      return;
    }
    try {
      await assignRider(orderId, selectedRiderId);
      toast.success("Order assigned!");
      setAssigningOrderId(null);
      setSelectedRiderId("");
      fetchOrders({ status: statusFilter, search: searchQuery });
    } catch (err) {
      toast.error(err.message || "Failed to assign order");
    }
  };

  const handleCancelOrder = async (orderId) => {
    if (window.confirm("Are you sure you want to cancel this order?")) {
      try {
        await deleteOrder(orderId);
        toast.success("Order cancelled");
        fetchOrders({ status: statusFilter, search: searchQuery });
      } catch (err) {
        toast.error(err.message || "Failed to cancel order");
      }
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Package className="w-8 h-8 text-indigo-600" />
            Orders Log
          </h1>
          <p className="text-slate-500 text-xs font-semibold mt-1">
            Track, assign, and cancel deliveries. Filter by status or search customer names.
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
        <div className="relative flex-1 w-full">
          <input
            type="text"
            placeholder="Search by customer name or item details..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full border border-slate-200 p-3.5 pl-10 rounded-xl text-xs outline-none bg-slate-50"
          />
          <Search className="w-4.5 h-4.5 text-slate-400 absolute left-3.5 top-4" />
        </div>

        <div className="flex gap-2 w-full md:w-auto shrink-0">
          <div className="relative w-full md:w-48">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full border border-slate-205 p-3.5 rounded-xl text-xs outline-none bg-slate-50 cursor-pointer appearance-none font-bold text-slate-700"
            >
              <option value="all">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Assigned">Assigned</option>
              <option value="Accepted">Accepted</option>
              <option value="dispatched">Dispatched</option>
              <option value="OutForDelivery">Out For Delivery</option>
              <option value="Delivered">Delivered</option>
              <option value="Cancelled">Cancelled</option>
            </select>
            <Filter className="w-4 h-4 text-slate-400 absolute right-3.5 top-4.5 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
        {loading ? (
          <div className="py-20 flex justify-center items-center">
            <div className="animate-spin rounded-full h-8 w-8 border-4 border-indigo-650 border-t-transparent"></div>
          </div>
        ) : orders.length === 0 ? (
          <div className="py-20 text-center text-slate-400 text-xs font-semibold">
            No orders found matching filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="pb-3">Order ID</th>
                  <th className="pb-3">Customer Details</th>
                  <th className="pb-3">Address Locality</th>
                  <th className="pb-3">Items / Details</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3">Assigned Rider</th>
                  <th className="pb-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {orders.map((order) => {
                  const statusColors = {
                    Pending: "bg-blue-50 text-blue-600 border-blue-100",
                    pending: "bg-blue-50 text-blue-600 border-blue-100",
                    Assigned: "bg-purple-50 text-purple-600 border-purple-100",
                    assigned: "bg-purple-50 text-purple-600 border-purple-100",
                    Accepted: "bg-indigo-50 text-indigo-600 border-indigo-100",
                    accepted: "bg-indigo-50 text-indigo-600 border-indigo-100",
                    OutForDelivery: "bg-amber-50 text-amber-700 border-amber-100",
                    outfordelivery: "bg-amber-50 text-amber-700 border-amber-100",
                    dispatched: "bg-amber-50 text-amber-700 border-amber-100",
                    Dispatched: "bg-amber-50 text-amber-700 border-amber-100",
                    Delivered: "bg-green-50 text-green-700 border-green-100",
                    delivered: "bg-green-50 text-green-700 border-green-100",
                    Cancelled: "bg-slate-50 text-slate-500 border-slate-100",
                    cancelled: "bg-slate-50 text-slate-500 border-slate-100",
                  };

                  const fullAddr = order.address 
                    ? `${order.address.building || ""}, ${order.address.area || ""}, ${order.address.city || ""}`
                    : order.deliveryAddress?.fullAddress || "No Address Details";

                  return (
                    <tr key={order._id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-4 font-mono font-bold text-[10px] text-slate-400 select-all">
                        #{order._id.substring(18)}
                      </td>
                      <td className="py-4">
                        <p className="font-bold text-slate-800">{order.customerName}</p>
                        <p className="text-slate-450 text-[10px] font-semibold mt-0.5">{order.phone}</p>
                      </td>
                      <td className="py-4 text-slate-600 max-w-[180px] truncate" title={fullAddr}>
                        {fullAddr}
                      </td>
                      <td className="py-4 text-slate-600 max-w-[200px] truncate">{order.orderDetails}</td>
                      <td className="py-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase border ${statusColors[order.status] || ""}`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="py-4">
                        {order.assignedRider?.name ? (
                          <div>
                            <p className="font-bold text-slate-700">{order.assignedRider.name}</p>
                            <p className="text-[9px] text-slate-400 font-semibold">{order.assignedRider.phone}</p>
                          </div>
                        ) : order.status === "Pending" ? (
                          <div>
                            <span className="text-amber-700 font-bold text-[10px] block">
                              {order.requestedRiders?.length > 0
                                ? `Broadcasted to ${order.requestedRiders.length} rider${order.requestedRiders.length > 1 ? "s" : ""}`
                                : "Awaiting eligible riders"}
                            </span>
                            <span className="text-[9px] text-slate-450 font-semibold">Auto-dispatched</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[10px] font-semibold">Unassigned</span>
                        )}
                      </td>
                      <td className="py-4 text-right space-x-2">
                        {order.status === "Pending" && (
                          <button
                            onClick={() => setAssigningOrderId(order._id)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-[9px] font-bold uppercase transition-all cursor-pointer"
                            title="Optional manual rider override"
                          >
                            Manual Assign
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

      {/* Rider Assignment Modal */}
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
                {(Array.isArray(riders) ? riders : [])
                  .filter((r) => r.isAvailable)
                  .map((r) => (
                    <option key={r.userId?._id} value={r.userId?._id}>
                      {r.userId?.name} ({r.vehicleType})
                    </option>
                  ))}
              </select>

              {(Array.isArray(riders) ? riders : []).filter((r) => r.isAvailable).length === 0 && (
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

export default ShopOrders;
