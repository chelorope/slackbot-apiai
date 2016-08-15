// const {Wit, log} = require('node-wit');
const Botkit = require('botkit');
var apiai = require('apiai');
var env = require('./env.json')

//API.AI---------------

var app = apiai(env.apiai.USER_TOKEN);

//BOTKIT--------------

var controller = Botkit.slackbot({
  debug: false
  //include "log: false" to disable logging
  //or a "logLevel" integer from 0 to 7 to adjust logging verbosity
});

// connect the bot to a stream of messages
controller.spawn({
  token: env.slack.USER_TOKEN,
}).startRTM()


// give the bot something to listen for.
// controller.hears('hello',['direct_message','direct_mention','mention'],function(bot,message) {
//
//   bot.reply(message,'Hello yourself.');
//
// });
//reply to any incoming message -------
// controller.on('message_received', function(bot, message) {
//     bot.reply(message, 'Incoming!');
// });
// reply to a direct mention - @bot hello ------
controller.on('direct_mention',function(bot,message) {
  // reply to _message_ by using the _bot_ object
  console.log(message);
  var request = app.textRequest(message.text);

  request.on('response', function(response) {
      bot.reply(message,
        "Parameters:  " + JSON.stringify(response.result.parameters) +
        "\nAction:  " + response.result.action +
        "\n Answer:  " + response.result.fulfillment.speech
      );
      console.log(response);
  });
  request.end()

});
//reply to a direct message --------
controller.on('direct_message',function(bot,message) {
  // reply to _message_ by using the _bot_ object
  // bot.reply(message,'You are talking directly to me');
  console.log(message);
  var request = app.textRequest(message.text);

  request.on('response', function(response) {
      bot.reply(message,
        "Parameters:  " + JSON.stringify(response.result.parameters) +
        "\nAction:  " + response.result.action +
        "\n Answer:  " + response.result.fulfillment.speech
      );
      console.log(response);
  });
  request.end()
});

//WIT-----------------

// const client = new Wit({
//   accessToken: MY_TOKEN,
//   actions: {
//     send(request, response) {
//       return new Promise(function(resolve, reject) {
//         console.log(JSON.stringify(response));
//         return resolve();
//       });
//     },
//     myAction({sessionId, context, text, entities}) {
//       console.log(`Session ${sessionId} received ${text}`);
//       console.log(`The current context is ${JSON.stringify(context)}`);
//       console.log(`Wit extracted ${JSON.stringify(entities)}`);
//       return Promise.resolve(context);
//     }
//   },
//   logger: new log.Logger(log.DEBUG) // optional
// });

// const client = new Wit({accessToken: 'MY_TOKEN'});
// client.message('what is the weather in London?', {})
// .then((data) => {
//   console.log('Yay, got Wit.ai response: ' + JSON.stringify(data));
// })
// .catch(console.error);
