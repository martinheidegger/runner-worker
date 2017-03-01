const firebase = require('firebase')

module.exports = function (queueUrl, dbName, start, cb) {
  setImmediate(function () {
    if (process.env.DEBUG) {
      console.info('Initializing client for database: ' + queueUrl + ' # ' + dbName + '.')
    }
    const ref = firebase.initializeApp({
      databaseURL: queueUrl
    }).database().ref().child(dbName)
    if (process.env.FIREBASE_TOKEN) {
      if (process.env.DEBUG) {
        console.info('Signing in with FIREBASE_TOKEN.')
      }
      ref.auth().signInWithCustomToken(process.env.FIREBASE_TOKEN, function (error, result) {
        if (error) {
          return cb(reject('Authentication failed: ' + error))
        }
        if (process.env.DEBUG) {
          console.info('Successfully authenticated.')
        }
        cb(null, start(ref))
      })
      delete env.FIREBASE_TOKEN
    } else {
      if (process.env.DEBUG) {
        console.info('Successfully without authentication.')
      }
      cb(null, start(ref))
    }
  })
}
