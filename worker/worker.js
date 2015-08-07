var spawn = require('child_process').spawn
var Queue = require('firebase-queue'),
    Firebase = require('firebase')

if (process.argv.length < 4) {
  console.log("usage: node worker.js firebaseUrl command [arg1, arg2, ...]")
  console.log("  For authentication, set FIREBASE_TOKEN environment variable.")
  process.exit()
}
var queueUrl = process.argv[2]
var cmdArgs = process.argv.slice(3)

var queueRef = new Firebase(queueUrl)
var start = function () {
  new Queue(queueRef, function (data, progress, resolve, reject) {
    // Read and process task data
    var bufferRef = new Firebase(data.bufferUrl)
    var log = function (msg) {
      bufferRef.child('log').push(msg.toString())
      process.stdout.write(msg.toString())
    }
    log("WORKER: start command: " + cmdArgs + "\n\n")
    var env = Object.create(process.env)
    for (var name in data.env) {
      env[name] = data.env[name]
    }
    var cmd = spawn(cmdArgs[0], cmdArgs.slice(1), { env: env })
    cmd.stdout.on('data', log)
    cmd.stderr.on('data', log)
    cmd.on('error', function (err) { reject(err) })
    cmd.on('close', function (code) {
      if (code === 0) {
        log("\nWORKER: command completed.\n\n")
        resolve()
      } else {
        log("\nWORKER: command failed.\n\n")
        reject("exit code: " + code)
      }
    })
  });
}

if (process.env.FIREBASE_TOKEN) {
  queueRef.authWithCustomToken(process.env.FIREBASE_TOKEN, function (error, result) {
    if (error) {
      console.log("Authentication Failed!", error);
    } else {
      console.log("Authentication succeeded!", result);
      start()
    }
  })
  delete process.env.FIREBASE_TOKEN
} else {
  start()
}
