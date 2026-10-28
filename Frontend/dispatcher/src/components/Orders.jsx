import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import io from "socket.io-client";
import API from "../api";
import { toast } from "react-hot-toast";
import { 
  Search, 
  ChevronDown, 
  Kanban, 
  Table, 
  LayoutGrid,
  Trash2, 
  UserPlus, 
  Edit3, 
  Calendar,
  AlertCircle,
  Clock,
  User,
  ArrowUpDown,
  Building,
  CheckCircle,
  X,
  MapPin,
  ChevronLeft,
  ChevronRight,
  Package
} from "lucide-react";

const STATUS_OPTIONS = ["pending", "assigned", "accepted", "dispatched", "outfordelivery", "delivered"];

const getStatusSelectClass = (status) => {
  const base = "text-[9px] font-extrabold uppercase tracking-wider px-2 py-1 rounded-lg border cursor-pointer outline-none focus:ring-2 focus:ring-blue-100 ";
  const map = {
    pending: "bg-amber-50 text-amber-700 border-amber-200",
    dispatched: "bg-purple-50 text-purple-700 border-purple-200",
    outfordelivery: "bg-purple-50 text-purple-700 border-purple-200",
    delivered: "bg-green-50 text-green-700 border-green-200",
    assigned: "bg-blue-50 text-blue-700 border-blue-200",
    accepted: "bg-blue-50 text-blue-700 border-blue-200",
  };
  return base + (map[status] || "bg-slate-50 text-slate-600 border-slate-200");
};

const OrderStatusSelect = ({ order, onChange }) => (
  <select
    value={order.status}
    onChange={(e) => onChange(order._id, e.target.value)}
    className={getStatusSelectClass(order.status)}
    onClick={(e) => e.stopPropagation()}
  >
    {STATUS_OPTIONS.map((s) => (
      <option key={s} value={s}>{s}</option>
    ))}
  </select>
);

const Orders = () => {
  const [orders, setOrders] = useState([]);
  const [riders, setRiders] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewMode, setViewMode] = useState("table"); // "table" | "grid" | "kanban"
  const [sortField, setSortField] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState("desc");
  
  // Selection/Bulk actions state
  const [selectedIds, setSelectedIds] = useState([]);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;
  
  // Modals state
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isBulkDeleteConfirmOpen, setIsBulkDeleteConfirmOpen] = useState(false);

  // Edit form state
  const [editForm, setEditForm] = useState({
    customerName: "",
    phone: "",
    orderDetails: "",
    pincode: "",
    city: "",
    state: "",
    area: "",
    building: "",
    landmark: "",
    addressType: "Home",
  });

  const [assignRiderId, setAssignRiderId] = useState("");

  useEffect(() => {
    fetchOrders();
    fetchRiders();
    const interval = setInterval(() => {
      fetchOrders();
      fetchRiders();
    }, 5000);

    const socketUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:4000";
    const socket = io(socketUrl);

    socket.on("connect", () => {
      socket.emit("join-admin");
    });

    socket.on("order:status-changed", () => {
      fetchOrders();
    });

    socket.on("order:new", () => {
      fetchOrders();
    });

    socket.on("order:accepted", () => {
      fetchOrders();
    });

    socket.on("order:deleted", () => {
      fetchOrders();
    });

    return () => {
      clearInterval(interval);
      socket.disconnect();
    };
  }, []);

  const fetchOrders = async () => {
    try {
      const res = await API.get("/api/orders");
      setOrders(res.data);
    } catch (err) {
      console.error("Error fetching orders:", err);
    }
  };

  const fetchRiders = async () => {
    try {
      const res = await API.get("/api/admin/riders");
      setRiders(res.data.filter(r => r.isActive));
    } catch (err) {
      console.error("Error fetching riders:", err);
    }
  };

  const handleEditClick = (order) => {
    setSelectedOrder(order);
    setEditForm({
      customerName: order.customerName || "",
      phone: order.phone || "",
      orderDetails: order.orderDetails || "",
      pincode: order.address?.pincode || "",
      city: order.address?.city || "",
      state: order.address?.state || "",
      area: order.address?.area || "",
      building: order.address?.building || "",
      landmark: order.address?.landmark || "",
      addressType: order.address?.addressType || "Home",
    });
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      await API.put(`/api/orders/${selectedOrder._id}`, {
        customerName: editForm.customerName,
        phone: editForm.phone,
        orderDetails: editForm.orderDetails,
        address: {
          pincode: editForm.pincode,
          city: editForm.city,
          state: editForm.state,
          area: editForm.area,
          building: editForm.building,
          landmark: editForm.landmark,
          addressType: editForm.addressType,
        }
      });
      toast.success("Order details saved successfully!");
      setIsEditModalOpen(false);
      fetchOrders();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update order");
    }
  };

  const handleAssignClick = (order) => {
    setSelectedOrder(order);
    setAssignRiderId(order.assignedRider?._id || "");
    setIsAssignModalOpen(true);
  };

  const handleAssignSubmit = async (e) => {
    e.preventDefault();
    if (!assignRiderId) {
      toast.error("Please select a rider");
      return;
    }
    try {
      await API.put(`/api/orders/assign/${selectedOrder._id}`, {
        riderId: assignRiderId
      });
      toast.success("Rider assigned to order successfully!");
      setIsAssignModalOpen(false);
      fetchOrders();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to assign rider");
    }
  };

  const handleDeleteClick = (order) => {
    setSelectedOrder(order);
    setIsDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      await API.delete(`/api/orders/${selectedOrder._id}`);
      toast.success("Order deleted successfully!");
      setIsDeleteConfirmOpen(false);
      setSelectedIds(prev => prev.filter(id => id !== selectedOrder._id));
      fetchOrders();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete order");
    }
  };

  const handleStatusChange = async (orderId, newStatus) => {
    try {
      await API.put(`/api/orders/status/${orderId}`, { status: newStatus });
      toast.success(`Status updated to ${newStatus}`);
      fetchOrders();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update status");
    }
  };

  const handleBulkDeleteConfirm = async () => {
    try {
      setOrders(prev => prev.filter(o => !selectedIds.includes(o._id)));
      
      // Request deletion sequentially
      for (const id of selectedIds) {
        await API.delete(`/api/orders/${id}`);
      }
      toast.success(`Deleted ${selectedIds.length} orders successfully!`);
      setSelectedIds([]);
      setIsBulkDeleteConfirmOpen(false);
      fetchOrders();
    } catch (err) {
      toast.error("Error performing bulk deletion");
    }
  };

  // Sort handler
  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  // Row selection helpers
  const toggleSelectRow = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = (filteredData) => {
    const visibleIds = filteredData.map(o => o._id);
    const allSelected = visibleIds.every(id => selectedIds.includes(id));

    if (allSelected) {
      setSelectedIds(prev => prev.filter(id => !visibleIds.includes(id)));
    } else {
      setSelectedIds(prev => [...new Set([...prev, ...visibleIds])]);
    }
  };

  // Generate priority dynamically based on postcode length or order detail length for visual diversity
  const getPriority = (order) => {
    const length = order.orderDetails?.length || 0;
    if (length > 25) return { label: "High", color: "bg-rose-50 text-rose-700 border-rose-100" };
    if (length > 15) return { label: "Medium", color: "bg-amber-50 text-amber-700 border-amber-100" };
    return { label: "Low", color: "bg-slate-50 text-slate-600 border-slate-100" };
  };

  // Filter orders
  const getFilteredOrders = () => {
    return orders
      .filter((order) => {
        if (order.status === "delivered") return false;

        const query = searchTerm.toLowerCase();
        const matchesSearch =
          order.customerName.toLowerCase().includes(query) ||
          order._id.toLowerCase().includes(query) ||
          (order.assignedRider?.name || "").toLowerCase().includes(query) ||
          (order.address?.area || "").toLowerCase().includes(query) ||
          (order.orderDetails || "").toLowerCase().includes(query);
        
        const matchesStatus =
          statusFilter === "all" || order.status === statusFilter;

        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => {
        let valA, valB;
        if (sortField === "customerName") {
          valA = a.customerName.toLowerCase();
          valB = b.customerName.toLowerCase();
        } else if (sortField === "status") {
          valA = a.status;
          valB = b.status;
        } else {
          valA = a.createdAt || a.updatedAt || "";
          valB = b.createdAt || b.updatedAt || "";
        }

        if (valA < valB) return sortOrder === "asc" ? -1 : 1;
        if (valA > valB) return sortOrder === "asc" ? 1 : -1;
        return 0;
      });
  };

  const filteredOrders = getFilteredOrders();

  // Paginated visible items
  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage) || 1;
  const paginatedOrders = filteredOrders.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">
            Dispatch Board
          </h1>
          <p className="text-slate-500 text-xs font-semibold mt-1">
            Assign, schedule, audit, and dispatch customer order requests.
          </p>
        </div>

        {/* View Mode Toggle */}
        <div className="flex bg-slate-100 p-1 rounded-2xl gap-1 self-start">
          <button
            onClick={() => setViewMode("table")}
            className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              viewMode === "table" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Table className="w-4 h-4" /> Table
          </button>
          <button
            onClick={() => setViewMode("grid")}
            className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              viewMode === "grid" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <LayoutGrid className="w-4 h-4" /> Grid
          </button>
          <button
            onClick={() => setViewMode("kanban")}
            className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              viewMode === "kanban" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Kanban className="w-4 h-4" /> Board
          </button>
        </div>
      </div>

      {/* Bulk actions ribbon (Sticky overlay when items selected) */}
      {selectedIds.length > 0 && viewMode === "table" && (
        <div className="bg-slate-900 text-white px-6 py-4 rounded-2xl flex items-center justify-between animate-slideUp">
          <div className="flex items-center gap-3">
            <span className="h-5 w-5 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-xs">
              {selectedIds.length}
            </span>
            <span className="text-xs font-bold">Orders Selected</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setIsBulkDeleteConfirmOpen(true)}
              className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="w-4 h-4" /> Delete Selected
            </button>
            <button
              onClick={() => setSelectedIds([])}
              className="text-xs font-semibold text-slate-400 hover:text-white px-3 py-2"
            >
              Deselect All
            </button>
          </div>
        </div>
      )}

      {/* Filter panel */}
      <div className="flex flex-col lg:flex-row justify-between items-center gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
        {/* Search */}
        <div className="relative w-full lg:w-96">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="w-4 h-4 text-slate-400" />
          </span>
          <input
            type="text"
            placeholder="Search by ID, customer name, area locality..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-9 pr-4 py-2.5 text-xs bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-transparent focus:border-blue-500 outline-none rounded-xl transition-all"
          />
        </div>

        {/* Tab filters */}
        <div className="flex flex-wrap gap-1.5 w-full lg:w-auto">
          {["all", "pending", "assigned", "accepted", "dispatched", "outfordelivery"].map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setStatusFilter(tab);
                setCurrentPage(1);
              }}
              className={`px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer
                ${statusFilter === tab
                  ? "bg-slate-900 text-white"
                  : "bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-800"
                }
              `}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* VIEW RENDERER */}
      {viewMode === "table" && (
        /* TABLE VIEW MODE */
        <div className="bg-white border border-slate-100 rounded-3xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-400 select-none">
                  <th className="p-4 w-12 text-center">
                    <input
                      type="checkbox"
                      checked={
                        paginatedOrders.length > 0 &&
                        paginatedOrders.every(o => selectedIds.includes(o._id))
                      }
                      onChange={() => toggleSelectAll(paginatedOrders)}
                      className="rounded border-slate-300 cursor-pointer text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                  <th className="p-4">ID</th>
                  <th className="p-4 cursor-pointer hover:text-slate-800" onClick={() => handleSort("customerName")}>
                    <div className="flex items-center gap-1.5">
                      Customer <ArrowUpDown className="w-3.5 h-3.5" />
                    </div>
                  </th>
                  <th className="p-4">Delivery Area</th>
                  <th className="p-4">Order Details</th>
                  <th className="p-4">Priority</th>
                  <th className="p-4">Assigned Rider</th>
                  <th className="p-4 cursor-pointer hover:text-slate-800" onClick={() => handleSort("status")}>
                    <div className="flex items-center gap-1.5">
                      Status <ArrowUpDown className="w-3.5 h-3.5" />
                    </div>
                  </th>
                  <th className="p-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-xs text-slate-700">
                {paginatedOrders.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="text-center py-20 text-slate-400">
                      <div className="flex flex-col items-center">
                        <span className="text-6xl mb-3">📦</span>
                        <h3 className="font-bold text-slate-700 text-sm">No Active Orders Found</h3>
                        <p className="text-[10px] text-slate-400 mt-1">Try matching criteria or adjusting layout status filter tabs.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedOrders.map((order) => {
                    const priority = getPriority(order);
                    const isSelected = selectedIds.includes(order._id);
                    return (
                      <tr
                        key={order._id}
                        className={`hover:bg-slate-50/50 transition-colors ${
                          isSelected ? "bg-blue-50/20" : ""
                        }`}
                      >
                        {/* Selector */}
                        <td className="p-4 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectRow(order._id)}
                            className="rounded border-slate-300 cursor-pointer text-blue-600 focus:ring-blue-500"
                          />
                        </td>
                        
                        {/* ID */}
                        <td className="p-4 font-mono text-slate-400">
                          #{order._id.slice(-5)}
                        </td>

                        {/* Customer */}
                        <td className="p-4">
                          <p className="font-bold text-slate-850">{order.customerName}</p>
                          <p className="text-[10px] text-slate-450 mt-0.5">{order.phone}</p>
                        </td>

                        {/* Address locality */}
                        <td className="p-4 max-w-[200px] truncate">
                          <div className="flex items-center gap-1">
                            <span className="px-1.5 py-0.5 text-[9px] font-extrabold uppercase rounded bg-slate-100 text-slate-550 border border-slate-200">
                              {order.address?.addressType || "Home"}
                            </span>
                            <span className="text-slate-600 truncate ml-0.5">
                              {order.address?.building}, {order.address?.area}
                            </span>
                          </div>
                        </td>

                        {/* Description */}
                        <td className="p-4 max-w-[200px] truncate text-slate-600 italic">
                          {order.orderDetails}
                        </td>

                        {/* Priority Badge */}
                        <td className="p-4">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${priority.color}`}>
                            {priority.label}
                          </span>
                        </td>

                        {/* Rider */}
                        <td className="p-4">
                          {order.assignedRider ? (
                            <div className="flex items-center gap-1.5">
                              <span className="w-5 h-5 rounded-full bg-blue-50 text-blue-600 font-bold text-[9px] flex items-center justify-center border border-blue-100">
                                {order.assignedRider.name.charAt(0).toUpperCase()}
                              </span>
                              <span className="font-bold text-slate-800">{order.assignedRider.name}</span>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleAssignClick(order)}
                              className="text-blue-600 hover:text-blue-700 text-[10px] font-bold uppercase hover:underline flex items-center gap-0.5"
                            >
                              <UserPlus className="w-3.5 h-3.5" /> Assign Rider
                            </button>
                          )}
                        </td>

                        {/* Status dropdown */}
                        <td className="p-4">
                          <OrderStatusSelect order={order} onChange={handleStatusChange} />
                        </td>

                        {/* Actions menu */}
                        <td className="p-4">
                          <div className="flex justify-center items-center gap-1">
                            <button
                              onClick={() => handleAssignClick(order)}
                              className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-lg transition-colors cursor-pointer"
                              title="Assign Courier"
                            >
                              <UserPlus className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleEditClick(order)}
                              className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-lg transition-colors cursor-pointer"
                              title="Edit Details"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteClick(order)}
                              className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                              title="Delete Order"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Table Pagination */}
          {filteredOrders.length > 0 && (
            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-slate-500 select-none">
              <span>
                Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredOrders.length)} of {filteredOrders.length} entries
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 border border-slate-100 hover:border-slate-200 hover:bg-slate-50 rounded-lg disabled:opacity-50 transition-all cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-3.5 py-1.5 bg-slate-100 rounded-lg font-bold text-slate-800">
                  {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="p-1.5 border border-slate-100 hover:border-slate-200 hover:bg-slate-50 rounded-lg disabled:opacity-50 transition-all cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {viewMode === "grid" && (
        /* GRID VIEW MODE */
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredOrders.length === 0 ? (
            <div className="col-span-full df-card p-12 flex flex-col items-center justify-center min-h-[300px]">
              <Package className="w-12 h-12 text-slate-300 mb-4" />
              <h3 className="font-bold text-slate-700 text-sm">No orders match your filters</h3>
              <p className="text-[10px] text-slate-400 mt-1">Adjust search or status filters to see results.</p>
            </div>
          ) : (
            filteredOrders.map((order) => {
              const priority = getPriority(order);
              return (
                <div key={order._id} className="df-card p-5 space-y-4 hover:shadow-lg transition-shadow">
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0">
                      <h4 className="font-extrabold text-slate-800 text-sm truncate">{order.customerName}</h4>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">#{order._id.slice(-5)}</p>
                    </div>
                    <OrderStatusSelect order={order} onChange={handleStatusChange} />
                  </div>

                  <p className="text-xs text-slate-600 italic line-clamp-2">{order.orderDetails}</p>

                  <div className="flex items-center gap-2 text-[10px] text-slate-500">
                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{order.address?.building}, {order.address?.area}</span>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                    <div className="flex items-center gap-2">
                      {order.assignedRider ? (
                        <>
                          <span className="w-6 h-6 rounded-full bg-blue-50 text-blue-600 font-bold text-[9px] flex items-center justify-center border border-blue-100">
                            {order.assignedRider.name.charAt(0).toUpperCase()}
                          </span>
                          <span className="text-[10px] font-bold text-slate-700">{order.assignedRider.name}</span>
                        </>
                      ) : (
                        <button
                          onClick={() => handleAssignClick(order)}
                          className="text-blue-600 text-[10px] font-bold flex items-center gap-1 hover:underline"
                        >
                          <UserPlus className="w-3.5 h-3.5" /> Assign
                        </button>
                      )}
                    </div>
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border ${priority.color}`}>
                      {priority.label}
                    </span>
                  </div>

                  <div className="flex gap-1.5 pt-1">
                    <button onClick={() => handleEditClick(order)} className="flex-1 p-2 hover:bg-slate-50 text-slate-500 hover:text-slate-800 rounded-lg transition-colors text-[10px] font-bold flex items-center justify-center gap-1">
                      <Edit3 className="w-3.5 h-3.5" /> Edit
                    </button>
                    <button onClick={() => handleDeleteClick(order)} className="p-2 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {viewMode === "kanban" && (
        /* KANBAN BOARD VIEW MODE */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Column 1: Pending Orders */}
          <div className="bg-slate-50 p-4 rounded-3xl border border-slate-200/50 space-y-4 h-fit min-h-[500px]">
            <div className="flex justify-between items-center px-2">
              <span className="font-black text-xs uppercase tracking-wider text-slate-450">Pending Requests</span>
              <span className="h-5 px-2 bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-bold rounded-full flex items-center justify-center">
                {filteredOrders.filter(o => o.status === "pending").length}
              </span>
            </div>
            <div className="space-y-3">
              {filteredOrders.filter(o => o.status === "pending").map(order => (
                <div key={order._id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-3 hover:shadow transition-shadow">
                  <div className="flex justify-between items-start gap-1.5">
                    <h4 className="font-extrabold text-slate-800 text-xs truncate">{order.customerName}</h4>
                    <span className="font-mono text-[9px] text-slate-400 shrink-0">#{order._id.slice(-5)}</span>
                  </div>
                  <p className="text-[10px] text-slate-500 italic line-clamp-2 leading-relaxed">{order.orderDetails}</p>
                  
                  <div className="border-t border-slate-50 pt-2.5 flex items-center justify-between">
                    <span className="text-[9px] text-slate-450 flex items-center gap-1 font-semibold">
                      <MapPin className="w-3.5 h-3.5" /> {order.address?.area || "No area"}
                    </span>
                    <button
                      onClick={() => handleAssignClick(order)}
                      className="bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-0.5"
                    >
                      <UserPlus className="w-3.5 h-3.5" /> Assign
                    </button>
                  </div>
                </div>
              ))}
              {filteredOrders.filter(o => o.status === "pending").length === 0 && (
                <div className="text-center py-12 text-slate-450 text-[10px] font-semibold">No pending requests</div>
              )}
            </div>
          </div>

          {/* Column 2: Assigned & Accepted Orders */}
          <div className="bg-slate-50 p-4 rounded-3xl border border-slate-200/50 space-y-4 h-fit min-h-[500px]">
            <div className="flex justify-between items-center px-2">
              <span className="font-black text-xs uppercase tracking-wider text-slate-450">Assigned / Accepted</span>
              <span className="h-5 px-2 bg-blue-100 text-blue-800 border border-blue-200 text-[10px] font-bold rounded-full flex items-center justify-center">
                {filteredOrders.filter(o => ["assigned", "accepted"].includes(o.status)).length}
              </span>
            </div>
            <div className="space-y-3">
              {filteredOrders.filter(o => ["assigned", "accepted"].includes(o.status)).map(order => (
                <div key={order._id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-3 hover:shadow transition-shadow">
                  <div className="flex justify-between items-start gap-1.5">
                    <h4 className="font-extrabold text-slate-800 text-xs truncate">{order.customerName}</h4>
                    <span className="font-mono text-[9px] text-slate-400 shrink-0">#{order._id.slice(-5)}</span>
                  </div>
                  <p className="text-[10px] text-slate-500 italic line-clamp-2 leading-relaxed">{order.orderDetails}</p>
                  
                  <div className="border-t border-slate-50 pt-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <span className="w-5 h-5 rounded-full bg-blue-50 text-blue-600 font-bold text-[9px] flex items-center justify-center border border-blue-100">
                        {order.assignedRider?.name?.charAt(0).toUpperCase()}
                      </span>
                      <span className="text-[10px] font-bold text-slate-700 truncate max-w-[80px]">
                        {order.assignedRider?.name}
                      </span>
                    </div>
                    
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleAssignClick(order)}
                        className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-lg transition-colors cursor-pointer"
                        title="Reassign"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleEditClick(order)}
                        className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-lg transition-colors cursor-pointer"
                        title="Edit Details"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {filteredOrders.filter(o => ["assigned", "accepted"].includes(o.status)).length === 0 && (
                <div className="text-center py-12 text-slate-450 text-[10px] font-semibold">No assigned orders</div>
              )}
            </div>
          </div>

          {/* Column 3: OutForDelivery (In-Transit) / Dispatched Orders */}
          <div className="bg-slate-50 p-4 rounded-3xl border border-slate-200/50 space-y-4 h-fit min-h-[500px]">
            <div className="flex justify-between items-center px-2">
              <span className="font-black text-xs uppercase tracking-wider text-slate-450">Out For Delivery / Dispatched</span>
              <span className="h-5 px-2 bg-purple-100 text-purple-800 border border-purple-200 text-[10px] font-bold rounded-full flex items-center justify-center">
                {filteredOrders.filter(o => ["outfordelivery", "dispatched"].includes(o.status?.toLowerCase())).length}
              </span>
            </div>
            <div className="space-y-3">
              {filteredOrders.filter(o => ["outfordelivery", "dispatched"].includes(o.status?.toLowerCase())).map(order => (
                <div key={order._id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-3 hover:shadow transition-shadow">
                  <div className="flex justify-between items-start gap-1.5">
                    <h4 className="font-extrabold text-slate-800 text-xs truncate">{order.customerName}</h4>
                    <span className="font-mono text-[9px] text-slate-400 shrink-0">#{order._id.slice(-5)}</span>
                  </div>
                  <p className="text-[10px] text-slate-500 italic line-clamp-2 leading-relaxed">{order.orderDetails}</p>
                  
                  <div className="border-t border-slate-50 pt-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <span className="w-5 h-5 rounded-full bg-purple-50 text-purple-600 font-bold text-[9px] flex items-center justify-center border border-purple-100">
                        {order.assignedRider?.name?.charAt(0).toUpperCase()}
                      </span>
                      <span className="text-[10px] font-bold text-slate-700 truncate max-w-[80px]">
                        {order.assignedRider?.name}
                      </span>
                    </div>

                    <Link
                      to="/admin/tracking"
                      className="bg-purple-50 hover:bg-purple-100 text-purple-700 text-[10px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-0.5"
                    >
                      🗺️ Locate
                    </Link>
                  </div>
                </div>
              ))}
              {filteredOrders.filter(o => ["outfordelivery", "dispatched"].includes(o.status?.toLowerCase())).length === 0 && (
                <div className="text-center py-12 text-slate-450 text-[10px] font-semibold">No active deliveries in transit</div>
              )}
            </div>
          </div>

        </div>
      )}

      {/* ASSIGN RIDER MODAL */}
      {isAssignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-slate-100 animate-scaleUp">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-xl font-black text-slate-900 tracking-tight">Assign Operations Rider</h2>
              <button onClick={() => setIsAssignModalOpen(false)} className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleAssignSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-450">Choose Active Rider</label>
                <select
                  value={assignRiderId}
                  onChange={(e) => setAssignRiderId(e.target.value)}
                  className="w-full border border-slate-200 p-3.5 rounded-xl outline-none text-xs bg-slate-50 hover:bg-slate-100/50 focus:bg-white focus:border-blue-500 cursor-pointer"
                  required
                >
                  <option value="">-- Select Available Rider --</option>
                  {riders.map((rider) => (
                    <option key={rider._id} value={rider._id}>
                      {rider.name} ({rider.isAvailable ? "Available" : "Busy"})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2 justify-end pt-4 border-t border-slate-50">
                <button
                  type="button"
                  onClick={() => setIsAssignModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-650 hover:bg-slate-50 text-xs font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md hover:shadow-lg transition-all cursor-pointer"
                >
                  Confirm Rider
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT ORDER MODAL */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 w-full max-w-2xl shadow-2xl border border-slate-100 my-8">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-xl font-black text-slate-900 tracking-tight">Edit Dispatch Details</h2>
              <button onClick={() => setIsEditModalOpen(false)} className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-450">Customer Name</label>
                  <input
                    type="text"
                    value={editForm.customerName}
                    onChange={(e) => setEditForm({ ...editForm, customerName: e.target.value })}
                    className="w-full border border-slate-200 p-3 rounded-xl text-xs bg-slate-50 focus:bg-white focus:border-blue-500 outline-none"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-450">Phone Number</label>
                  <input
                    type="text"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="w-full border border-slate-200 p-3 rounded-xl text-xs bg-slate-50 focus:bg-white focus:border-blue-500 outline-none"
                    required
                  />
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4 space-y-4">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1">
                  <Building className="w-4 h-4 text-slate-400" /> Locality Address Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 font-bold uppercase">Building/Flat No.</label>
                    <input
                      type="text"
                      value={editForm.building}
                      onChange={(e) => setEditForm({ ...editForm, building: e.target.value })}
                      className="w-full border border-slate-200 p-3 rounded-xl text-xs bg-slate-50 focus:bg-white"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 font-bold uppercase">Locality/Area/Street</label>
                    <input
                      type="text"
                      value={editForm.area}
                      onChange={(e) => setEditForm({ ...editForm, area: e.target.value })}
                      className="w-full border border-slate-200 p-3 rounded-xl text-xs bg-slate-50 focus:bg-white"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 font-bold uppercase">City</label>
                    <input
                      type="text"
                      value={editForm.city}
                      onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                      className="w-full border border-slate-200 p-3 rounded-xl text-xs bg-slate-50 focus:bg-white"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 font-bold uppercase">Pincode</label>
                    <input
                      type="text"
                      value={editForm.pincode}
                      onChange={(e) => setEditForm({ ...editForm, pincode: e.target.value })}
                      className="w-full border border-slate-200 p-3 rounded-xl text-xs bg-slate-50 focus:bg-white"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 font-bold uppercase">State</label>
                    <input
                      type="text"
                      value={editForm.state}
                      onChange={(e) => setEditForm({ ...editForm, state: e.target.value })}
                      className="w-full border border-slate-200 p-3 rounded-xl text-xs bg-slate-50 focus:bg-white"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 font-bold uppercase">Landmark (Optional)</label>
                    <input
                      type="text"
                      value={editForm.landmark}
                      onChange={(e) => setEditForm({ ...editForm, landmark: e.target.value })}
                      className="w-full border border-slate-200 p-3 rounded-xl text-xs bg-slate-50 focus:bg-white"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-450 block">Address Type</label>
                <div className="flex gap-4">
                  {["Home", "Office", "Other"].map((type) => (
                    <label key={type} className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                      <input
                        type="radio"
                        name="editAddressType"
                        value={type}
                        checked={editForm.addressType === type}
                        onChange={(e) => setEditForm({ ...editForm, addressType: e.target.value })}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      {type}
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-450">Order Description Particulars</label>
                <textarea
                  value={editForm.orderDetails}
                  onChange={(e) => setEditForm({ ...editForm, orderDetails: e.target.value })}
                  className="w-full border border-slate-200 p-3 rounded-xl text-xs bg-slate-50 focus:bg-white h-20 outline-none resize-none"
                  required
                />
              </div>

              <div className="flex gap-2 justify-end pt-4 border-t border-slate-50">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-650 hover:bg-slate-50 text-xs font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md hover:shadow-lg transition-all cursor-pointer"
                >
                  Save Dispatch changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION */}
      {isDeleteConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-slate-100 animate-scaleUp">
            <h2 className="text-lg font-black text-slate-900 tracking-tight mb-2">Delete Order Dispatch?</h2>
            <p className="text-slate-500 text-xs font-semibold leading-relaxed mb-6">
              Are you sure you want to permanently delete the order dispatch for <strong className="text-slate-800">{selectedOrder?.customerName}</strong>? This action cannot be reversed.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setIsDeleteConfirmOpen(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-650 hover:bg-slate-50 text-xs font-bold transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md transition-all cursor-pointer"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BULK DELETE CONFIRMATION */}
      {isBulkDeleteConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-slate-100 animate-scaleUp">
            <h2 className="text-lg font-black text-slate-900 tracking-tight mb-2">Delete Multiple Dispatches?</h2>
            <p className="text-slate-500 text-xs font-semibold leading-relaxed mb-6">
              Are you sure you want to permanently delete <strong className="text-slate-800">{selectedIds.length} orders</strong>? This action will cancel and remove these active dispatches.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setIsBulkDeleteConfirmOpen(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-650 hover:bg-slate-50 text-xs font-bold transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBulkDeleteConfirm}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md transition-all cursor-pointer"
              >
                Confirm Bulk Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Orders;