var exec = require('child_process').exec,
    spawn = require('child_process').spawn,
    moment = require('moment');

module.exports = TestThis;

var mod = TestThis.prototype;

function TestThis(message){
  if (!(this instanceof TestThis)) return new TestThis(message);

  console.log('message');
}