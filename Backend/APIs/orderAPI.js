import express from "express";
import { verifyToken } from "../Middleware/VerifyToken.js";
import { OrderTypeModel } from "../Models/OrderModel.js";
import { RiderModel } from "../Models/RiderModel.js";
import { EarningsModel } from "../Models/EarningsModel.js";
import { ShopModel } from "../Models/ShopModel.js";
import { RiderLocationModel } from "../Models/RiderLocationModel.js";

const router = express.Router();

// Helper: Haversine distance in km
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// =============================================
// 1. GET ALL ORDERS (Admin: all | ShopOwner: filtered | Rider: own)
// =============================================
router.get("/", verifyToken("admin", "shop_owner", "rider"), async (req, res) => {
  try {
    const { status, search } = req.query;
    let query = {};

    // SHOP OWNER: only own shop orders
    if (req.user.role === "shop_owner") {
      const shop = await ShopModel.findOne({ ownerId: req.user.userId });
      if (!shop) return res.status(404).json({ message: "Shop not found." });
      query.shopId = shop._id;
    }

    // RIDER: only own assigned orders
    if (req.user.role === "rider") {
      query.$or = [
        { assignedRider: req.user.userId },
        { requestedRiders: req.user.userId },
      ];
    }

    if (status && status !== "all") {
      query.status = status;
    }

    if (search) {
      const searchCondition = [
        { customerName: { $regex: search, $options: "i" } },
        { orderDetails: { $regex: search, $options: "i" } },
        { "address.area": { $regex: search, $options: "i" } },
      ];
      query.$or = searchCondition;
    }

    const orders = await OrderTypeModel.find(query)
      .populate("assignedRider", "name email phone")
      .populate("shopId", "shopName shopCode")
      .sort({ createdAt: -1 });

    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// =============================================
// 2. CREATE ORDER (Admin only - legacy)
// =============================================
router.post("/", verifyToken("admin"), async (req, res) => {
  try {
    const { customerName, phone, address, orderDetails, latitude, longitude, shopId } = req.body;

    if (!shopId) {
      return res.status(400).json({ message: "shopId is required for admin order creation." });
    }

    const availableRiders = await RiderModel.find({
      shopId,
      approvalStatus: "Approved",
      isAvailable: true,
    }).populate({
      path: "userId",
      match: { isBlocked: false, isActive: true },
      select: "_id",
    });

    const eligibleRiders = availableRiders.filter((r) => r.userId != null);
    const riderUserIds = eligibleRiders.map((r) => r.userId._id || r.userId);

    const fullAddress = address
      ? `${address.building || ""}, ${address.area || ""}, ${address.city || ""}, ${address.state || ""} - ${address.pincode || ""}`
      : "No address details";

    const order = await OrderTypeModel.create({
      shopId,
      customerName,
      phone,
      address,
      orderDetails,
      status: "Pending",
      deliveryLocation: { lat: latitude || 0, lng: longitude || 0 },
      deliveryAddress: { fullAddress, lat: latitude || 0, lng: longitude || 0 },
      requestedRiders: riderUserIds,
      rejectedRiders: [],
      acceptedByRider: false,
      assignedRider: null,
    });

    const populatedOrder = await OrderTypeModel.findById(order._id)
      .populate("shopId", "shopName shopCode address latitude longitude phone")
      .lean();

    const io = req.app.get("io");
    if (io) {
      io.to(`shop:${shopId}`).emit("order:new", populatedOrder);
      io.to("admin-room").emit("order:new", populatedOrder);
      riderUserIds.forEach((riderId) => {
        io.to(`rider:${riderId}`).emit("order:new", populatedOrder);
      });
      io.emit("order:new", populatedOrder);
    }

    res.status(201).json({ success: true, order: populatedOrder, availableRiders: eligibleRiders });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// =============================================
// 3. EDIT ORDER (Admin & ShopOwner)
// =============================================
router.put("/:id", verifyToken("admin", "shop_owner"), async (req, res) => {
  try {
    const order = await OrderTypeModel.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    // Shop Owner isolation
    if (req.user.role === "shop_owner") {
      const shop = await ShopModel.findOne({ ownerId: req.user.userId });
      if (!shop || order.shopId.toString() !== shop._id.toString()) {
        return res.status(403).json({ message: "Access denied." });
      }
    }

    const { customerName, phone, address, orderDetails, latitude, longitude } = req.body;
    if (customerName) order.customerName = customerName;
    if (phone) order.phone = phone;
    if (address) order.address = address;
    if (orderDetails) order.orderDetails = orderDetails;
    if (latitude !== undefined) { order.deliveryLocation.lat = latitude; if (order.deliveryAddress) order.deliveryAddress.lat = latitude; }
    if (longitude !== undefined) { order.deliveryLocation.lng = longitude; if (order.deliveryAddress) order.deliveryAddress.lng = longitude; }

    await order.save();

    const io = req.app.get("io");
    if (io) io.to(`shop:${order.shopId}`).emit("order:status-changed", order);

    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// =============================================
// 4. DELETE ORDER (Admin & ShopOwner)
// =============================================
router.delete("/:id", verifyToken("admin", "shop_owner"), async (req, res) => {
  try {
    const order = await OrderTypeModel.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (req.user.role === "shop_owner") {
      const shop = await ShopModel.findOne({ ownerId: req.user.userId });
      if (!shop || order.shopId.toString() !== shop._id.toString()) {
        return res.status(403).json({ message: "Access denied." });
      }
    }

    if (order.assignedRider && ["Assigned", "Accepted", "OutForDelivery"].includes(order.status)) {
      await RiderModel.findOneAndUpdate({ userId: order.assignedRider }, { isAvailable: true });
    }

    await OrderTypeModel.findByIdAndDelete(req.params.id);

    const io = req.app.get("io");
    if (io) io.to(`shop:${order.shopId}`).emit("order:deleted", { orderId: req.params.id });

    res.json({ success: true, message: "Order deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// =============================================
// 5. ASSIGN RIDER (Admin & ShopOwner)
// =============================================
router.put("/assign/:id", verifyToken("admin", "shop_owner"), async (req, res) => {
  try {
    const { riderId } = req.body;
    const order = await OrderTypeModel.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    // Shop Owner isolation
    if (req.user.role === "shop_owner") {
      const shop = await ShopModel.findOne({ ownerId: req.user.userId });
      if (!shop || order.shopId.toString() !== shop._id.toString()) {
        return res.status(403).json({ message: "Access denied." });
      }
      // Validate rider is in the same shop
      const riderProfile = await RiderModel.findOne({ userId: riderId, shopId: shop._id });
      if (!riderProfile) {
        return res.status(403).json({ message: "Rider does not belong to your shop." });
      }
      if (riderProfile.approvalStatus !== "Approved") {
        return res.status(403).json({ message: "Rider is not approved." });
      }
    }

    order.assignedRider = riderId;
    order.status = "Assigned";
    if (!order.requestedRiders.map(id => id.toString()).includes(riderId)) {
      order.requestedRiders.push(riderId);
    }
    await order.save();

    const io = req.app.get("io");
    if (io) io.to(`shop:${order.shopId}`).emit("order:new-assigned", order);

    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// =============================================
// 6. UPDATE ORDER STATUS (Admin, ShopOwner, Rider)
// =============================================
router.put("/status/:id", verifyToken("admin", "shop_owner", "rider"), async (req, res) => {
  try {
    const { status } = req.body;
    const order = await OrderTypeModel.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    // Rider: must be assigned to this order
    if (req.user.role === "rider" && order.assignedRider?.toString() !== req.user.userId) {
      return res.status(403).json({ message: "Access denied. Order not assigned to you." });
    }

    // Shop Owner: must be own shop
    if (req.user.role === "shop_owner") {
      const shop = await ShopModel.findOne({ ownerId: req.user.userId });
      if (!shop || order.shopId.toString() !== shop._id.toString()) {
        return res.status(403).json({ message: "Access denied." });
      }
    }

    const prevStatus = order.status;
    const isDispatched = ["outfordelivery", "dispatched"].includes(status?.toLowerCase());
    const isDelivered = status?.toLowerCase() === "delivered";
    const wasDelivered = prevStatus?.toLowerCase() === "delivered";

    // Validate state transitions for rider
    if (req.user.role === "rider") {
      if (isDispatched && !["Accepted", "accepted", "Assigned", "assigned", "dispatched", "OutForDelivery"].includes(prevStatus)) {
        return res.status(400).json({ message: `Cannot start delivery from status: ${prevStatus}` });
      }
      if (isDelivered && !["outfordelivery", "dispatched"].includes(prevStatus?.toLowerCase())) {
        return res.status(400).json({ message: "Cannot mark order as delivered before starting delivery." });
      }
    }

    order.status = status;

    // DELIVERED logic
    if (isDelivered && !wasDelivered) {
      const riderId = order.assignedRider || req.user.userId;

      // Mark rider available
      await RiderModel.findOneAndUpdate({ userId: riderId }, { isAvailable: true });

      // Clean location
      await RiderLocationModel.deleteOne({ riderId });
      order.riderLocation = { lat: 0, lng: 0 };
      order.deliveredAt = new Date();

      // Calculate earnings
      const shop = await ShopModel.findById(order.shopId);
      let distance = 0;
      let calculatedAmount = 50;

      if (shop && order.deliveryLocation?.lat && order.deliveryLocation?.lat !== 0) {
        const rawDist = calculateDistance(
          shop.latitude, shop.longitude,
          order.deliveryLocation.lat, order.deliveryLocation.lng
        );
        distance = Math.round(rawDist * 100) / 100;
        calculatedAmount = Math.max(30, Math.round(distance * 15));
      }

      // Update EarningsModel
      let earnings = await EarningsModel.findOne({ riderId });
      if (!earnings) {
        earnings = new EarningsModel({
          riderId,
          completedOrders: 1,
          totalEarnings: calculatedAmount,
          history: [{ orderId: order._id, customerName: order.customerName, amount: calculatedAmount, distance, date: new Date() }],
        });
      } else {
        const alreadyLogged = earnings.history.some(item => item.orderId?.toString() === order._id.toString());
        if (!alreadyLogged) {
          earnings.completedOrders += 1;
          earnings.totalEarnings += calculatedAmount;
          earnings.history.push({ orderId: order._id, customerName: order.customerName, amount: calculatedAmount, distance, date: new Date() });
        }
      }
      await earnings.save();

      // Also update RiderModel earnings
      await RiderModel.findOneAndUpdate({ userId: riderId }, { $inc: { earnings: calculatedAmount } });
    }

    if (isDispatched && order.assignedRider) {
      await RiderModel.findOneAndUpdate({ userId: order.assignedRider }, { isAvailable: false });
    }

    await order.save();

    const populatedOrder = await OrderTypeModel.findById(order._id)
      .populate("shopId", "shopName shopCode address latitude longitude phone")
      .populate("assignedRider", "name phone email")
      .lean();

    const io = req.app.get("io");
    if (io) {
      io.to(`shop:${order.shopId}`).to("admin-room").emit("order:status-changed", populatedOrder);
      if (order.assignedRider) {
        io.to(`rider:${order.assignedRider._id || order.assignedRider}`).emit("order:status-changed", populatedOrder);
      }
      io.emit("order:status-changed", populatedOrder);
    }

    res.json({ success: true, order: populatedOrder });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
