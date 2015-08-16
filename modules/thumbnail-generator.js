var AWS = require('aws-sdk'),
    chokidar = require('chokidar'),
    fs = require('fs-extra'),
    Bacon   = require('baconjs').Bacon,
    runExec = require('../utils/exec').runExec;

module.exports = ThumbnailGenerator;

var mod = ThumbnailGenerator.prototype;

function ThumbnailGenerator(baseDir){
  if (!(this instanceof ThumbnailGenerator)) return new ThumbnailGenerator(baseDir);
  this.baseDir = baseDir;

  this.buildDirectories();
  this.setupWatch();
  this.thumbnails = new Bacon.Bus();
}

mod.buildDirectories = function(){
  fs.mkdirs(this.baseDir + 'upload');
}

mod.setupWatch = function(){
  var self = this;
  var fileRegEx = /([^\/]+)(?=\.\w+$)/;
  var options = {ignored: /[\/\\]\./, 
                 persistent: true,
                 followSymlinks: true};

  this.debugWatch = chokidar.watch('tmp/images/preview/', options)
  .on('raw', function(event, path, details) { 
    console.log('Watching and saw', event, path, details);
  });

  // Watch for preview raw files
  this.rawWatch = chokidar.watch(['tmp/images/preview/' + '*.nef', 'tmp/images/preview/' + '*.NEF'], options)
  .on('add', function(path) { 
    runExec('dcraw -v -e ' + path)
    .then(function(response){
      fs.remove(path);
    });
  });

  this.thumbnailWatch = chokidar.watch('tmp/images/preview/*thumb.jpg', options)
  .on('add', function(path, stats) {
    var name = fileRegEx.exec(path)[0];
    runExec('convert ' + path + ' -resize 20% ' + this.baseDir + 'upload/' + name + '.jpg')
    .then(function(response){
      fs.remove(path);
    });
  });

  this.uploadwWatch = chokidar.watch('tmp/images/preview/upload/*.jpg', options)
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
        self.thumbnails.push(data.Location);
      }
    });
  });
  
}