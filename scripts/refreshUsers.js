"use strict";
const Botkit = require('botkit');
const apiai = require('apiai');
const env = require('./../env.json');
const request = require('request');

var controllerSlack = Botkit.slackbot({
  debug: false, //or from 1 to 7 for debuging
  json_file_store: './store'
});

var app = apiai(env.apiai.USER_TOKEN);

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
      teamMembers.entries.push({value:user.name, synonyms: [user.name]});
      getUserImChannelId(user.id)
        .then(function(channelId) {
          user.imChannel = channelId;
          controllerSlack.storage.users.save(user);
          })
        .catch(function(err) {
          throw new Error(err);
        })
    })
    writeUserEntityToFile();
    // postUserEntity();      //Paid account required
  })
  .catch(function(err) {
    throw new Error(err);
  })

  // UPLOAD APIAI TEAM MEMBERS ENTITY

  var teamMembers = {
  "id": "7c406579-52a6-42cb-a88f-d22f35c1d874",
  "sessionId": "6b9f7839-720a-4eaf-9c29-3d5c3e5571d0",
  "name": "members",
  "isOverridable": true,
  "entries": [],
  "isEnum": true,
  "automatedExpansion": true
}
function writeUserEntityToFile() {
  var fs = require('fs');
  fs.writeFile("components/apiai/entities/users.json", JSON.stringify(teamMembers,null,' '), function(err) {
      if(err) {
          return console.log(err);
      }
      console.log("The file was saved!");
  });
}

function postUserEntity() {
  request({
    method: 'POST',
    uri: 'https://api.api.ai/v1/entities?v=20150910',
    json: JSON.stringify(teamMembers),
    'auth': {
      'bearer': env.apiai.USER_TOKEN
    }
  },
  function (error, response, body) {
    if (error) {
      return console.error('upload failed:', error);
    }
    console.log('Upload successful!  Server responded with:', response);
  })
}
