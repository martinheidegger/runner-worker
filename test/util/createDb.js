'use strict'
const firebase = require('firebase')

if (!process.env.FIREBASE_URL) {
  throw new Error('environment variable FIREBASE_URL needs to point to a firebase repo with free read/write access!')
}

module.exports = function createDb (name) {
  return firebase.initializeApp({
    databaseURL: process.env.FIREBASE_URL
  }, name).database()
}
