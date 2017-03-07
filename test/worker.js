'use strict'
const tap = require('tap')
const test = tap.test
const tearDown = tap.tearDown
const runner = require('../lib/runner')
const worker = require('../lib/worker')
const toStream = require('string-to-stream')
const toString = require('stream-to-string')
const path = require('path')
const createDb = require('./util/createDb')
const db = createDb('db')
const db2 = createDb('db2')
const refRoot = db.ref().child('worker-runner').push(null)
const refTasks = db2.refFromURL(refRoot.toString()).child('tasks')

function setupWorker (t, options, argv) {
  if (!options) {
    options = {}
  }
  if (!options.root) {
    options.root = refRoot
  }
  if (!options.db) {
    options.db = db2
  }
  const proc = worker(options, argv)
  proc.on('debug', (key, message) => {
    console.log('[DEBUG]', key, message)
  })
  proc.on('info', (key, message) => {
    console.log('[INFO]', key, message)
  })
  proc.on('done', (key) => {
    console.log('[DONE]', key)
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
  const proc = setupWorker(t, {}, ['/bin/bash', '-c', 'echo hi'])
  refTasks.push({
    finished: false,
    stdio: [null, null, null],
    options: {
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

function parseSection (data) {
  if (data === '') {
    return null
  }
  return JSON.parse(data)
}

function parseSections (data) {
  var sections = {}
  var currentPart
  var currentLines
  data.split('\n').forEach((line) => {
    var parts = /^---(.*)$/.exec(line)
    if (parts) {
      if (currentLines) {
        sections[currentPart] = parseSection(currentLines.join('\n'))
      }
      currentPart = parts[1]
      currentLines = []
    } else if (currentLines) {
      currentLines.push(line)
    }
  })
  if (currentLines) {
    sections[currentPart] = parseSection(currentLines.join('\n'))
  }
  return sections
}

test('Passing of all data to a complex task.', t => {
  const fullPath = path.join(__dirname, 'util', 'full')
  const proc = setupWorker(t, {
    whitelist: {foo: true}
  }, [fullPath])
  var startCalled = false
  var doneCalled = false
  const args = ['a', 'b', '$d']
  const task = runner({
    root: refRoot,
    env: {foo: 'bar', baz: 'bat', RUNNER_WORKER: 'abcd'},
    stdio: 'pipe'
  }, args)
  proc.on('start', (key) => {
    startCalled = true
    t.equal(key, task.key, 'Started key for the same task as the request')
  })
  proc.on('done', (key) => {
    t.ok(startCalled, 'Start called before done called')
    doneCalled = true
    t.equal(task.key, key, 'The done key is equal to the start key')
  })
  var out
  var err = null
  toStream('Hello World').setEncoding('utf8').pipe(task.stdin)
  toString(task.stdout, (e, outData) => {
    t.equals(e, null, 'No error from stdout')
    out = outData
  })
  toString(task.stderr, (e, errData) => {
    t.equals(e, null, 'No error from stderr')
    err = errData
  })
  task.on('exit', code => {
    const sections = parseSections(out)
    t.ok(doneCalled, 'Kill has been properly called')
    t.equals(sections.env.RUNNER_KEY, task.key, 'Properly receives the key as RUNNER_KEY')
    t.equals(sections.env.RUNNER_WORKER, 'true', 'Properly receives default RUNNER_WORKER env variable')
    t.equals(sections.env.foo, 'bar', 'Properly passes whitelisted env variable')
    t.equals(sections.env.baz, undefined, 'Skips non-whitelisted env variable')
    t.equals(sections.env.FIREBASE_URL, undefined, 'Firebase url should not be passed to the worker')
    t.equals(sections.argv[0], process.argv[0], 'Same node process')
    t.equals(sections.argv[1], fullPath, 'expected node path')
    t.equals(sections.argv.length, 5, 'No additional arguments')
    t.same(sections.argv.slice(2), args, 'All arguments passed on')
    t.equals(sections['stream-data'], 'Hello World', 'Data properly received')
    t.equals(err, '"Test error output"\n', 'Error properly received')
    t.equals(code, 13, 'Error code properly passed on')
    t.end()
  })
})

tearDown(() =>
  refRoot.remove().then(() => {
    db.goOffline()
    db2.goOffline()
  })
)
