'use strict'
module.exports = function (command, options, argv, cb) {
  var cmd
  if (command === 'runner') {
    cmd = require('./lib/runner')
  } else if (command === 'worker') {
    cmd = require('./lib/worker')
  }
  if (!cmd) {
    return cb(new Error('Unknown command'))
  }
  if (!options) {
    options = {}
  }
  require('./lib/auth')(options, function (err, db) {
    if (err) {
      return cb(err)
    }
    options.db = db
    if (options.namespace) {
      options.root = db.ref().child(options.namespace)
    } else {
      options.root = db.ref()
    }
    try {
      var task = cmd(
        options,
        argv || []
      )
    } catch (e) {
      return cb(e)
    }

    cb(null, task)
  })
}
