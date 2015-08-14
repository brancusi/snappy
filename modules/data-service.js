var Bacon   = require('baconjs').Bacon,
    Firebase = require('firebase'),
    runExec = require('../utils/exec').runExec,
    Promise = require('promise');

module.exports = DataService;

var mod = DataService.prototype;

function DataService(config){
  if (!(this instanceof DataService)) return new DataService(config);
  this.config = config;

  this.fbClient = new Firebase(config.fbUrl);
  this.settings = new Bacon.Bus();

  this.setup();
}

mod.setup = function(){
  var self = this;

  this.loadNodeData()
  .then(function(data){
    self.setupListeners(data);
  }).catch(function(error){
    console.log('There was as error', error);
  })
}

mod.setupListeners = function(nodeData){
  this.linkWithSettings(nodeData.val().setting);
}

mod.linkWithSettings = function(settingID){
  var self = this;

  var nodeRef = self.fbClient.child('settings/' + settingID);

  var setting = nodeRef.on('value', function(snapshot){
    self.settings.push(snapshot.val());
    console.log(snapshot.val());
  });
}

mod.loadNodeData = function(){
  var self = this;

  return new Promise(function(resolve, reject){
    self.createOrLoadNode().then(function(data){
      resolve(data);
    }).catch(function(error){
      reject(error);
    });

  });
}

mod.createOrLoadNode = function(){
  var self = this;
  return new Promise(function(resolve, reject){

    var nodeRef = self.fbClient.child('nodes/' + self.config.deviceUUID);

    nodeRef.once('value', function(snapshot){
      if(!snapshot.exists()){
        console.log('Gonna make one');
        resolve(self.createNode(nodeRef));
      }else{
        console.log('Got one already');
        resolve(snapshot);
      }
    });

  });
}

mod.createNode = function(nodeRef){
  var self = this;
  return new Promise(function(resolve, reject){
    var data = {name:self.config.nodeName,
                swarm:self.config.swarmID, 
                setting:self.createSetting(self.config.deviceUUID)};

    nodeRef.update(data, function(error){
      if(error){
        reject(error);
      }else{
        self.registerWithSwarm(self.config.deviceUUID)
        .then(function(){
          resolve(data);
        });
      }
    });

  });
}

mod.createSetting = function(deviceUUID){
    
  var nodeRef = this.fbClient.child('settings/');

  var data = {iso:1, aperture:5, shutterspeed:20, node:deviceUUID};

  var record = nodeRef.push(data, function(error){
    if(error){
      console.log('Error creating setting: ', error);
    }
  });

  return record.key();
}

mod.registerWithSwarm = function(present){
  var self = this;

  if(present === undefined){
    present = true;
  }

  return new Promise(function(resolve, reject){
    var swarmRef = self.fbClient.child('swarms/' + self.config.swarmID + '/nodes');
    swarmRef.once('value', function(snapshot){
      var data = {};
      data[self.config.deviceUUID] = present;

      swarmRef.update(data, function(error){
        if(error){
          reject(error);
        }else{
          resolve(data);
        }
      });
    });
  });
}

mod.updatePreviewImage = function(e){
  var nodeRef = this.fbClient.child('nodes/' + this.config.deviceUUID);
  nodeRef.update({latestFileURL:e.value()});
}