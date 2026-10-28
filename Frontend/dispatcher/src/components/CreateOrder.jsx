import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMapEvents,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import useAuthStore from "../store/authstore";
import API, { getShopLocation } from "../api";
import { 
  Package, 
  User, 
  Phone, 
  MapPin, 
  Search, 
  Navigation, 
  PlusCircle, 
  Check 
} from "lucide-react";
import { toast } from "react-hot-toast";

// ============================
// FIX LEAFLET DEFAULT ICON & DEFINE SHOP ICON
// ============================
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const shopIcon = L.icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Map click event listener
const MapClickHandler = ({ onMapClick }) => {
  useMapEvents({
    click(e) {
      onMapClick([e.latlng.lat, e.latlng.lng]);
    }
  });
  return null;
};

// Map center adjustment
const ChangeMapCenter = ({ center }) => {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.flyTo(center, 15, { duration: 1.2 });
    }
  }, [center]);
  return null;
};

const CreateOrder = () => {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);

  const [selectedPosition, setSelectedPosition] = useState(null);
  const [shopPosition, setShopPosition] = useState(null);
  const [shopDetails, setShopDetails] = useState(null);
  const [mapSearchQuery, setMapSearchQuery] = useState("");
  const [isSearchingMap, setIsSearchingMap] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    customerName: "",
    phone: "",
    pincode: "",
    city: "",
    state: "",
    area: "",
    building: "",
    landmark: "",
    orderDetails: "",
  });

  // Load Shop Location
  useEffect(() => {
    const fetchShopLocation = async () => {
      try {
        const response = user.role === "shop_owner"
          ? await API.get("/api/shop-owner/shop")
          : await getShopLocation();

        if (response.data?.success && response.data?.shop) {
          const shop = response.data.shop;
          setShopDetails(shop);
          if (shop.latitude && shop.longitude) {
            setShopPosition({ lat: shop.latitude, lng: shop.longitude });
          }
        }
      } catch (err) {
        console.error("Failed to load shop location:", err);
      }
    };
    if (user) {
      fetchShopLocation();
    }
  }, [user]);

  const handleReverseGeocode = async (lat, lng) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=en`
      );
      const data = await response.json();
      if (data && data.address) {
        const addr = data.address;
        
        // Construct area locality
        const areaParts = [];
        if (addr.suburb) areaParts.push(addr.suburb);
        if (addr.neighbourhood) areaParts.push(addr.neighbourhood);
        if (addr.road) areaParts.push(addr.road);
        const areaStr = areaParts.join(", ") || addr.amenity || "";

        setFormData((prev) => ({
          ...prev,
          pincode: addr.postcode || prev.pincode || "",
          city: addr.city || addr.town || addr.village || prev.city || "",
          state: addr.state || prev.state || "",
          area: areaStr || prev.area || "",
          building: addr.house_number || addr.building || prev.building || "",
        }));
      }
    } catch (err) {
      console.error("Reverse geocoding failed:", err);
    }
  };

  const handleSearchMapLocation = async () => {
    if (!mapSearchQuery) return;
    setIsSearchingMap(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(mapSearchQuery)}&accept-language=en`
      );
      const data = await response.json();
      if (data && data.length > 0) {
        const first = data[0];
        const lat = parseFloat(first.lat);
        const lng = parseFloat(first.lon);
        setSelectedPosition({ lat, lng });
        handleReverseGeocode(lat, lng);
      } else {
        toast.error("Location not found on map.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Map search failed.");
    } finally {
      setIsSearchingMap(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedPosition) {
      toast.error("Please select a customer delivery location on the map");
      return;
    }

    setSubmitting(true);
    try {
      const latitude = selectedPosition.lat;
      const longitude = selectedPosition.lng;

      const payload = {
        customerName: formData.customerName,
        phone: formData.phone,
        address: {
          pincode: formData.pincode,
          city: formData.city,
          state: formData.state,
          area: formData.area,
          building: formData.building,
          landmark: formData.landmark,
        },
        orderDetails: formData.orderDetails,
        latitude,
        longitude,
      };

      // Admin requires shopId in payload
      if (user.role === "admin") {
        if (!shopDetails?._id) {
          toast.error("No active shop linked to dispatch order");
          setSubmitting(false);
          return;
        }
        payload.shopId = shopDetails._id;
      }

      const url = user.role === "shop_owner"
        ? "/api/shop-owner/orders"
        : "/api/orders";

      await API.post(url, payload);

      toast.success("Order created and broadcasted to available riders!");

      // Reset form
      setFormData({
        customerName: "",
        phone: "",
        pincode: "",
        city: "",
        state: "",
        area: "",
        building: "",
        landmark: "",
        orderDetails: "",
      });
      setSelectedPosition(null);

      // Navigate back to orders list
      navigate(user.role === "shop_owner" ? "/shop/orders" : "/admin/orders");
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || "Failed to create order");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Page Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <PlusCircle className="w-8 h-8 text-blue-600" />
            Create Dispatch Order
          </h1>
          <p className="text-slate-500 text-xs font-semibold mt-1">
            Dispatch orders immediately to available riders. Fill in customer details and pin their delivery spot.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Form Panel */}
        <div className="bg-white border border-slate-100 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
          <h2 className="text-lg font-black text-slate-850 tracking-tight border-b border-slate-100 pb-3 flex items-center gap-2">
            <Package className="w-5 h-5 text-slate-400" />
            Order Details
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Customer Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-450 flex items-center gap-1">
                  <User className="w-3.5 h-3.5" /> Customer Name
                </label>
                <input
                  type="text"
                  name="customerName"
                  placeholder="e.g. John Doe"
                  value={formData.customerName}
                  onChange={handleChange}
                  className="w-full border border-slate-200 p-3 rounded-xl text-xs outline-none bg-slate-50"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-450 flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5" /> Phone Number
                </label>
                <input
                  type="tel"
                  name="phone"
                  placeholder="e.g. 98765 43210"
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full border border-slate-200 p-3 rounded-xl text-xs outline-none bg-slate-50"
                  required
                />
              </div>
            </div>

            {/* Address fields */}
            <div className="border border-slate-100 rounded-2xl p-4 bg-slate-50/50 space-y-4">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Delivery Address Details</span>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold uppercase text-slate-450">Flat / Building Name</label>
                  <input
                    type="text"
                    name="building"
                    placeholder="Plot 10, Flat 3B"
                    value={formData.building}
                    onChange={handleChange}
                    className="w-full border border-slate-200 p-3 rounded-xl text-xs outline-none bg-white"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-bold uppercase text-slate-450">Pincode</label>
                  <input
                    type="text"
                    name="pincode"
                    placeholder="500081"
                    value={formData.pincode}
                    onChange={handleChange}
                    className="w-full border border-slate-200 p-3 rounded-xl text-xs outline-none bg-white"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase text-slate-450">Locality / Area / Street</label>
                <input
                  type="text"
                  name="area"
                  placeholder="Gachibowli, Telecom Nagar"
                  value={formData.area}
                  onChange={handleChange}
                  className="w-full border border-slate-200 p-3 rounded-xl text-xs outline-none bg-white"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold uppercase text-slate-450">City</label>
                  <input
                    type="text"
                    name="city"
                    placeholder="Hyderabad"
                    value={formData.city}
                    onChange={handleChange}
                    className="w-full border border-slate-200 p-3 rounded-xl text-xs outline-none bg-white"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-bold uppercase text-slate-450">State</label>
                  <input
                    type="text"
                    name="state"
                    placeholder="Telangana"
                    value={formData.state}
                    onChange={handleChange}
                    className="w-full border border-slate-200 p-3 rounded-xl text-xs outline-none bg-white"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase text-slate-450">Landmark (Optional)</label>
                <input
                  type="text"
                  name="landmark"
                  placeholder="e.g. Near HDFC Bank"
                  value={formData.landmark}
                  onChange={handleChange}
                  className="w-full border border-slate-200 p-3 rounded-xl text-xs outline-none bg-white"
                />
              </div>
            </div>

            {/* Order Description */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-450">Items Description</label>
              <textarea
                name="orderDetails"
                placeholder="List items to deliver (e.g. 2x Milk Packets, 1x Bread)"
                value={formData.orderDetails}
                onChange={handleChange}
                className="w-full border border-slate-200 p-3 rounded-xl text-xs outline-none bg-slate-50 h-20 resize-none"
                required
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl text-xs uppercase tracking-wider shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer mt-4"
            >
              {submitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  <span>Dispatching Order...</span>
                </>
              ) : (
                <>
                  <span>Dispatch Order</span>
                  <Check className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Map Panel */}
        <div className="bg-white border border-slate-100 rounded-3xl p-6 sm:p-8 shadow-sm space-y-4">
          <h2 className="text-lg font-black text-slate-850 tracking-tight border-b border-slate-100 pb-3 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-slate-400" />
            Set Customer Location
          </h2>

          {selectedPosition ? (
            <div className="bg-emerald-50 border border-emerald-100 p-3.5 rounded-xl text-xs font-semibold text-emerald-800 flex flex-col gap-1.5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5">🟢 Customer Pin Set</span>
                <span className="text-[10px] bg-emerald-200 text-emerald-800 px-2 py-0.5 rounded-full font-bold uppercase">Ready</span>
              </div>
              <p className="text-[10px] text-emerald-600 font-mono font-bold">
                Coordinates: {selectedPosition.lat.toFixed(6)}, {selectedPosition.lng.toFixed(6)}
              </p>
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-100 p-3.5 rounded-xl text-xs font-semibold text-amber-800 flex items-center justify-between shadow-sm">
              <span>⚠️ Map pin selection is mandatory</span>
              <span className="text-[10px] bg-amber-200 text-amber-850 px-2 py-0.5 rounded-full font-bold uppercase">Required</span>
            </div>
          )}

          {/* Search location bar */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Search street, area or landmark..."
                value={mapSearchQuery}
                onChange={(e) => setMapSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSearchMapLocation();
                  }
                }}
                className="w-full border border-slate-200 p-3.5 pl-10 rounded-xl text-xs outline-none bg-slate-50"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-4" />
            </div>
            <button
              type="button"
              onClick={handleSearchMapLocation}
              disabled={isSearchingMap}
              className="bg-slate-950 hover:bg-slate-850 text-white font-bold px-4 py-3 rounded-xl text-xs disabled:bg-slate-450 shrink-0 cursor-pointer"
            >
              {isSearchingMap ? "Searching..." : "Search"}
            </button>
          </div>

          {/* Map */}
          <div className="border border-slate-150 rounded-2xl overflow-hidden h-[380px] relative z-10 shadow-sm">
            <MapContainer
              center={selectedPosition ? [selectedPosition.lat, selectedPosition.lng] : (shopPosition ? [shopPosition.lat, shopPosition.lng] : [17.4483, 78.3915])}
              zoom={14}
              scrollWheelZoom={true}
              className="h-full w-full"
            >
              <TileLayer
                attribution='&copy; OpenStreetMap contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {/* Shop Marker */}
              {shopPosition && (
                <Marker position={[shopPosition.lat, shopPosition.lng]} icon={shopIcon}>
                  <Popup>
                    <div className="p-1 text-center">
                      <p className="font-extrabold text-red-650 text-xs uppercase">🏪 Dispatch Center</p>
                      <p className="text-[9px] text-gray-500 font-semibold mt-0.5">{shopDetails?.shopName}</p>
                    </div>
                  </Popup>
                </Marker>
              )}

              {/* Customer Marker */}
              {selectedPosition && (
                <Marker
                  position={[selectedPosition.lat, selectedPosition.lng]}
                  draggable={true}
                  eventHandlers={{
                    dragend: (e) => {
                      const marker = e.target;
                      const position = marker.getLatLng();
                      setSelectedPosition({ lat: position.lat, lng: position.lng });
                      handleReverseGeocode(position.lat, position.lng);
                    },
                  }}
                >
                  <Popup>
                    <div className="p-1 text-center">
                      <p className="font-extrabold text-blue-600 text-xs uppercase">📍 Customer Location</p>
                      <p className="text-[9px] text-gray-500 font-semibold mt-0.5">Drag to adjust delivery spot</p>
                    </div>
                  </Popup>
                </Marker>
              )}

              <MapClickHandler onMapClick={([lat, lng]) => {
                setSelectedPosition({ lat, lng });
                handleReverseGeocode(lat, lng);
              }} />
              <ChangeMapCenter center={selectedPosition ? [selectedPosition.lat, selectedPosition.lng] : (shopPosition ? [shopPosition.lat, shopPosition.lng] : null)} />
            </MapContainer>
          </div>

          <button
            type="button"
            onClick={() => {
              navigator.geolocation.getCurrentPosition(
                (position) => {
                  const lat = position.coords.latitude;
                  const lng = position.coords.longitude;
                  setSelectedPosition({ lat, lng });
                  handleReverseGeocode(lat, lng);
                },
                (error) => console.error(error),
                { enableHighAccuracy: true }
              );
            }}
            className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold px-4 py-2.5 rounded-xl text-xs border border-slate-200 cursor-pointer"
          >
            <Navigation className="w-3.5 h-3.5 text-blue-600" />
            Auto-fill My Current Location
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateOrder;