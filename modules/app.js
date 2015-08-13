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
    // GPIO = require('pi-pins');

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
                  message:{node:process.env.RESIN_DEVICE_UUID, 
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
  switch('global', message.cmd){
    case 'tether' :
      this.tether();
      break;
    case 'unTether' :
      this.unTether();
      break;
    case 'capture' :
      this.captureImage();
      break;
    case 'captureTethered' :
      this.captureTethered();
      break;
  }
}

mod.processNodeMessage = function(message){
  console.log('node', message.cmd);
  switch(message.cmd){
    case 'capture' :
      this.captureImage();
      break;
    case 'tether' :
      this.tether();
      break;
    case 'unTether' :
      this.unTether();
      break;
    case 'captureTethered' :
      this.captureTethered();
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
  this.runExec('gphoto2 --capture-image-and-download ' + this.fileNameFlag('pending'));
}

mod.fileNameFlag = function(type){
  switch(type){
    case 'pending':
      return '--filename=pending/'+process.env.RESIN_DEVICE_UUID+'_%m_%d_%y_%H_%M_%S.%C';
    break;
  }
}

mod.tether = function(){

  if(!this.isTetheredMode()){
    try{

      var options = {
        stdio: [
          0,
          'pipe',
          'pipe'
        ]
      }

      var gPhoto2 = spawn('gphoto2', ['--capture-tethered', this.fileNameFlag('pending')], options);



      gPhoto2.stdout.on('data', function (data) {
        console.log('stdout: ' + data);
      });

      gPhoto2.stderr.on('data', function (data) {
        console.log('stderr: ' + data);
      });

      this.tetheredProcess = gPhoto2;

    }catch(err){
      console.log('Error tethering', err);
    }
  }
}

mod.unTether = function(){
  var self = this;
  console.log('Entered unTether');
  return new Promise(function(resolve, reject){
    if(self.isTetheredMode()){
      console.log('Is tethered and will now untether');
      self.tetheredProcess.on('close', function (code, signal) {
        self.tetheredProcess = null;
        console.log('Untethered! Will resolve');
        resolve('Untethered ok! '+signal);
      });

      self.tetheredProcess.on('SIGINT', function (code, signal) {
        self.tetheredProcess = null;
        console.log('Untethered! Will resolve');
        resolve('Untethered ok! '+signal);
      });

      console.log('tethered and will now kill process');
      self.tetheredProcess.kill('SIGINT');
    }else{
      console.log('not tethered and will now resolve');
      resolve();
    }
  });
  
}

mod.isTetheredMode = function(){
  return (this.tetheredProcess !== null && this.tetheredProcess !== undefined);
}

mod.runExec = function(cmd){
  console.log('cmd', cmd);
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

      console.log('something changed lets sync', snapshot.val());    

      self.unTether().then(function(){
        console.log('Untethered');
        var data = snapshot.val();
        var cmdStr = 'gphoto2 --set-config-index iso=' + data.iso + ' --set-config-index shutterspeed=' + data.shutterspeed + ' --set-config-index aperture' + data.aperture
        resolve(self.runExec(cmdStr));
      }).catch(function(error){
        console.log('Couldnt untether');
        reject(error);
      }) 
    });
  })
  
}

mod.notifyUploadImageCompleted = function(fileLocation){

  var re = /^.*\.(jpg|JPG)$/; 

  if(re.test(fileLocation)){
    console.log('Updating FB with jpg', fileLocation);
    var self = this;
    return new Promise(function(resolve, reject){

      var nodeRef = self.fbClient.child('nodes/' + process.env.RESIN_DEVICE_UUID);
      var data = {latestFileURL:fileLocation};
      nodeRef.update(data, function(error){
        if(error){
          reject(error);
        }else{
          console.log('All good on the file path');
          resolve();
        }
      });

    });

  }
}

mod.setupGPIO = function(){
  this.shutterPin = GPIO.connect(14);
  this.shutterPin.mode('low');
}

mod.captureTethered = function(){
  var self = this;
  var startTime = moment();
  console.log('Will set to high');

  this.shutterPin.mode('high');

  setTimeout(function() {
    console.log('Will set to low', startTime.diff(moment()));
    self.shutterPin.mode('low');
  }, 50);
}

mod.setupWatch = function(){
  var self = this;

  var previewWatch = chokidar.watch('pending/preview/*.jpg', {
    ignored: /[\/\\]\./,
    persistent: true
  });

  previewWatch.on('add', function(path, stats) { 
    console.log('File', path, 'has been added', 'Stats: ', stats); 

    var body = fs.createReadStream(path);
    var name = path.substring(8, path.indexOf('.'));
    var key = name + '.preview.jpg';

    var s3obj = new AWS.S3({params: {Bucket: 'snappyapp', Key: key}});
    s3obj.upload({Body: body})
    .on('httpUploadProgress', function(evt) { 
      // console.log(evt); 
    }).
    send(function(err, data) {
      if(!err){
        fs.unlink(path);
        fs.unlink('pending/'+name+'.thumb.jpg');
        self.notifyUploadImageCompleted(data.Location);  
      }
    });
  });

  var rawWatch = chokidar.watch('pending/*.nef', {
    ignored: /[\/\\]\./,
    persistent: true
  });

  rawWatch.on('add', function(path, stats) { 
    console.log('File', path, 'has been added', 'Stats: ', stats); 

    self.runExec('dcraw -e ' + path);
  });

  var thumbnailWatch = chokidar.watch('pending/*thumb.jpg', {
    ignored: /[\/\\]\./,
    persistent: true
  });

  thumbnailWatch.on('add', function(path, stats) { 
    console.log('File', path, 'has been added', 'Stats: ', stats); 

    var name = path.substring(8, path.indexOf('.'));

    self.runExec('convert ' + path + ' -resize 10% ' + 'pending/preview/' + name + '.jpg');

    // fs.unlink(path);

    // self.runExec('convert ' + 'pending/' + thumbName + ' -resize 10% ' + 'pending/preview/' + name + '.jpg');
    // try {
    //   // fs.unlink('pending/' + thumbName);
    // }catch(err){
    //   console.log(err);
    // }

    // var body = fs.createReadStream(path);
    // var name = path.substring(8);

    // var s3obj = new AWS.S3({params: {Bucket: 'snappyapp', Key: name}});
    // s3obj.upload({Body: body})
    // .on('httpUploadProgress', function(evt) { 
    //   // console.log(evt); 
    // }).
    // send(function(err, data) {
    //   if(!err){
    //     fs.unlink(path);
    //     self.notifyUploadImageCompleted(data.Location);  
    //   }
    // });
  });

}



mod.bootstrap = function (){
  // this.setupGPIO();
  this.setupWatch();
  this.subscribe();
  this.syncWithFB().then(function(response){
    console.log('Success yo!');
  }).catch(function(error){
    console.log(error);
  });
}