"use strict";
var fs = require('fs');
var google = require('googleapis');
const btoa = require('btoa');
var gAuth = require('./googleAuth.js');
var googleAuth = new gAuth('gmail', ['modify']);

class Gmail {

  constructor() {
    this.auth = "";
    this.gmail = google.gmail('v1');

    // Load client secrets from a local file.
    fs.readFile('client_secret.json', function processClientSecrets(err, content) {
      if (err) {
        console.log('Error loading client secret file: ' + err);
        return;
      }
      // Authorize a client with the loaded credentials, then call the
      // Google Calendar API.
      googleAuth.authenticate(JSON.parse(content), (auth) => {this.auth = auth;});
    }.bind(this));
  }

  sendMessage(userId, email) {
    this.gmail.users.messages.send(
      {
        'auth': this.auth,
        'userId': 'me',
        'resource': {
          'raw': email
        }
      },
      function(err, response) {
        err ? console.log('The API returned an error: ' + err) : console.log(response);
      }
    );
  }

  makeBody(to, from, subject, message) {
      var str = ["Content-Type: text/plain; charset=\"UTF-8\"\n",
          "MIME-Version: 1.0\n",
          "Content-Transfer-Encoding: 7bit\n",
          "to: ", to, "\n",
          "from: ", from, "\n",
          "subject: ", subject, "\n\n",
          message
      ].join('');
      console.log('MESSAGE:  ', str);
      var encodedMail = new Buffer(str).toString("base64").replace(/\+/g, '-').replace(/\//g, '_');
      return encodedMail;
  }

    /**
   * Lists the labels in the user's account.
   *
   * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
   */
  listLabels() {
    this.gmail.users.labels.list({
      auth: this.auth,
      userId: 'me',
    }, function(err, response) {
      if (err) {
        console.log('The API returned an error: ' + err);
        return;
      }
      var labels = response.labels;
      if (labels.length == 0) {
        console.log('No labels found.');
      } else {
        console.log('Labels:');
        for (var i = 0; i < labels.length; i++) {
          var label = labels[i];
          console.log('- %s', label.name);
        }
      }
    });
  }

}
module.exports = Gmail;
