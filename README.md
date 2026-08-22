# Architecture Tokens

[![Validate](https://github.com/architecture-tokens/spec/actions/workflows/validate.yml/badge.svg)](https://github.com/architecture-tokens/spec/actions/workflows/validate.yml)

Architecture Tokens are the smallest reusable semantic units for software architecture.

They give diagrams, documentation, reviews, and automation a shared, machine-readable architectural vocabulary. A token describes architectural meaning independently from a particular cloud provider, product, or rendering tool.

> [!IMPORTANT]
> This repository contains an early `v0.1` draft. The model will evolve as it is tested against real architecture work.

## A minimal token

```yaml
id: component.database
name: Database
category: component
description: A persistent structured data store.

capabilities:
  - persistent-storage
  - structured-query

constraints:
  - stateful

mappings:
  aws: rds
  azure: azure-sql
  gcp: cloud-sql
```

The meaning stays stable while each environment can map the token to a suitable implementation.

## Start here

- Read the normative [specification](./SPEC.md).
- Inspect the machine-readable [JSON Schema](./schema/architecture-token.schema.json).
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
