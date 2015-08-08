var exec = require('child_process').exec,
    spawn = require('child_process').spawn,
    moment = require('moment');

module.exports = Tether;

var mod = Tether.prototype;

function Tether(message){
  if (!(this instanceof Tether)) return new Tether(message);

  console.log(message);
}