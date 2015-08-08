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
    callback : function(response) {
      console.log('Message got', response);
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
  // gphoto2 --capture-tethered --filename=lone_ranger_%m_%d_%y_%H_%M_%S.%C
  if(this.isTetheredMode()){
    // gphoto2 --capture-tethered --filename=lone_ranger_%m_%d_%y_%H_%M_%S.%C
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
        console.log('stdout: ' + stdout);
        console.log('stderr: ' + stderr);
        resolve(stdout, stderr);
        if (error !== null) {
          console.log('exec error: ' + error);
          reject(error);
        }
    });

  });
}

mod.syncSettings = function(nodeRef){
  var self = this;
  console.log('Step 1');
  return new Promise(function(resolve, reject){
    console.log('Step 2');
    nodeRef.on('value', function(snapshot){
      console.log('Step 3');
      self.unTether().then(function(){
        console.log('Step 4');
        snapshot.val();
        console.log('Step 5');
        resolve(self.runExec('gphoto2 --set-config iso=100 aperture=4.5 shutterspeed=1/80'));

      }).catch(function(error){
        console.log('syncSettings', error);
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

/*

var self = this;
  return new Promise(function(resolve, reject){
    var itemRef = self.fbClient.child('category/' + categoryId);
    itemRef.update({name:categoryName}, function(error){
      if(error){
        reject(error);
      }else{
        resolve();
      }
    });
  });

 */