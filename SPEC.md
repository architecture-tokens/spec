# Architecture Tokens Core Specification

Version: 0.1.0

This specification defines portable YAML/JSON contracts for architecture
meaning. A token library owns a lowercase namespace and exact SemVer version.
It contains `component-type`, `relationship-type`, and `applied` definitions.
Definitions may declare `appliesTo`, a JSON-Schema `valueSchema`, `requires`,
`conflicts`, and implementation `mappings`.

An architecture model contains libraries, components, and relationships.
Components and relationships are foundational elements. Every element has a
unique ID, exactly one type-token reference, and zero or more applied-token
references. Relationships connect existing component IDs. References use
`namespace:token-id`; libraries are selected as `namespace@version`.

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
