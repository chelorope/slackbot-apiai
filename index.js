"use strict";
// const {Wit, log} = require('node-wit');
const cal = require('./components/Google/calendar.js');
var Calendar = new cal;
const mail = require('./components/Google/gmail.js');
var Gmail = new mail;

const Botkit = require('botkit');
const apiaibotkit = require('api-ai-botkit');
const ai = require('./components/apiai.js');
const env = require('./env.json');
const A = require('./components/apiai.js');
const S = require('./components/slack.js');


//API.AI---------------
const apiai = apiaibotkit(env.apiai.USER_TOKEN);
var botApiAi = new ai(apiai);
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
Slack.startHearing(function(message, bot) {
  botApiAi.process(message, bot);
});
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

botApiAi.all(function(message, resp, bot) {
  Slack.sendToConversation(message, resp.result.fulfillment.speech, bot);
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

botApiAi.action('calendar.get', function (message, resp, bot) {
    Calendar.listEvents();
});

botApiAi.action('events.get', function (message, resp, bot) {
    Calendar.listEvents();
});

var reminderData = {
  mail: [],
  slackId: [],
  body: '',
  reset() {this.mail = []; this.slackId = []; this.body = ''}
};
botApiAi.action('reminder', function (message, resp, bot) {
    switch (resp.result.parameters.action) {
      case 'reminderStart':
        if (message.matchedUsers !== []) {
          message.matchedUsers.map((usr) => {
            console.log('USER:   ' ,usr);
            reminderData.mail.push(usr.profile.email);
            reminderData.slackId.push(usr.imChannel);
          })
        }
        console.log('ANY:  ', reminderData);       //DELETE
        break;
      case 'reminderBody':
        reminderData.body = resp.result.parameters.body;
        console.log('REMINDERTYPE:  ', reminderData.body);       //DELETE
        break;
      case 'reminderType':
        if (resp.result.parameters.reminderType === 'email') {
          console.log('PARAMETERS:   ', reminderData, '  ', reminderData.body);            //DELETE
          Gmail.sendMessage('me', Gmail.makeBody(
            reminderData.mail.join(','),
            'marcelo.rodriguez@jam3.com',
            'Reminder',
            reminderData.body
          ));
          reminderData.reset();
        }else if (resp.result.parameters.reminderType === 'message') {
          console.log('ENTRA MSG');            //DELETE
          reminderData.slackId.map((id) => {
            bot.say({
              text: reminderData.body,
              channel: id
            })
            console.log('MESSAGE SENT:   ', reminderData.body, id);
          })
          reminderData.reset();
        }
        break;
    }
});


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
