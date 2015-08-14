var AWS = require('aws-sdk'),
    chokidar = require('chokidar'),
    CommandService = require('./command-service'),
    exec = require('child_process').exec,
    Firebase = require('firebase'),
    fs = require('fs-extra'),
    // GPIO = require('pi-pins');
    moment = require('moment'),
    Promise = require('promise'),
    spawn = require('child_process').spawn,
    util = require('util'),  
    zlib = require('zlib');

module.exports = App;

var mod = App.prototype;

function App(fbUrl, pubKey, subKey){
  if (!(this instanceof App)) return new App(fbUrl, pubKey, subKey);

  this.cs = new CommandService({pubKey:pubKey, 
                                subKey:subKey, 
                                deviceUUID:process.env.RESIN_DEVICE_UUID, 
                                delegate:this});

  this.fbClient = new Firebase(fbUrl);
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
  this.runExec('gphoto2 --capture-image-and-download ' + this.fileNameFlag('preview'));
}

mod.fileNameFlag = function(type){
  switch(type){
    case 'new':
      return '--filename='+process.env.BASE_IMAGE_DIR+'new/'+process.env.RESIN_DEVICE_UUID+'_%m_%d_%y_%H_%M_%S.%C';
    break;

    case 'preview':
      return '--filename='+process.env.BASE_IMAGE_DIR+'preview/'+process.env.RESIN_DEVICE_UUID+'_%m_%d_%y_%H_%M_%S.%C';
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

      var gPhoto2 = spawn('gphoto2', ['--capture-tethered', this.fileNameFlag('new')], options);

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
        console.log(stdout);
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

mod.buildDirStructure = function(){
  fs.mkdirs(process.env.BASE_IMAGE_DIR);
  fs.mkdirs(process.env.BASE_IMAGE_DIR + 'preview/upload');
  fs.mkdirs(process.env.BASE_IMAGE_DIR + 'new');
}

mod.setupWatch = function(){
  var self = this;
  var fileRegEx = /([^\/]+)(?=\.\w+$)/;
  var options = {ignored: /[\/\\]\./, persistent: true};
  var dir = process.env.BASE_IMAGE_DIR;

  this.debugWatch = chokidar.watch([dir + 'preview/'], options)
  .on('add', function(path) {
    console.log('DEBUG: File', path);
  });
  
  // Watch for preview raw files
  this.rawWatch = chokidar.watch([dir + 'preview/*.nef', dir + 'preview/*.NEF'], options)
  .on('add', function(path) { 
    self.runExec('dcraw -v -e ' + path)
    .then(function(response){
      fs.remove(path);
    });
  });

  this.thumbnailWatch = chokidar.watch(dir + 'preview/*thumb.jpg', options)
  .on('add', function(path, stats) {
    var name = fileRegEx.exec(path)[0];
    self.runExec('convert ' + path + ' -resize 20% ' + dir + 'preview/upload/' + name + '.jpg')
    .then(function(response){
      fs.remove(path);
    });
  });

  this.uploadwWatch = chokidar.watch(dir + 'preview/upload/*.jpg', options)
  .on('add', function(path) { 

    var body = fs.createReadStream(path);
    var name = fileRegEx.exec(path)[0];
    var key = name + '.preview.jpg';

    var s3obj = new AWS.S3({params: {Bucket: 'snappyapp', Key: key}});
    s3obj.upload({Body: body})
    .on('httpUploadProgress', function(evt) { 
      // console.log(evt); 
    }).
    send(function(err, data) {
      if(!err){
        fs.remove(path);
        self.notifyUploadImageCompleted(data.Location);  
      }
    });
  });
  
}

mod.bootstrap = function (){
  console.log('Starting up client');
  this.buildDirStructure();
  this.setupWatch();
  // this.setupGPIO();
  
  this.syncWithFB().then(function(response){
    console.log('Success yo!');
  }).catch(function(error){
    console.log(error);
  });
}