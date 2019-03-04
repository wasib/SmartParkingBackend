var firebase = require("firebase");
firebase_config= require("./config").firebase_config;
var gcm = require('node-gcm');

firebase.initializeApp(firebase_config);
var database = firebase.database();


function check_in(rfid) { 
    //authenticating user
    database.ref('/Users').once('value').then(function (snapshot) {
      var found = false;
      var uid;
      snapshot.forEach(
        function (node) { 
          if (node.val().RFID == rfid) {
            found = true;
            uid = node.key;
          }
        });
      if (!found) {
        //alert("Not a authentic user");
        callback(null, "Not a authentic user$f$");
        return;
      }
      checkIngReservation(uid, rfid);
    });
  }
  function check_out(rfid) {
    //authenticating user
    database.ref('/Users').once('value').then(function (snapshot) {
      var found = false;
      var uid;
      snapshot.forEach(
        function (node) {
          if (node.val().RFID == rfid) {
            found = true;
            uid = node.key;
          }
        });
      if (!found) {
        callback(null, "Not a authentic user$f$");
        return;
      }
      checkOut(uid, rfid);
    });
  }
  //start of IN code------------------------------------------------------------------------------------
  function checkIngReservation(uid, rfid) {
    database.ref('/Bills/' + uid).once('value').then(function (snapshot) {
      var found = false;
      snapshot.forEach(
        function (node) {
          if (found) return;
          if ((node.val().checkInTime == null) && (node.val().reservationTime != null)) {
            //checkIng in
            database.ref('/Bills/' + uid + "/" + node.key).update({ checkInTime: firebase.database.ServerValue.TIMESTAMP }).then(function () {
              database.ref('/Bills/' + uid + "/" + node.key).once('value').then(function (VALUE) {
                var SLOTNUM = VALUE.val().slot;
                database.ref('/Status/' + SLOTNUM).update(
                  { "Status": "Full" }
                ).then(function () {
                  //callback(null,"Already Reserved - Checked In");
                  var message = new gcm.Message({
                    data: { title: 'Successfully Checked In with Reservation' }
                  });
                  push_notif(uid, message);
                });
              });
            });
            //
            found = true;
            return;
          }
        });
      if (found) {
        //alert("already reserved");
        return;
      }
      else {
        //alert("not reserved");
        isBook(uid, rfid);
      }
    });
  }
  function isBook(uid, rfid) {
    var Frage = false;
    firebase.database().ref('/Bills/' + uid).once('value').then(function (snapshot) {
      snapshot.forEach(
        function (bill) {
          if (Frage) return;
          if ((bill.val().checkInTime != null) && (bill.val().checkOutTime == null))
            Frage = true;
        }
      );
      if (!Frage) {
        book(uid, rfid);
      }
      else {
        callback(null, "Already checked in$t$");
        return;
      }
    });
  }
  function book(uid, rfid) {
    var w_slotno;
    firebase.database().ref('/Status').transaction(function (status) {
      if (status) {
        var S = status;
        var DONE = false;
        var Xslot;
        S.forEach(
          function (slot) {
            //console.log(slot);
            if (DONE) return;
            if (slot.Vacant) {
              slot.RFID = rfid;
              slot.Vacant = false;
              slot.Status = "Full";
              DONE = true;
              Xslot = slot;
              w_slotno = slot.SlotNo;
              //console.log("Slot key :"+slot.SlotNo);
            }
          });
        if (!DONE) {
          //alert("No slots available");
          callback(null, "No slots available$f$");
        }
        //status[Xslot.SlotNo] = Xslot;
      }
      return status;
    }).then(function () {
      bill(uid, w_slotno);
    });
  }
  function bill(uid, slotNo) {
    //console.log("Slot num:"+slotNo);
    var DATA = { slot: parseInt(slotNo), paidStatus: false, checkInTime: firebase.database.ServerValue.TIMESTAMP };
    firebase.database().ref('/Bills/' + uid).push().set(DATA).then(function () {
      var message = new gcm.Message({
        data: { title: 'Successfully checked in' }
      });
      push_notif(uid, message);
    });
  }
  //end of IN code
  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  //start of OUT code
  function checkOut(uid) {
    database.ref('/Bills/' + uid).once('value').then(function (snapshot) {
      var found = false;
      snapshot.forEach(
        function (node) {
          if (found) return;
          if ((node.val().checkInTime != null) && (node.val().checkOutTime == null)) {
            //checkIng out
            //
            found = true;
            database.ref('/Bills/' + uid + "/" + node.key).update({ checkOutTime: firebase.database.ServerValue.TIMESTAMP });
            database.ref('/Bills/' + uid + "/" + node.key).once('value').then(function (VALUE) {
              var SLOTNUM = VALUE.val().slot;
              var checkin = parseInt(VALUE.val().checkInTime);
              var checkout = parseInt(VALUE.val().checkOutTime);
              var amt = (checkout - checkin) / 1000000;
              var resamt = null;
              if (node.val().reservationTime != null) {
                var restime = parseInt(VALUE.val().reservationTime);
                resamt = (checkin - restime) / 1000000;
              }
              database.ref('/Bills/' + uid + "/" + node.key).update({ parkingAmount: amt, reservationAmount: resamt }).then(function () {
                database.ref('/Status/' + SLOTNUM).update({ Status: 'Vacant', RFID: null, Vacant: true }).then(function () {
                  var message = new gcm.Message({
                    data: { title: 'Successfully checked out' }
                  });
                  push_notif(uid, message);
                });
              });
            });
            return;
          }
        });
      if (!found) {
        //callback(null,"Error in checkout"); //Buggy
      }
    });
  }
  //end of OUT code
  ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  function push_notif(uid, message) {
    //PUSH
    // Set up the sender with you API key
    // Add the registration tokens of the devices you want to send to
    database.ref("/Users/" + uid).once('value').then(function (snapshot) {
      var token = snapshot.val().token;
      //callback(null,token);
      //callback(null,"Checked In with uid"+uid+"\nslotnum"+slotNo+"\nServer API Key="+"AIzaSyCE1qfGaC_dBDnM1Jckw_Tf8p9vpL5eqXk"+"\nToken="+token);
      var sender = new gcm.Sender('AIzaSyCE1qfGaC_dBDnM1Jckw_Tf8p9vpL5eqXk');
      var registrationTokens = [];
      registrationTokens.push("" + token);
      // Send the message
      // ... trying only once
      // ... or retrying
      sender.send(message, { registrationTokens: registrationTokens }, function (err, response) {
        if (err) callback(null, "Success with PUSH ERROR$t$");
        else callback(null, "Success$t$");
      });
    });
  }


module.exports={
    checkIn:check_in,
    checkOut:check_out
}