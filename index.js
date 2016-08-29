"use strict";
// const {Wit, log} = require('node-wit');
const Botkit = require('botkit');
const apiaibotkit = require('api-ai-botkit');
const ai = require('apiai');
const env = require('./env.json');
const A = require('./apiai.js');
const S = require('./slack.js');


//API.AI---------------
const botApiAi = apiaibotkit(env.apiai.USER_TOKEN);
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

var Slack = new S(controllerSlack);
Slack.startHearing(botApiAi.process);
Slack.addEventListener('file_shared', function(bot, message) {
  Slack.getSharedFile(bot, message, function(fileInfo) {
    let auxMessage = {
      type: 'message',
      channel: fileInfo.channel,
      user: fileInfo.user,
      text: 'Image Uploaded',
      team: fileInfo.team,
      event: 'direct_message'
    };
    botApiAi.process(auxMessage, bot);
  });
})

botApiAi.action('newTriggerImage', function (message, resp, bot) {
  let contexts = resp.result.contexts;
  // console.log(resp.result); // DELETE
  if (contexts.length > 0 && contexts[contexts.length - 1].name === "upload-image_dialog_params_image-uploaded") {
    Slack.addWaitingForFile(message.user, {
      trigger: resp.result.resolvedQuery.toLowerCase(),
      channel: message.channel,
      team: message.team,
      user: message.user
    })
  }
});

botApiAi.all(function(message, resp, bot) {
  Slack.sendToConversation(message, resp.result.fulfillment.speech, bot);
})

  // botApiAi.action('calendar.get', function (message, resp, bot) {
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
