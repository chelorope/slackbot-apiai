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
    this.controller = controller;
    this.waitingForFile = new Map();
    this.matches = {
      images: getImageMatchArray(),
      extra: [/<@\w*?>/g, /.*/],
      all: '',
      generate() {this.all = this.images.concat(this.extra)}
    }
    this.matches.generate();

    chokidar.watch('img/', { persistent: true })
      .on('change', function(path) {
        console.log('img/ folder has changed');
        fileNames = fs.readdirSync('img');
        this.matches.images = getImageMatchArray();
        this.matches.generate();
        console.log(this.matches.all);
      }.bind(this))
  }
  addEventListener(evnt, callback) {
    this.controller.on(evnt, callback);
  }
  startHearing(messageHandler) {
    this.controller.hears(
      '',
      ['direct_message','direct_mention','mention','ambient'],
      function middleware(params, message) {
        var tests = this.matches.all;
        var test, match = '';
        for (var t = 0; t < tests.length; t++) {
          if (message.text) {
            test = tests[t];
            match = message.text.match(test);
            if (match) {
              message.match = match;
              return true;
            }
          }
        }
        return false;
      }.bind(this),
      function callBack(bot,message) {
        uploadMatchedFile(bot, message);
        if (message.event !== "ambient") {
          replaceUsers(bot, message)
            .then(function(message) {
              messageHandler(message, bot);
            })
            .catch(function(message) {
              messageHandler(message, bot);
            })

        }
      }.bind(this)
    );
  }
  sendToConversation(message, text, bot) {
    bot.reply(message, text)
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
            .catch(function(err) {
              console.log(err);
            })
        })
        .catch(function(err) {
          console.log(err);
        })
    }
  }
}
module.exports = Slack;

//PRIVATE ATTRIBUTES-----------------------

//USER-MATCHING REGEXPS---------------------
var findUsrInArrayRE = RegExp(/<@\w*?>/);
var getHashFromUsrRE = RegExp(/\w+/);
var fileNames = fs.readdirSync('img');

//PRIVATE FUNCTIONS-----------------------

function replaceUsers(bot, message) {
  message.matchedUsers = [];
  var users = message.match.filter(m => (findUsrInArrayRE.test(m)));
  return new Promise(function(resolve, reject) {
    if (users.length > 0) {
      //Translates the matched hash into a name
      let usrPromises = users.map((usr) => (
        requestUserInfo(usr.match(getHashFromUsrRE)[0], bot)
      ));
      //Resolves all promises after the last one arrives
      Promise.all(usrPromises)
        .then(function(result) {
          result.map(function(item) {
            let user = item.data.user;
            user.name = user.name.charAt(0).toUpperCase() + user.name.slice(1);
            message.matchedUsers.push(user);
            message.text = message.text.replace(
              RegExp('<@' + item.hash + '>'),
              user.name
            );
          });
          resolve(message);
        })
        .catch(function(err) {
          console.log(err);
        })
    }else {
      reject(message);
    }
  })
};
function uploadMatchedFile(bot, message) {
  getMatchedFile(message).map(function(image) {
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
function getMatchedFile(message) {
  console.log(message.match);
  var matches = message.match.map((item) => (item.toLowerCase()));
  return fileNames.map(function(image) {
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
//Gets the direct messages channel id with a user
function getUserImChannelId(user, bot) {
  return new Promise(function(resolve, reject) {
    bot.api.im.open({user: user, return_im: true}, function(err, response) {
      if (err) {
        console.log(err);
      }else {
        resolve(response.channel.id)
      }
    })
  })
}
function requestUserInfo(userId, bot) {
  // console.log('userId:   ', userId);                          //DELETE
  return new Promise(function(resolve, reject) {
    bot.api.users.info({user: userId}, function(err, response) {
      if(err) {
        reject(err);
      }else {
        getUserImChannelId(userId, bot)
          .then(function(channelId) {
            response.user.imChannel = channelId;
            resolve({hash: userId, data: response});
          })
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
//WATCHIG FOR CHANGES ON img/ FOLDER-----------------
function getImageMatchArray() {
  var arr = [];
  fileNames.map((img) => {
    if (img.split('.')[0]) {
      arr.push(RegExp(img.replace(/_/g, ' ').split('.')[0],'i'));
    }
  });
  return arr;
};
