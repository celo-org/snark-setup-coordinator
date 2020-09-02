# coordinator-client

## Using

If you have a pre-built executable, use `--help` for an overview:

```
./coordinator-client-linux --help
./coordinator-client-linux contribute --help
```

Every command line option is also configurable with an environment
variable or [dotenv](https://www.npmjs.com/package/dotenv)
file. Upper snake-case the command line option and prepend
`COORDINATOR_`.  E.g.,

```
./coordinator-client-linux contribute --seed foo
COORDINATOR_SEED=foo ./coordinator-client-linux contribute
```

## Development

### Setup

Install dependencies:

```
npm i
```

Configure powersoftau:

```
echo "COORDINATOR_SEED=$(tr -dc 'A-F0-9' < /dev/urandom | head -c32)" > .env
```

Build:

```
npm run build
```

### Testing

Set `COORDINATOR_PARTICIPANT_ID` and contribute:

```
COORDINATOR_PARTICIPANT_ID=dave npm run start
```

or verify:

```
COORDINATOR_PARTICIPANT_ID=verifier0 npm run start-verifier
```

### Create new challenges

```
node dist/index.js new --count=4 --destination ../coordinator-service/.storage
```

### Build for distribution

Build executable:

```
npm run pkg
```
