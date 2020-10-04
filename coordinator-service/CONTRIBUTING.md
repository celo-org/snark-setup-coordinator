# Contributing to coordinator-service

## Adding an authentication strategy

You can add a new authentication strategy by implementing the
['AuthenticateStrategy'](src/authenticate.ts) and registering your new
strategy in [`index.ts`](src/index.ts).

See the [`AuthenticateCelo`](src/authenticate-celo.ts) or
['AuthenticateDummy`](src/authenticate-dumy.ts) implementations for
examples.
