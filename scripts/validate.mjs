import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import { parse as parseYaml } from 'yaml';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ajv = new Ajv2020({ allErrors: true, strict: false });
const schemaDir = path.join(root, 'schema');
const schemas = Object.fromEntries(['token-library', 'architecture-model', 'policy-set', 'validation-report', 'renderer-input'].map((name) => {
  const schema = JSON.parse(fs.readFileSync(path.join(schemaDir, `${name}.schema.json`), 'utf8'));
  return [name, ajv.compile(schema)];
}));
let failures = 0;
const fail = (message) => { failures += 1; console.error(`FAIL: ${message}`); };
const load = (file) => parseYaml(fs.readFileSync(file, 'utf8'));
const fmt = (errors) => (errors ?? []).map((e) => `${e.instancePath || '/'} ${e.message}`).join('; ');
const fixture = (dir, file) => path.join(root, dir, file);
const valid = (name, doc) => { if (!schemas[name](doc)) fail(`${name} invalid: ${fmt(schemas[name].errors)}`); else console.log(`PASS: ${name}`); };
function diagnostic(code, severity, layer, pathName, message, extra = {}) { return { code, severity, layer, path: pathName, message, ...extra }; }
function refParts(ref) { const m = /^([^:]+):(.+)$/.exec(ref ?? ''); return m ? { namespace: m[1], id: m[2] } : null; }

export function validateArchitecture(model, libraries, policies = []) {
  const diagnostics = [];
  const availableLibraries = new Map(libraries.map((lib) => [`${lib.namespace}@${lib.version}`, lib]));
  for (const requested of model.libraries ?? []) if (!availableLibraries.has(requested)) diagnostics.push(diagnostic('PACKAGE_VERSION_MISMATCH', 'error', 'references', '/libraries', `Library ${requested} is not available`));
  const tokenMap = new Map();
  for (const lib of libraries) for (const token of lib.tokens) { if (!token.id.startsWith(`${token.id.split('.')[0]}.`)) diagnostics.push(diagnostic('TOKEN_NAMESPACE_MISMATCH', 'error', 'references', '/tokens', `${token.id} is outside ${lib.namespace}`)); tokenMap.set(`${lib.namespace}:${token.id}`, { ...token, namespace: lib.namespace, version: lib.version }); }
  const components = new Map(model.components.map((e) => [e.id, { ...e, elementKind: 'component' }]));
  const relationships = new Map(model.relationships.map((e) => [e.id, { ...e, elementKind: 'relationship' }]));
  const all = [...components.values(), ...relationships.values()];
  for (const [kind, items] of [['component', model.components], ['relationship', model.relationships]]) { const seen = new Set(); for (const e of items) { if (seen.has(e.id)) diagnostics.push(diagnostic('DUPLICATE_ELEMENT_ID', 'error', 'references', `/${kind}s/${e.id}`, `Duplicate ${kind} ID ${e.id}`, { elementId: e.id })); seen.add(e.id); } }
  const checkRef = (ref, expected, p, elementId) => { const token = tokenMap.get(ref); if (!token) { diagnostics.push(diagnostic('UNRESOLVED_TOKEN', 'error', 'references', p, `Unresolved token ${ref}`, { elementId })); return null; } if (expected && token.kind !== expected) diagnostics.push(diagnostic('WRONG_TOKEN_KIND', 'error', 'semantics', p, `${ref} is ${token.kind}; expected ${expected}`, { elementId })); return token; };
  for (const e of all) {
    const type = checkRef(e.type, e.elementKind === 'component' ? 'component-type' : 'relationship-type', `/${e.elementKind}s/${e.id}/type`, e.id);
    const apps = e.tokens;
    const applied = apps.map((a) => checkRef(a.token, 'applied', `/${e.elementKind}s/${e.id}/tokens`, e.id)).filter(Boolean);
    const ids = new Set(apps.map((a) => a.token));
    for (const token of applied) { const a = apps.find((x) => x.token === `${token.namespace}:${token.id}`); const applies = token.appliesTo; if (applies && (!applies.elementKinds?.includes(e.elementKind) || (e.elementKind === 'component' && applies.componentTypes && !applies.componentTypes.includes(e.type)) || (e.elementKind === 'relationship' && applies.relationshipTypes && !applies.relationshipTypes.includes(e.type)))) diagnostics.push(diagnostic('TOKEN_NOT_APPLICABLE', 'error', 'semantics', `/${e.elementKind}s/${e.id}/tokens`, `${token.namespace}:${token.id} is not applicable`, { elementId: e.id })); for (const req of token.requires ?? []) if (!ids.has(req)) diagnostics.push(diagnostic('TOKEN_REQUIRES', 'error', 'semantics', `/${e.elementKind}s/${e.id}/tokens`, `${token.id} requires ${req}`, { elementId: e.id })); for (const conflict of token.conflicts ?? []) if (ids.has(conflict)) diagnostics.push(diagnostic('TOKEN_CONFLICT', 'error', 'semantics', `/${e.elementKind}s/${e.id}/tokens`, `${token.id} conflicts with ${conflict}`, { elementId: e.id })); if (token.valueSchema && a?.value !== undefined && !ajv.compile(token.valueSchema)(a.value)) diagnostics.push(diagnostic('INVALID_TOKEN_VALUE', 'error', 'semantics', `/${e.elementKind}s/${e.id}/tokens`, `Invalid value for ${token.id}`, { elementId: e.id })); }
  }
  for (const [id, r] of relationships) for (const endpoint of [r.from, r.to]) if (!components.has(endpoint)) diagnostics.push(diagnostic('UNRESOLVED_ELEMENT', 'error', 'references', `/relationships/${id}`, `Unresolved component ${endpoint}`, { elementId: id }));
  const matches = (e, c) => { if (!c) return true; if (c.kind && e.elementKind !== c.kind) return false; if (c.type && e.type !== c.type) return false; if (c.hasToken && !e.tokens.includes(c.hasToken)) return false; if (c.missingToken && e.tokens.includes(c.missingToken)) return false; if (c.connectedTo) { const q = c.connectedTo; const connected = [...relationships.values()].filter((r) => (q.direction === 'out' ? r.from === e.id : q.direction === 'in' ? r.to === e.id : r.from === e.id || r.to === e.id) && (!q.relationshipType || r.type === q.relationshipType)).some((r) => { const id = r.from === e.id ? r.to : r.from; const other = components.get(id); return other && (!q.elementType || other.type === q.elementType) && (!q.elementToken || other.tokens.includes(q.elementToken)); }); if (!connected) return false; } return true; };
  const evaluate = (e, c) => c?.all ? c.all.every((x) => evaluate(e, x)) : c?.any ? c.any.some((x) => evaluate(e, x)) : c?.not ? !evaluate(e, c.not) : matches(e, c);
  for (const policy of policies.flatMap((p) => p.policies ?? [])) { const targets = policy.target === 'component' ? [...components.values()] : policy.target === 'relationship' ? [...relationships.values()] : [{ elementKind: 'model', id: model.id, ...model }]; for (const e of targets) if (evaluate(e, policy.where) && !evaluate(e, policy.assert)) diagnostics.push(diagnostic('POLICY_VIOLATION', policy.severity, 'policy', `/policies/${policy.id}`, policy.message, { elementId: e.elementKind === 'model' ? undefined : e.id, ruleId: policy.id, ...(policy.remediation ? { remediation: policy.remediation } : {}) })); }
  return { valid: !diagnostics.some((d) => d.severity === 'error'), diagnostics };
}

export function normalizeArchitecture(model, libraries) {
  const tokenMap = new Map(libraries.flatMap((lib) => lib.tokens.map((token) => [`${lib.namespace}:${token.id}`, { ...token, ref: `${lib.namespace}:${token.id}`, namespace: lib.namespace, version: lib.version }])));
  const normalize = (element, kind) => ({ id: element.id, kind, type: tokenMap.get(element.type) ?? { ref: element.type }, appliedTokens: element.tokens.map((ref) => tokenMap.get(ref) ?? { ref }), values: element.values ?? {}, ...(kind === 'relationship' ? { from: element.from, to: element.to } : {}) });
  return { kind: 'renderer-input', model: { id: model.id, components: model.components.map((e) => normalize(e, 'component')), relationships: model.relationships.map((e) => normalize(e, 'relationship')) } };
}

const libraryFiles = fs.readdirSync(path.join(root, 'libraries')).filter((f) => f.endsWith('.yaml')).sort();
const libraries = libraryFiles.map((f) => { const d = load(path.join(root, 'libraries', f)); if (!schemas['token-library'](d)) fail(`libraries/${f}: ${fmt(schemas['token-library'].errors)}`); return d; });
for (const f of fs.readdirSync(path.join(root, 'examples')).filter((x) => x.endsWith('.yaml')).sort()) { const d = load(fixture('examples', f)); if (d.kind === 'architecture-model') { valid('architecture-model', d); const normalized = normalizeArchitecture(d, libraries); if (!schemas['renderer-input'](normalized)) fail(`examples/${f} normalized renderer input invalid: ${fmt(schemas['renderer-input'].errors)}`); } else if (d.kind === 'policy-set') valid('policy-set', d); }
for (const f of fs.readdirSync(path.join(root, 'tests', 'invalid')).filter((x) => x.endsWith('.yaml')).sort()) { const d = load(fixture('tests/invalid', f)); const result = d.kind === 'architecture-model' ? validateArchitecture(d, libraries) : { valid: false }; if (result.valid) fail(`tests/invalid/${f} should be rejected`); else console.log(`PASS: tests/invalid/${f} was rejected`); }
if (failures) { console.error(`\n${failures} validation check(s) failed.`); process.exitCode = 1; } else console.log('\nAll specification checks passed.');
