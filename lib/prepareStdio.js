'use strict'
const createStream = require('firebase-stream')

function isStream (prop) {
  return prop !== null && prop !== undefined && typeof prop.pipe === 'function'
}

function getStream (prop, fallback, newStreamOptions) {
  if (prop === 'inherit') {
    prop = fallback
  }
  if (isStream(prop)) {
    var targetStream = createStream(newStreamOptions)
    if (newStreamOptions.mode === 'r') {
      prop.key = targetStream.key
      return targetStream.pipe(prop)
    }
    return prop.pipe(targetStream)
  }
  if (prop === 'pipe') {
    return createStream(newStreamOptions)
  }
  return null
}

function getIO (prop, fallback, newStreamOptions) {
  const stream = getStream(prop, fallback, newStreamOptions)
  if (stream === null) {
    return null
  }
  if (stream.setEncoding) {
    return stream.setEncoding('utf8')
  }
  return stream
}

module.exports = function prepareStdio (node, stdio) {
  return [
    getIO(stdio[0], process.stdin, {node: node.child('in'), mode: 'w'}),
    getIO(stdio[1], process.stdout, {node: node.child('out'), mode: 'r'}),
    getIO(stdio[2], process.stderr, {node: node.child('err'), mode: 'r'})
  ]
}
