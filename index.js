"use strict";
// const {Wit, log} = require('node-wit');
const Botkit = require('botkit');
const apiaibotkit = require('api-ai-botkit');
const ai = require('apiai');
const env = require('./env.json');
const cal = require('./calendar.js');
const express = require('express');
const fs = require('fs');
const chokidar = require('chokidar');
var SU = require('node-slack-upload');
var slackUploadTest = new SU(env.slack.USER_TOKEN);
var slackUploadJam3 = new SU(env.slack.USER_TOKEN1);
var Calendar = new cal;

//API.AI---------------
const botkitapiai = apiaibotkit(env.apiai.USER_TOKEN);
//API.AI con botkit
const apiai = ai(env.apiai.USER_TOKEN);

//BOTKIT--------------
//MESSENGER BOTKIT-----------------------
var controllerFace = Botkit.facebookbot({
        access_token: env.facebook.ACCESS_TOKEN,
        verify_token: env.facebook.VERIFY_TOKEN,
})

var face = controllerFace.spawn({
  debug: false
});
//SLACK BOTKIT-----------------
var controllerSlack = Botkit.slackbot({
  debug: false
  //include "log: false" to disable logging
  //or a "logLevel" integer from 0 to 7 to adjust logging verbosity
});

// connect the bot to a stream of messages
var slack = controllerSlack.spawn({
  token: env.slack.USER_TOKEN,
}).startRTM()

var slackCool = controllerSlack.spawn({
  token: env.slack.USER_TOKEN1,                  //CHANGE TOKEN ----------
}).startRTM()


//EXPRESS SERVER---------------------
  var app = express();
  app.get('/', function (req, res) {
    // var dataSend = {};
    // client.get('search/tweets', {q: '%23' + req.query.hash ,result_type: 'recent',count: 5},
    // function(error,data,response){
    //   if(error) throw error;
    //   res.stautsCode = 200;
    //   res.setHeader('Content-Type', 'text/plain');
    //   dataSend = getJsonData(data);
    //   res.send(JSON.stringify(dataSend));
    // });
  });
  app.listen(9090);
  console.log('Listening on port 9090...');

//CALENDAR-------------------

Calendar.init();

function requestUserName(hash) {
  return new Promise(function(resolve, reject) {
    slack.api.users.info({user: hash}, function(err, response) {
      if(err) {
        reject(err);
      }else {
        resolve({hash: hash, data: response});
      }
    });
  })
};

var findUsrsInTextRE = RegExp(/<@\w*?>/g);
var findUsrInArrayRE = RegExp(/<@\w*?>/);
var getHashFromUsrRE = RegExp(/\w+/);

var images = fs.readdirSync('img');
function getMatchArray(imgs) {
  var arr = [findUsrsInTextRE];
  imgs.map((img) => {
    img.replace('_', ' ').split('.')[0] ? arr.push(img.replace('_', ' ').split('.')[0]) : '';
  });
  arr.push('.*');
  return arr;
};
var matchArray = getMatchArray(images);
var watcher = chokidar.watch('img', { persistent: true });
watcher
  .on('change', function(path) {
    console.log('File Added');
    images = fs.readdirSync('img');
    matchArray = getMatchArray(images);
  })

controllerSlack.hears(
  matchArray,
  ['direct_message','direct_mention','mention','ambient'],
  function(bot,message) {
 /* Creates an array with all the matched users and then
    substitutes them by their names in the message        */
    uploadMatchedImage(bot, message);
    if (message.event !== "ambient") {
      var users = message.match.filter(m => (findUsrInArrayRE.test(m)));
      if (users.length > 0) {
        //Translates the matched hash into a name
        let usrPromises = users.map((usr) => (
          requestUserName(usr.match(getHashFromUsrRE)[0])
        ));
        //Resolves all promises after the last one arrives
        Promise.all(usrPromises)
          .then(function(result) {
            result.map(function(item) {
              message.text = message.text.replace(
                RegExp('<@' + item.hash + '>'),
                item.data.user.name
              );
            });
            handleMessage(bot,message, result);
          })
          .catch(function(err) {
            console.log(err)
          })
      }else {
        //If there's no users in the message
        handleMessage(bot,message);
      }
    }
  }
);


function handleMessage(bot, message, users) {
  console.log(message);
  botkitapiai.process(message, bot);

  botkitapiai
    .action('calendar.get', function (message, resp, bot) {
        Calendar.listEvents();
        var responseText = resp.result.fulfillment.speech;
        bot.reply(message, responseText);
    })

  console.log("TEXT: " + message.text); //DELETE

  var request = apiai.textRequest(message.text);
  request.on('response', function(response) {
      bot.reply(message,
        "Parameters:  " + JSON.stringify(response.result.parameters) +
        "\nAction:  " + response.result.action +
        "\n Answer:  " + response.result.fulfillment.speech
      );
      console.log(response);// DELETE
  });
  request.end()
}

// EXTRA----------------------------------

function getSlackUpload(teamName) {
  switch (teamName) {
    case "T1ZKD6M38":
      return slackUploadTest;
      break;
    case "T026JTKEW":
      return slackUploadJam3;
      break;
  }
};

var catchImgName = '';
function getImage(message, images) {
  for (var i = 0; i < images.length; i++) {
    catchImgName = images[i].replace('_', ' ').split('.');
    for (var j = 0, matches = message.match; j < matches.length; j++) {
      if (catchImgName[0] === matches[j]) {
        return {
          'data': fs.createReadStream('img/' + images[i]),
          'tittle': catchImgName[0],
          'filetype': catchImgName[1]
        }
      }
    };
  };
  return '';
};

var image = {};
function uploadMatchedImage(bot, message) {
  image = getImage(message, images);
  if (image) {
    getSlackUpload(message.team).uploadFile({
        file: image.data,
        filetype: image.fileType,
        title: image.title,
        channels: message.channel
    }, function(err) {
        if (err) {
            console.error(err);
        }
        else {
            console.log('File Uploaded to ', message.channel);
        }
    });
  }
};
    // slack.api.files.upload(
    //   {'filename': 'cool.png', 'title': 'Cool Beans', 'channels': message.channel,
    //    'filetype': 'png', 'file': fs.readFileSync('cool.png')},
    //   function(err, response) {
    //     console.log(response);
    //     // if(err) {
    //     //   console.log(err);
    //     // } else{
    //     //   console.log(response);
    //     // }
    //   }
    // );

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
