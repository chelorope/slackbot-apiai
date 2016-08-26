'use strict';

class ApiAi {

  constructor(controller) {
    this.apibot = controller;
  }

  addActionListener(action, callback) {
    this.apibot.action(action, callback)
  }

  addAllActionsListener(callback) {
    this.apibot.all(callback)
  }

  sendBot(message, bot) {
    this.apibot.process(message, bot);
  }
}
module.exports = ApiAi;
