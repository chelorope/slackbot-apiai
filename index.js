"use strict";
// const {Wit, log} = require('node-wit');
const cal = require('./components/Google/calendar.js');
var Calendar = new cal;
const mail = require('./components/Google/gmail.js');
var Gmail = new mail;

const Botkit = require('botkit');
const apiaibotkit = require('api-ai-botkit');
const env = require('./env.json');
const Ai = require('./components/apiai/apiai.js');
const Slk = require('./components/slack.js');


//API.AI---------------
const apiai = apiaibotkit(env.apiai.USER_TOKEN);
var botApiAi = new Ai(apiai);
var controllerSlack = Botkit.slackbot({
  debug: false, //or from 1 to 7 for debuging
  json_file_store: './store'
});
// connect the bot to a stream of messages
controllerSlack.spawn({
  token: env.slack.USER_TOKEN_Test,
}).startRTM()
controllerSlack.spawn({
  token: env.slack.USER_TOKEN_Jam,                  //CHANGE TOKEN ----------
}).startRTM()

var Slack = new Slk(controllerSlack);
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
  Slack.reply(message, resp.result.fulfillment.speech, bot);
})

botApiAi.action('newTriggerImage', function (message, resp, bot) {
  let contexts = resp.result.contexts;
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

botApiAi.action('events.list', function (message, resp, bot) {
  Slack.getUserInfo(message.user, bot)
    .then(function(user) {
      var obj = {};
      var params = resp.result.parameters;
      var dateAnswer = '';
      var otherUserAnswer = '';
      var dateFound = true;
      var calendarId = '';
      if (params['given-name']) {
        calendarId = message.matchedUsers[0].profile.email;
        otherUserAnswer = '  (' + message.matchedUsers[0].real_name + ')';
      }
      if (params.date) {
        if (params.date === 'next' || params.date === 'Next') {
          let actDate = new Date();
          let nextDate = new Date();
          nextDate.setFullYear(actDate.getFullYear() + 1);
          obj = {
            email: (calendarId || user.profile.email),
            timeMin: actDate.toISOString(),
            timeMax: nextDate.toISOString(),
            maxResults: (params.number || 1)
            }
            dateAnswer = '';
        }else {
          dateAnswer = ' for ' + params.date;
          obj = {
            email: (calendarId || user.profile.email),
            timeMin: params.date + 'T00:00:00Z',
            timeMax: params.date + 'T23:59:59Z',
            maxResults: 20
            }
        }
      }else if(params['date-period']) {
        let period = params['date-period'].split('/');
        dateAnswer = ' between ' + period[0] + ' and ' + period[1];
        obj = {
          email: (calendarId || user.profile.email),
          timeMin: period[0] + 'T00:00:00Z',
          timeMax: period[1] + 'T23:59:59Z',
          maxResults: 30
          }
      }else if(params['date-time']) {
        dateAnswer = ' for ' + params['date-time'];
        obj = {
          email: (calendarId || user.profile.email),
          timeMin: params['date-time'],
          timeMax: params['date-time'],
          maxResults: 10
          }
      }else {
        dateFound = false;
        Slack.reply(message, 'Try again but this time with an specific date or period of time', bot);
      }
      if (dateFound) {
        Calendar.listEvents(obj)
          .then(function(ev) {
            let events = ev.items;
            if (events.length == 0) {
              Slack.reply(message, 'No events found' + dateAnswer, bot);
            } else {
              let answer = (
                events.length >= obj.maxResults ?
                'First ' + obj.maxResults + ' events' :
                'Events found'
              ) + dateAnswer  + otherUserAnswer + ' :\n\n';
              for (let i = 0; i < events.length; i++) {
                let event = events[i];
                let start = (event.start.dateTime || event.start.date).split('T');
                let end = (event.end.dateTime || event.end.date).split('T');
                let time = (start[1] && end[1]) ? [start[1].split('-')[0], end[1].split('-')[0]] : [start[0],end[0]];
                answer += (
                  'Event ' + (i+1) + ':\n' +
                  '\tDay: ' + start[0] + '\n' +
                  '\tFrom ' + time[0] + ' to ' + time[1] + '\n' +
                  '\t' + event.summary + '\n\n'
                );
              }
              Slack.reply(message, answer, bot);
            }
          })
          .catch(function(err) {
            throw new Error(err);
          })
      }
    })
    .catch(function(err) {
      throw new Error(err);
    })

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
            // console.log('USER:   ' ,usr);               //DELETE
            reminderData.mail.push(usr.profile.email);
            reminderData.slackId.push(usr.imChannel);
          })
        }
        // console.log('ANY:  ', reminderData);       //DELETE
        break;
      case 'reminderBody':
        reminderData.body = resp.result.parameters.body;
        // console.log('REMINDERTYPE:  ', reminderData.body);       //DELETE
        break;
      case 'reminderType':
        if (resp.result.parameters.reminderType === 'email') {
          // console.log('PARAMETERS:   ', reminderData, '  ', reminderData.body);            //DELETE
          Gmail.sendMessage('me', Gmail.makeBody(
            reminderData.mail.join(','),
            'marcelo.rodriguez@jam3.com',
            'Reminder',
            reminderData.body
          ));
          reminderData.reset();
        }else if (resp.result.parameters.reminderType === 'message') {
          reminderData.slackId.map((id) => {
            bot.say({
              text: reminderData.body,
              channel: id
            })
            // console.log('MESSAGE SENT:   ', reminderData.body, id);     //DELETE
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
