# Contributing

Architecture Tokens is an early draft. Concrete examples, ambiguous definitions, and interoperability problems are especially useful feedback.

## Propose a change

1. Open an issue describing the architecture problem and why the current specification does not address it.
2. Keep each proposal focused on one semantic concept or schema change.
3. Include a representative YAML or JSON example.
4. Update `SPEC.md`, the JSON Schema, and validation fixtures together when behavior changes.
5. Run `npm install` once and `npm test` before opening a pull request.

New fields should demonstrate reuse across more than one tool, provider, or architecture style. Provider-specific data should normally be represented as a mapping instead of changing the token's semantic definition.

Contributions are licensed under the repository's [Apache License 2.0](./LICENSE).
