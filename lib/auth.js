'use strict'
const firebase = require('firebase')

module.exports = function (options, cb) {
  if (!options.dbUrl) {
    return cb(new Error('No database url given'))
  }
  setImmediate(function () {
    const db = firebase.initializeApp({
      databaseURL: options.dbUrl
    }).database()

    if (!options.authToken) {
      return cb(null, db)
    }
    db.ref().auth().signInWithCustomToken(options.authToken, function (error, result) {
      if (error) {
        return cb(new Error('Authentication failed: ' + error))
      }
      cb(null, db)
    })
  })
}
