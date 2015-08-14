var exec = require('child_process').exec,
    Promise = require('promise'),
    spawn = require('child_process').spawn;

module.exports = {
  runExec: function(cmd){
    console.log('Will try to exec this command now', cmd);
    return new Promise(function(resolve, reject){
      exec(cmd, function(error, stdout, stderr){
        resolve(stdout);

        if (error !== null) {
          reject(error);
        }
      });
    });
  }
}