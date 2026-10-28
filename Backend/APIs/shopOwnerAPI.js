import express from "express";
import { verifyToken } from "../Middleware/VerifyToken.js";
import { ShopModel, generateShopCode } from "../Models/ShopModel.js";
import { RiderModel } from "../Models/RiderModel.js";
import { OrderTypeModel } from "../Models/OrderModel.js";
import { UserTypeModel } from "../Models/UserModel.js";
import { EarningsModel } from "../Models/EarningsModel.js";

const shopOwnerRouter = express.Router();

// Helper to build full address string
function buildFullAddress(address) {
  if (!address) return "No address details";
  return `${address.building || ""}, ${address.area || ""}, ${address.city || ""}, ${address.state || ""} - ${address.pincode || ""}`;
}

// =============================================
// 1. CREATE SHOP (first login / onboarding)
// =============================================
shopOwnerRouter.post("/shop", verifyToken("shop_owner"), async (req, res) => {
  try {
    const { shopName, address, phone } = req.body;

    if (!shopName) {
      return res.status(400).json({ message: "Shop name is required." });
    }

    // Check if owner already has a shop
    const existingShop = await ShopModel.findOne({ ownerId: req.user.userId });
    if (existingShop) {
      return res.status(400).json({
        message: "You already have a shop.",
        shop: existingShop,
      });
    }

    // Generate unique shop code
    let shopCode;
    let isUnique = false;
    while (!isUnique) {
      shopCode = generateShopCode();
      const exists = await ShopModel.findOne({ shopCode });
      if (!exists) isUnique = true;
    }

    const shop = await ShopModel.create({
      ownerId: req.user.userId,
      shopName,
      shopCode,
      address: address || "",
      phone: phone || "",
      isActive: true,
    });

    res.status(201).json({
      success: true,
      message: "Shop created successfully!",
      shop,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// =============================================
// 2. GET OWN SHOP DETAILS
// =============================================
shopOwnerRouter.get("/shop", verifyToken("shop_owner"), async (req, res) => {
  try {
    const shop = await ShopModel.findOne({ ownerId: req.user.userId });
    if (!shop) {
      return res.status(404).json({ message: "No shop found. Please create your shop first." });
    }
    res.json({ success: true, shop });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// =============================================
// 3. UPDATE SHOP
// =============================================
shopOwnerRouter.put("/shop", verifyToken("shop_owner"), async (req, res) => {
  try {
    const { shopName, address, phone, latitude, longitude } = req.body;
    const shop = await ShopModel.findOne({ ownerId: req.user.userId });
    if (!shop) {
      return res.status(404).json({ message: "Shop not found." });
    }

    if (shopName) shop.shopName = shopName;
    if (address !== undefined) shop.address = address;
    if (phone !== undefined) shop.phone = phone;
    if (latitude !== undefined) shop.latitude = latitude;
    if (longitude !== undefined) shop.longitude = longitude;

    await shop.save();
    res.json({ success: true, message: "Shop updated successfully.", shop });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// =============================================
// 4. GET SHOP CODE (dedicated page)
// =============================================
shopOwnerRouter.get("/shop-code", verifyToken("shop_owner"), async (req, res) => {
  try {
    const shop = await ShopModel.findOne({ ownerId: req.user.userId }).select("shopName shopCode");
    if (!shop) {
      return res.status(404).json({ message: "Shop not found." });
    }
    res.json({ success: true, shopName: shop.shopName, shopCode: shop.shopCode });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// =============================================
// 5. GET RIDERS IN OWN SHOP
// =============================================
shopOwnerRouter.get("/riders", verifyToken("shop_owner"), async (req, res) => {
  try {
    const shop = await ShopModel.findOne({ ownerId: req.user.userId });
    if (!shop) {
      return res.status(404).json({ message: "Shop not found." });
    }

    const riders = await RiderModel.find({ shopId: shop._id, approvalStatus: "Approved" })
      .populate("userId", "name email phone isBlocked isActive")
      .sort({ createdAt: -1 });

    res.json({ success: true, riders });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// =============================================
// 6. GET PENDING RIDER REQUESTS
// =============================================
shopOwnerRouter.get("/rider-requests", verifyToken("shop_owner"), async (req, res) => {
  try {
    const shop = await ShopModel.findOne({ ownerId: req.user.userId });
    if (!shop) {
      return res.status(404).json({ message: "Shop not found." });
    }

    const { status = "Pending" } = req.query;

    const riders = await RiderModel.find({ shopId: shop._id, approvalStatus: status })
      .populate("userId", "name email phone")
      .sort({ createdAt: -1 });

    res.json({ success: true, riders });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// =============================================
// 7. APPROVE RIDER
// =============================================
shopOwnerRouter.patch("/rider/:riderId/approve", verifyToken("shop_owner"), async (req, res) => {
  try {
    const shop = await ShopModel.findOne({ ownerId: req.user.userId });
    if (!shop) return res.status(404).json({ message: "Shop not found." });

    const rider = await RiderModel.findById(req.params.riderId);
    if (!rider) return res.status(404).json({ message: "Rider not found." });

    // Security: Only approve riders belonging to own shop
    if (rider.shopId.toString() !== shop._id.toString()) {
      return res.status(403).json({ message: "Access denied: Rider not in your shop." });
    }

    rider.approvalStatus = "Approved";
    await rider.save();

    res.json({
      success: true,
      message: "Rider approved successfully.",
      rider,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// =============================================
// 8. REJECT RIDER
// =============================================
shopOwnerRouter.patch("/rider/:riderId/reject", verifyToken("shop_owner"), async (req, res) => {
  try {
    const shop = await ShopModel.findOne({ ownerId: req.user.userId });
    if (!shop) return res.status(404).json({ message: "Shop not found." });

    const rider = await RiderModel.findById(req.params.riderId);
    if (!rider) return res.status(404).json({ message: "Rider not found." });

    if (rider.shopId.toString() !== shop._id.toString()) {
      return res.status(403).json({ message: "Access denied: Rider not in your shop." });
    }

    rider.approvalStatus = "Rejected";
    await rider.save();

    res.json({
      success: true,
      message: "Rider rejected.",
      rider,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// =============================================
// 9. GET ORDERS FOR OWN SHOP
// =============================================
shopOwnerRouter.get("/orders", verifyToken("shop_owner"), async (req, res) => {
  try {
    const shop = await ShopModel.findOne({ ownerId: req.user.userId });
    if (!shop) return res.status(404).json({ message: "Shop not found." });

    const { status, search } = req.query;
    let query = { shopId: shop._id };

    if (status && status !== "all") {
      query.status = status;
    }

    if (search) {
      query.$or = [
        { customerName: { $regex: search, $options: "i" } },
        { orderDetails: { $regex: search, $options: "i" } },
        { "address.area": { $regex: search, $options: "i" } },
      ];
    }

    const orders = await OrderTypeModel.find(query)
      .populate("assignedRider", "name email phone")
      .sort({ createdAt: -1 });

    res.json({ success: true, orders });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// =============================================
// 10. CREATE ORDER (Shop Owner)
// =============================================
shopOwnerRouter.post("/orders", verifyToken("shop_owner"), async (req, res) => {
  try {
    const shop = await ShopModel.findOne({ ownerId: req.user.userId });
    if (!shop) return res.status(404).json({ message: "Shop not found. Please create your shop first." });

    const { customerName, phone, address, orderDetails, latitude, longitude } = req.body;

    if (!customerName || !phone || !orderDetails) {
      return res.status(400).json({ message: "customerName, phone, and orderDetails are required." });
    }
    if (!address || !address.area || !address.building) {
      return res.status(400).json({ message: "Address area and building are required." });
    }
    if (!latitude || !longitude) {
      return res.status(400).json({ message: "Customer location (latitude and longitude) is required. Please pin the location on the map." });
    }

    // Broadcast to ALL approved and eligible riders in the shop
    const allApprovedRiders = await RiderModel.find({
      shopId: shop._id,
      approvalStatus: "Approved",
    }).populate({
      path: "userId",
      match: { isBlocked: false, isActive: true },
      select: "_id",
    });

    const eligibleRiders = allApprovedRiders.filter((r) => r.userId != null);
    const riderUserIds = eligibleRiders.map((r) => r.userId._id || r.userId);

    const fullAddress = buildFullAddress(address);

    const order = await OrderTypeModel.create({
      shopId: shop._id,
      customerName,
      phone,
      address,
      orderDetails,
      status: "Pending",
      deliveryLocation: { lat: latitude, lng: longitude },
      deliveryAddress: { fullAddress, lat: latitude, lng: longitude },
      requestedRiders: riderUserIds,
    });

    // Populate assignedRider for socket payload
    const populatedOrder = await OrderTypeModel.findById(order._id)
      .populate("shopId", "shopName address latitude longitude")
      .lean();

    const io = req.app.get("io");
    if (io) {
      // Emit to the shop room (shop owner sees it)
      io.to(`shop:${shop._id}`).emit("order:new", populatedOrder);
      // Emit to admin room so admin dashboard syncs in real time
      io.to("admin-room").emit("order:new", populatedOrder);
      
      // Emit to each individual rider's personal room
      riderUserIds.forEach((riderId) => {
        io.to(`rider:${riderId}`).emit("order:new", populatedOrder);
      });
    }

    res.status(201).json({ success: true, order: populatedOrder, broadcastedTo: riderUserIds.length });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// =============================================
// 11. ASSIGN RIDER TO ORDER
// =============================================
shopOwnerRouter.put("/orders/assign/:orderId", verifyToken("shop_owner"), async (req, res) => {
  try {
    const shop = await ShopModel.findOne({ ownerId: req.user.userId });
    if (!shop) return res.status(404).json({ message: "Shop not found." });

    const order = await OrderTypeModel.findById(req.params.orderId);
    if (!order) return res.status(404).json({ message: "Order not found." });

    // Shop isolation check
    if (order.shopId.toString() !== shop._id.toString()) {
      return res.status(403).json({ message: "Access denied: Order not in your shop." });
    }

    const { riderId } = req.body;

    // Validate rider
    const riderProfile = await RiderModel.findOne({ userId: riderId, shopId: shop._id });
    if (!riderProfile) {
      return res.status(403).json({ message: "Rider does not belong to your shop." });
    }
    if (riderProfile.approvalStatus !== "Approved") {
      return res.status(403).json({ message: "Rider is not approved yet." });
    }

    order.assignedRider = riderId;
    order.status = "Assigned";
    if (!order.requestedRiders.map(id => id.toString()).includes(riderId)) {
      order.requestedRiders.push(riderId);
    }
    await order.save();

    const io = req.app.get("io");
    if (io) {
      io.to(`shop:${shop._id}`).emit("order:new-assigned", order);
    }

    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// =============================================
// 12. DELETE / CANCEL ORDER
// =============================================
shopOwnerRouter.delete("/orders/:orderId", verifyToken("shop_owner"), async (req, res) => {
  try {
    const shop = await ShopModel.findOne({ ownerId: req.user.userId });
    if (!shop) return res.status(404).json({ message: "Shop not found." });

    const order = await OrderTypeModel.findById(req.params.orderId);
    if (!order) return res.status(404).json({ message: "Order not found." });

    if (order.shopId.toString() !== shop._id.toString()) {
      return res.status(403).json({ message: "Access denied: Order not in your shop." });
    }

    // If rider is assigned, free them up
    if (order.assignedRider && ["Assigned", "Accepted", "OutForDelivery"].includes(order.status)) {
      await RiderModel.findOneAndUpdate(
        { userId: order.assignedRider },
        { isAvailable: true }
      );
    }

    await OrderTypeModel.findByIdAndDelete(req.params.orderId);

    const io = req.app.get("io");
    if (io) {
      io.to(`shop:${shop._id}`).emit("order:deleted", { orderId: req.params.orderId });
    }

    res.json({ success: true, message: "Order cancelled successfully." });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// =============================================
// 13. SHOP OWNER DASHBOARD STATS
// =============================================
shopOwnerRouter.get("/stats", verifyToken("shop_owner"), async (req, res) => {
  try {
    const shop = await ShopModel.findOne({ ownerId: req.user.userId });
    if (!shop) return res.status(404).json({ message: "Shop not found." });

    const [
      totalOrders,
      deliveredOrders,
      activeOrders,
      totalRiders,
      pendingRiders,
    ] = await Promise.all([
      OrderTypeModel.countDocuments({ shopId: shop._id }),
      OrderTypeModel.countDocuments({ shopId: shop._id, status: { $in: ["Delivered", "delivered"] } }),
      OrderTypeModel.countDocuments({ shopId: shop._id, status: { $nin: ["Delivered", "delivered", "Cancelled", "cancelled"] } }),
      RiderModel.countDocuments({ shopId: shop._id, approvalStatus: "Approved" }),
      RiderModel.countDocuments({ shopId: shop._id, approvalStatus: "Pending" }),
    ]);

    const recentOrders = await OrderTypeModel.find({ shopId: shop._id })
      .populate("assignedRider", "name")
      .sort({ createdAt: -1 })
      .limit(5);

    const ridersList = await RiderModel.find({ shopId: shop._id, approvalStatus: "Approved" })
      .populate("userId", "name phone isBlocked")
      .limit(5);

    res.json({
      success: true,
      shop,
      totalOrders,
      deliveredOrders,
      activeOrders,
      totalRiders,
      pendingRiders,
      recentOrders,
      ridersList,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// =============================================
// 14. SHOP OWNER RIDER PERFORMANCE ANALYTICS
// =============================================
shopOwnerRouter.get("/rider-analytics", verifyToken("shop_owner"), async (req, res) => {
  try {
    const shop = await ShopModel.findOne({ ownerId: req.user.userId });
    if (!shop) return res.status(404).json({ message: "Shop not found." });

    const riders = await RiderModel.find({ shopId: shop._id, approvalStatus: "Approved" })
      .populate("userId", "name email phone");

    const analytics = await Promise.all(riders.map(async (rider) => {
      const riderId = rider.userId?._id;
      if (!riderId) return null;

      // 1. Fetch completed orders for this rider in this shop
      const completedOrders = await OrderTypeModel.find({
        shopId: shop._id,
        assignedRider: riderId,
        status: { $in: ["Delivered", "delivered"] }
      });

      // 2. Fetch Avg Delivery Time (in minutes)
      let totalDeliveryTime = 0;
      let timedOrdersCount = 0;
      completedOrders.forEach(order => {
        if (order.deliveredAt && order.createdAt) {
          const diffMs = new Date(order.deliveredAt) - new Date(order.createdAt);
          totalDeliveryTime += diffMs / (1000 * 60); // minutes
          timedOrdersCount++;
        }
      });
      const avgDeliveryTime = timedOrdersCount > 0 ? Math.round(totalDeliveryTime / timedOrdersCount) : 0;

      // 3. Fetch Earnings history for this rider to sum distance and amount
      const earnings = await EarningsModel.findOne({ riderId });
      let totalDistance = 0;
      let totalEarnings = 0;
      let activeDays = new Set();

      if (earnings) {
        // Find completed order IDs for this shop to filter earnings history
        const shopCompletedOrderIds = completedOrders.map(o => o._id.toString());
        earnings.history.forEach(item => {
          if (item.orderId && shopCompletedOrderIds.includes(item.orderId.toString())) {
            totalDistance += item.distance || 0;
            totalEarnings += item.amount || 0;
            if (item.date) {
              activeDays.add(new Date(item.date).toISOString().split('T')[0]);
            }
          }
        });
      }

      // 4. Calculate Acceptance Rate
      // Opportunities = total orders created in this shop since rider joined (approximated by rider.createdAt)
      const opportunities = await OrderTypeModel.countDocuments({
        shopId: shop._id,
        createdAt: { $gte: rider.createdAt }
      });
      const acceptedCount = await OrderTypeModel.countDocuments({
        shopId: shop._id,
        assignedRider: riderId,
        status: { $in: ["Assigned", "Accepted", "OutForDelivery", "dispatched", "Dispatched", "Delivered", "delivered"] }
      });
      const acceptanceRate = opportunities > 0 ? Math.round((acceptedCount / opportunities) * 100) : 100;

      // 5. Calculate Completion Rate
      // Completion Rate = Completed Orders / Accepted Orders
      const completionRate = acceptedCount > 0 ? Math.round((completedOrders.length / acceptedCount) * 100) : 100;

      return {
        riderId,
        name: rider.userId.name,
        email: rider.userId.email,
        phone: rider.userId.phone,
        vehicleType: rider.vehicleType,
        completedDeliveries: completedOrders.length,
        totalEarnings,
        totalDistance: Math.round(totalDistance * 100) / 100,
        avgDeliveryTime,
        acceptanceRate: Math.min(100, acceptanceRate),
        completionRate: Math.min(100, completionRate),
        activeDays: activeDays.size,
      };
    }));

    // Filter out nulls
    const filteredAnalytics = analytics.filter(a => a !== null);

    res.json({ success: true, analytics: filteredAnalytics });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default shopOwnerRouter;
