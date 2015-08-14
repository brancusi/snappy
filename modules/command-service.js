PubNub = require('pubnub');

module.exports = CommandService;

var mod = CommandService.prototype;

const ALLOWED_COMMANDS = ['tether', 'unTether', 'captureImage', 'captureTethered'];

function CommandService(pubKey, subKey, deviceUUID){
  if (!(this instanceof CommandService)) return new CommandService(pubKey, subKey, deviceUUID);
  
  this.pnClient = PubNub({
    ssl           : true,
    publish_key   : pubKey,
    subscribe_key : subKey
  });

  this.deviceUUID = deviceUUID;

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
  this.pnClient.subscribe({
    channel  : self.generateChannels(),
    callback : self.processMessage,
    error : function(e) { console.log( 'Error subscribing', e ); }
  });
}

//===========================
// Utility methods
//===========================
mod.generateChannels = function(){
  return 'global,'+this.deviceUUID;
}

mod.processMessage = function(message, data, channel){
  
  console.log('Entered processing:', message.cmd, channel, this.deviceUUID, this[message.cmd], 'other');

  if(channel !== 'global' && channel !== this.deviceUUID){
    return;
  }

  console.log('Is for this node');

  if(!this.isAllowedCommand){
    console.log('This is not an allowed command');
    return;
  }
  
  console.log('Callback', this[message.cmd]);

  if(this[message.cmd] !== undefined){
    this[message.cmd]();
  }else{
    console.log('You must set the '+message.cmd+' method on command service');
  }
}

mod.isAllowedCommand = function(cmd){
  return ALLOWED_COMMANDS.includes(cmd);
}