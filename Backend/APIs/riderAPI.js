import express from "express";
import { verifyToken } from "../Middleware/VerifyToken.js";
import { OrderTypeModel } from "../Models/OrderModel.js";
import { RiderModel } from "../Models/RiderModel.js";
import { EarningsModel } from "../Models/EarningsModel.js";
import { ShopModel } from "../Models/ShopModel.js";
import { RiderLocationModel } from "../Models/RiderLocationModel.js";

const riderrouter = express.Router();

// Helper: Haversine distance
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
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// =============================================
// 1. GET AVAILABLE ORDERS (for rider to accept)
// =============================================
riderrouter.get("/available-orders", verifyToken("rider"), async (req, res) => {
  try {
    const riderProfile = await RiderModel.findOne({ userId: req.user.userId });
    if (!riderProfile || riderProfile.approvalStatus !== "Approved") {
      return res.status(403).json({ message: "Rider not approved." });
    }

    const orders = await OrderTypeModel.find({
      shopId: riderProfile.shopId,  // Only orders from rider's shop
      requestedRiders: req.user.userId,
      rejectedRiders: { $ne: req.user.userId },
      acceptedByRider: false,
      status: "Pending",
    })
      .populate("shopId", "shopName shopCode address latitude longitude phone")
      .sort({ createdAt: -1 });

    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// =============================================
// 2. GET MY ORDERS (assigned to this rider)
// =============================================
riderrouter.get("/my-orders", verifyToken("rider"), async (req, res) => {
  try {
    const { status } = req.query;
    let query = { assignedRider: req.user.userId };

    if (status === "delivered") {
      query.status = { $in: ["Delivered", "delivered"] };
    } else if (status === "active") {
      query.status = { $in: ["Assigned", "Accepted", "OutForDelivery", "dispatched", "Dispatched"] };
    } else if (status && status !== "all") {
      query.status = status;
    } else {
      // Default: active orders
      query.status = { $in: ["Assigned", "Accepted", "OutForDelivery", "dispatched", "Dispatched"] };
    }

    const orders = await OrderTypeModel.find(query)
      .populate("shopId", "shopName shopCode address latitude longitude phone")
      .sort({ updatedAt: -1, createdAt: -1 });

    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// =============================================
// 3. RESPOND TO ORDER (accept or reject)
// =============================================
riderrouter.put("/respond-order/:orderId", verifyToken("rider"), async (req, res) => {
  try {
    const riderProfile = await RiderModel.findOne({ userId: req.user.userId });
    if (!riderProfile || riderProfile.approvalStatus !== "Approved") {
      return res.status(403).json({ message: "Rider not approved." });
    }

    const { action } = req.body;

    if (action === "accept") {
      // ATOMIC ACCEPT — prevents race conditions
      // Only update if: order is still Pending AND not yet accepted by another rider
      const order = await OrderTypeModel.findOneAndUpdate(
        {
          _id: req.params.orderId,
          acceptedByRider: false,
          status: "Pending",
          requestedRiders: req.user.userId,
          shopId: riderProfile.shopId,
        },
        {
          $set: {
            assignedRider: req.user.userId,
            acceptedByRider: true,
            status: "Accepted",
            requestedRiders: [],
          },
        },
        { new: true }
      );

      if (!order) {
        return res.status(400).json({ message: "Order already accepted by another rider or no longer available." });
      }

      // Mark rider busy
      await RiderModel.findOneAndUpdate({ userId: req.user.userId }, { isAvailable: false });

      // Populate shop and rider for socket
      const populatedOrder = await OrderTypeModel.findById(order._id)
        .populate("shopId", "shopName shopCode address latitude longitude phone")
        .populate("assignedRider", "name email phone")
        .lean();

      const io = req.app.get("io");
      if (io) {
        // Notify shop room, admin room, rider personal room, and all clients
        io.to(`shop:${order.shopId}`).to("admin-room").emit("order:status-changed", populatedOrder);
        io.to(`rider:${req.user.userId}`).emit("order:status-changed", populatedOrder);
        io.emit("order:status-changed", populatedOrder);

        // Tell all other requestedRiders to remove this order from available list
        io.to(`shop:${order.shopId}`).to("admin-room").emit("order:accepted", { orderId: order._id, acceptedBy: req.user.userId });
        io.emit("order:accepted", { orderId: order._id, acceptedBy: req.user.userId });
      }

      return res.json({ success: true, order: populatedOrder });

    } else if (action === "reject") {
      const order = await OrderTypeModel.findById(req.params.orderId);
      if (!order) return res.status(404).json({ message: "Order not found" });
      if (order.acceptedByRider) return res.status(400).json({ message: "Order already accepted" });

      // Atomically remove from requestedRiders and add to rejectedRiders
      await OrderTypeModel.findByIdAndUpdate(req.params.orderId, {
        $pull: { requestedRiders: req.user.userId },
        $addToSet: { rejectedRiders: req.user.userId },
      });

      return res.json({ success: true, message: "Order rejected" });
    } else {
      return res.status(400).json({ message: "Invalid action" });
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// =============================================
// 4. UPDATE ORDER STATUS (rider only)
// =============================================
riderrouter.put("/update-status/:orderId", verifyToken("rider"), async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ["Accepted", "OutForDelivery", "dispatched", "Dispatched", "Delivered", "delivered"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: `Invalid status. Must be one of: ${validStatuses.join(", ")}` });
    }

    const order = await OrderTypeModel.findById(req.params.orderId);
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (order.assignedRider?.toString() !== req.user.userId) {
      return res.status(403).json({ message: "Not your order" });
    }

    const prevStatus = order.status;
    const isDispatched = ["outfordelivery", "dispatched"].includes(status?.toLowerCase());
    const isDelivered = status?.toLowerCase() === "delivered";
    const wasDelivered = prevStatus?.toLowerCase() === "delivered";

    // Validate state transitions
    if (isDispatched && !["Accepted", "accepted", "Assigned", "assigned", "dispatched", "OutForDelivery"].includes(prevStatus)) {
      return res.status(400).json({ message: `Cannot start delivery from status: ${prevStatus}` });
    }

    if (isDelivered && !["outfordelivery", "dispatched"].includes(prevStatus?.toLowerCase())) {
      return res.status(400).json({ message: "Cannot mark order as delivered before starting delivery." });
    }

    order.status = status;

    if (isDelivered && !wasDelivered) {
      const riderId = req.user.userId;
      await RiderModel.findOneAndUpdate({ userId: riderId }, { isAvailable: true });

      await RiderLocationModel.deleteOne({ riderId });
      order.riderLocation = { lat: 0, lng: 0 };
      order.deliveredAt = new Date();

      // Earnings calculation
      const shop = await ShopModel.findById(order.shopId);
      let distance = 0;
      let calculatedAmount = 30; // base fare
      if (shop && order.deliveryLocation?.lat && order.deliveryLocation.lat !== 0) {
        const rawDist = calculateDistance(
          shop.latitude, shop.longitude,
          order.deliveryLocation.lat, order.deliveryLocation.lng
        );
        distance = Math.round(rawDist * 100) / 100;
        // ₹30 base + ₹15 per km
        calculatedAmount = Math.max(30, Math.round(30 + distance * 15));
      }

      let earnings = await EarningsModel.findOne({ riderId });
      if (!earnings) {
        earnings = new EarningsModel({
          riderId,
          completedOrders: 1,
          totalEarnings: calculatedAmount,
          history: [{
            orderId: order._id,
            customerName: order.customerName,
            amount: calculatedAmount,
            distance,
            date: new Date()
          }]
        });
      } else {
        const alreadyLogged = earnings.history.some(
          (item) => item.orderId?.toString() === order._id.toString()
        );
        if (!alreadyLogged) {
          earnings.completedOrders += 1;
          earnings.totalEarnings += calculatedAmount;
          earnings.history.push({
            orderId: order._id,
            customerName: order.customerName,
            amount: calculatedAmount,
            distance,
            date: new Date()
          });
        }
      }
      await earnings.save();
      await RiderModel.findOneAndUpdate(
        { userId: riderId },
        { $inc: { earnings: calculatedAmount } }
      );
    }

    if (isDispatched && order.assignedRider) {
      await RiderModel.findOneAndUpdate({ userId: order.assignedRider }, { isAvailable: false });
    }

    await order.save();

    // Populate shop and assignedRider for full context in socket event
    const populatedOrder = await OrderTypeModel.findById(order._id)
      .populate("shopId", "shopName shopCode address latitude longitude phone")
      .populate("assignedRider", "name phone email")
      .lean();

    const io = req.app.get("io");
    if (io) {
      io.to(`shop:${order.shopId}`).to("admin-room").emit("order:status-changed", populatedOrder);
      // Also emit to rider's personal room and all clients
      io.to(`rider:${req.user.userId}`).emit("order:status-changed", populatedOrder);
      io.emit("order:status-changed", populatedOrder);
    }

    res.json(populatedOrder);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// =============================================
// 5. UPDATE LIVE LOCATION
// =============================================
riderrouter.put("/update-location/:orderId", verifyToken("rider"), async (req, res) => {
  try {
    const { lat, lng } = req.body;
    const order = await OrderTypeModel.findById(req.params.orderId);

    if (!order) return res.status(404).json({ message: "Order not found" });
    if (order.assignedRider?.toString() !== req.user.userId) {
      return res.status(403).json({ message: "Not your order" });
    }
    if (order.status === "Delivered") {
      return res.status(400).json({ message: "Order already delivered" });
    }

    order.riderLocation = { lat, lng };
    await order.save();

    // Update RiderLocationModel
    await RiderLocationModel.findOneAndUpdate(
      { riderId: req.user.userId },
      { latitude: lat, longitude: lng, orderId: order._id, shopId: order.shopId, updatedAt: new Date() },
      { new: true, upsert: true }
    );

    const io = req.app.get("io");
    if (io) {
      console.log(`[BACKEND] Backend emits socket event: rider:location-update for rider ${req.user.userId}`);
      io.to(`shop:${order.shopId}`).emit("rider:location-update", {
        riderId: req.user.userId,
        latitude: lat,
        longitude: lng,
        orderId: order._id,
        shopId: order.shopId,
      });
    }

    res.json({ message: "Live location updated", order });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// =============================================
// 6. JOIN SHOP (by shop code)
// =============================================
riderrouter.post("/join-shop", verifyToken("rider"), async (req, res) => {
  try {
    const { shopCode } = req.body;
    if (!shopCode) {
      return res.status(400).json({ message: "Shop code is required." });
    }

    const shop = await ShopModel.findOne({ shopCode: shopCode.trim().toUpperCase() });
    if (!shop) {
      return res.status(404).json({ message: "Invalid shop code. Please contact your shop owner." });
    }

    // Update or create Rider profile
    const rider = await RiderModel.findOneAndUpdate(
      { userId: req.user.userId },
      { 
        shopId: shop._id, 
        approvalStatus: "Pending",
        isAvailable: true 
      },
      { new: true, upsert: true }
    );

    res.json({
      success: true,
      message: "Join request submitted. Awaiting shop owner approval.",
      rider,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default riderrouter;