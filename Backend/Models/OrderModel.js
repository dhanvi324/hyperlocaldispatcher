import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    // =========================
    // SHOP ISOLATION
    // =========================
    shopId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shop",
      required: true,
    },

    // =========================
    // CUSTOMER DETAILS
    // =========================
    customerName: {
      type: String,
      required: true,
    },

    phone: {
      type: String,
      required: true,
    },

    address: {
      pincode: {
        type: String,
        default: "",
      },
      city: {
        type: String,
        default: "",
      },
      state: {
        type: String,
        default: "",
      },
      area: {
        type: String,
        required: true,
      },
      building: {
        type: String,
        required: true,
      },
      landmark: {
        type: String,
        default: "",
      },
    },

    orderDetails: {
      type: String,
      required: true,
    },

    // =========================
    // ORDER STATUS
    // =========================
    status: {
      type: String,
      enum: [
        "Pending",
        "Assigned",
        "Accepted",
        "OutForDelivery",
        "dispatched",
        "Dispatched",
        "Delivered",
        "delivered",
        "Cancelled",
      ],
      default: "Pending",
    },

    // =========================
    // ASSIGNED RIDER
    // =========================
    assignedRider: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // =========================
    // REQUESTED RIDERS (for broadcast)
    // =========================
    requestedRiders: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    acceptedByRider: {
      type: Boolean,
      default: false,
    },

    // =========================
    // RIDER LIVE LOCATION
    // =========================
    riderLocation: {
      lat: {
        type: Number,
        default: 0,
      },
      lng: {
        type: Number,
        default: 0,
      },
    },

    // =========================
    // DELIVERY LOCATION
    // =========================
    deliveryLocation: {
      lat: {
        type: Number,
        default: 0,
      },
      lng: {
        type: Number,
        default: 0,
      },
    },

    deliveryAddress: {
      fullAddress: {
        type: String,
        default: "",
      },
      lat: {
        type: Number,
        default: 0,
      },
      lng: {
        type: Number,
        default: 0,
      },
    },

    deliveredAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

orderSchema.index({ shopId: 1 });
orderSchema.index({ assignedRider: 1 });

export const OrderTypeModel = mongoose.model("order", orderSchema);