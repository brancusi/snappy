var Firebase = require('firebase'),
    runExec = require('../utils/exec').runExec,
    Promise = require('promise');

module.exports = DataService;

var mod = DataService.prototype;

function DataService(config){
  if (!(this instanceof DataService)) return new DataService(config);
  
  this.config = config

  this.fbClient = new Firebase(config.fbUrl);

  this.init();
}

mod.init = function(){
  this.syncWithFB().then(function(response){
    console.log('Synced with fb setting');
  }).catch(function(error){
    console.log(error);
  });
}

mod.syncWithFB = function(){
  var self = this;
  return new Promise(function(resolve, reject){
    self.createOrUpdateNode().then(function(){
      var swarmRef = self.fbClient.child('swarms/' + this.config.swarmID + '/nodes');
      swarmRef.once('value', function(snapshot){
        var data = {};
        data[this.config.deviceUUID] = true;
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

    var nodeRef = self.fbClient.child('nodes/' + this.config.deviceUUID);
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
    var data = {name:this.config.deviceUUID, swarm:this.config.swarmID};

    nodeRef.update(data, function(error){
      if(error){
        reject(error);
      }else{
        resolve(self.syncSettings(nodeRef));
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
        var cmdStr = 'gphoto2 --set-config-index iso=' + data.iso + ' --set-config-index shutterspeed=' + data.shutterspeed + ' --set-config-index aperture' + data.aperture
        resolve(runExec(cmdStr));
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

      var nodeRef = self.fbClient.child('nodes/' + this.config.deviceUUID);
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