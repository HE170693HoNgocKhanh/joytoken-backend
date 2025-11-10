const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");
const ActivityLog = require("../models/ActivityLog");

dayjs.extend(utc);
dayjs.extend(timezone);

const TIMEZONE = "Asia/Ho_Chi_Minh";

exports.logActivity = async (req, res) => {
  try {
    const {
      sessionId,
      eventType = "page_view",
      path,
      title,
      referrer,
      metadata = {},
    } = req.body;

    if (!path) {
      return res.status(400).json({
        success: false,
        message: "Thiếu đường dẫn truy cập (path)",
      });
    }

    const log = new ActivityLog({
      userId: req.user?._id || null,
      sessionId,
      eventType,
      path,
      title,
      referrer: referrer || req.get("Referer"),
      metadata,
      userAgent: req.get("user-agent"),
      device: metadata.device || null,
      ipAddress:
        req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
        req.socket?.remoteAddress ||
        null,
    });

    await log.save();

    res.json({ success: true });
  } catch (error) {
    console.error("logActivity error", error);
    res.status(500).json({
      success: false,
      message: "Không thể ghi nhận hoạt động",
      error: error.message,
    });
  }
};

exports.getActivityTimeline = async (req, res) => {
  try {
    const granularity = req.query.granularity || "day"; // "day" | "hour"

    let startDate;
    let endDate;

    if (granularity === "hour") {
      const dateParam = req.query.date
        ? dayjs(req.query.date)
        : dayjs().tz(TIMEZONE);
      if (!dateParam.isValid()) {
        return res.status(400).json({
          success: false,
          message: "Ngày không hợp lệ",
        });
      }
      startDate = dateParam.startOf("day");
      endDate = dateParam.endOf("day");
    } else {
      endDate = req.query.endDate
        ? dayjs(req.query.endDate).endOf("day")
        : dayjs().tz(TIMEZONE).endOf("day");
      const rangeDays = parseInt(req.query.range || "7", 10);
      startDate = req.query.startDate
        ? dayjs(req.query.startDate).startOf("day")
        : endDate.subtract(Math.max(rangeDays - 1, 0), "day").startOf("day");
    }

    if (!startDate || !endDate || !startDate.isValid() || !endDate.isValid()) {
      return res.status(400).json({ success: false, message: "Khoảng thời gian không hợp lệ" });
    }

    const matchStage = {
      createdAt: {
        $gte: startDate.toDate(),
        $lte: endDate.toDate(),
      },
    };

    const projectionStage = {
      $project: {
        userId: 1,
        sessionId: 1,
        createdAt: 1,
      },
    };

    let groupStage;
    let timeline = [];

    if (granularity === "hour") {
      groupStage = {
        $group: {
          _id: {
            date: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$createdAt",
                timezone: TIMEZONE,
              },
            },
            hour: {
              $toInt: {
                $dateToString: {
                  format: "%H",
                  date: "$createdAt",
                  timezone: TIMEZONE,
                },
              },
            },
          },
          hits: { $sum: 1 },
          sessions: { $addToSet: "$sessionId" },
          users: { $addToSet: "$userId" },
        },
      };

      const results = await ActivityLog.aggregate([
        { $match: matchStage },
        projectionStage,
        groupStage,
        {
          $project: {
            _id: 0,
            date: "$_id.date",
            hour: "$_id.hour",
            hits: 1,
            sessions: {
              $size: {
                $filter: {
                  input: "$sessions",
                  as: "session",
                  cond: { $ne: ["$$session", null] },
                },
              },
            },
            users: {
              $size: {
                $filter: {
                  input: "$users",
                  as: "user",
                  cond: { $ne: ["$$user", null] },
                },
              },
            },
          },
        },
        { $sort: { date: 1, hour: 1 } },
      ]);

      const resultMap = new Map();
      results.forEach((item) => {
        resultMap.set(`${item.date}-${item.hour}`, item);
      });

      for (let hour = 0; hour < 24; hour++) {
        const key = `${startDate.format("YYYY-MM-DD")}-${hour}`;
        const found = resultMap.get(key);
        timeline.push({
          label: `Giờ ${hour}`,
          hour,
          date: startDate.format("YYYY-MM-DD"),
          hits: found?.hits || 0,
          sessions: found?.sessions || 0,
          users: found?.users || 0,
        });
      }
    } else {
      groupStage = {
        $group: {
          _id: {
            date: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$createdAt",
                timezone: TIMEZONE,
              },
            },
          },
          hits: { $sum: 1 },
          sessions: { $addToSet: "$sessionId" },
          users: { $addToSet: "$userId" },
        },
      };

      const results = await ActivityLog.aggregate([
        { $match: matchStage },
        projectionStage,
        groupStage,
        {
          $project: {
            _id: 0,
            date: "$_id.date",
            hits: 1,
            sessions: {
              $size: {
                $filter: {
                  input: "$sessions",
                  as: "session",
                  cond: { $ne: ["$$session", null] },
                },
              },
            },
            users: {
              $size: {
                $filter: {
                  input: "$users",
                  as: "user",
                  cond: { $ne: ["$$user", null] },
                },
              },
            },
          },
        },
        { $sort: { date: 1 } },
      ]);

      const resultMap = new Map();
      results.forEach((item) => {
        resultMap.set(item.date, item);
      });

      const days = endDate.diff(startDate, "day") + 1;
      for (let i = 0; i < days; i++) {
        const current = startDate.add(i, "day");
        const dateKey = current.format("YYYY-MM-DD");
        const found = resultMap.get(dateKey);
        timeline.push({
          label: current.format("DD/MM"),
          date: dateKey,
          hits: found?.hits || 0,
          sessions: found?.sessions || 0,
          users: found?.users || 0,
        });
      }
    }

    const totals = timeline.reduce(
      (acc, item) => {
        acc.hits += item.hits;
        acc.sessions += item.sessions;
        acc.users += item.users;
        return acc;
      },
      { hits: 0, sessions: 0, users: 0 }
    );

    res.json({
      success: true,
      granularity,
      startDate: startDate.format(),
      endDate: endDate.format(),
      totals,
      data: timeline,
    });
  } catch (error) {
    console.error("getActivityTimeline error", error);
    res.status(500).json({
      success: false,
      message: "Không thể lấy dữ liệu biểu đồ hoạt động",
      error: error.message,
    });
  }
};

