import React, { useState, useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import io from "socket.io-client";
import useAuthStore from "../store/authstore";
import { getMyShop, getShopOwnerOrders } from "../api";
import { 
  Map, 
  Compass, 
  MapPin, 
  Phone, 
  User, 
  Package, 
  Clock, 
  Activity,
  AlertCircle,
  TrendingUp
} from "lucide-react";
import { toast } from "react-hot-toast";

// ============================
// FIX LEAFLET DEFAULT ICON
// ============================
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Custom divisional icon creator
const createCustomIcon = (color, text = "📍") => {
  const colorMap = {
    blue: "#2563EB",
    red: "#EF4444",
    green: "#10B981"
  };
  const themeHex = colorMap[color] || "#2563EB";
  
  return new L.DivIcon({
    html: `
      <div class="relative flex items-center justify-center">
        <div class="absolute w-8 h-8 rounded-full bg-[${themeHex}]/30 animate-ping opacity-60"></div>
        <div class="relative flex items-center justify-center w-10 h-10 rounded-full bg-white shadow-xl border-2 border-[${themeHex}] transition-all duration-300 hover:scale-110">
          <span style="font-size: 16px;">${text}</span>
        </div>
        <div class="absolute -bottom-2 w-0 h-0 border-t-[8px] border-t-white border-x-[6px] border-x-transparent shadow-md"></div>
      </div>
    `,
    className: "custom-leaflet-icon",
    iconSize: [40, 40],
    iconAnchor: [20, 40],
  });
};

const shopIcon = createCustomIcon("blue", "🏪");
const customerIcon = createCustomIcon("red", "👤");
const riderIcon = createCustomIcon("green", "🛵");

// Helper component to auto-fit map view to markers
const FitMapBounds = ({ markers }) => {
  const map = useMap();
  useEffect(() => {
    if (markers && markers.length > 0) {
      const validCoords = markers.filter(m => m && m[0] && m[1]);
      if (validCoords.length > 0) {
        const bounds = L.latLngBounds(validCoords);
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
      }
    }
  }, [markers, map]);
  return null;
};

const ShopTracking = () => {
  const user = useAuthStore((state) => state.user);
  const [shop, setShop] = useState(null);
  const [orders, setOrders] = useState([]);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch shop and active orders
  const loadTrackingData = async () => {
    try {
      const shopRes = await getMyShop();
      if (shopRes.data?.success && shopRes.data?.shop) {
        setShop(shopRes.data.shop);
        
        // Fetch active/dispatched orders for the shop
        const ordersRes = await getShopOwnerOrders({ status: "all" });
        if (ordersRes.data?.success && ordersRes.data?.orders) {
          // Filter for active delivery statuses: Assigned, Accepted, OutForDelivery, dispatched
          const activeOrders = ordersRes.data.orders.filter(o => 
            ["Assigned", "Accepted", "OutForDelivery", "dispatched", "Dispatched"].includes(o.status)
          );
          setOrders(activeOrders);
          
          // Auto select first order if none selected
          if (activeOrders.length > 0 && !selectedOrderId) {
            setSelectedOrderId(activeOrders[0]._id);
          }
        }
      }
    } catch (err) {
      console.error("Failed to load tracking data", err);
      toast.error("Failed to load active orders information");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTrackingData();
    const interval = setInterval(loadTrackingData, 10000); // Poll list every 10s
    return () => clearInterval(interval);
  }, []);

  // Socket setup
  useEffect(() => {
    if (!shop?._id) return;

    const socketUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:4000";
    const socket = io(socketUrl);

    socket.on("connect", () => {
      console.log("[SHOP TRACKING] Connected to socket server");
      socket.emit("join-shop", shop._id);
    });

    // Handle real-time rider location updates
    socket.on("rider:location-update", (data) => {
      console.log("[SHOP TRACKING] Admin receives socket event: rider:location-update", data);
      
      setOrders(prevOrders => 
        prevOrders.map(order => {
          // Update riderLocation for orders assigned to this rider
          if (order.assignedRider && (order.assignedRider._id === data.riderId || order.assignedRider === data.riderId)) {
            return {
              ...order,
              riderLocation: {
                lat: data.latitude,
                lng: data.longitude
              }
            };
          }
          return order;
        })
      );
    });

    // Handle real-time status adjustments
    socket.on("order:status-changed", (updatedOrder) => {
      console.log("[SHOP TRACKING] Order status changed:", updatedOrder);
      toast.success(`Order status changed to: ${updatedOrder.status}`);
      
      // If completed or cancelled, remove from local list
      if (["Delivered", "delivered", "Cancelled", "cancelled"].includes(updatedOrder.status)) {
        setOrders(prev => prev.filter(o => o._id !== updatedOrder._id));
        if (selectedOrderId === updatedOrder._id) {
          setSelectedOrderId(null);
        }
      } else {
        setOrders(prev => prev.map(o => o._id === updatedOrder._id ? { ...o, ...updatedOrder } : o));
      }
    });

    // Handle new assignments
    socket.on("order:new-assigned", (newOrder) => {
      console.log("[SHOP TRACKING] Order assigned:", newOrder);
      if (newOrder.shopId === shop._id || newOrder.shopId?._id === shop._id) {
        setOrders(prev => {
          if (prev.some(o => o._id === newOrder._id)) return prev;
          return [newOrder, ...prev];
        });
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [shop?._id, selectedOrderId]);

  // Selected Order details helper
  const selectedOrder = orders.find(o => o._id === selectedOrderId);

  // Markers helper
  const getMapMarkers = () => {
    const markers = [];
    if (shop?.latitude && shop?.longitude) {
      markers.push([shop.latitude, shop.longitude]);
    }
    if (selectedOrder?.deliveryLocation?.lat && selectedOrder?.deliveryLocation?.lng) {
      markers.push([selectedOrder.deliveryLocation.lat, selectedOrder.deliveryLocation.lng]);
    }
    if (
      ["Accepted", "OutForDelivery", "dispatched", "Dispatched"].includes(selectedOrder?.status) &&
      selectedOrder?.riderLocation?.lat !== undefined &&
      selectedOrder?.riderLocation?.lng !== undefined &&
      selectedOrder?.riderLocation?.lat !== 0 &&
      selectedOrder?.riderLocation?.lng !== 0
    ) {
      markers.push([selectedOrder.riderLocation.lat, selectedOrder.riderLocation.lng]);
    }
    return markers;
  };

  const mapMarkers = getMapMarkers();

  // Draw Polyline paths
  const getPaths = () => {
    const paths = [];
    if (!selectedOrder) return paths;

    const shopCoords = [shop.latitude, shop.longitude];
    const customerCoords = [selectedOrder.deliveryLocation.lat, selectedOrder.deliveryLocation.lng];
    const hasRider = ["Accepted", "OutForDelivery", "dispatched", "Dispatched"].includes(selectedOrder.status) &&
      selectedOrder.riderLocation?.lat !== undefined &&
      selectedOrder.riderLocation?.lng !== undefined &&
      selectedOrder.riderLocation?.lat !== 0 &&
      selectedOrder.riderLocation?.lng !== 0;

    const riderCoords = hasRider ? [selectedOrder.riderLocation.lat, selectedOrder.riderLocation.lng] : null;

    if (hasRider) {
      // Line from shop to rider (courier path)
      paths.push({
        positions: [shopCoords, riderCoords],
        color: "#2563EB",
        dashArray: "6, 6"
      });
      // Line from rider to customer (pending delivery path)
      paths.push({
        positions: [riderCoords, customerCoords],
        color: "#10B981",
        dashArray: "6, 6"
      });
    } else {
      // Direct baseline path from shop to customer
      paths.push({
        positions: [shopCoords, customerCoords],
        color: "#64748B",
        dashArray: "3, 6"
      });
    }

    return paths;
  };

  const pathSegments = getPaths();

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Compass className="w-8 h-8 text-indigo-650" />
            Live Tracking
          </h1>
          <p className="text-slate-500 text-xs font-semibold mt-1">
            Track active orders, courier live coordinates, and dispatch delivery paths in real-time.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch min-h-[580px]">
        {/* Active Orders List */}
        <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm flex flex-col justify-between h-full">
          <div className="space-y-4 flex-1 overflow-y-auto pr-1">
            <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2 pb-3 border-b border-slate-55">
              <Activity className="w-5 h-5 text-indigo-600" />
              Active Shipments ({orders.length})
            </h2>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent mb-3"></div>
                <span className="text-xs font-semibold">Loading orders feed...</span>
              </div>
            ) : orders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400 text-center">
                <AlertCircle className="w-12 h-12 text-slate-300 mb-3" />
                <h3 className="font-bold text-slate-700 text-xs">No Active Deliveries</h3>
                <p className="text-[10px] text-slate-450 mt-1 max-w-[200px] leading-relaxed">
                  Go to "Create Order" to launch a dispatch. Approved riders will claim them.
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[420px] overflow-y-auto">
                {orders.map((order) => {
                  const isActive = order._id === selectedOrderId;
                  return (
                    <button
                      key={order._id}
                      onClick={() => setSelectedOrderId(order._id)}
                      className={`w-full text-left p-4 rounded-2xl border transition-all flex flex-col gap-2 relative ${
                        isActive
                          ? "bg-indigo-50 border-indigo-250 shadow-sm"
                          : "bg-slate-50/50 border-slate-100 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-bold text-slate-850 text-xs truncate max-w-[150px]">{order.customerName}</h4>
                          <span className="font-mono text-[9px] text-slate-400">ID: #{order._id.slice(-6)}</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[8px] font-extrabold uppercase border ${
                          order.status === "Pending" ? "bg-amber-50 text-amber-700 border-amber-200" :
                          order.status === "Assigned" ? "bg-blue-50 text-blue-700 border-blue-200" :
                          order.status === "Accepted" ? "bg-teal-50 text-teal-700 border-teal-200 animate-pulse" :
                          "bg-purple-50 text-purple-700 border-purple-200"
                        }`}>
                          {order.status?.toLowerCase() === "dispatched" ? "Dispatched" : (order.status === "OutForDelivery" ? "Out For Delivery" : order.status)}
                        </span>
                      </div>

                      <p className="text-[10px] text-slate-500 font-semibold truncate italic">
                        {order.orderDetails}
                      </p>

                      <div className="flex items-center gap-1 text-[9px] text-slate-400 font-bold border-t border-slate-100/50 pt-2">
                        <MapPin className="w-3.5 h-3.5 text-slate-450" />
                        <span className="truncate">{order.address?.area}, {order.address?.city}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Live Map Frame */}
        <div className="lg:col-span-2 bg-white border border-slate-100 rounded-3xl p-4 shadow-sm flex flex-col h-full relative overflow-hidden">
          <div className="flex-1 rounded-2xl overflow-hidden h-[420px] relative z-10 border border-slate-100">
            {shop && (
              <MapContainer
                center={[shop.latitude, shop.longitude]}
                zoom={14}
                scrollWheelZoom={true}
                className="h-full w-full"
              >
                <TileLayer
                  attribution='&copy; OpenStreetMap contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {/* Shop Marker */}
                <Marker position={[shop.latitude, shop.longitude]} icon={shopIcon}>
                  <Popup>
                    <div className="p-1 text-center text-xs">
                      <p className="font-extrabold text-blue-650 uppercase">🏪 Dispatch Center</p>
                      <p className="font-semibold text-gray-500 text-[10px] mt-0.5">{shop.shopName}</p>
                    </div>
                  </Popup>
                </Marker>

                {/* Customer Location Marker */}
                {selectedOrder?.deliveryLocation?.lat && selectedOrder?.deliveryLocation?.lng && (
                  <Marker
                    position={[selectedOrder.deliveryLocation.lat, selectedOrder.deliveryLocation.lng]}
                    icon={customerIcon}
                  >
                    <Popup>
                      <div className="p-1 text-xs">
                        <p className="font-extrabold text-red-650 uppercase">👤 Customer Destination</p>
                        <p className="font-semibold text-gray-800 mt-1">{selectedOrder.customerName}</p>
                        <p className="text-[9px] text-gray-500 mt-0.5">{selectedOrder.phone}</p>
                      </div>
                    </Popup>
                  </Marker>
                )}

                {/* Rider Live Marker */}
                {selectedOrder &&
                  ["Accepted", "OutForDelivery", "dispatched", "Dispatched"].includes(selectedOrder.status) &&
                  selectedOrder.riderLocation?.lat !== undefined &&
                  selectedOrder.riderLocation?.lng !== undefined &&
                  selectedOrder.riderLocation?.lat !== 0 &&
                  selectedOrder.riderLocation?.lng !== 0 && (
                    <Marker
                      position={[selectedOrder.riderLocation.lat, selectedOrder.riderLocation.lng]}
                      icon={riderIcon}
                    >
                      <Popup>
                        <div className="p-1 text-xs">
                          <p className="font-extrabold text-green-650 uppercase">🛵 Active Courier</p>
                          <p className="font-semibold text-gray-800 mt-1">
                            {selectedOrder.assignedRider?.name || "Rider Assigned"}
                          </p>
                          <p className="text-[9px] text-gray-500 mt-0.5">
                            Status: <span className="font-bold text-slate-800">{selectedOrder.status}</span>
                          </p>
                        </div>
                      </Popup>
                    </Marker>
                  )}

                {/* Path Lines */}
                {pathSegments.map((seg, idx) => (
                  <Polyline
                    key={idx}
                    positions={seg.positions}
                    pathOptions={{ color: seg.color, dashArray: seg.dashArray, weight: 3 }}
                  />
                ))}

                <FitMapBounds markers={mapMarkers} />
              </MapContainer>
            )}
          </div>

          {/* Quick Stats Panel Below Map */}
          {selectedOrder && (
            <div className="mt-4 p-4 bg-slate-50/50 rounded-2xl border border-slate-100 flex flex-wrap items-center justify-between gap-4 select-none">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-indigo-50 text-indigo-650 rounded-xl">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-800 text-xs">{selectedOrder.customerName}</h3>
                  <span className="text-[9px] text-slate-400 font-bold block mt-0.5 flex items-center gap-1">
                    <Phone className="w-3 h-3" /> {selectedOrder.phone}
                  </span>
                </div>
              </div>

              {selectedOrder.assignedRider ? (
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-green-50 text-green-700 rounded-xl">
                    <Compass className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-800 text-xs">
                      Courier: {selectedOrder.assignedRider.name || "Assigned"}
                    </h3>
                    <span className="text-[9px] text-slate-400 font-bold block mt-0.5 flex items-center gap-1">
                      <Phone className="w-3 h-3" /> {selectedOrder.assignedRider.phone || "No phone"}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 bg-amber-50 border border-amber-100 px-3.5 py-2 rounded-xl text-[10px] font-bold text-amber-700">
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                  Broadcasted — Waiting for acceptance
                </div>
              )}

              <div className="flex items-center gap-3">
                <div className="p-3 bg-slate-900 text-white rounded-xl">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-800 text-xs">Package details</h3>
                  <span className="text-[9px] text-slate-450 italic block mt-0.5 max-w-[150px] truncate">
                    {selectedOrder.orderDetails}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ShopTracking;
