const EventEmitter = require('events')
const prepareStdio = require('./prepareStdio')

function syncAllTrue (targetNode, nodes) {
  const handlers = []
  targetNode.set(false)
  const max = nodes.length
  var count = 0
  const updateTarget = function () {
    if (count === max) {
      setImmediate(function () {
        targetNode.set(true)
      })
    }
  }
  nodes.forEach(function (node, index) {
    const handler = function (snap) {
      const val = snap.val()
      if (val === true) {
        count += 1
        node.off('value', handler)
        updateTarget()
      }
    }
    handlers[index] = handler
    node.on('value', handler)
  })
  updateTarget()
  return targetNode
}
function writeTo (dbRef, stream, message) {
  var data = Buffer.from(message).toJSON()
  data.time = new Date().toISOString()
  dbRef.child(stream.key).child('buffer').push(data)
}
module.exports = function (options) {
  if (!options) {
    options = {}
  }
  if (!options.root) {
    throw new Error('`options.root` is a required option.')
  }
  const taskRef = options.root.child('tasks').push(null)
  const ioRef = taskRef.child('io')
  const stdio = prepareStdio(ioRef, options.stdio)
  const proc = new EventEmitter()
  Object.assign(proc, {
    url: taskRef.toString(),
    type: 'runner',
    stdio: stdio,
    stdin: stdio[0],
    stdout: stdio[1],
    stderr: stdio[2],
    env: options.env || {},
    argv: options.argv || []
  })
  const ioFinishedRef = syncAllTrue(taskRef.child('ioFinished'),
    stdio.filter(Boolean).map(function (stream) {
      return ioRef.child(stream.key).child('finished')
    })
  )
  var _finished = false
  const exitCode = taskRef.child('exitCode')
  syncAllTrue(taskRef.child('finished'), [
    ioFinishedRef,
    taskRef.child('processFinished')
  ]).on('value', function (finished) {
    if (finished.val() && !_finished) {
      _finished = true
      proc.emit('debug', proc.key, 'All finished, waiting on exit code')
      exitCode.once('value', function (snap) {
        proc.emit('exit', snap.val())
      })
    }
  })
  const optionsRef = taskRef.child('options')
  optionsRef.transaction(function () {
    optionsRef.set({
      stdio: proc.stdio.map(function (stream) {
        return stream ? stream.url : 'ignore'
      }),
      env: proc.env,
      argv: proc.argv
    })
  }).then(function () {
    proc.emit('debug', proc.key, 'Finished setting up task.')
  })
  proc.emit('debug', proc.key, 'Pushing task to `tasks` queue with env: ' + JSON.stringify(options.env))
  return proc
}
