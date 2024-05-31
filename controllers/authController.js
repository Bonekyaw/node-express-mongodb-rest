require("dotenv").config();

const asyncHandler = require("express-async-handler");
const { body, validationResult } = require("express-validator");
// const { v4: uuidv4 } = require("uuid");
const moment = require("moment");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const { ObjectId } = require("mongodb");

// const mongo = new MongoClient(process.env.MONGO_URL);    // Mongodb Atlas
// const mongo = new MongoClient(process.env.MONGO_URI);       // localhost

// const db = mongo.db("lucky");

const db = require("../utils/database");
const admins = db.collection("admins");
const otps = db.collection("otps");

const {
  checkPhoneExist,
  checkPhoneIfNotExist,
  checkOtpErrorIfSameDate,
  checkOtpPhone,
  checkAdmin,
} = require("../utils/auth");

exports.register = asyncHandler(async (req, res, next) => {
  const phone = req.body.phone;

  let phoneQuery = { phone: phone };

  let admin = await admins.findOne(phoneQuery);
  checkPhoneExist(admin);

  // OTP processing eg. Sending OTP request to Operator
  let otpCheck = await otps.findOne(phoneQuery);
  let otpQuery;
  let otpUpdates;

  const token = rand() + rand();
  if (!otpCheck) {
    const otpDoc = {
      phone: phone,
      otp: "123456", // fake OTP
      rememberToken: token,
      count: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await otps.insertOne(otpDoc);
  } else {
    otpQuery = { _id: ObjectId.createFromHexString(otpCheck._id) };
    otpUpdates = {
      $set: otpCheck,
    };

    const lastRequest = new Date(otpCheck.updatedAt).toLocaleDateString();
    const isSameDate = lastRequest == new Date().toLocaleDateString();

    checkOtpErrorIfSameDate(isSameDate, otpCheck);

    if (!isSameDate) {
      otpCheck.otp = "123456"; // Should replace new OTP
      otpCheck.rememberToken = token;
      otpCheck.count = 1;
      otpCheck.error = 0; // reset error count
      otpCheck.updatedAt = new Date();

      await otps.updateOne(otpQuery, otpUpdates);
    } else {
      if (otpCheck.count === 3) {
        const err = new Error(
          "OTP requests are allowed only 3 times per day. Please try again tomorrow,if you reach the limit."
        );
        err.status = 405;
        return next(err);
      } else {
        otpCheck.otp = "123456"; // Should replace new OTP
        otpCheck.rememberToken = token;
        otpCheck.count += 1;
        otpCheck.updatedAt = new Date();

        await otps.updateOne(otpQuery, otpUpdates);
      }
    }
  }

  res.status(200).json({
    message: `We are sending OTP to 09${phone}.`,
    phone,
    token,
  });
});

exports.verifyOTP = [
  // Validate and sanitize fields.
  body("token", "Token must not be empty.").trim().notEmpty().escape(),
  body("phone", "Invalid Phone Number.")
    .trim()
    .notEmpty()
    .matches("^[0-9]+$")
    .isLength({ min: 5, max: 12 })
    .escape(),
  body("otp", "OTP is not invalid.")
    .trim()
    .notEmpty()
    .matches("^[0-9]+$")
    .isLength({ min: 6, max: 6 })
    .escape(),

  asyncHandler(async (req, res, next) => {
    // Extract the validation errors from a request.
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      // There are errors. Render form again with sanitized values/error messages.
      const err = new Error("Validation failed!");
      err.status = 400;
      return next(err);
    }
    const { token, phone, otp } = req.body;

    let phoneQuery = { phone: phone };
    let admin = await admins.findOne(phoneQuery);
    checkPhoneExist(admin);

    let otpCheck = await otps.findOne(phoneQuery);

    checkOtpPhone(otpCheck);

    const otpQuery = { _id: ObjectId.createFromHexString(otpCheck._id) };
    const otpUpdates = {
      $set: otpCheck,
    };

    // Wrong OTP allowed 5 times per day
    const lastRequest = new Date(otpCheck.updatedAt).toLocaleDateString();
    const isSameDate = lastRequest == new Date().toLocaleDateString();
    checkOtpErrorIfSameDate(isSameDate, otpCheck);

    if (otpCheck.rememberToken !== token) {
      otpCheck.error = 5;

      await otps.updateOne(otpQuery, otpUpdates);

      const err = new Error("Token is invalid.");
      err.status = 400;
      return next(err);
    }

    const difference = moment() - moment(otpCheck.updatedAt);
    // console.log("Diff", difference);

    if (difference > 90000) {
      // will expire after 1 min 30 sec
      const err = new Error("OTP is expired.");
      err.status = 403;
      return next(err);
    }

    if (otpCheck.otp !== otp) {
      // ----- Starting to record wrong times --------
      if (!isSameDate) {
        otpCheck.error = 1;
      } else {
        if (otpCheck.error) {
          // because NaN issue
          otpCheck.error += 1;
        } else {
          otpCheck.error = 1;
        }
      }
      await otps.updateOne(otpQuery, otpUpdates);
      // ----- Ending -----------
      const err = new Error("OTP is incorrect.");
      err.status = 401;
      return next(err);
    }

    const randomToken = rand() + rand() + rand();
    otpCheck.otp = "123456"; // Should replace new OTP
    otpCheck.verifyToken = randomToken;
    otpCheck.count = 1;
    otpCheck.error = 1; // reset error count
    otpCheck.updatedAt = new Date();

    await otps.updateOne(otpQuery, otpUpdates);

    res.status(200).json({
      message: "Successfully OTP is verified",
      phone: phone,
      token: randomToken,
    });
  }),
];

exports.confirmPassword = [
  // Validate and sanitize fields.
  body("token", "Token must not be empty.").trim().notEmpty().escape(),
  body("phone", "Invalid Phone Number.")
    .trim()
    .notEmpty()
    .matches("^[0-9]+$")
    .isLength({ min: 5, max: 12 })
    .escape(),
  body("password", "Password must be 8 digits.")
    .trim()
    .notEmpty()
    .matches("^[0-9]+$")
    .isLength({ min: 8, max: 8 })
    .escape(),

  asyncHandler(async (req, res, next) => {
    // Extract the validation errors from a request.
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      // There are errors. Render form again with sanitized values/error messages.
      const err = new Error("Validation failed!");
      err.status = 400;
      return next(err);
    }
    const { token, phone, password } = req.body;

    let phoneQuery = { phone: phone };
    let admin = await admins.findOne(phoneQuery);

    checkPhoneExist(admin);

    let otpCheck = await otps.findOne(phoneQuery);

    checkOtpPhone(otpCheck);

    if (otpCheck.error === 5) {
      const err = new Error(
        "This request may be an attack. If not, try again tomorrow."
      );
      err.status = 401;
      return next(err);
    }

    const otpQuery2 = { _id: ObjectId.createFromHexString(otpCheck._id) };
    const otpUpdates2 = {
      $set: otpCheck,
    };

    if (otpCheck.verifyToken !== token) {
      otpCheck.error = 5;

      await otps.updateOne(otpQuery2, otpUpdates2);

      const err = new Error("Token is invalid.");
      err.status = 400;
      return next(err);
    }

    const difference = moment() - moment(otpCheck.updatedAt);
    // console.log("Diff", difference);

    if (difference > 300000) {
      // will expire after 5 min
      const err = new Error("Your request is expired. Please try again.");
      err.status = 403;
      return next(err);
    }

    const salt = await bcrypt.genSalt(10);
    const hashPassword = await bcrypt.hash(password, salt);
    const randToken = rand() + rand() + rand();

    const adminDoc = {
      phone: req.body.phone,
      password: hashPassword,
      randToken: randToken,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const newAdmin = await admins.insertOne(adminDoc);

    // jwt token
    let payload = { id: newAdmin.insertedId };
    const jwtToken = jwt.sign(payload, process.env.TOKEN_SECRET, {
      expiresIn: "1h",
    });

    res.status(201).json({
      message: "Successfully created an account.",
      token: jwtToken,
      user_id: newAdmin.insertedId,
      randomToken: randToken,
    });
  }),
];

exports.login = [
  // Validate and sanitize fields.
  body("password", "Password must be 8 digits.")
    .trim()
    .notEmpty()
    .matches("^[0-9]+$")
    .isLength({ min: 8, max: 8 })
    .escape(),

  asyncHandler(async (req, res, next) => {
    // Extract the validation errors from a request.
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      // There are errors. Render form again with sanitized values/error messages.
      const err = new Error("Validation failed!");
      err.status = 400;
      return next(err);
    }

    const { phone, password } = req.body;

    let findAdminQuery = { phone: phone };
    let admin = await admins.findOne(findAdminQuery);

    checkPhoneIfNotExist(admin);

    // Wrong Password allowed 3 times per day
    if (admin.status === "freeze") {
      const err = new Error(
        "Your account is temporarily locked. Please contact us."
      );
      err.status = 401;
      return next(err);
    }

    const adminQuery = { _id: admin._id };
    const adminUpdates = {
      $set: admin,
    };

    const isEqual = await bcrypt.compare(password, admin.password);
    if (!isEqual) {
      // ----- Starting to record wrong times --------
      const lastRequest = new Date(admin.updatedAt).toLocaleDateString();
      const isSameDate = lastRequest == new Date().toLocaleDateString();

      if (!isSameDate) {
        admin.error = 1;
      } else {
        if (admin.error >= 2) {
          admin.status = "freeze";
        } else {
          if (admin.error) {
            // because it may be NaN
            admin.error += 1;
          } else {
            admin.error = 1;
          }
        }
      }

      await admins.updateOne(adminQuery, adminUpdates);

      // ----- Ending -----------
      const err = new Error("Password is wrong.");
      err.status = 401;
      return next(err);
    }

    const randToken = rand() + rand() + rand();
    if (admin.error >= 1) {
      admin.error = 0;
      admin.randToken = randToken;
      await admins.updateOne(adminQuery, adminUpdates);
    } else {
      admin.randToken = randToken;
      await admins.updateOne(adminQuery, adminUpdates);
    }

    let payload = { id: admin._id.toString() };
    const jwtToken = jwt.sign(payload, process.env.TOKEN_SECRET, {
      expiresIn: "1h",
    });

    res.status(201).json({
      message: "Successfully Logged In.",
      token: jwtToken,
      user_id: admin._id.toString(),
      randomToken: randToken,
    });
  }),
];

exports.refreshToken = [
  // Validate and sanitize fields.
  body("randomToken", "randomToken must not be empty.")
    .trim()
    .notEmpty()
    .escape(),
  body("user_id", "User ID must not be empty.").isAlphanumeric(),

  asyncHandler(async (req, res, next) => {
    // Extract the validation errors from a request.
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      // There are errors. Render form again with sanitized values/error messages.
      const err = new Error("Validation failed!");
      err.status = 400;
      return next(err);
    }

    const authHeader = req.get("Authorization");
    if (!authHeader) {
      const err = new Error("You are not an authenticated user!.");
      err.status = 401;
      throw err;
    }
    const { randomToken, user_id } = req.body;

    const adminQuery = { _id: ObjectId(user_id) };
    const admin = await admins.findOne(adminQuery);
  
    if (admin.randToken !== randomToken) {
      const adminUpdates = {
        $set: admin,
      };
      admin.error = 3;
      await admins.updateOne(adminQuery, adminUpdates);

      const err = new Error(
        "This request may be an attack. Please contact the admin team."
      );
      err.status = 400;
      return next(err);
    }

    const randToken = rand() + rand() + rand();

    const adminUpdates = {
      $set: admin,
    };
    admin.randToken = randToken;
    await admins.updateOne(adminQuery, adminUpdates);

    // jwt token
    let payload = { id: user_id };
    const jwtToken = jwt.sign(payload, process.env.TOKEN_SECRET, {
      expiresIn: "1h",
    });

    res.status(201).json({
      message: "Successfully sent a new token.",
      token: jwtToken,
      user_id: user_id,
      randomToken: randToken,
    });
  }),
];

const rand = () => Math.random().toString(36).substring(2);
