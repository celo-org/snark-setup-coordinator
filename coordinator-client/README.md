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
./coordinator-client-linux contribute --seed-file ./seed
COORDINATOR_SEED_FILE=./seed ./coordinator-client-linux contribute
```

## Development

### Setup

Install dependencies:

```
npm i
```

Configure powersoftau:

```
echo -n "$(tr -dc 'A-F0-9' < /dev/urandom | head -c32)" > seed
echo "COORDINATOR_SEED_FILE=seed" > .env
```

Build:

```
npm run build
```

Build powersoftau binaries (requires Docker):

```
cd coordinator-client
./build_binaries.sh
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

### Initial challenges for testing

Use the built-in `powersoftau` and the `COORDINATOR_SEED_FILE` you configured
above to create initial challenges and `POST` them to the local
[coordinator-service](../coordinator-service):

```
node dist/index.js new --count=4 --participant-id=verifier0
```

### Build for distribution

Build executable:

```
npm run pkg
```
