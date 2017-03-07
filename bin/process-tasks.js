'use strict'
const runnerWorker = require('../')

module.exports = {
  aliases: ['process', 'worker'],
  builder: (yargs) => {
    return yargs
      .help()
      // .usage('Usage: $0 ')
      .option('ping', {
        type: 'number',
        default: 3000,
        desc: 'Ping interval in which the worker writes pings to the database in milliseconds.'
      })
      .option('whitelist', {
        alias: 'w',
        type: 'array',
        desc: 'Whitelist an environment variable to be specified by create-task.'
      })
      .example(
        '$0 process-tasks --url https://<db>.firebase.io --ns tasks --whitelist NODE_ENV --env SERVER=1 --ping 1000 -- ./my_worker_script.sh',
        'Processes tasks put into the given databases. The tasks can have an environment variable NODE_ENV set and the environment variable SERVER=1 will be defined ' +
        'as well. The worker will ping in a 1000 millisecond interval the database and tell everyone that its still processing.'
      )
      .demandCommand(1, 'You need to specify which command is supposed to be run.')
  },
  handler: function (argv) {
    runnerWorker('worker', argv, argv._.slice(1), (err, proc) => {
      console.log('[' + proc.key + '] processing tasks')
      if (err) {
        console.error(err.stack || err)
        return process.exit(1)
      }
      proc.on('debug', (key, message) => {
        console.log('[' + proc.key + '/' + key + '] (DEBUG) ' + message)
      })
      proc.on('start', (key, argv, options) => {
        console.log('[' + proc.key + '/' + key + '] Start.')
        console.log('[' + proc.key + '/' + key + '] Options: ' + JSON.stringify(options))
        console.log('[' + proc.key + '/' + key + '] Argv: ' + JSON.stringify(argv))
      })
      proc.on('done', (key, code) => {
        console.log('[' + proc.key + '/' + key + '] Finished with code ' + code + '.')
      })
    })
  }
}
