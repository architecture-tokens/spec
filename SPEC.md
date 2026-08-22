# Architecture Tokens Specification

Version: 0.1 Draft

## 1. Scope

This specification defines the portable semantic unit called an Architecture Token and its YAML or JSON representation. It does not define a complete architecture-model format, graphical notation, deployment system, or universal token catalogue.

The key words **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT**, and **MAY** indicate requirement levels as described by [BCP 14](https://www.rfc-editor.org/info/bcp14).

## 2. Architecture Token

An Architecture Token is the smallest reusable semantic unit for software architecture.

A token gives a stable identity to an architectural concept, describes its technology-neutral meaning, and may record capabilities, constraints, implementation mappings, and relationships to other tokens.

Token meaning MUST remain understandable without consulting a provider-specific mapping.

## 3. Document format

A token document MUST be a YAML or JSON object. It MUST conform to the repository's [JSON Schema](./schema/architecture-token.schema.json).

Unknown top-level fields are prohibited in v0.1. Authors SHOULD open a specification proposal rather than adding private fields to a shared token document.

## 4. Required fields

### 4.1 `id`

`id` is the stable, machine-readable identity of the token.

- It MUST start with the token category followed by a period.
- It MUST use lowercase ASCII letters, digits, periods, and hyphens.
- Each segment MUST start with a lowercase letter.
- It MUST NOT be silently reused for a different meaning.

Examples: `component.database`, `component.message-broker`, and `relationship.communicates-with`.

### 4.2 `name`

`name` is a concise human-readable label. It MUST be a non-empty string.

### 4.3 `category`

`category` identifies the kind of concept. v0.1 defines exactly two values:

- `component`: a reusable architectural building block.
- `relationship`: a reusable semantic connection between architectural elements.

The category MUST match the first segment of `id`.

### 4.4 `description`

`description` states the technology-neutral meaning of the token. It MUST be a non-empty string and SHOULD describe architectural intent rather than a named product.

## 5. Optional fields

### 5.1 `capabilities`

`capabilities` is a unique list of behaviors or outcomes the concept provides. Each value uses lowercase slug form, such as `persistent-storage`.

### 5.2 `constraints`

`constraints` is a unique list of architectural restrictions or properties, such as `stateful` or `directed`. v0.1 validates their syntax but does not define a universal constraint vocabulary.

### 5.3 `mappings`

`mappings` associates an environment or provider key with a concrete implementation name. Keys use lowercase slug form and values are non-empty strings.

Mappings MUST NOT change the token's underlying meaning. A provider-specific product that does not satisfy the described semantics is not a valid mapping.

### 5.4 `relationships`

`relationships` is a unique list of other token IDs relevant to this token. v0.1 validates reference syntax but does not define referential integrity or relationship roles.

### 5.5 `tags`

`tags` is a unique list of lowercase discovery terms. Tags do not affect token semantics.

### 5.6 `aliases`

`aliases` is a unique list of non-empty alternative human-readable names. Aliases do not create additional token identities.

## 6. Conformance

A token is structurally conformant when it passes the published JSON Schema. Structural conformance does not prove that its description is useful, that a mapping is accurate, or that two independently authored tokens have distinct meanings.

Tools claiming v0.1 validation support MUST apply the same structural rules to YAML and JSON inputs. They SHOULD report the failing field path and violated rule for invalid documents.

## 7. Versioning

The specification is versioned by repository releases. Before `v1.0.0`, releases may contain breaking changes, which MUST be identified in release notes.

Individual token version fields are not defined in v0.1. Stable IDs SHOULD be preserved when wording is clarified without changing meaning; a materially different meaning SHOULD receive a new ID.
