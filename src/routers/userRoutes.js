const express = require("express");
const {
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  creatUser,
} = require("../controller/userController");
const router = express.Router();

router.get("/", getAllUsers);
router.post("/", creatUser);
router.get("/:id", getUserById);
router.put("/:id", updateUser);
router.delete("/:id", deleteUser);

module.exports = router;
