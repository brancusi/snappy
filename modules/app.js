var util = require('util'),  
    exec = require('child_process').exec,
    spawn = require('child_process').spawn,
    PubNub = require('pubnub'),
    Firebase = require('firebase'),
    moment = require('moment'),
    Promise = require('promise'),
    chokidar = require('chokidar'),
    fs = require('fs'),
    AWS = require('aws-sdk'),
    zlib = require('zlib');

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

  var channels = 'global,'+process.env.RESIN_DEVICE_UUID;
  this.pnClient.subscribe({
    channel  : channels,
    connect  : self.notify(connectMessage),
    callback : function(message, data, channel) {
      if(channel === 'global'){
        self.processGlobalMessage(message);
      }else if(channel === process.env.RESIN_DEVICE_UUID){
        self.processNodeMessage(message);
      }
    }
  });
}

mod.processGlobalMessage = function(message){
  // require('../global_commands/'+message.cmd)(message);
  console.log('global', message);
  switch(message.cmd){
    case 'tether' :
      this.tether();
      break;
    case 'unTether' :
      this.unTether();
      break;
    case 'wakeUp' :
      this.wakeUp();
      break;
    case 'capture' :
      this.captureImage();
      break;
  }
}

mod.processNodeMessage = function(message){
  console.log('node', message);
  switch(message.cmd){
    case 'capture' :
      this.captureImage();
      break;
    case 'wakeUp' :
      this.wakeUp();
      break;
  }
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
    var data = {name:process.env.RESIN_DEVICE_UUID, swarm:process.env.SWARM_ID, status:'online'};

    nodeRef.update(data, function(error){
      if(error){
        reject(error);
      }else{
        resolve(self.syncSettings(nodeRef));
      }
    });
  });
}

mod.captureImage = function(){
  this.runExec('gphoto2 --capture-image-and-download --filename=pending/'+process.env.RESIN_DEVICE_UUID+'_%m_%d_%y_%H_%M_%S.%C');
}

mod.wakeUp = function(){
  //TODO: Send wakeup signal to camera, should be red to ground
}

mod.tether = function(){
  if(!this.isTetheredMode()){
    try{
      this.tetheredProcess = spawn('gphoto2', ['--capture-tethered', '--filename=pending/'+process.env.RESIN_DEVICE_UUID+'_%m_%d_%y_%H_%M_%S.%C']);
    }catch(err){
      console.log('Error tethering', err);
    }
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
        console.log(data);
        var cmdStr = 'gphoto2 --set-config-index iso=' + data.iso + ' --set-config-index shutterspeed=' + data.shutterspeed + ' --set-config-index aperture' + data.aperture
        resolve(self.runExec(cmdStr));
      }).catch(function(error){
        reject(error);
      }) 
    });
  })
  
}

mod.setupWatch = function(){
  var watcher = chokidar.watch('pending', {
    persistent: true
  });

  watcher.on('add', function(path) { 
    console.log('File', path, 'has been added'); 

    var body = fs.createReadStream(path).pipe(zlib.createGzip());
    
    var s3obj = new AWS.S3({params: {Bucket: 'snappyapp', Key: 'AKIAJQWLH22WNJ67RWIA'}});
    s3obj.upload({Body: body})
    .on('httpUploadProgress', function(evt) { console.log(evt); }).
    send(function(err, data) { console.log(err, data) });
  })
}

mod.bootstrap = function (){
  this.setupWatch();
  this.subscribe();
  this.syncWithFB().then(function(response){
    console.log('Success yo!');
  }).catch(function(error){
    console.log(error);
  });
}