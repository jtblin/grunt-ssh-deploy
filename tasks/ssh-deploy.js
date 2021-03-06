'use strict';

module.exports = function(grunt) {

  // Please see the Grunt documentation for more information regarding task
  // creation: http://gruntjs.com/creating-tasks

  grunt.registerMultiTask('ssh-deploy', 'start deployment of the whole project', function() {
    var self = this;
    var done = self.async();
    var Connection = require('ssh2');
    var moment = require('moment');
    var timeStamp = moment().format('YYYYMMDDHHmmssSSS');
    var options = self.options();
    var async = require('async');
    var maxBuffer = 800 * 1024;

    options.servers.forEach(function(server){
      var c = new Connection();
      c.on('connect', function() {
        console.log('Connecting to server: ' + server.host);
      });
      c.on('ready', function() {
        console.log('Connected to server: ' + server.host);
        // execution of tasks
        execSingleServer(server,c);
      });
      c.on('error', function(err) {
        console.log("Error on server: " + server.host);
        console.error(err);
        if (err) {throw err;}
      });
      c.on('close', function(had_error) {
        console.log("Closed connection for server: " + server.host);
      });
      c.connect(server);
    });


    var execSingleServer = function(server, connection){
      // require local command handling
      var sys = require('sys')
      var childProcessExec = require('child_process').exec;

      var execLocal = function(cmd, next) {
        var nextFun = next;
        childProcessExec(cmd, {maxBuffer: maxBuffer}, function(err, stdout, stderr){
          grunt.log.debug(cmd);
          grunt.log.debug('stdout: ' + stdout);
          grunt.log.debug('stderr: ' + stderr);
          if (err !== null) {
            grunt.log.errorlns('exec error: ' + err);
            process.exit();
          }
          nextFun();
        });
      };

      // executes a remote command via ssh
      var exec = function(cmd, showLog, next){
        connection.exec(cmd, function(err, stream) {
          if (err) {
            grunt.log.errorlns('exec error: ' + err);
            process.exit();
          }
          stream.on('data', function(data, extended) {
            grunt.log.debug((extended === 'stderr' ? 'STDERR: ' : 'STDOUT: ') + data);
          });
          stream.on('end', function() {
            grunt.log.debug('REMOTE: ' + cmd);
            next && next()
          });
        });
      };


      // executes before tasks
      var executeBeforeTasks = function(callback){
        grunt.log.subhead('-------------------------------EXEC BEFORE DEPLOY COMMANDS');
        exec('', true, callback);
      };
      // create releases folder on server
      var createReleasesFolder = function(callback) {
        grunt.log.subhead('-------------------------------CREATE RELEASES FOLDER');
        var command = "mkdir -p " + options.deploy_path + "/releases/" + timeStamp;
        exec(command, options.debug, callback);
      };
      // zips local content with respecting exclude list
      var zipContentForDeployment = function(callback) {
        grunt.log.subhead('-------------------------------ZIPPING FOLDER');
        var excludeList = "--exclude='./deploy.tgz'";
        if (options.exclude_list) {
          options.exclude_list.map(function(item){
            excludeList += " --exclude='./" + item + "'";
          });
        }
        var command = "tar " + excludeList + ' -czvf deploy.tgz .';
        execLocal(command, callback);
      };
      // upload zipfile to server via scp
      var uploadZipFile = function(callback) {
        grunt.log.subhead('-------------------------------UPLOAD ZIPFILE');
        var scpAuthString = server.username + "@" + server.host + ":" + options.deploy_path + "/releases/" + timeStamp + '/';
        var command = "scp";
        if (server.privateKeyPath) command += ' -i ' + server.privateKeyPath;
        command += " ./deploy.tgz " + scpAuthString;
        execLocal(command, callback);
      };
      // unzips on remote and removes zipfolder
      var unzipOnRemote = function(callback) {
        grunt.log.subhead('-------------------------------CLEANUP REMOTE');

        var goToCurrent = "cd " + options.deploy_path + "/releases/" + timeStamp;
        var untar = "tar -xzvf deploy.tgz";
        var cleanup = "rm " + options.deploy_path + "/releases/" + timeStamp + "/deploy.tgz";
        var command = goToCurrent + " && " + untar + " && " + cleanup;
        exec(command, options.debug, callback);
      };

      // executing commands before symlink switch
      var executeWarmupCommands = function(callback) {
        if (options.cmds_warmup) {
          grunt.log.subhead('-------------------------------EXECUTE WARMUP COMMANDS');
          var changeToDeployDir = 'cd ' + options.deploy_path + '/releases/' + timeStamp;
          var command = changeToDeployDir + ' && ' + options.cmds_warmup.join(';');
          exec(command, options.debug, callback);
        }
        else {
          callback();
        }
      };

      // changes symlink to new release folder
      var changeSymLink = function(callback) {
        grunt.log.subhead('-------------------------------SWITCH SYMLINK');

        var removeCurrent = 'rm -rf ' + options.deploy_path + '/current';
        var setCurrent    = 'ln -s ' + options.deploy_path + '/releases/' + timeStamp + ' ' + options.deploy_path + '/current';
        var command = removeCurrent + " && " + setCurrent;
        exec(command, options.debug, callback);
      };

      // removing local zipfile
      var localCleanup = function(callback) {
        grunt.log.subhead('-------------------------------CLEANUP LOCAL');
        var command = 'rm deploy.tgz';
        execLocal(command, callback);
      };

      // executing post commands on remote machine
      var executePostCommands = function(callback) {
        if (options.cmds_after_deploy) {
          grunt.log.subhead('-------------------------------EXECUTE POSTDEPLOY COMMANDS');
          var changeToDeployDir = 'cd ' + options.deploy_path + '/current';
          var command = changeToDeployDir + ' && ' + options.cmds_after_deploy.join(';');
          exec(command, options.debug, callback);
        }
        else {
          callback();
        }
      };

      // executing post commands on remote machine
      var executePostCommands = function(callback) {
        if (options.cmds_after_deploy) {
          grunt.log.subhead('-------------------------------EXECUTE POSTDEPLOY COMMANDS');
          var changeToDeployDir = 'cd ' + options.deploy_path + '/current';
          var command = changeToDeployDir + ' && ' + options.cmds_after_deploy.join(';');
          exec(command, options.debug, callback);
        }
        else {
          callback();
        }
      };

      // keep only 3 recent releases
      var cleanupOldReleases = function(callback) {
        grunt.log.subhead('-------------------------------KEEP ONLY RECENT FOLDERS');
        var changeToDeployDir = 'cd ' + options.deploy_path + '/releases';
        var numberOfReleasesToKeep = options.numberOfReleasesToKeep || 3;
        var command = changeToDeployDir + ' && ls -dt */ | tail -n +' + (numberOfReleasesToKeep+1) + ' | xargs rm -rf';
        exec(command, options.debug, callback);
      };

      // closing connection to remote server
      var closeConnection = function(callback) {
        connection.end();
      };

      /*---------------------------------------
       *
       * async execution of the deploy steps
       *
       ---------------------------------------*/
      async.series([
        executeBeforeTasks,
        createReleasesFolder,
        zipContentForDeployment,
        uploadZipFile,
        unzipOnRemote,
        executeWarmupCommands,
        changeSymLink,
        localCleanup,
        executePostCommands,
        cleanupOldReleases,
        closeConnection
      ]);
    };
  });
};
