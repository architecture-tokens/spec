# Architecture Tokens

[![Validate](https://github.com/architecture-tokens/spec/actions/workflows/validate.yml/badge.svg)](https://github.com/architecture-tokens/spec/actions/workflows/validate.yml)

Architecture Tokens are the smallest reusable semantic units for software architecture.

They give diagrams, documentation, reviews, and automation a shared, machine-readable architectural vocabulary. A token describes architectural meaning independently from a particular cloud provider, product, or rendering tool.

> [!IMPORTANT]
> This repository contains an early `v0.1` draft. The model will evolve as it is tested against real architecture work.

## v0.1 package

```yaml
kind: token-library
namespace: core
version: 0.1.0
name: Architecture Tokens Core
tokens:
  - id: component.database
    kind: component-type
    name: Database
    description: A persistent structured data store.
```

The package defines token libraries, architecture models, versioned architecture views, typed policy sets, validation reports, and renderer-input normalized models. Core, security, environment, and lifecycle are separate namespaces; applied token uses are `{token, value?}` objects.

## Start here

- Read the normative [specification](./SPEC.md).
- Inspect the machine-readable [JSON Schemas](./schema/).
- Browse the valid [examples](./examples/).
- Read the [contribution guide](./CONTRIBUTING.md) before proposing a change.

## Design principles

- **Semantic first:** define architectural intent before implementation.
- **Tool independent:** the same token can be referenced by diagrams, documents, linters, and automation.
- **Small and composable:** tokens should be reusable building blocks, not complete architecture models.
- **Human and machine readable:** definitions should be understandable in review and verifiable by software.
- **Incremental:** the core model should grow from demonstrated use cases.

## Validate locally

```shell
npm install
npm test
```

## License

Licensed under the [Apache License 2.0](./LICENSE).
