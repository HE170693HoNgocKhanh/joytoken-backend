const express = require("express");
const morgan = require("morgan");
const cors = require("cors");
const dotenv = require("dotenv");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const path = require("path");

const db = require("./config/db");
const routes = require("./routers"); // ✅ import router tổng

dotenv.config({
  path: path.resolve(__dirname, "../.env"),
});

// ✅ Kết nối MongoDB
db.connect();

const app = express();

// ✅ Middleware
app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

app.use(session({
  secret: process.env.SESSION_SECRET || "mysecret",
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false },
}));

// ✅ Route test
app.get("/", (req, res) => {
  res.send("🚀 Server running successfully!");
});

// ✅ Import tất cả router (có /auth/login bên trong)
app.use("/api", routes);

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`✅ Server listening on port ${port}`);
});
