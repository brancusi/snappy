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
  fs.mkdirsSync(this.baseDir + 'upload');
}

mod.setupWatch = function(){
  var self = this;
  var fileRegEx = /([^\/]+)(?=\.\w+$)/;
  var options = {ignored: /[\/\\]\./, 
                 persistent: true,
                 followSymlinks: true};

  this.debugWatcher = chokidar.watch(this.baseDir, options)
  .on('change', function(path, stats) {
    console.log('Debug watcher', path, 'changed size to', stats);
  });

  // Watch for preview raw files
  this.rawWatch = chokidar.watch([this.baseDir + '*.nef', this.baseDir + '*.NEF'], options)
  .on('add', function(path) { 
    runExec('dcraw -v -e ' + path)
    .then(function(response){
      fs.remove(path);
    });
  });

  this.thumbnailWatch = chokidar.watch(this.baseDir + '*thumb.jpg', options)
  .on('add', function(path, stats) {
    var name = fileRegEx.exec(path)[0];
    runExec('convert ' + path + ' -resize 20% ' + self.baseDir + 'upload/' + name + '.jpg')
    .then(function(response){
      fs.remove(path);
    });
  });

  this.uploadwWatch = chokidar.watch(this.baseDir + 'upload/*.jpg', options)
  .on('add', this.uploadAndClearFile.bind(this))
  .on('change', this.uploadAndClearFile.bind(this));
  
}

mod.uploadAndClearFile(path){
  var self = this;
  var fileRegEx = /([^\/]+)(?=\.\w+$)/;

  fs.readFile(path, function(err, data){
    if(err){
      console.log(err);
    }else if(data.length === 0){
      console.log('This buffer is empty, skipping');
    }else{
      console.log('Buffer data:', data);
      var name = fileRegEx.exec(path)[0];
      var key = name + '.preview.jpg';

      var s3obj = new AWS.S3({params: {Bucket: 'snappyapp', Key: key}});
      s3obj.upload({Body: data})
      .on('httpUploadProgress', function(evt) { 
        console.log(evt);
      })
      .send(function(err, response) {
        console.log(err);
        if(!err){
          fs.remove(path);
          self.thumbnails.push(response.Location);
        }
      });
    }
    
  });
}