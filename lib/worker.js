'use strict'
const os = require('os')
const ip = require('ip')
const spawn = require('child_process').spawn
const stream = require('firebase-stream')
const EventEmitter = require('events')
const Readable = require('stream').Readable

process.env.RUNNER_WORKER = true

function now () {
  return new Date().toISOString()
}

function createPingInterval (ref, pingTime) {
  if (pingTime === undefined) {
    pingTime = 3000
  }
  if (pingTime <= 0) {
    return
  }
  return setInterval(function () {
    ref.set(now())
  }, pingTime)
}

function getIOFromTask (db, task, streamKey, mode) {
  const node = task.child('options/stdio').child(streamKey)
  return getVal(node)
    .then(input => {
      if (input === null) {
        return 'ignore'
      }
      const result = stream({node: db.refFromURL(input), mode: mode})
      if (result.setEncoding) {
        console.log('encoding to utf8!')
        return result.setEncoding('utf8')
      }
      return result
    })
}

function sysInfo () {
  return {
    start: now(),
    ping: now(),
    os: os.platform(),
    ip: ip.address(),
    busy: false
  }
}

class TaskQueue {
  constructor(proc, handler) {
    this.proc = proc
    this.queue = new Map()
    this.handler = handler
    this.removeFromQueueBySnap = snap => {
      if (snap.val() !== null) {
        this.removeFromQueue(snap.ref)
      }
    }
  }
  removeFromQueue(workerRef) {
    const task = this.queue.get(workerRef)
    this.queue.delete(workerRef)
    workerRef.off('value', this.removeFromQueueBySnap)
    return task
  }
  add(task) {
    this.proc.emit('debug', task.key, 'Got notice of new task!')
    const workerRef = task.child('worker')
    this.queue.set(workerRef, task)
    workerRef.on('value', this.removeFromQueueBySnap)
    this.processQueue()
  }
  processQueue() {
    if (this.current) {
      return
    }
    const taskItem = this.queue.keys().next()
    if (taskItem.done) {
      this.proc.emit('debug', null, 'Idle.')
      return
    }
    const task = this.removeFromQueue(taskItem.value)
    this.current = task
    this.proc.emit('debug', task.key, 'Attempting to own.')
    this.handler(task, () => {
      this.current = null
      this.processQueue()
    })
  }
}

function spawnProcess (argv, options) {
  if (os.platform() === 'win32') {
    return spawn(process.env.comspec, ['/c'].concat(argv), options)
  }
  return spawn(argv[0], argv.slice(1), options)
}

function defaultExec (proc, task, argv, options) {
  return new Promise(resolve => {
    const cmd = spawnProcess(argv, {
      stdio: options.stdio.map(io => io === 'ignore' ? 'ignore' : 'pipe'),
      env: options.env
    })
    options.stdio.forEach((io, index) => {
      if (io.pipe) {
        if (index === 0) {
          // in goes into other direction
          io.pipe(cmd.stdio[index])
        } else {
          cmd.stdio[index].pipe(io)
        }
      }
    })
    var killed
    const kill = function () {
      killed = (killed || 0) + 1
      if (killed > 3) {
        proc.emit('info', task.key, 'Not cleanly destroyed.')
        process.exit(1)
      }
      proc.emit('info', task.key, 'Sending SIGINT to process.')
      cmd.kill()
    }
    cmd.once('close', function (code) {
      proc.emit('debug', task.key, 'Exited with code: ' + code)
      proc.emit('done', task.key, code)
      task.update({
        exitCode: code,
        killed: killed || null,
        processFinished: true
      }).then(function () {
        process.removeListener('SIGINT', kill)
        if (killed > 0) {
          proc.emit('killed', task.key)
        }
      })
    })
    process.on('SIGINT', kill)
  }).catch(e => {
    proc.emit('debug', task.key, 'Error during execution: ' + (e.stack || e))
  })
}

function filterKeys (object, whitelist) {
  return Object.keys(whitelist).reduce(function (target, key) {
    const val = object[key]
    if (val !== undefined) {
      target[key] = val
    }
    return target
  }, {})
}

function getVal (ref) {
  return new Promise(resolve => {
    ref.once('value', snap => resolve(snap.val()))
  })
}

module.exports = function (options) {
  if (!options) {
    options = {}
  }
  if (!options.exec) {
    options.exec = defaultExec
  }
  if (!options.root) {
    throw new Error('`options.root` is a required option.')
  }
  if (!options.db) {
    throw new Error('`options.db` is a required option.')
  }
  const proc = new EventEmitter()
  const tasks = options.root.child('tasks')
  const worker = options.root.child('workers').push(sysInfo())
  const workerTasks = worker.child('tasks')
  const busy = worker.child('busy')
  const pingInterval = createPingInterval(worker.child('ping'), options.ping)
  Object.assign(proc, {
    key: worker.key,
    type: 'worker',
    whitelist: options.whitelist || {},
    argv: options.argv || []
  })
  var cmd
  const queue = new TaskQueue(proc, function processQueue(task, done) {
    const workerRef = task.child('worker')
    workerRef.transaction(function (currentWorker, done) {
      if (currentWorker !== null) {
        throw 'Worker#' + currentWorker + ' started processing it quicker.'
      }
      workerRef.set(proc.key)
    }, function (err) {
      if (err) {
        proc.emit('debug', task.key, err.stack || err)
        return
      }
      proc.emit('debug', task.key, 'Fetching info.')
      const getIO = getIOFromTask.bind(null, options.db, task)
      Promise.all([
        Promise.all([
          getIO('0', 'r'),
          getIO('1', 'w'),
          getIO('2', 'w')
        ]),
        getVal(task.child('options')),
        busy.set(true),
        workerTasks.push(task.key)
      ]).then(function (parts) {
        const stdio = parts[0]
        const opts = parts[1] || {}
        const cmdArgv = proc.argv.concat(opts.argv)
        const cmdOptions = {
          env: Object.assign(filterKeys(opts.env || {}, proc.whitelist), process.env),
          stdio: stdio
        }
        proc.emit('debug', task.key, 'Executing [' + cmdArgv.map(String) + '] env: ' + JSON.stringify(cmdOptions.env) + ' stdio: ' + stdio.map(function (io) {
          return io === 'ignore' ? '0' : '1'
        }).join('/'))
        try {
          return options.exec(proc, task, cmdArgv, cmdOptions)
        } catch (e) {
          proc.emit('debug', task.key, 'Error while attempting execution:' + (e.stack || e))
        }
      }).then(function () {
        return Promise.all([
          workerRef.remove(),
          busy.set(false)
        ])
      }).then(done)
      .catch(function (e) {
        console.log(e)
      })
    })
  })
  const addTask = function (taskSnap) {
    var val = taskSnap.val()
    if (val.finished || val.worker) {
      return
    }
    queue.add(taskSnap.ref)
  }
  tasks.on('child_added', addTask)
  proc.close = function () {
    clearInterval(pingInterval)
    tasks.off('child_added', addTask)
  }
  return proc
}
