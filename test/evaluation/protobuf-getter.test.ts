/**
 * Protobuf getter enforcement integration tests.
 *
 * Verifies the 4-attribute chain:
 *   protobufTypes → protobufTypeEnv → protobufViolation → allProtobufViolations
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as path from 'node:path';
import ts from 'typescript';

import { buildTSTree, evaluateTS, tsToAstTranslatorAdapter } from '../compose.js';
import { createProgram } from 'ksc/ts-kind-checking';
import type { KSCAttrMap, Diagnostic } from '@ksc/analysis-ts-kind-checking';
import type { TypedAGNode } from '@ksc/ag-ports';

const FIXTURES = path.resolve(__dirname, '../fixtures');

function getRootFiles(fixtureDir: string): string[] {
  return ts.sys.readDirectory(path.join(FIXTURES, fixtureDir, 'src'), ['.ts']);
}

function buildAndEvaluateProtobuf(
  fixtureDir: string,
  options?: { protobufEnabled?: boolean },
) {
  const files = getRootFiles(fixtureDir);
  const tsProgram = ts.createProgram(files, {
    strict: true, noEmit: true,
    rootDir: path.join(FIXTURES, fixtureDir),
  });
  const ksTree = tsToAstTranslatorAdapter.convert(tsProgram);
  const dnodeRoot = evaluateTS(
    ksTree.root,
    options?.protobufEnabled ? { protobuf: { enabled: true } } : undefined,
  );
  const definitions = dnodeRoot.attr('definitions');
  const diagnostics = dnodeRoot.attr('diagnostics');
  return { ksTree, dnodeRoot, definitions, diagnostics };
}

function pbDiags(diags: Diagnostic[]): Diagnostic[] {
  return diags.filter(d => d.property === 'protobuf-getter');
}

describe('protobuf getter enforcement', () => {
  let dnodeRoot: TypedAGNode<KSCAttrMap>;
  let diagnostics: Diagnostic[];

  beforeAll(() => {
    const result = buildAndEvaluateProtobuf('protobuf-getter', { protobufEnabled: true });
    dnodeRoot = result.dnodeRoot;
    diagnostics = result.diagnostics;
  });

  // ── Collect phase ──

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

    it('extracts namespace import bindings and returns empty for non-protobuf files', () => {
      const nsCU = dnodeRoot.children.find(cu =>
        (cu.node as { fileName?: string }).fileName?.includes('namespace-handler.ts')
      );
      expect(nsCU).toBeDefined();
      const nsTypes = nsCU!.attr('protobufTypes') as Map<string, { namespace: boolean }>;
      expect(nsTypes.has('proto')).toBe(true);
      expect(nsTypes.get('proto')!.namespace).toBe(true);

      const pbCU = dnodeRoot.children.find(cu =>
        (cu.node as { fileName?: string }).fileName?.includes('person_pb.ts')
      );
      expect(pbCU!.attr('protobufTypes') as Map<string, unknown>).toSatisfy((m: Map<string, unknown>) => m.size === 0);
    });
  });

  // ── Propagate phase ──

  describe('protobufTypeEnv attribute (propagate phase)', () => {
    it('broadcasts protobuf type names to every node (inherited copy-down)', () => {
      const env = dnodeRoot.attr('protobufTypeEnv') as Set<string>;
      expect(env.has('Person')).toBe(true);
      expect(env.has('Address')).toBe(true);

      // Verify deep in the tree
      let node: TypedAGNode<KSCAttrMap> = dnodeRoot;
      for (let i = 0; i < 6 && node.children.length > 0; i++) node = node.children[0];
      expect((node.attr('protobufTypeEnv') as Set<string>).has('Person')).toBe(true);
    });
  });

  // ── Check phase ──

  describe('protobufViolation attribute (check phase)', () => {
    it('detects direct field access and element access violations', () => {
      const violations = pbDiags(diagnostics);
      const messages = violations.map(d => d.message);
      expect(messages.some(m => m.includes("'.name'") && m.includes("'Person'"))).toBe(true);
      expect(messages.some(m => m.includes("'.age'") && m.includes("'Person'"))).toBe(true);
      expect(messages.some(m => m.includes("'.street'") && m.includes("'Address'"))).toBe(true);
      expect(messages.some(m => m.includes("['name']") && m.includes("'Person'"))).toBe(true);
    });

    it('does not flag method calls, toObject() results, or non-protobuf types', () => {
      const violations = pbDiags(diagnostics);
      const messages = violations.map(d => d.message);
      for (const safe of ['getName', 'getAge', 'setName', 'getAddress', 'toObject', 'serializeBinary']) {
        expect(messages.some(m => m.includes(safe))).toBe(false);
      }
      expect(messages.some(m => m.includes("'Config'"))).toBe(false);
      for (const v of violations) {
        expect(v.message).not.toMatch(/\{ name: string/);
      }
    });

    it('all violations include correct position info', () => {
      for (const d of pbDiags(diagnostics)) {
        expect(d.pos).toBeGreaterThan(0);
        expect(d.end).toBeGreaterThan(d.pos);
        expect(d.fileName).toBeTruthy();
        expect(d.property).toBe('protobuf-getter');
      }
    });
  });

  // ── Gather phase ──

  describe('allProtobufViolations attribute (gather phase)', () => {
    it('root gathers all violations, CUs contain only their subtree', () => {
      const allPbViolations = dnodeRoot.attr('allProtobufViolations') as Diagnostic[];
      expect(allPbViolations.length).toBeGreaterThanOrEqual(6);

      const handlerCU = dnodeRoot.children.find(cu =>
        (cu.node as { fileName?: string }).fileName?.includes('handler.ts')
      );
      expect((handlerCU!.attr('allProtobufViolations') as Diagnostic[]).length).toBeGreaterThanOrEqual(5);

      const pbCU = dnodeRoot.children.find(cu =>
        (cu.node as { fileName?: string }).fileName?.includes('person_pb.ts')
      );
      expect((pbCU!.attr('allProtobufViolations') as Diagnostic[]).length).toBe(0);
    });
  });

  // ── Toggle + config ──

  describe('toggle and config-driven control', () => {
    it('when disabled, returns empty results', () => {
      const result = buildAndEvaluateProtobuf('protobuf-getter');
      expect(pbDiags(result.diagnostics).length).toBe(0);
      expect((result.dnodeRoot.attr('protobufTypeEnv') as Set<string>).size).toBe(0);
    });

    it('enables protobuf checking via config.protobuf.enabled', () => {
      const files = getRootFiles('protobuf-getter');
      const program = createProgram(files, { protobuf: { enabled: true } }, {
        strict: true, noEmit: true,
        rootDir: path.join(FIXTURES, 'protobuf-getter'),
      });
      expect(program.getDiagnostics().filter(d => d.property === 'protobuf-getter').length).toBeGreaterThanOrEqual(6);
    });

    it('does not enable protobuf checking without config', () => {
      const files = getRootFiles('protobuf-getter');
      const program = createProgram(files, undefined, {
        strict: true, noEmit: true,
        rootDir: path.join(FIXTURES, 'protobuf-getter'),
      });
      expect(program.getDiagnostics().filter(d => d.property === 'protobuf-getter').length).toBe(0);
    });
  });
});
