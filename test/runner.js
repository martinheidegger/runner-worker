'use strict'
const tap = require('tap')
const test = tap.test
const tearDown = tap.tearDown
const runner = require('../lib/runner')
const stream = require('firebase-stream')
const toStream = require('string-to-stream')
const toString = require('stream-to-string')
const createDb = require('./util/createDb')
const db = createDb('db')
const db2 = createDb('db2')
const refRoot = db.ref().child('runner-worker').push(null)
const ref = refRoot.child('tasks')

test('Test a simple run', function (t) {
  const instance = runner({
    root: ref,
    stdio: 'ignore',
    env: {x: 1}
  }, ['a', 'b'])
  t.notEquals(instance.url, null, 'instance url is set')
  const node = db2.refFromURL(instance.url)
  t.tearDown(function () {
    return node.remove()
  })
  t.same(instance.stdio, [null, null, null], 'stdio goes nowhere')
  instance.on('exit', function (code) {
    t.equals(code, 34, 'exit code is passed on')
    t.end()
  })
  node.child('options').on('value', function (snap) {
    const options = snap.val()
    if (options !== null) {
      t.same(options, {
        stdio: ['ignore', 'ignore', 'ignore'],
        env: {
          x: 1
        },
        argv: ['a', 'b']
      })
      node.child('exitCode').set(34)
      node.child('processFinished').set(true)
    }
  })
})

test('Test a stream with simple output', function (t) {
  var instance = runner({
    root: ref,
    stdio: ['ignore', 'pipe', 'ignore']
  })
  const node = db2.refFromURL(instance.url)
  t.tearDown(function () {
    return node.remove()
  })
  t.equal(instance.stdio[0], null, 'stdin is not set')
  t.equal(instance.stdio[2], null, 'stderr is not set')
  var _data
  instance.on('exit', function (code) {
    t.equals(_data, 'Hello World', 'Data to stdout should be finished writing after exit')
    t.equals(code, 12, 'Verifying exit code')
    t.end()
  })
  node.child('options').on('value', function (snap) {
    if (snap.val() !== null) {
      toStream('Hello World').pipe(stream.createWriteStream({
        node: db2.refFromURL(instance.url).child('io/out')
      })).on('finish', function () {
        node.child('exitCode').set(12)
        node.child('processFinished').set(true)
      })
      toString(instance.stdout, function (err, data) {
        t.equals(err, null, 'Streaming to stdout should just work')
        _data = data
      })
    }
  })
})

test('Test a stream with simple io', function (t) {
  var instance = runner({
    root: ref,
    stdio: ['pipe', 'pipe', 'ignore']
  })
  const node = db2.refFromURL(instance.url)
  t.tearDown(function () {
    return node.remove()
  })
  var _data
  const stdinData = 'Data written to Stdin'
  instance.on('exit', function (code) {
    t.equals(_data, 'Hello World ' + stdinData, 'Data properly passed on')
    t.equals(code, 11, 'New exit code')
    t.end()
  })

  var writingFinished = false
  // From the process
  toString(
    stream.createReadStream({
      node: db2.refFromURL(instance.url).child('io/in')
    }),
    function (err, data) {
      writingFinished = true
      t.equals(data, stdinData, 'Stdin data properly passed')
      t.equals(err, null, 'No error occured reading from stdin')
      toStream('Hello World ' + stdinData)
        .pipe(stream.createWriteStream({
          node: db2.refFromURL(instance.url).child('io/out')
        }))
        .on('finish', function () {
          node.child('exitCode').set(11)
          node.child('processFinished').set(true)
        })
    }
  )
  // To the process
  toStream(stdinData).pipe(instance.stdin)
  toString(instance.stdout, function (err, data) {
    t.ok(writingFinished, 'Writing should be finished before out is finished?!')
    t.equals(err, null, 'No error occurred writing to stdout')
    _data = data
  })
})

tearDown(() =>
  refRoot.remove().then(function () {
    db.goOffline()
    db2.goOffline()
  })
)
