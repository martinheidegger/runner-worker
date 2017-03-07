'use strict'
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
function getStdIO(stdio) {
  if (stdio === null || stdio === undefined) {
    stdio = 'pipe'
  }
  if (typeof stdio === 'string') {
    stdio = [stdio, stdio, stdio]
  }
  if (!Array.isArray(stdio)) {
    throw new Error('`options.stdio` contains invalid value: ' + stdio)
  }
  return stdio
}
module.exports = function (options, argv) {
  if (!options) {
    options = {}
  }
  if (!argv) {
    argv || []
  }
  if (!options.root) {
    throw new Error('`options.root` is a required option.')
  }
  const env = options.env || {}
  const stdioOptions = getStdIO(options.stdio)
  const taskRef = options.root.child('tasks').push({
    options: {
      stdio: stdioOptions,
      env: env,
      argv: argv
    }
  })
  const ioRef = taskRef.child('io')
  const stdio = prepareStdio(ioRef, stdioOptions)
  const proc = new EventEmitter()
  Object.assign(proc, {
    url: taskRef.toString(),
    key: taskRef.key,
    type: 'runner',
    stdio: stdio,
    stdin: stdio[0],
    stdout: stdio[1],
    stderr: stdio[2],
    env: env,
    argv: argv
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
        if (options.delete) {
          proc.emit('debug', proc.key, 'Deleting the process data.')
          taskRef
            .remove()
            .catch(function (e) {
              proc.emit('debug', proc.key, 'Couldnt delete the process data. \n' + (e.stack || e))
            })
            .then(function () {
              proc.emit('exit', snap.val())
            })
        } else {
          proc.emit('exit', snap.val())
        }
      })
    }
  })
  proc.emit('debug', proc.key, 'Pushing task to `tasks` queue with env: ' + JSON.stringify(options.env))
  return proc
}
