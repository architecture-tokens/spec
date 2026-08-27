# Architecture Tokens Core Specification

Version: 0.1.0

This specification defines portable YAML/JSON contracts for architecture
meaning. A token library owns a lowercase namespace and exact SemVer version.
It contains `component-type`, `relationship-type`, and `applied` definitions;
the reference libraries keep core types separate from security, environment,
and lifecycle domains. IDs are hierarchical dotted names and references are
qualified as `namespace:token.id`.
Definitions may declare `appliesTo`, a JSON-Schema `valueSchema`, `requires`,
`conflicts`, and implementation `mappings`.

An architecture model contains libraries, components, and relationships.
Components and relationships are foundational elements. Every element has a
unique ID, exactly one type-token reference, and zero or more applied-token
objects `{token, value?}`. `appliesTo` can restrict element kinds and type
tokens; application values are checked against `valueSchema`. Relationships
connect existing component IDs. Libraries are selected as `namespace@version`.

## Token-only boundary

Tokens are reusable definitions of architecture meaning, not managed runtime
objects. In v0.1, a component or relationship is the architecture-model
element; its type token classifies it, and applied tokens annotate it. For
example, `orders-api` can be a component of type
`core:component.service`; its synchronous call to `payments-api` can be a
relationship of type `core:relationship.call.sync`; and
`lifecycle:lifecycle.deprecated` can be an applied token on either element.

An Asset is a concrete managed object, such as a Kubernetes Deployment,
database instance, repository, alert policy, or cloud account. Asset records
and Token-to-Asset links are not part of the v0.1 schema. A later integration
may associate an Asset with an architecture-model component, but it must not
change the semantic meaning expressed by the component, relationship, or
Token. This preserves architectural continuity when an implementation is
migrated or replaced.

Policy sets are safe typed YAML: no code or CEL. A rule has `id`, `description`,
`severity` (`error` or `warning`), `target`, `where`, `assert`, `message`, and
optional `remediation`. Conditions are recursive `all`, `any`, `not`, or leaf
predicates for `kind`, `type`, `hasToken`, `missingToken`, and `connectedTo`
(direction, relationship type, and other element type/token).

Validation reports contain stable `code`, `severity`, `layer`, document `path`,
optional affected `elementId` and `ruleId`, `message`, and optional remediation.
Renderer input is a normalized resolved model; layout is outside v0.1.

Flows, separate type/instance identity, architecture evolution, remote
registries, standard layout hints, and layout models are out of scope.

See the [schemas](./schema/), [reference library](./libraries/core.yaml), and
[examples](./examples/). The package is Apache-2.0 licensed.
