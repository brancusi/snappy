var exec = require('child_process').exec,
    Promise = require('promise'),
    spawn = require('child_process').spawn;

module.exports = ExecTools;

ExecTools.prototype.runExec = function(cmd){
  return new Promise(function(resolve, reject){
    var child = exec(cmd,
      function (error, stdout, stderr) {
        resolve(stdout);
        if (error !== null) {
          reject(error);
        }
    });

  });
}