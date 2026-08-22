import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import Ajv2020 from 'ajv/dist/2020.js';
import { parse as parseYaml } from 'yaml';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const schemaPath = path.join(root, 'schema', 'architecture-token.schema.json');
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
const ajv = new Ajv2020({ allErrors: true, strict: true });
let failures = 0;

function fail(message) {
  failures += 1;
  console.error(`FAIL: ${message}`);
}

function loadYaml(filePath) {
  return parseYaml(fs.readFileSync(filePath, 'utf8'));
}

function formatErrors(errors) {
  return (errors ?? [])
    .map((error) => `${error.instancePath || '/'} ${error.message}`)
    .join('; ');
}

if (!ajv.validateSchema(schema)) {
  fail(`schema is invalid: ${formatErrors(ajv.errors)}`);
}

const validate = ajv.compile(schema);

function validateExpectedValid(label, document) {
  if (!validate(document)) {
    fail(`${label} should be valid: ${formatErrors(validate.errors)}`);
  } else {
    console.log(`PASS: ${label}`);
  }
}

function validateExpectedInvalid(label, document) {
  if (validate(document)) {
    fail(`${label} should be rejected`);
  } else {
    console.log(`PASS: ${label} was rejected`);
  }
}

for (const fileName of fs.readdirSync(path.join(root, 'examples')).sort()) {
  const filePath = path.join(root, 'examples', fileName);
  validateExpectedValid(`examples/${fileName}`, loadYaml(filePath));
}

const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
const readmeExample = readme.match(/```yaml\s*\n([\s\S]*?)```/);
if (!readmeExample) {
  fail('README.md must contain a YAML example');
} else {
  validateExpectedValid('README.md YAML example', parseYaml(readmeExample[1]));
}

const invalidDirectory = path.join(root, 'tests', 'invalid');
for (const fileName of fs.readdirSync(invalidDirectory).sort()) {
  const filePath = path.join(invalidDirectory, fileName);
  validateExpectedInvalid(`tests/invalid/${fileName}`, loadYaml(filePath));
}

const markdownFiles = ['README.md', 'SPEC.md', 'CONTRIBUTING.md'];
const markdownLink = /(?<!!)\[[^\]]+\]\(([^)]+)\)/g;
for (const fileName of markdownFiles) {
  const filePath = path.join(root, fileName);
  const contents = fs.readFileSync(filePath, 'utf8');
  for (const match of contents.matchAll(markdownLink)) {
    const target = match[1].split('#', 1)[0];
    if (!target || /^(?:https?:|mailto:)/.test(target)) {
      continue;
    }

    const resolved = path.resolve(path.dirname(filePath), target);
    if (!fs.existsSync(resolved)) {
      fail(`${fileName} links to missing local target ${target}`);
    }
  }
}

if (failures > 0) {
  console.error(`\n${failures} validation check(s) failed.`);
  process.exitCode = 1;
} else {
  console.log('\nAll specification checks passed.');
}
