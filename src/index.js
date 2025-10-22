const express = require("express");
const morgan = require("morgan");
const cors = require("cors");
const dotenv = require("dotenv");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const path = require("path");

const db = require("./config/db");

dotenv.config({
  path: path.resolve(__dirname, "../.env"),
});

db.connect();

const app = express();

// app.use(morgan("combined"));
app.use(cookieParser());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Hello World!dasdasd");
});

const port = process.env.PORT || 8080;

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
