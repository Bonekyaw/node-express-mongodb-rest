const asyncHandler = require("express-async-handler");
const { body, query, validationResult } = require("express-validator");
const { unlink } = require("node:fs/promises");
const path = require("path");

const { ObjectId } = require("mongodb");
const db = require("../utils/database");
const admins = db.collection("admins");
const authorise = require("./../utils/authorise");
const { offset, noCount, cursor } = require("./../utils/paginate");

const { checkUploadFile } = require("./../utils/file");

exports.uploadProfile = asyncHandler(async (req, res, next) => {
  const id = req.adminId;
  const admin = req.admin;
  const image = req.file;
  // console.log("Multiple Images array", req.files);  // For multiple files uploaded

  const adminQuery = { _id: ObjectId.createFromHexString(id) };
  checkUploadFile(image);
  const imageUrl = image.path.replace("\\", "/");

  if (admin.profile) {
    // await unlink(admin.profile); // Delete an old profile image because it accepts just one.
    try {
      await unlink(path.join(__dirname, "..", admin.profile));
    } catch (error) {
      const adminUpdates = {
        $set: admin,
      };
      admin.profile = imageUrl;
      await admins.updateOne(adminQuery, adminUpdates);
    }
  }

  const adminUpdates = {
    $set: admin,
  };
  admin.profile = imageUrl;
  await admins.updateOne(adminQuery, adminUpdates);

  res
    .status(200)
    .json({ message: "Successfully uploaded the image.", profile: imageUrl });
});

exports.index = [
  // Validate and sanitize fields.
  query("page", "Page number must be integer.").isInt({ gt: 0 }).toInt(),
  query("limit", "Limit number must be integer.")
    .isInt({ min: 1, max: 15 })
    .toInt(),

  asyncHandler(async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      // There are errors. Render form again with sanitized values/error messages.
      const err = new Error("Validation failed!");
      err.status = 400;
      return next(err);
    }
    // Authorization - if it is "user" role, no one is allowed.
    // Same as - authorise(true, admin, "super", "manager", "editor")
    // const admin = req.admin;
    // authorise(false, admin, "user");

    const { page, limit } = req.query;
    // const limit = req.query.limit;
    // const cursors = req.query.cursor ?? null;

    const filters = { status: "active" };
    const fields = {
      _id: 1,
      name: 1,
      phone: 1,
      role: 1,
      status: 1,
      lastLogin: 1,
      profile: 1,
      createdAt: 1,
    };
    const sort = { createdAt: -1 };

    const result = await noCount(
      admins,
      page,
      limit,
      filters,
      fields,
      sort
    );
    // const result = await cursor(admins, cursors, limit, filters, fields, sort);
    res.status(200).json(result);
  }),
];

exports.store = asyncHandler(async (req, res, next) => {
  res.json({ success: true });
});

exports.show = (req, res, next) => {
  res.json({ success: true });
};

exports.update = (req, res, next) => {
  res.json({ success: true });
};

exports.destroy = (req, res, next) => {
  res.json({ success: true });
};
