# coordinator-client

## Setup

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

## Testing

Set `COORDINATOR_PARTICIPANT_ID` and contribute:


```
COORDINATOR_PARTICIPANT_ID=dave npm run start
```

or verify:

```

COORDINATOR_PARTICIPANT_ID=verifier0 npm run start-verifier
```

## Distribute

Build executable:

```
npm run pkg

```
