"use strict";
var fs = require('fs');
var google = require('googleapis');
var gAuth = require('./googleAuth.js');
var googleAuth = new gAuth('calendar', ['']);

class Calendar {

  constructor() {
    this.auth = "";
    this.calendar = google.calendar('v3');
    // Load client secrets from a local file.
    fs.readFile('client_secret.json', function processClientSecrets(err, content) {
      if (err) {
        console.log('Error loading client secret file: ' + err);
        return;
      }
      // Authorize a client with the loaded credentials, then call the
      // Google Calendar API.
      googleAuth.authenticate(JSON.parse(content), (auth) => {this.auth = auth;});
    }.bind(this))
  }
  /**
   * Lists the next 10 events on the user's primary calendar.
   *
   * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
   */
  listEvents(obj) {
    return new Promise(function(resolve, reject) {
      this.calendar.events.list({
        auth: this.auth,
        calendarId: obj.email,
        timeMin: obj.timeMin,
        timeMax: obj.timeMax,
        maxResults: obj.maxResults,
        singleEvents: true,
        orderBy: 'startTime'
      }, function(err, response) {
        if (err) {
          reject(err)
        }else {
          resolve(response)
        }
      });
    }.bind(this))
  }
};
module.exports = Calendar;
