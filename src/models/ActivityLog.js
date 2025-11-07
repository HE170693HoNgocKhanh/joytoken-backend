const mongoose = require("mongoose");

const activityLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    sessionId: {
      type: String,
      index: true,
    },
    eventType: {
      type: String,
      default: "page_view",
    },
    path: {
      type: String,
      required: true,
    },
    title: String,
    referrer: String,
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    userAgent: String,
    device: String,
    ipAddress: String,
  },
  {
    timestamps: true,
  }
);

activityLogSchema.index({ createdAt: 1 });
activityLogSchema.index({ userId: 1, createdAt: 1 });
activityLogSchema.index({ path: 1, createdAt: 1 });

const ActivityLog = mongoose.model("ActivityLog", activityLogSchema);

module.exports = ActivityLog;

