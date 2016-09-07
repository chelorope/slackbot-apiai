"use strict";
const Botkit = require('botkit');
const env = require('./../env.json');
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
      extra: [/<@\w*?>/g, /.*/]
    }

    chokidar.watch('img/', { persistent: true })
      .on('change', function(path) {
        console.log('img/ folder has changed');
        fileNames = fs.readdirSync('img');
        this.matches.images = getImageMatchArray();
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
        var tests = this.matches.images.concat(this.matches.extra);
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
  reply(message, text, bot) {
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
          getFileFromURL(queuedObj, fileInfo, bot)
            .then(function(obj){
              callBack(obj);
            })
            .catch(function(err) {
              throw new Error(err)
            })
        })
        .catch(function(err) {
          throw new Error(err)
        })
    }
  }
  getUserInfo(userId, bot) {
    return requestUserInfo(userId, bot);
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
      //Translates the matched id into a name
      let usrPromises = users.map((usr) => (
        requestUserInfo(usr.match(getHashFromUsrRE)[0], bot)
      ));
      //Resolves all promises after the last one arrives
      Promise.all(usrPromises)
        .then(function(result) {
          result.map(function(user) {
            user.name = user.name.charAt(0).toUpperCase() + user.name.slice(1);
            message.matchedUsers.push(user);
            message.text = message.text.replace(
              RegExp('<@' + user.id + '>'),
              user.name
            );
          });
          resolve(message);
        })
        .catch(function(err) {
          throw new Error(err)
        })
    }else {
      reject(message);
    }
  })
};
//TODO: try to replace SlackUpload with the api file upload method
function uploadMatchedFile(bot, message) {
  getMatchedFile(message).map(function(image) {
    if (image) {
      let slackUpload = new SU(bot.config.token);
      slackUpload.uploadFile({
          file: image.data,
          filetype: image.fileType,
          title: image.title,
          channels: message.channel
      }, function(err) {
          if (err) {
              throw new Error(err)
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

//Gets the direct messages channel id with a user
function getUserImChannelId(user, bot) {
  return new Promise(function(resolve, reject) {
    bot.api.im.open({user: user, return_im: true}, function(err, response) {
      if (err) {
        throw new Error(err);
      }else {
        resolve(response.channel.id)
      }
    })
  })
}
function requestUserInfo(userId, bot) {
  return new Promise(function(resolve, reject) {
    //Tries to get the user from the store
    bot.botkit.storage.users.get(userId, function(err, user) {
      if (!err) {
        resolve(user);
      }else {
        //If it can't find it
        bot.api.users.info({user: userId}, function(err, response) {
          if(err) {
            reject(err);
          }else {
            getUserImChannelId(userId, bot)
              .then(function(channelId) {
                response.user.imChannel = channelId;
                bot.botkit.storage.users.save(userId, response.user)
                resolve(response.user);
              })
          }
        });
      }
    })

  })
};
function requestFileInfo(id, bot) {
  return new Promise(function(resolve, reject) {
    bot.api.files.info({file: id}, function(err, response) {
      if(err) {
        reject(err);
      }else {
        resolve(response);
      }
    });
  })
};
function getFileFromURL(mesageInfo, fileInfo, bot) {
  return new Promise(function(resolve,reject) {
    request
      .get(fileInfo.file.url_private, function(error, response, body) {
          if (error) {
            reject(error);
          }else {
            resolve(mesageInfo);
          }
        })
      .auth(null, null, true, bot.config.token)
      .pipe(fs.createWriteStream('img/' + mesageInfo.trigger.replace(/ /g, '_') + '.' + fileInfo.file.name.split('.')[1]))
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
