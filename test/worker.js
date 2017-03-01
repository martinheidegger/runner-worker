const tap = require('tap')
const test = tap.test
const tearDown = tap.tearDown
const runner = require('../lib/runner')
const worker = require('../lib/worker')
const stream = require('firebase-stream')
const toStream = require('string-to-stream')
const toString = require('stream-to-string')
const path = require('path')
const createDb = require('./util/createDb')
const db = createDb('db')
const db2 = createDb('db2')
const refRoot = db.ref().child('worker-runner').push(null)
const refTasks = db2.refFromURL(refRoot.toString()).child('tasks')

function setupWorker (t, options) {
  if (!options) {
    options = {}
  }
  if (!options.root) {
    options.root = refRoot
  }
  if (!options.db) {
    options.db = db2
  }
  const proc = worker(options)
  proc.on('debug', (key, message) => {
    console.log('[DEBUG]', key, message)
  })
  proc.on('info', (key, message) => {
    console.log('[INFO]', key, message)
  })
  proc.on('killed', (key) => {
    console.log('[KILLED]', key)
  })
  t.tearDown(() => {
    proc.close()
    options.root.child(proc.key).remove()
  })
  return proc
}

test('Processing a simple task.', t => {
  const proc = setupWorker(t)
  refTasks.push({
    finished: false,
    stdio: [null, null, null],
    options: {
      argv: ['/bin/bash', '-c', 'echo hi'],
      env: {}
    }
  }).then(() => {
    proc.once('done', (key, code) => {
      t.equals(code, 0, 'Properly closed.')
      proc.close()
      t.end()
    })
  }).catch(e => {
    console.log(e)
  })
})

test('Passing of all data to a complex task.', t => {
  const proc = setupWorker(t, {
    whitelist: {foo: true},
    argv: [path.join(__dirname, 'util', 'full')]
  })
  const task = runner({
    root: refRoot,
    env: {foo: 'bar', baz: 'bat'},
    argv: ['a', 'b', '$d'],
    stdio: 'pipe'
  })
  var out
  var err
  toStream('Hello World').setEncoding('utf8').pipe(task.stdin)
  toString(task.stdout, function (err, outData) {
    t.equals(err, null, 'No error from stdout')
    out = outData
  })
  toString(task.stderr, function (err, errData) {
    t.equals(err, null, 'No error from stderr')
    err = errData
  })
  task.on('exit', function (code) {
    console.log(out)
    console.log(err)
    t.equals(code, 13)
    t.end()
  })
})

tearDown(() =>
  refRoot.remove().then(()=> {
    db.goOffline()
    db2.goOffline()
  })
)
