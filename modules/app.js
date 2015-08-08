var util = require('util'),  
    exec = require('child_process').exec,
    spawn = require('child_process').spawn,
    PubNub = require('pubnub'),
    Firebase = require('firebase'),
    moment = require('moment');

module.exports = App;

var mod = App.prototype;

function App(fbUrl, pubKey, subKey){
  if (!(this instanceof App)) return new App(fbUrl, pubKey, subKey);

  this.fbClient = new Firebase(fbUrl);
  this.pnClient = PubNub({
    ssl           : true,
    publish_key   : pubKey,
    subscribe_key : subKey
  });
}

mod.notify = function(data){
  this.pnClient.publish({ 
    channel   : data.channel,
    message   : data.message,
    callback  : function(e) { console.log( 'SUCCESS!', e ); },
    error     : function(e) { console.log( 'FAILED! RETRY PUBLISH!', e ); }
  });
}

mod.subscribe = function(){
  var self = this;
  var connectMessage = { channel:'node_feedback', 
                  message:{node:'lone_ranger', 
                  message:'online', 
                  status:'online'}};

  this.pnClient.subscribe({
    channel  : 'global,lone_ranger',
    connect  : self.notify(connectMessage),
    callback : function() {
      console.log('Message got', arguments);
    }
  });
}

mod.syncWithFB = function(){
  var self = this;
  return new Promise(function(resolve, reject){
    self.createOrUpdateNode().then(function(){
      var swarmRef = self.fbClient.child('swarms/' + process.env.SWARM_ID + '/nodes');
      swarmRef.once('value', function(snapshot){
        var data = {};
        data[process.env.RESIN_DEVICE_UUID] = true;
        swarmRef.update(data, function(error){
          if(error){
            reject(error);
          }else{
            resolve(data);
          }
        });
      });
    });
  });
}

mod.createOrUpdateNode = function(){
  var self = this;
  return new Promise(function(resolve, reject){

    var nodeRef = self.fbClient.child('nodes/' + process.env.RESIN_DEVICE_UUID);
    nodeRef.once('value', function(snapshot){
      if(!snapshot.exists()){
        resolve(self.createNode(nodeRef));
      }else{
        resolve(self.syncSettings(nodeRef));
      }
    });

  });
}


mod.createNode = function(nodeRef){
  var self = this;
  return new Promise(function(resolve, reject){
    var data = {name:'lone_ranger', status:'online'};

    nodeRef.update(data, function(error){
      if(error){
        reject(error);
      }else{
        resolve(self.syncSettings(nodeRef));
      }
    });
  });
}

mod.wakeUp = function(){
  //TODO: Send wakeup signal to camera, should be red to ground
}

mod.tether = function(){
  if(this.isTetheredMode()){
    this.tetheredProcess = spawn('gphoto2 --capture-tethered --filename=lone_ranger_%m_%d_%y_%H_%M_%S.%C');
  }
}

mod.unTether = function(){
  var self = this;
  return new Promise(function(resolve, reject){
    if(self.isTetheredMode()){
      self.tetheredProcess.on('close', function (code, signal) {
        self.tetheredProcess = null;
        resolve('Untethered ok! '+signal);
      });

      self.tetheredProcess.kill();
    }else{
      resolve();
    }
  });
  
}

mod.isTetheredMode = function(){
  return (this.tetheredProcess !== null && this.tetheredProcess !== undefined);
}

mod.runExec = function(cmd){
  return new Promise(function(resolve, reject){
    var child = exec(cmd,
      function (error, stdout, stderr) {
        resolve(stdout);
        if (error !== null) {
          reject(error);
        }
    });

  });
}

mod.syncSettings = function(nodeRef){
  var self = this;
  return new Promise(function(resolve, reject){
    nodeRef.on('value', function(snapshot){
      self.unTether().then(function(){
        var data = snapshot.val();
        resolve(self.runExec('gphoto2 --set-config-index iso=' + data.iso + ' shutterspeed=' + data.shutterspeed + ' aperture' + data.aperture));
      }).catch(function(error){
        reject(error);
      }) 
    });
  })
  
}

mod.bootstrap = function (){
  this.subscribe();
  this.syncWithFB().then(function(response){
    console.log('Success yo!');
  }).catch(function(error){
    console.log(error);
  });
}