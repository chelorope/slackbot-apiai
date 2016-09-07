"use strict";
const Botkit = require('botkit');
const env = require('./../env.json');

var controllerSlack = Botkit.slackbot({
  debug: false, //or from 1 to 7 for debuging
  json_file_store: './'
});

var jambot = controllerSlack.spawn({
  token: env.slack.USER_TOKEN_Jam,                  //CHANGE TOKEN ----------
}).startRTM()

function listTeamUsers() {
  return new Promise(function(resolve, reject) {
    jambot.api.users.list({}, function(err, response) {
      if (err) {
        reject(err);
      }else {
        resolve(response);
      }
    });
  })
};

function getUserImChannelId(userId) {
  return new Promise(function(resolve, reject) {
    jambot.api.im.open({user: userId, return_im: true}, function(err, response) {
      if (err) {
        reject(err)
      }else {
        resolve(response.channel.id)
      }
    })
  })
}


listTeamUsers()
  .then(function(resp) {
    resp.members.map(function(user) {
      getUserImChannelId(user.id)
        .then(function(channelId) {
          user.imChannel = channelId;
          controllerSlack.storage.users.save(user);
          })
        .catch(function(err) {
          throw new Error(err);
        })
    })
  })
  .catch(function(err) {
    throw new Error(err);
  })
