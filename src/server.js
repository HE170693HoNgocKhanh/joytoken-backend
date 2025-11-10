const express = require("express");
const morgan = require("morgan");
const cors = require("cors");
const dotenv = require("dotenv");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const path = require("path");
const { Server } = require("socket.io");
const http = require("http");
const chatSocket = require("./socket/chatSocket");

const db = require("./config/db");
const routes = require("./routers"); // ✅ import router tổng

dotenv.config({
  path: path.resolve(__dirname, "../.env"),
});

// ✅ ENV Guards
const requiredEnvs = ["JWT_SECRET", "MONGODB_URI"];
const missing = requiredEnvs.filter((k) => !process.env[k] || String(process.env[k]).trim() === "");
if (missing.length > 0) {
  console.warn(`⚠️ Missing required ENV(s): ${missing.join(", ")}`);
}

const app = express();

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // React frontend
    methods: ["GET", "POST"],
  },
});
db.connect();
chatSocket(io);

// ✅ Middleware
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "mysecret",
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false },
  })
);

// ✅ Serve static files (uploads)
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// ✅ Route test
app.get("/", (req, res) => {
  res.send("🚀 Server running successfully!");
});

// ✅ Import tất cả router (có /auth/login bên trong)
app.use("/api", routes);

// ✅ Error handling
const { notFound, errorHandler } = require("./middleware/errorHandler");
app.use(notFound);
app.use(errorHandler);

const port = process.env.PORT || 8080;
server.listen(port, () => {
  console.log(`✅ Server listening on port ${port}`);
});
