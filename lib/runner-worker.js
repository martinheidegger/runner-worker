module.exports = function (args, options, cb) {
  var task
  const type = String(args[0]).trim().toLowerCase()
  if (type === 'runner') {
    task = require('./runner').bind(null, options, args.slice(3))
  } else if (type === 'worker') {
    task = require('./worker').bind(null, args.slice(3))
  }
  if (!task) {
    return cb('usage: runner-worker runner|worker')
  }
  if (!options) {
    options = {}
  }
  require('./auth')(args[1], args[2], task, function (err, proc) {
    if (err) {
      return cb(err)
    }
    proc.type = type
    cb(null, proc)
  })
}
