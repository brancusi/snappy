var util = require('util'),  
    exec = require('child_process').exec,
    PubNub = require('pubnub'),
    Firebase = require('firebase');

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
  var data = { channel:'node_feedback', 
                  message:{node:'lone_ranger', 
                  message:'online', 
                  status:'online'}};

  this.pnClient.subscribe({
    channel  : 'global,lone_ranger',
    connect  : self.notify(data),
    callback : function(response) {
      console.log('Message got', response);
    }
  });
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
    var data = {name:'lone_ranger', status:'online'};
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
  nodeRef.on('value', function(snapshot){
    console.log(snapshot.val());
    //TODO : set config
    // exec('gphoto2 --set-config');
  });
}

mod.bootstrap = function (){
  this.subscribe();
  this.syncWithFB().then(function(response){
    console.log('Success yo!');
  }).catch(function(error){
    console.log(error);
  });
}

/*

var self = this;
  return new Promise(function(resolve, reject){
    var itemRef = self.fbClient.child('category/' + categoryId);
    itemRef.update({name:categoryName}, function(error){
      if(error){
        reject(error);
      }else{
        resolve();
      }
    });
  });

 */