'use strict'
const runnerWorker = require('../')

module.exports = {
  aliases: ['create', 'runner', 'execute', 'exec'],
  builder: (yargs) => {
    return yargs
      .help()
      .option('delete', {
        alias: ['rm', 'remove'],
        desc: 'Deletes the task data after the runner is finished reading it.'
      })
      .example(
        '$0 create-task --url https://<db>.firebase.io --ns tasks --env NODE_ENV=develop -- foo bar',
        'Creates a new task in the given database with the the environment variable NODE_ENV set to develop and the arguments foo and bar passed to the worker process.'
      )
  },
  handler: (argv) => {
    argv.stdio = ['inherit', 'inherit', 'inherit']
    runnerWorker('runner', argv, argv._.slice(1), (err, proc) => {
      if (err) {
        console.error(err.stack || err)
        return process.exit(1)
      }
      proc.on('exit', process.exit.bind(process))
    })
  }
}
