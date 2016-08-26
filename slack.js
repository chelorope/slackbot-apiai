"use strict";
const Botkit = require('botkit');
const env = require('./env.json');
const cal = require('./calendar.js');
const fs = require('fs');
const chokidar = require('chokidar');
const request = require('request');
var SU = require('node-slack-upload');

class Slack {

  constructor(controller) {
    this.controllerSlack = controller;
    this.waitingForFile = new Map();
    this.matchArray = [];
  }

  addEventListener(event, callback) {
    this.controllerSlack.on(event, callback);
  }
  startHearing(messageHandler) {
    this.controllerSlack.hears(
      this.matchArray,
      ['direct_message','direct_mention','mention','ambient'],
      function(bot,message) {
        console.log(message.match);
        uploadMatchedImage(bot, message);
        if (message.event !== "ambient") {
          message = replaceUsers(bot, message);
          messageHandler(message, bot);
        }
      }.bind(this)
    );
  }

  sendToConversation(message, text, bot) {
    bot.reply(message, text)
  }
  setMatchArray(array) {
    this.matchArray = array;
  }
  addWaitingForFile(user, newWaiter) {
    this.waitingForFile.set(user, newWaiter);
  }
  getWaitingForFile(user) {
    return this.waitingForFile.get(user);
  }
  isWaitingForFile(user) {
    return this.waitingForFile.has(user);
  }
  removeWaitingForFile(user) {
    this.waitingForFile.delete(user);
  }
  getSharedFile(bot, message, callBack) {
    if (this.isWaitingForFile(message.user_id)) {
      var queuedObj = this.getWaitingForFile(message.user_id);
      this.removeWaitingForFile(message.user_id);
      requestFileInfo(message.file.id, bot)
        .then(function(fileInfo) {
          getFileFromURL(queuedObj, fileInfo)
            .then(function(obj){
              callBack(obj);
            })
        })
        .catch(function(err) {
          console.log(err);
        })
      }
  }
}
module.exports = Slack;

//PRIVATE FUNCTIONS-----------------------

//USER-MATCHING REGEXPS---------------------
var findUsrInArrayRE = RegExp(/<@\w*?>/);
var getHashFromUsrRE = RegExp(/\w+/);

function replaceUsers(bot, message) {
  var users = message.match.filter(m => (findUsrInArrayRE.test(m)));
  if (users.length > 0) {
    //Translates the matched hash into a name
    let usrPromises = users.map((usr) => (
      requestUserName(usr.match(getHashFromUsrRE)[0], bot)
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
        return message;
      })
      .catch(function(err) {
        console.log(err)
      })
  }else {
    return message;
  }
};
function uploadMatchedImage(bot, message) {
  getFile(message).map(function(image) {
    if (image) {
      let slackUpload = new SU(getSlackToken(message.team));
      slackUpload.uploadFile({
          file: image.data,
          filetype: image.fileType,
          title: image.title,
          channels: message.channel
      }, function(err) {
          if (err) {
              console.error(err);
          }else {
            console.log('File "', image.title, '" uploaded to ', message.channel);
            //garbage collector?
            slackUpload = null;
          }
      });
    }
  });
};
function getFile(message) {
  var images = fs.readdirSync('img');
  var matches = message.match;
  message.match = message.match.map((item) => (item.toLowerCase()));
  return images.map(function(image) {
    let catchedImgName = image.replace(/_/g, ' ').split('.');
    for (var j = 0; j < matches.length; j++) {
      if (catchedImgName[0] && catchedImgName[0] === matches[j]) {
        return {
          'data': fs.createReadStream('img/' + image),
          'title': catchedImgName[0],
          'filetype': catchedImgName[1]
        }
      }
    };
  })
};
//REQUESTS TO SLACK API-------------------------
function getSlackToken(teamName) {
  switch (teamName) {
    case "T1ZKD6M38":
      return env.slack.USER_TOKEN;
      break;
    case "T026JTKEW":
      return env.slack.USER_TOKEN1;
      break;
  }
};
function requestUserName(hash, bot) {
  return new Promise(function(resolve, reject) {
    bot.api.users.info({user: hash}, function(err, response) {
      if(err) {
        reject(err);
      }else {
        resolve({hash: hash, data: response});
      }
    });
  })
};
function requestFileInfo(hash, bot) {
  return new Promise(function(resolve, reject) {
    bot.api.files.info({file: hash}, function(err, response) {
      if(err) {
        reject(err);
      }else {
        resolve({hash: hash, data: response});
      }
    });
  })
};
function getFileFromURL(mesageInfo, fileInfo) {
  return new Promise(function(resolve,reject) {
    request
      .get(fileInfo.data.file.url_private, function(error, response, body) {
          if (error) {
            reject(error);
          }else {
            resolve(mesageInfo);
          }
        })
      .auth(null, null, true, getSlackToken(mesageInfo.team))
      .pipe(fs.createWriteStream('img/' + mesageInfo.trigger.replace(/ /g, '_') + '.' + fileInfo.data.file.name.split('.')[1]))
  })
}
