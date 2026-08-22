# Architecture Tokens Core Spec v0.1 Design

## Goal

Replace the single-token draft with a small, public-ready core model for
architecture tokens. The package remains a specification and validation
fixture package; it does not publish a registry, renderer, CLI, or live
service.

## Normative documents

The package defines five interoperable document contracts:

1. **Token library** — a library has a stable namespace prefix and exact
   semantic version, and owns component-type, relationship-type, and applied
   token definitions. Definitions can declare applicability, JSON-Schema value
   constraints, requirements, conflicts, and implementation mappings.
2. **Architecture model** — a model declares libraries, components, and
   relationships. Each element has a unique ID, exactly one type-token
   reference, and zero or more applied-token references. Relationships connect
   existing component IDs and have a relationship-type token.
3. **Policy set** — policies are typed YAML data only. A rule has an ID,
   description, severity, target, condition (`where`), assertion (`assert`),
   message, and optional remediation. Conditions are a fixed recursive
   language of `all`, `any`, `not`, and leaf predicates for element kind/type,
   applied-token presence, and direct connected-to checks (direction,
   relationship type, and other element type/token filters).
4. **Validation report** — diagnostics have stable code, severity, layer,
   document path, optional affected element and rule IDs, message, and optional
   remediation. Human and JSON rendering are small library helpers; command
   ownership remains with a future CLI.
5. **Renderer input / normalized model** — a renderer receives a normalized,
   resolved model with canonical element and token identity, values, and
   relationship endpoints. Layout is intentionally absent from v0.1.

## Vocabulary and identity

Components and relationships are foundational model elements. A component
references a `component-type` token; a relationship references a
`relationship-type` token. Applied tokens are annotations and must be
applicable to the element kind and type token. Token references are
`namespace:token-id`; library identity is `namespace@version`. Namespace
prefixes are lowercase hyphenated names and versions are exact SemVer strings.

The core library supplies representative component and relationship types plus
security, environment, and lifecycle applied tokens. Flows, separate type /
instance identity, architecture evolution, remote registries, standard layout
hints, and layout models are non-normative/out of scope in v0.1.

## Validation behavior

Validation is fixture-driven and layered: document shape, package identity and
references, applicability, requirements/conflicts, token value schemas, and
policy evaluation. Every failure becomes a stable diagnostic code and path.
The validator must detect unresolved IDs, wrong token-definition kinds,
inapplicable applied tokens, requires/conflicts violations, invalid values,
package namespace/version mismatches, and policy violations. Invalid fixtures
must test each class; valid fixtures must cover representative production
models and policies for encrypted production data and direct public exposure.

## Package surface and compatibility

`@architecture-tokens/spec` is version `0.1.0`, remains Apache-2.0 licensed,
and exports the validator/normalizer API. `SPEC.md` is the normative prose;
JSON Schemas, reference libraries, examples, and tests are package assets and
must be included by `npm pack --dry-run`. README, package metadata, schemas,
and normative prose must describe the same contracts.

## Self-review

- No placeholders or open design decisions remain in this document.
- The renderer contract consumes the architecture model but does not add a
  layout model, matching the v0.1 scope boundary.
- Policy `where` selects target elements and `assert` is evaluated against each
  selected element; both use the same fixed typed condition vocabulary.
- Exact SemVer is required for package/library identity, while token IDs remain
  stable semantic identities.
