# grunt-ssh-deploy: simple deployment via SSH

> deploy the local project via SSH

## Getting Started
This plugin requires Grunt `~0.4.1`

If you haven't used [Grunt](http://gruntjs.com/) before, be sure to check out the [Getting Started](http://gruntjs.com/getting-started) guide, as it explains how to create a [Gruntfile](http://gruntjs.com/sample-gruntfile) as well as install and use Grunt plugins. Once you're familiar with that process, you may install this plugin with this command:

```shell
npm install grunt-ssh-deploy --save-dev
```

Once the plugin has been installed, it may be enabled inside your Gruntfile with this line of JavaScript:

```js
grunt.loadNpmTasks('grunt-ssh-deploy');
```

## The "deploy" task
Your remote server target folder for deployment has following layout:

```shell
/path/to/deploy +
                |
                |- current -> symlink to ./releases/<timestamp> #last deployment
                |
                |- releases +
                            |-<timestamp1> 
                            |
                            |-<timestamp2>
```

### Overview
In your project's Gruntfile, add a section named `ssh-deploy` to the data object passed into `grunt.initConfig()`.

```js
grunt.initConfig({
  "ssh-deploy": {
    liveservers: {
      options:{
        servers: [{
          host: '123.123.123.12',
          port: 22,

          // usage with user/password authentication
          username: 'username',
          password: 'password'

          // usage with SSH Agent forwarding
          agent: process.env.SSH_AUTH_SOCK

          // usage with private key
          username: 'username',
          privateKey: grunt.file.read('deploy/private_key.pem'),
          privateKeyPath: 'deploy/private_key.pem'
        }],
        cmds_before_deploy: ["some cmds you may want to exec before deploy"],
        cmds_warmup: ["some cmds to be executed before symlink is switched to new deployment result"],
        cmds_after_deploy: ["forever restart", "some other cmds you want to exec after deploy"],
        deploy_path: '/path/to/deployment',
        // list of folders and files that should be excluded from deployment
        exclude_list: ['node_modules', 'private']
      }
    }
  },
})
```
###Current Execution Order
1. create releases/ folder and new folder under releases/
2. zip local project folder with exclude parameters
3. upload tgz file to remote
4. execute warmup commands on remote machine etc. restarting services, delete fragments
5. switch symlinks to new folder 
6. execute local cleanup
7. execute post commands on remote host
8. keep only 3 recent releases
9. close connection

###Authentication
Currently password authentication via username and password and agent SSH agent forwarding is possible.
With SSH agent forwarding your personal keys can be used for authentication but host aliases are currently not supported
Please see documentation of [node-SSH2](https://github.com/mscdex/ssh2) plugin.
To use private keys, both the string and the path are required for ssh and scp. TODO: read string from path.

### Debugging
You can have a look inside every step that is executed by using `grunt ssh-deploy --debug`
All local and remote STDOUT and STDERR output will be shown on the console.

## Contributing
In lieu of a formal styleguide, take care to maintain the existing coding style. Add unit tests for any new or changed functionality. Lint and test your code using [Grunt](http://gruntjs.com/).
