var PubNub = require('pubnub');

module.exports = CommandService;

var mod = CommandService.prototype;

const ALLOWED_COMMANDS = ['tether', 'unTether', 'captureImage', 'captureTethered'];

function CommandService(config){
  if (!(this instanceof CommandService)) return new CommandService(config);
  
  this.config = config

  this.pnClient = PubNub({
    ssl           : true,
    publish_key   : config.pubKey,
    subscribe_key : config.subKey
  });

  this.init();
}

mod.notify = function(data){
  this.pnClient.publish({ 
    channel   : data.channel,
    message   : data.message,
    callback  : function(e) {},
    error     : function(e) { console.log( 'Error publishing', e ); }
  });
}

mod.init = function(){
  var self = this;
  console.log('config.deviceUUID', this.config.deviceUUID);
  this.pnClient.subscribe({
    channel  : self.generateChannels(),
    callback : self.processMessage.bind(self),
    error : function(e) { console.log( 'Error subscribing', e ); }
  });
}

//===========================
// Utility methods
//===========================
mod.generateChannels = function(){
  return 'global,'+this.config.deviceUUID;
}

mod.processMessage = function(message, data, channel){
  if(channel !== 'global' && channel !== this.config.deviceUUID){
    return;
  }

  if(!this.isAllowedCommand){
    return;
  }

  if(this.config.delegate[message.cmd] !== undefined){
    this.config.delegate[message.cmd].call(this.config.delegate);
  }else{
    console.log('You must set the '+message.cmd+' method on command service');
  }
}

mod.isAllowedCommand = function(cmd){
  return ALLOWED_COMMANDS.includes(cmd);
}