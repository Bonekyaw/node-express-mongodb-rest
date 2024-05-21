const { MongoClient } = require("mongodb");

const client = new MongoClient(process.env.MONGO_URI);

let db = client.db("lucky");

module.exports = db;
