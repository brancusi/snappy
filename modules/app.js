var CommandService = require('./command-service'),
    DataService = require('./data-service'),
    fs = require('fs-extra'),
    runExec = require('../utils/exec').runExec,
    
    // GPIO = require('pi-pins');
    moment = require('moment'),
    Promise = require('promise'),
    spawn = require('child_process').spawn,
    ThumbnailGenerator = require('./thumbnail-generator');

module.exports = App;

var mod = App.prototype;

function App(fbUrl, pubKey, subKey){
  if (!(this instanceof App)) return new App(fbUrl, pubKey, subKey);

  this.commandService = new CommandService({pubKey:pubKey, 
                                            subKey:subKey, 
                                            deviceUUID:process.env.RESIN_DEVICE_UUID, 
                                            delegate:this});

  this.dataService = new DataService({fbUrl:fbUrl,
                                      deviceUUID:process.env.RESIN_DEVICE_UUID,
                                      swarmID:process.env.SWARM_ID,
                                      nodeName:process.env.NODE_NAME});

  this.setupThumbnailGenerator();

  fs.mkdirs(process.env.BASE_IMAGE_DIR + 'new');

  this.setupEventHandlers();
}

mod.setupEventHandlers = function(){
  this.dataService.settings.subscribe(this.updateCameraSettings.bind(this));
}

mod.updateCameraSettings = function(settingsData){
  this.unTether().then(function(){
    var cmdStr = 'gphoto2 --set-config-index iso=' + settingsData.iso + ' --set-config-index shutterspeed=' + settingsData.shutterspeed + ' --set-config-index aperture' + settingsData.aperture;
    runExec(cmdStr);
  }).catch(function(error){
    console.log('Couldnt untether');
  });
}

mod.setupThumbnailGenerator = function(){
  var self = this;
  this.thumbnailGenerator = new ThumbnailGenerator(process.env.BASE_IMAGE_DIR);
  this.thumbnailGenerator.thumbnails
  .subscribe(function(path){
    self.dataService.updatePreviewImage.call(dataService, path);
  });
}

mod.captureImage = function(){
  runExec('gphoto2 --capture-image-and-download ' + this.fileNameFlag('preview'));
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
  return new Promise(function(resolve, reject){
    if(self.isTetheredMode()){
      self.tetheredProcess.on('close', function (code, signal) {
        self.tetheredProcess = null;
        resolve('Untethered ok! '+signal);
      });

      self.tetheredProcess.on('SIGINT', function (code, signal) {
        self.tetheredProcess = null;
        resolve('Untethered ok! '+signal);
      });

      self.tetheredProcess.kill('SIGINT');
    }else{
      resolve();
    }
  });
  
}

mod.isTetheredMode = function(){
  return (this.tetheredProcess !== null && this.tetheredProcess !== undefined);
}

mod.setupGPIO = function(){
  this.shutterPin = GPIO.connect(14);
  this.shutterPin.mode('low');
}

mod.captureTethered = function(){
  var self = this;
  var startTime = moment();

  this.shutterPin.mode('high');

  setTimeout(function() {
    self.shutterPin.mode('low');
  }, 20);
}
