/**
 * Protobuf getter enforcement integration tests.
 *
 * Verifies the 4-attribute chain:
 *   protobufTypes → protobufTypeEnv → protobufViolation → allProtobufViolations
 *
 * Tests run with PROTOBUF_CHECKING_ENABLED toggled on before evaluation
 * and restored afterwards.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as path from 'node:path';
import ts from 'typescript';

import { evaluator, tsToAstTranslatorAdapter } from '../../src/application/evaluation/ts-kind-checking.js';
import { createProgram } from '../../src/application/index.js';
import type { KSCAttrMap, Diagnostic } from '../../src/adapters/analysis/spec/ts-kind-checking/index.js';
import type { TypedAGNode } from '@kindscript/core-evaluator';

// Import the toggle setter so we can enable/disable protobuf checking
import { setProtobufCheckingEnabled } from '../../src/adapters/analysis/spec/ts-kind-checking/equations/protobuf.js';

const FIXTURES = path.resolve(__dirname, '../fixtures');

function getRootFiles(fixtureDir: string): string[] {
  return ts.sys.readDirectory(
    path.join(FIXTURES, fixtureDir, 'src'),
    ['.ts'],
  );
}

function buildAndEvaluateProtobuf(fixtureDir: string) {
  const files = getRootFiles(fixtureDir);
  const tsProgram = ts.createProgram(files, {
    strict: true,
    noEmit: true,
    rootDir: path.join(FIXTURES, fixtureDir),
  });
  const ksTree = tsToAstTranslatorAdapter.convert(tsProgram);
  const { definitions, diagnostics } = evaluator.evaluate(ksTree.root);
  const dnodeRoot = evaluator.buildTree(ksTree.root);
  return { ksTree, dnodeRoot, definitions, diagnostics };
}

/** Filter diagnostics to just protobuf violations. */
function pbDiags(diags: Diagnostic[]): Diagnostic[] {
  return diags.filter(d => d.property === 'protobuf-getter');
}

describe('protobuf getter enforcement', () => {
  let dnodeRoot: TypedAGNode<KSCAttrMap>;
  let diagnostics: Diagnostic[];

  beforeAll(() => {
    setProtobufCheckingEnabled(true);
  });

  afterAll(() => {
    setProtobufCheckingEnabled(false);
  });

  beforeAll(() => {
    const result = buildAndEvaluateProtobuf('protobuf-getter');
    dnodeRoot = result.dnodeRoot;
    diagnostics = result.diagnostics;
  });

  // ── Collect phase ──────────────────────────────────────────────────

  describe('protobufTypes attribute (collect phase)', () => {
    it('extracts protobuf type names from named imports', () => {
      const handlerCU = dnodeRoot.children.find(cu =>
        (cu.node as { fileName?: string }).fileName?.includes('handler.ts')
      );
      expect(handlerCU).toBeDefined();

      const pbTypes = handlerCU!.attr('protobufTypes') as Map<string, unknown>;
      expect(pbTypes.has('Person')).toBe(true);
      expect(pbTypes.has('Address')).toBe(true);
    });

    it('extracts namespace import bindings', () => {
      const nsCU = dnodeRoot.children.find(cu =>
        (cu.node as { fileName?: string }).fileName?.includes('namespace-handler.ts')
      );
      expect(nsCU).toBeDefined();

      const pbTypes = nsCU!.attr('protobufTypes') as Map<string, { namespace: boolean }>;
      expect(pbTypes.has('proto')).toBe(true);
      expect(pbTypes.get('proto')!.namespace).toBe(true);
    });

    it('returns empty map for files without protobuf imports', () => {
      const pbCU = dnodeRoot.children.find(cu =>
        (cu.node as { fileName?: string }).fileName?.includes('person_pb.ts')
      );
      expect(pbCU).toBeDefined();

      const pbTypes = pbCU!.attr('protobufTypes') as Map<string, unknown>;
      expect(pbTypes.size).toBe(0);
    });
  });

  // ── Propagate phase ────────────────────────────────────────────────

  describe('protobufTypeEnv attribute (propagate phase)', () => {
    it('broadcasts protobuf type names to every node', () => {
      const env = dnodeRoot.attr('protobufTypeEnv') as Set<string>;
      expect(env.has('Person')).toBe(true);
      expect(env.has('Address')).toBe(true);
    });

    it('is available deep in the tree (inherited copy-down)', () => {
      // Walk to a deep node
      let node: TypedAGNode<KSCAttrMap> = dnodeRoot;
      for (let i = 0; i < 6 && node.children.length > 0; i++) {
        node = node.children[0];
      }
      const env = node.attr('protobufTypeEnv') as Set<string>;
      expect(env.has('Person')).toBe(true);
    });
  });

  // ── Check phase: violations ────────────────────────────────────────

  describe('protobufViolation attribute (check phase)', () => {
    it('detects direct field access violations (PropertyAccessExpression)', () => {
      const violations = pbDiags(diagnostics);
      const messages = violations.map(d => d.message);

      // These direct accesses should be flagged
      expect(messages.some(m => m.includes("'.name'") && m.includes("'Person'"))).toBe(true);
      expect(messages.some(m => m.includes("'.age'") && m.includes("'Person'"))).toBe(true);
      expect(messages.some(m => m.includes("'.street'") && m.includes("'Address'"))).toBe(true);
    });

    it('detects element access violations (ElementAccessExpression)', () => {
      const violations = pbDiags(diagnostics);
      const messages = violations.map(d => d.message);

      // msg['name'] should be flagged
      expect(messages.some(m => m.includes("['name']") && m.includes("'Person'"))).toBe(true);
    });

    it('detects chained access violations (getAddress().street)', () => {
      const violations = pbDiags(diagnostics);
      const messages = violations.map(d => d.message);

      // p.getAddress().street — .street on Address is a violation
      expect(messages.some(m => m.includes("'.street'") && m.includes("'Address'"))).toBe(true);
    });

    it('does not flag method calls', () => {
      const violations = pbDiags(diagnostics);
      const messages = violations.map(d => d.message);

      expect(messages.some(m => m.includes('getName'))).toBe(false);
      expect(messages.some(m => m.includes('getAge'))).toBe(false);
      expect(messages.some(m => m.includes('setName'))).toBe(false);
      expect(messages.some(m => m.includes('setAge'))).toBe(false);
      expect(messages.some(m => m.includes('getAddress'))).toBe(false);
      expect(messages.some(m => m.includes('toObject'))).toBe(false);
      expect(messages.some(m => m.includes('serializeBinary'))).toBe(false);
    });

    it('does not flag toObject() result fields (escape hatch)', () => {
      const violations = pbDiags(diagnostics);

      // toObject() returns { name: string; age: number } — a plain object type
      // Access to obj.name / obj.age should NOT be flagged
      // We need to verify none of the violations come from toObjectEscapeHatch
      // The violation on .name from toObject() result would have a different typeString
      // (the structural type, not 'Person')
      for (const v of violations) {
        // No violation should mention a structural type like '{ name: string; age: number; }'
        expect(v.message).not.toMatch(/\{ name: string/);
      }
    });

    it('does not flag non-protobuf types', () => {
      const violations = pbDiags(diagnostics);
      const messages = violations.map(d => d.message);

      expect(messages.some(m => m.includes('timeout'))).toBe(false);
      expect(messages.some(m => m.includes("'Config'"))).toBe(false);
    });

    it('all violations include correct position info', () => {
      const violations = pbDiags(diagnostics);
      for (const d of violations) {
        expect(d.pos).toBeGreaterThan(0);
        expect(d.end).toBeGreaterThan(d.pos);
        expect(d.fileName).toBeTruthy();
        expect(d.message).toBeTruthy();
        expect(d.property).toBe('protobuf-getter');
      }
    });
  });

  // ── Gather phase ───────────────────────────────────────────────────

  describe('allProtobufViolations attribute (gather phase)', () => {
    it('root gathers all violations from all files', () => {
      const allPbViolations = dnodeRoot.attr('allProtobufViolations') as Diagnostic[];
      // At least: p.name, p.age, p.name='test', addr.street, p['name'], chained .street, namespace p.name
      expect(allPbViolations.length).toBeGreaterThanOrEqual(6);
    });

    it('handler CU contains violations from its subtree only', () => {
      const handlerCU = dnodeRoot.children.find(cu =>
        (cu.node as { fileName?: string }).fileName?.includes('handler.ts')
      );
      expect(handlerCU).toBeDefined();

      const cuViolations = handlerCU!.attr('allProtobufViolations') as Diagnostic[];
      expect(cuViolations.length).toBeGreaterThanOrEqual(5);
    });

    it('person_pb CU has zero violations (no usage, only definitions)', () => {
      const pbCU = dnodeRoot.children.find(cu =>
        (cu.node as { fileName?: string }).fileName?.includes('person_pb.ts')
      );
      expect(pbCU).toBeDefined();

      const cuViolations = pbCU!.attr('allProtobufViolations') as Diagnostic[];
      expect(cuViolations.length).toBe(0);
    });

    it('namespace-handler CU has violations', () => {
      const nsCU = dnodeRoot.children.find(cu =>
        (cu.node as { fileName?: string }).fileName?.includes('namespace-handler.ts')
      );
      expect(nsCU).toBeDefined();

      const cuViolations = nsCU!.attr('allProtobufViolations') as Diagnostic[];
      expect(cuViolations.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── Toggle control ─────────────────────────────────────────────────

  describe('toggle control', () => {
    it('when disabled, returns empty results', () => {
      setProtobufCheckingEnabled(false);
      const result = buildAndEvaluateProtobuf('protobuf-getter');

      expect(pbDiags(result.diagnostics).length).toBe(0);

      const env = result.dnodeRoot.attr('protobufTypeEnv') as Set<string>;
      expect(env.size).toBe(0);

      // Re-enable for other tests
      setProtobufCheckingEnabled(true);
    });
  });

  // ── Config-driven API ──────────────────────────────────────────────

  describe('config-driven API (createProgram)', () => {
    it('enables protobuf checking via config.protobuf.enabled', () => {
      // Use the public API with config
      setProtobufCheckingEnabled(false); // reset first
      const files = getRootFiles('protobuf-getter');
      const program = createProgram(files, { protobuf: { enabled: true } }, {
        strict: true,
        noEmit: true,
        rootDir: path.join(FIXTURES, 'protobuf-getter'),
      });

      const diags = program.getDiagnostics();
      const pbViolations = diags.filter(d => d.property === 'protobuf-getter');
      expect(pbViolations.length).toBeGreaterThanOrEqual(6);
    });

    it('does not enable protobuf checking without config', () => {
      setProtobufCheckingEnabled(false); // reset first
      const files = getRootFiles('protobuf-getter');
      const program = createProgram(files, undefined, {
        strict: true,
        noEmit: true,
        rootDir: path.join(FIXTURES, 'protobuf-getter'),
      });

      const diags = program.getDiagnostics();
      const pbViolations = diags.filter(d => d.property === 'protobuf-getter');
      expect(pbViolations.length).toBe(0);
    });
  });
});
