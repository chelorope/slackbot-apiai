'use strict';
const uuid = require('node-uuid');
const Entities = require('html-entities').XmlEntities;
const decoder = new Entities();

class ApiAi {

  constructor(controller) {
    this.apibot = controller;
  }

  action(action, callback) {
    this.apibot.action(action, callback);
  }

  all(callback) {
    this.apibot.all(callback);
  }

  process(message, bot) {
    try {
      if (message.type == 'message') {
          if (message.user == bot.identity.id) {
              // message from bot can be skipped
          }
          else if (message.text.indexOf("<@U") == 0 && message.text.indexOf(bot.identity.id) == -1) {
              // skip other users direct mentions
          }
          else {
              var requestText = decoder.decode(message.text);
              requestText = requestText.replace("’", "'");

              var channel = message.channel;
              var user = message.user;
              var messageType = message.event;
              var botId = '<@' + bot.identity.id + '>';

              if (requestText.indexOf(botId) > -1) {
                  requestText = requestText.replace(botId, '');
              }
              if (!(channel in this.apibot.sessionIds)) {
                  this.apibot.sessionIds[channel] = {};
                  this.apibot.sessionIds[channel][user] = uuid.v1();
              }else if (!(user in this.apibot.sessionIds[channel])) {
                this.apibot.sessionIds[channel][user] = uuid.v1();
              }

              var request = this.apibot.apiaiService.textRequest(requestText,
                  {
                      sessionId: this.apibot.sessionIds[channel][user]
                  });

              request.on('response', function (response) {

                  this.apibot.allCallback.forEach(function (callback) {
                      callback(message, response, bot);
                  });

                  if (isDefined(response.result)) {
                      var action = response.result.action;

                      if (isDefined(action)) {
                          if (this.apibot.actionCallbacks[action]) {
                              this.apibot.actionCallbacks[action].forEach(function (callback) {
                                  callback(message, response, bot);
                              });
                          }
                      }
                  }
              }.bind(this));

              request.on('error', function (err) {
                  throw new Error(err)
              });

              request.end();

          }
        }
    } catch (err) {
        throw new Error(err)
    }
  }
}
module.exports = ApiAi;

function isDefined(obj) {
    if (typeof obj == 'undefined') {
        return false;
    }

    if (!obj) {
        return false;
    }

    return obj != null;
}
