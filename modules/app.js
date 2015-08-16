var CommandService = require('./command-service'),
    DataService = require('./data-service'),
    fs = require('fs-extra'),
    GPIO = require('pi-pins'),
    runExec = require('../utils/exec').runExec,
    moment = require('moment'),
    Promise = require('promise'),
    spawn = require('child_process').spawn,
    ThumbnailGenerator = require('./thumbnail-generator');

const TMP_IMAGE_DIR = process.env.APP_BASE + '/tmp/images/preview/';
const SWARM_IMAGE_DIR = process.env.APP_BASE + '/tmp/images/swarm/';

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

  fs.mkdirs(SWARM_IMAGE_DIR);

  this.setupGPIO();

  this.setupEventHandlers();
}

mod.setupEventHandlers = function(){
  this.dataService.settings.subscribe(this.updateCameraSettings.bind(this));
}

mod.updateCameraSettings = function(e){
  this.unTether().then(function(){
    
    var data = e.value();
    
    var cmdStr = 'gphoto2 --set-config-index iso=' + data.iso 
               + ' --set-config-index shutterspeed=' + data.shutterspeed 
               + ' --set-config-index f-number=' + data.aperture;
    
    runExec(cmdStr);

  }).catch(function(error){
    console.log('Couldnt untether');
  });
}

mod.setupThumbnailGenerator = function(){
  var self = this;
  this.thumbnailGenerator = new ThumbnailGenerator(TMP_IMAGE_DIR);
  this.thumbnailGenerator.thumbnails.subscribe(self.dataService.updatePreviewImage.bind(self.dataService));
}

mod.captureImage = function(){
  runExec('gphoto2 --capture-image-and-download ' + this.fileNameFlag('preview'));
}

mod.fileNameFlag = function(type){
  switch(type){
    case 'new':
      return '--filename='+TMP_IMAGE_DIR+process.env.RESIN_DEVICE_UUID+'_%m_%d_%y_%H_%M_%S.%C';
    break;

    case 'preview':
      return '--filename='+TMP_IMAGE_DIR+process.env.RESIN_DEVICE_UUID+'_%m_%d_%y_%H_%M_%S.%C';
    break;
  }
}

mod.tether = function(){
  console.log('Tether');
  var self = this;
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
        self.unTether();
      });

      this.tetheredProcess = gPhoto2;

    }catch(err){
      console.log('Error tethering', err);
    }
  }else{
    console.log('Already tethered');
  }
}

mod.unTether = function(){
  console.log('Entered unTether');
  var self = this;
  return new Promise(function(resolve, reject){
    console.log('Entered promise');
    if(self.isTetheredMode()){
      
      self.tetheredProcess.on('close', function (code, signal) {
        self.processUntethered(resolve);
      });

      self.tetheredProcess.on('exit', function (code, signal) {
        self.processUntethered(resolve);
      });

      self.tetheredProcess.on('error', function (code, signal) {
        self.processUntethered(resolve);
      });

      self.tetheredProcess.on('SIGINT', function (code, signal) {
        self.processUntethered(resolve);
      });

      self.tetheredProcess.kill('SIGINT');
    }else{
      console.log('Already Untethered so resolving');
      self.tetheredProcess = null;
      resolve();
    }
  });
  
}

mod.processUntethered = function(resolve){
  console.log(resolve.called);
  if(!resolve.called){
    self.tetheredProcess = null;
    resolve.called = true;
    resolve();
  }
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
