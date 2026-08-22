import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import { parse as yaml } from 'yaml';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ajv = new Ajv2020({ allErrors: true, strict: true });
const names = ['token-library', 'architecture-model', 'policy-set', 'validation-report', 'renderer-input'];
const schemas = {};
const validators = {};
const format = (errors) => (errors ?? []).map((e) => `${e.instancePath || '/'} ${e.keyword}: ${e.message}`).join('; ');
for (const name of names) {
  const schema = JSON.parse(fs.readFileSync(path.join(root, 'schema', `${name}.schema.json`), 'utf8'));
  if (!ajv.validateSchema(schema)) throw new Error(`${name} schema invalid: ${format(ajv.errors)}`);
  schemas[name] = schema;
  ajv.addSchema(schema, schema.$id);
}
for (const name of names) validators[name] = ajv.compile(schemas[name]);

const read = (file) => yaml(fs.readFileSync(file, 'utf8'));
const diag = (code, severity, layer, reportPath, message, extra = {}) => ({ code, severity, layer, path: reportPath, message, ...extra });
const key = (library) => `${library.namespace}@${library.version}`;
const refKey = (namespace, id) => `${namespace}:${id}`;

function libraryState(libraries) {
  const diagnostics = [];
  const tokens = new Map();
  const byKey = new Map();
  for (const library of libraries) {
    const libraryId = key(library);
    if (byKey.has(libraryId)) diagnostics.push(diag('DUPLICATE_LIBRARY_ID', 'error', 'references', '/libraries', `Duplicate ${libraryId}`));
    byKey.set(libraryId, library);
    for (const token of library.tokens ?? []) {
      if (!library.domains?.includes(token.id.split('.')[0])) diagnostics.push(diag('TOKEN_NAMESPACE_MISMATCH', 'error', 'references', '/tokens', `${token.id} is outside ${library.namespace} domains`));
      const ref = refKey(library.namespace, token.id);
      if (tokens.has(ref)) diagnostics.push(diag('DUPLICATE_TOKEN_ID', 'error', 'references', '/tokens', `Duplicate ${ref}`));
      tokens.set(ref, { ...token, namespace: library.namespace, version: library.version, ref });
    }
  }
  const check = (ref, kind, reportPath) => {
    const token = tokens.get(ref);
    if (!token) diagnostics.push(diag('UNRESOLVED_LIBRARY_REF', 'error', 'references', reportPath, `Unresolved library reference ${ref}`));
    else if (kind && token.kind !== kind) diagnostics.push(diag('WRONG_LIBRARY_REF_KIND', 'error', 'references', reportPath, `${ref} must reference ${kind}`));
  };
  for (const library of libraries) for (const token of library.tokens ?? []) {
    for (const field of ['requires', 'conflicts']) for (const ref of token[field] ?? []) check(ref, 'applied', `/${library.namespace}/tokens/${token.id}/${field}`);
    for (const field of ['componentTypes', 'relationshipTypes']) for (const ref of token.appliesTo?.[field] ?? []) check(ref, field === 'componentTypes' ? 'component-type' : 'relationship-type', `/${library.namespace}/tokens/${token.id}/appliesTo/${field}`);
  }
  return { diagnostics, tokens, byKey };
}

export function validateLibraries(libraries) {
  const diagnostics = [];
  for (const library of libraries) if (!validators['token-library'](library)) diagnostics.push(diag('SCHEMA_INVALID_LIBRARY', 'error', 'schema', '/libraries', format(validators['token-library'].errors)));
  diagnostics.push(...libraryState(libraries).diagnostics);
  return { valid: !diagnostics.some((item) => item.severity === 'error'), diagnostics };
}

export function validateArchitecture(model, libraries, policies = []) {
  const state = libraryState(libraries);
  const diagnostics = [...state.diagnostics];
  const declared = new Set(model.libraries ?? []);
  for (const library of declared) if (!state.byKey.has(library)) diagnostics.push(diag('PACKAGE_VERSION_MISMATCH', 'error', 'references', '/libraries', `Library ${library} is unavailable`));
  const components = new Map();
  const relationships = new Map();
  const ids = new Set();
  const add = (element, kind, index) => {
    if (ids.has(element.id)) diagnostics.push(diag('DUPLICATE_ELEMENT_ID', 'error', 'references', `/${kind}s/${index}/id`, `Duplicate ${element.id}`, { elementId: element.id }));
    ids.add(element.id);
    (kind === 'component' ? components : relationships).set(element.id, { ...element, elementKind: kind });
  };
  (model.components ?? []).forEach((element, index) => add(element, 'component', index));
  (model.relationships ?? []).forEach((element, index) => add(element, 'relationship', index));
  const refs = (element) => (element.tokens ?? []).map((item) => item.token);
  const resolve = (ref, expected, reportPath, elementId) => {
    const token = state.tokens.get(ref);
    if (!token) { diagnostics.push(diag('UNRESOLVED_TOKEN', 'error', 'references', reportPath, `Unresolved ${ref}`, { elementId })); return null; }
    if (token.kind !== expected) diagnostics.push(diag('WRONG_TOKEN_KIND', 'error', 'semantics', reportPath, `Expected ${expected}`, { elementId }));
    if (!declared.has(`${token.namespace}@${token.version}`)) diagnostics.push(diag('UNDECLARED_LIBRARY_TOKEN', 'error', 'references', reportPath, `${ref} is from an undeclared library`, { elementId }));
    return token;
  };
  for (const [id, element] of [...components, ...relationships]) {
    const kind = element.elementKind === 'component' ? 'component-type' : 'relationship-type';
    const type = resolve(element.type, kind, `/${element.elementKind}s/${id}/type`, id);
    if (type?.valueSchema && !ajv.compile(type.valueSchema)(element.configuration ?? {})) diagnostics.push(diag('INVALID_TYPE_CONFIGURATION', 'error', 'semantics', `/${element.elementKind}s/${id}/configuration`, 'Invalid type configuration', { elementId: id }));
    const seen = new Set();
    for (const application of element.tokens ?? []) {
      if (seen.has(application.token)) diagnostics.push(diag('DUPLICATE_APPLICATION', 'error', 'semantics', `/${element.elementKind}s/${id}/tokens`, `Duplicate ${application.token}`, { elementId: id }));
      seen.add(application.token);
    }
    for (const application of element.tokens ?? []) {
      const token = resolve(application.token, 'applied', `/${element.elementKind}s/${id}/tokens`, id);
      if (!token) continue;
      const applies = token.appliesTo;
      if (applies && (!applies.elementKinds?.includes(element.elementKind) || (element.elementKind === 'component' && applies.componentTypes && !applies.componentTypes.includes(element.type)) || (element.elementKind === 'relationship' && applies.relationshipTypes && !applies.relationshipTypes.includes(element.type)))) diagnostics.push(diag('TOKEN_NOT_APPLICABLE', 'error', 'semantics', `/${element.elementKind}s/${id}/tokens`, `${application.token} not applicable`, { elementId: id }));
      if (application.value !== undefined && !token.valueSchema) diagnostics.push(diag('UNEXPECTED_TOKEN_VALUE', 'error', 'semantics', `/${element.elementKind}s/${id}/tokens`, `${application.token} has no value schema`, { elementId: id }));
      if (token.valueSchema && application.value === undefined) diagnostics.push(diag('INVALID_TOKEN_VALUE', 'error', 'semantics', `/${element.elementKind}s/${id}/tokens`, `${application.token} requires a value`, { elementId: id }));
      else if (token.valueSchema && !ajv.compile(token.valueSchema)(application.value)) diagnostics.push(diag('INVALID_TOKEN_VALUE', 'error', 'semantics', `/${element.elementKind}s/${id}/tokens`, `Invalid ${application.token}`, { elementId: id }));
      for (const required of token.requires ?? []) if (!seen.has(required)) diagnostics.push(diag('TOKEN_REQUIRES', 'error', 'semantics', `/${element.elementKind}s/${id}/tokens`, `${application.token} requires ${required}`, { elementId: id }));
      for (const conflict of token.conflicts ?? []) if (seen.has(conflict)) diagnostics.push(diag('TOKEN_CONFLICT', 'error', 'semantics', `/${element.elementKind}s/${id}/tokens`, `${application.token} conflicts ${conflict}`, { elementId: id }));
    }
  }
  for (const relationship of relationships.values()) for (const endpoint of [relationship.from, relationship.to]) if (!components.has(endpoint)) diagnostics.push(diag('UNRESOLVED_ELEMENT', 'error', 'references', `/relationships/${relationship.id}`, `Unresolved ${endpoint}`, { elementId: relationship.id }));
  const matches = (element, condition) => {
    if (!condition) return true;
    if (condition.all) return condition.all.every((item) => matches(element, item));
    if (condition.any) return condition.any.some((item) => matches(element, item));
    if (condition.not) return !matches(element, condition.not);
    if (condition.kind && element.elementKind !== condition.kind) return false;
    if (condition.type && element.type !== condition.type) return false;
    const tokenRefs = refs(element);
    if (condition.hasToken && !tokenRefs.includes(condition.hasToken)) return false;
    if (condition.missingToken && tokenRefs.includes(condition.missingToken)) return false;
    if (!condition.connectedTo) return true;
    const query = condition.connectedTo;
    return [...relationships.values()].filter((relationship) => (query.direction === 'in' ? relationship.to === element.id : query.direction === 'out' ? relationship.from === element.id : relationship.from === element.id || relationship.to === element.id) && (!query.relationshipType || relationship.type === query.relationshipType)).some((relationship) => {
      const other = components.get(relationship.from === element.id ? relationship.to : relationship.from);
      return other && (!query.elementType || other.type === query.elementType) && (!query.elementToken || refs(other).includes(query.elementToken));
    });
  };
  for (const policySet of policies) for (const policy of policySet.policies ?? []) {
    const elements = policy.target === 'component' ? [...components.values()] : policy.target === 'relationship' ? [...relationships.values()] : [{ ...model, id: model.id, elementKind: 'model' }];
    for (const element of elements) if (matches(element, policy.where) && !matches(element, policy.assert)) diagnostics.push(diag('POLICY_VIOLATION', policy.severity, 'policy', `/policies/${policy.id}`, policy.message, { ...(element.elementKind === 'model' ? {} : { elementId: element.id }), ruleId: policy.id }));
  }
  return { valid: !diagnostics.some((item) => item.severity === 'error'), diagnostics };
}

export function normalizeArchitecture(model, libraries) {
  const state = libraryState(libraries);
  const definition = (ref) => { const token = state.tokens.get(ref); return token ? { ref, namespace: token.namespace, id: token.id, kind: token.kind, name: token.name, description: token.description } : { ref }; };
  const normalize = (element) => ({ id: element.id, type: { definition: definition(element.type) }, appliedTokens: (element.tokens ?? []).map((item) => ({ token: { definition: definition(item.token) }, ...(item.value === undefined ? {} : { value: item.value }) })), configuration: element.configuration ?? {}, ...(element.from === undefined ? {} : { from: element.from, to: element.to }) });
  return { kind: 'renderer-input', model: { id: model.id, components: (model.components ?? []).map(normalize), relationships: (model.relationships ?? []).map(normalize) } };
}

function manifest(dir) { return JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8')); }
function reportValid(report, label, failures) { if (!validators['validation-report'](report)) failures.push(`${label} report invalid: ${format(validators['validation-report'].errors)}`); }
function run() {
  const failures = [];
  const fail = (message) => failures.push(message);
  const libraries = fs.readdirSync(path.join(root, 'libraries')).filter((file) => file.endsWith('.yaml')).flatMap((file) => { const value = read(path.join(root, 'libraries', file)); return Array.isArray(value) ? value : [value]; });
  if (!validateLibraries(libraries).valid) fail('shipped libraries invalid');
  for (const file of fs.readdirSync(path.join(root, 'examples')).filter((name) => name.endsWith('.yaml'))) {
    const document = read(path.join(root, 'examples', file));
    const schema = document.kind === 'architecture-model' ? 'architecture-model' : 'policy-set';
    if (!validators[schema](document)) fail(`${file} schema invalid: ${format(validators[schema].errors)}`);
    if (schema === 'architecture-model') {
      const normalized = normalizeArchitecture(document, libraries);
      if (!validators['renderer-input'](normalized)) fail(`${file} renderer input invalid: ${format(validators['renderer-input'].errors)}`);
      const report = validateArchitecture(document, libraries, [read(path.join(root, 'examples/policies.yaml'))]); reportValid(report, file, failures);
      if (!report.valid) fail(`${file} should pass policies`);
    }
  }
  const runManifest = (folder, check) => {
    const dir = path.join(root, 'tests', folder); const map = manifest(dir); const files = fs.readdirSync(dir).filter((file) => file.endsWith('.yaml'));
    for (const file of files) { if (!map[file]) { fail(`${folder}/${file} missing manifest entry`); continue; } check(file, map[file], dir); }
    for (const file of Object.keys(map)) if (!files.includes(file)) fail(`${folder} manifest entry has no file: ${file}`);
  };
  runManifest('schema-invalid', (file, expected, dir) => { const validator = validators[expected.schema]; if (!validator) return fail(`${file} names unknown schema`); const document = read(path.join(dir, file)); if (validator(document)) fail(`${file} should fail schema`); if (expected.keyword && !validator.errors.some((error) => error.keyword === expected.keyword)) fail(`${file} missing keyword ${expected.keyword}`); if (expected.instancePath && !validator.errors.some((error) => error.instancePath === expected.instancePath)) fail(`${file} missing pointer ${expected.instancePath}`); console.log(`PASS: schema-invalid/${file}`); });
  runManifest('semantic-invalid', (file, expected, dir) => { const document = read(path.join(dir, file)); if (!validators['architecture-model'](document)) return fail(`${file} is not schema-valid`); const report = validateArchitecture(document, libraries, expected.policies ? [read(path.join(root, 'examples/policies.yaml'))] : []); reportValid(report, file, failures); for (const code of expected.codes ?? []) if (!report.diagnostics.some((item) => item.code === code)) fail(`${file} missing ${code}`); for (const ruleId of expected.ruleIds ?? expected.rules ?? []) if (!report.diagnostics.some((item) => item.ruleId === ruleId)) fail(`${file} missing rule ${ruleId}`); if ((expected.codes ?? []).length && report.valid) fail(`${file} unexpectedly valid`); console.log(`PASS: semantic-invalid/${file}`); });
  runManifest('library-invalid', (file, expected, dir) => { const value = read(path.join(dir, file)); const docs = Array.isArray(value) ? value : [value]; for (const document of docs) if (!validators['token-library'](document)) fail(`${file} fixture is not schema-valid`); const report = validateLibraries(docs); for (const code of expected.codes ?? []) if (!report.diagnostics.some((item) => item.code === code)) fail(`${file} missing ${code}`); console.log(`PASS: library-invalid/${file}`); });
  if (failures.length) { failures.forEach((failure) => console.error(`FAIL: ${failure}`)); process.exitCode = 1; } else console.log('All specification checks passed.');
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) run();
