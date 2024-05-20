require("dotenv").config();
const express = require("express");
// const bodyParser = require('body-parser');

const adminRoutes = require("./routes/admin");
const authRoutes = require("./routes/auth");

const app = express();

app.use(express.json()); // application/json
// app.use(bodyParser.json());

app.use("/api/v1", authRoutes);
app.use("/api/v1", adminRoutes);

// start the Express server
app.listen(8080, () => {
  console.log('Server is running');
});

app.use((err, req, res, next) => {
  const status = err.status || 500;
  const message = err.message;
  res.status(status).json({ message: message });
});
