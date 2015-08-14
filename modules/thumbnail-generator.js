var AWS = require('aws-sdk'),
    chokidar = require('chokidar'),
    fs = require('fs-extra'),
    runExec = require('../utils/exec').runExec;

module.exports = ThumbnailGenerator;

var mod = ThumbnailGenerator.prototype;

function ThumbnailGenerator(baseDir){
  if (!(this instanceof ThumbnailGenerator)) return new ThumbnailGenerator(baseDir);
  this.baseDir = baseDir;
  
  this.buildDirectories();
  this.setupWatch();
}

mod.buildDirectories = function(){
  fs.mkdirs(this.baseDir + 'preview/upload');
}

mod.setupWatch = function(){
  var self = this;
  var fileRegEx = /([^\/]+)(?=\.\w+$)/;
  var options = {ignored: /[\/\\]\./, persistent: true};
  var dir = process.env.BASE_IMAGE_DIR;
  
  // Watch for preview raw files
  this.rawWatch = chokidar.watch([dir + 'preview/*.nef', dir + 'preview/*.NEF'], options)
  .on('add', function(path) { 
    runExec('dcraw -v -e ' + path)
    .then(function(response){
      fs.remove(path);
    });
  });

  this.thumbnailWatch = chokidar.watch(dir + 'preview/*thumb.jpg', options)
  .on('add', function(path, stats) {
    var name = fileRegEx.exec(path)[0];
    runExec('convert ' + path + ' -resize 20% ' + dir + 'preview/upload/' + name + '.jpg')
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