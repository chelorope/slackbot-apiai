"use strict";
// const {Wit, log} = require('node-wit');
const Botkit = require('botkit');
const apiaibotkit = require('api-ai-botkit');
const ai = require('apiai');
const env = require('./env.json');
const fs = require('fs');
const chokidar = require('chokidar');
const request = require('request');
var SU = require('node-slack-upload');
const A = require('./apiai.js');
const S = require('./slack.js');


//API.AI---------------
const botkitApiAi = apiaibotkit(env.apiai.USER_TOKEN);

var controllerSlack = Botkit.slackbot({
  debug: false //or from 1 to 7 for debuging
});
// connect the bot to a stream of messages
controllerSlack.spawn({
  token: env.slack.USER_TOKEN,
}).startRTM()
controllerSlack.spawn({
  token: env.slack.USER_TOKEN1,                  //CHANGE TOKEN ----------
}).startRTM()


Slack = new S(controllerSlack);
ApiAi = new A(botkitApiAi);
Slack.setMatchArray(getMatchArray());
Slack.startHearing(ApiAi.handleMessage);
Slack.addEventListener('file_shared', function(bot, message) {
  if (Slack.isWaitingForFile(message.user_id)) {
    var queuedObj = Slack.getWaitingForFile(message.user_id);
    Slack.removeWaitingForFile(message.user_id);
    Slack.requestFileInfo(message.file.id, bot)
      .then(function(fileInfo) {
        Slack.getFileFromURL(queuedObj, fileInfo)
          .then(function(obj){
            let auxMessage = {
              type: 'message',
              channel: obj.channel,
              user: obj.user,
              text: 'Image Uploaded',
              team: obj.team,
              event: 'direct_message'
            };
            ApiAi.sendBot(auxMessage, bot);
          })
      })
      .catch(function(err) {
        console.log(err);
      })
    }
})

ApiAi.addActionListener('newTriggerImage', function (message, resp, bot) {
  let contexts = resp.result.contexts;
  // console.log(resp.result); // DELETE
  if (contexts.length > 0 && contexts[contexts.length - 1].name === "upload-image_dialog_params_image-uploaded") {
    Slack.addWaitingForFile({
      trigger: resp.result.resolvedQuery,
      channel: message.channel,
      team: message.team,
      user: message.user
    })
  }
});

ApiAi.addAllActionsListener(function (message, resp, bot) {
  Slack.sendToConversation(message, resp.result.fulfillment.speech, bot);
})


//WATCHIG FOR CHANGES ON img/ FOLDER-----------------
function getMatchArray() {
  var arr = [findUsrsInTextRE];
  fs.readdirSync('img').map((img) => {
    if (img.split('.')[0]) {
      arr.push(img.replace(/_/g, ' ').split('.')[0])
    }
  });
  arr.push('.*');
  return arr;
};
chokidar.watch('img', { persistent: true })
  .on('change', function(path) {
    console.log('img/ folder has changed');
    Slack.setMatchArray(getMatchArray());
  })












  // ApiAi.addActionListener('calendar.get', function (message, resp, bot) {
  //     Calendar.listEvents();
  //     var responseText = resp.result.fulfillment.speech;
  //     bot.reply(message, responseText);
  // });

// const cal = require('./calendar.js');
// var Calendar = new cal;
// const express = require('express');
// //BOTKIT--------------
// //MESSENGER BOTKIT-----------------------
// var controllerFace = Botkit.facebookbot({
//         access_token: env.facebook.ACCESS_TOKEN,
//         verify_token: env.facebook.VERIFY_TOKEN,
// })
//
// var face = controllerFace.spawn({
//   debug: false
// });
// //SLACK BOTKIT-----------------
//
//
//
// //EXPRESS SERVER---------------------
//   var app = express();
//   app.get('/', function (req, res) {
//     // var dataSend = {};
//     // client.get('search/tweets', {q: '%23' + req.query.hash ,result_type: 'recent',count: 5},
//     // function(error,data,response){
//     //   if(error) throw error;
//     //   res.stautsCode = 200;
//     //   res.setHeader('Content-Type', 'text/plain');
//     //   dataSend = getJsonData(data);
//     //   res.send(JSON.stringify(dataSend));
//     // });
//   });
//   app.listen(9090);
//   console.log('Listening on port 9090...');
//
// //CALENDAR-------------------
//
// Calendar.init();
