var express = require("express");
var app = express();
var checkIn = require("./helper").checkIn;
var checkOut = require("./helper").checkOut;
global.__root = __dirname + "/";

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  next();
});

process.on("uncaughtException", function(error) {
  console.log("uncaughtException " + error);
});

app.get("/api", function(req, res) {
  res.status(200).send("API works.");
});

app.get("/test", (req, res) => {
  const event = req.query;

  if (parseInt(event.id) == 1) checkIn(event.rfid);
  else checkOut(event.rfid);

  res.json("success");
});

// expressLogging = require('express-logging'),
// logger = require('logops');
// app.use(expressLogging(logger));

module.exports = app;
