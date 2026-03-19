/**
 * Workflow Validation Tests
 *
 * Catches common GitHub Actions workflow issues BEFORE pushing:
 * - Missing files referenced by workflows (requirements.txt, scripts, etc.)
 * - Invalid YAML syntax
 * - Missing secrets documentation
 * - Inline code that breaks YAML escaping
 *
 * These tests prevent the v2.0 failure pattern where workflows were marked
 * "complete" but every GitHub Actions run failed.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { parse as parseYaml } from 'yaml';

const WORKFLOWS_DIR = join(process.cwd(), '.github/workflows');
const ROOT = process.cwd();

function loadWorkflow(name: string) {
  const path = join(WORKFLOWS_DIR, name);
  const raw = readFileSync(path, 'utf-8');
  const parsed = parseYaml(raw);
  return { raw, parsed, path };
}

function getAllWorkflows(): string[] {
  if (!existsSync(WORKFLOWS_DIR)) return [];
  return readdirSync(WORKFLOWS_DIR).filter(f => f.endsWith('.yml') || f.endsWith('.yaml'));
}

describe('GitHub Actions workflow validation', () => {
  const workflows = getAllWorkflows();

  it('has at least one workflow file', () => {
    expect(workflows.length).toBeGreaterThan(0);
  });

  describe.each(workflows)('%s', (filename) => {
    it('is valid YAML', () => {
      const { raw } = loadWorkflow(filename);
      expect(() => parseYaml(raw)).not.toThrow();
    });

    it('has a name field', () => {
      const { parsed } = loadWorkflow(filename);
      expect(parsed.name).toBeTruthy();
    });

    it('has at least one trigger', () => {
      const { parsed } = loadWorkflow(filename);
      expect(parsed.on).toBeTruthy();
    });

    it('has at least one job', () => {
      const { parsed } = loadWorkflow(filename);
      expect(parsed.jobs).toBeTruthy();
      expect(Object.keys(parsed.jobs).length).toBeGreaterThan(0);
    });

    it('does not use inline template literals in run steps (YAML escaping trap)', () => {
      const { raw } = loadWorkflow(filename);
      // Template literals with ${} inside run: blocks break YAML
      // unless properly quoted — check for backtick + ${ pattern in run blocks
      const runBlocks = raw.match(/run:\s*[|>]?\s*\n([\s\S]*?)(?=\n\s*(?:-\s|[a-z]+:|$))/g) ?? [];
      for (const block of runBlocks) {
        // Allow ${{ github.* }} (GHA expressions) but flag JS template literals
        const stripped = block.replace(/\$\{\{[^}]+\}\}/g, ''); // remove GHA expressions
        if (stripped.includes('`') && stripped.includes('${')) {
          throw new Error(
            `Workflow ${filename} has inline template literals in a run block. ` +
            `Move to a separate script file to avoid YAML escaping issues.`
          );
        }
      }
    });
  });

  describe('pip cache requires requirements.txt', () => {
    it.each(workflows)('%s — if uses pip cache, requirements.txt must exist', (filename) => {
      const { raw } = loadWorkflow(filename);
      if (raw.includes("cache: 'pip'") || raw.includes('cache: pip')) {
        expect(
          existsSync(join(ROOT, 'requirements.txt')) ||
          existsSync(join(ROOT, 'pyproject.toml'))
        ).toBe(true);
      }
    });
  });

  describe('referenced scripts exist on disk', () => {
    it.each(workflows)('%s — all scripts referenced in run steps exist', (filename) => {
      const { raw } = loadWorkflow(filename);
      // Match patterns like: python3 scripts/foo.py, npx tsx scripts/bar.ts, node scripts/baz.js
      const scriptRefs = raw.matchAll(/(?:python3?|npx tsx|node)\s+(scripts\/[\w./-]+)/g);
      for (const match of scriptRefs) {
        const scriptPath = match[1];
        expect(
          existsSync(join(ROOT, scriptPath)),
          `Script ${scriptPath} referenced in ${filename} does not exist`
        ).toBe(true);
      }
    });
  });

  describe('referenced test fixtures exist on disk', () => {
    it.each(workflows)('%s — all test fixtures referenced in run steps exist', (filename) => {
      const { raw } = loadWorkflow(filename);
      const fixtureRefs = raw.matchAll(/(?:python3?|npx tsx|node)\s+(tests\/[\w./-]+)/g);
      for (const match of fixtureRefs) {
        const fixturePath = match[1];
        expect(
          existsSync(join(ROOT, fixturePath)),
          `Fixture ${fixturePath} referenced in ${filename} does not exist`
        ).toBe(true);
      }
    });
  });

  describe('secrets documentation', () => {
    it('all secrets used across workflows are documented', () => {
      const allSecrets = new Set<string>();
      for (const filename of workflows) {
        const { raw } = loadWorkflow(filename);
        const matches = raw.matchAll(/\$\{\{\s*secrets\.(\w+)\s*\}\}/g);
        for (const m of matches) {
          allSecrets.add(m[1]);
        }
      }

      // Secrets should be documented in a known location
      const docsPath = join(ROOT, '.github/SECRETS.md');
      if (allSecrets.size > 0) {
        expect(
          existsSync(docsPath),
          `${allSecrets.size} secrets used (${[...allSecrets].join(', ')}) but .github/SECRETS.md does not exist. ` +
          `Create it to document required secrets for new contributors.`
        ).toBe(true);

        const docs = readFileSync(docsPath, 'utf-8');
        for (const secret of allSecrets) {
          expect(
            docs.includes(secret),
            `Secret ${secret} is used in workflows but not documented in .github/SECRETS.md`
          ).toBe(true);
        }
      }
    });
  });
});
