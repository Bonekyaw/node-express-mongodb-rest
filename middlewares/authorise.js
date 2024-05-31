/*
 * Authorization - middleware
 * These two functions are same
 * authorise(true, "super", "manager", "editor") === authorise(false, "user")
 * true means that his role must be one of these.
 * false means that his role must not be one of these.
 */
const { ObjectId } = require("mongodb");
const db = require("../utils/database");
const admins = db.collection("admins");

const authorise = (permission, ...roles) => {
  return async function (req, res, next) {
    const id = req.adminId;
    const adminQuery = { _id: ObjectId.createFromHexString(id) };
    const admin = await admins.findOne(adminQuery);
    if (!admin) {
      const err = new Error("This account has not registered!.");
      err.status = 401;
      return next(err);
    }

    const result = roles.includes(admin.role);

    if (!permission && result) {
      const err = new Error("This action is not allowed.");
      err.status = 403;
      return next(err);
    }

    if (permission && !result) {
      const err = new Error("This action is not allowed.");
      err.status = 403;
      return next(err);
    }
    req.admin = admin;
    next();
  };
};

module.exports = authorise;