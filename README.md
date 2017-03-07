# 🏃‍ runner-worker 🕴

`runner-worker` allows to create a tasks-queue stored in [firebase](https://firebase.google.com/)
and process those tasks with workers.

## 💡 What is it good for?

- Hosted CI systems
- Remote Task execution
- Systems where SSH is problematic (pure https transport)

## 🚄 Installation

```
$ npm install runner-worker --global
```

## 💪 Usage

_Note: Before you start this example: setup a firebase database with an admin token_

Start a worker for a queue on firebase:

```
$ export FIREBASE_URL=https://<my-domain>.firebase.io \
         FIREBASE_NAMESPACE=tasks \
         FIREBASE_TOKEN=<my-processor-token> \
  runner-worker process-tasks -- /bin/bash -c "\"echo Executed with args: \$@\""
```

Create a task in the firebase queue:

```
$ export FIREBASE_URL=https://<my-domain>.firebase.io \
         FIREBASE_NAMESPACE=tasks \
         FIREBASE_TOKEN=<my-requester-token> \
  runner-worker create-task -- arg1=a arg2=b
```

The tasks are stored in the `tasks` sub-object while workers are registered in the `workers`
sub object. [https://<my-domain>.firebase.io/tasks](https://<my-domain>.firebase.io/tasks).

## Extended usage

Use `runner-worker --help` or `runner-worker <command> --help` to get more
information about the available options

```
$ runner-worker --help
runner-worker <command>

Commands:
  create-task    Creates a new task for a worker to process.
  process-tasks  Process tasks

Options:
  --env, -e                        Environment variable passed to the worker.
                                                                         [array]
  --dbUrl, -d, --db, -u, --url     Firebase url that is used to store & process
                                   tasks. You can also specify the environment
                                   variable FIREBASE_URL.    [string] [required]
  --namespace, --ns, --prefix, -p  Namespace where to process and execute tasks
                                   in firebase. You can also specify the
                                   environment variable FIREBASE_NAMESPACE.
                                                                        [string]
  --auth-token, -t, --token        Token used to authenticate to the database.
                                   You can also specify the environment variable
                                   FIREBASE_TOKEN.                      [string]
  --help                           Show help                           [boolean]

Homepage:
  https://github.com/hiroshi/runner-worker#readme

```

## 🔑 Security

- See [SECURITY.md](./SECURITY.md)

## 😔 Caveats

- By default the log is kept, in order to not run out of data storage you need
  to delete the entries.
- It doesn't support time-outs as of yet.

## 👏 Contribute

Contributions that improve the stability or capability are warmly welcome.
Make sure that your tests pass before posting a PR.
Please post any issues you find [here](https://github.com/hiroshi/runner-worker/issues)

## 🤗 Credits

Proudly made by folks at [Nota Inc.](https://notainc.com/) in 🏯 Kyoto.
