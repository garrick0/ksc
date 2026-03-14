import type ts from 'typescript';
import type { KindScriptConfig } from './index.js';

export interface Diagnostic {
  node: unknown;
  message: string;
  kindName: string;
  property: string;
  pos: number;
  end: number;
  fileName: string;
}

export interface KindDefinition {
  id: string;
  name: string;
  properties: Record<string, boolean | undefined>;
  node: unknown;
}

export interface KSProgramInterface {
  getRootFileNames(): string[];
  getCompilationUnits(): unknown[];
  getKindDefinitions(): KindDefinition[];
  getDiagnostics(): Diagnostic[];
  getKSTree(): { root: unknown };
  getAttributeDepGraph(): unknown;
}

export interface ProjectCheckResult {
  definitions: KindDefinition[];
  diagnostics: Diagnostic[];
  fileCount: number;
}

export function createProgram(
  rootNames: string[],
  config?: KindScriptConfig,
  options?: ts.CompilerOptions,
): KSProgramInterface;

export function createProgramFromTSProgram(
  tsProgram: ts.Program,
  config?: KindScriptConfig,
): KSProgramInterface;

export function parseOnly(
  rootNames: string[],
  options?: ts.CompilerOptions,
  depth?: 'parse' | 'bind' | 'check',
): { root: unknown };

export function extractASTData(
  ksTree: { root: unknown },
  analysisDepth?: 'parse' | 'bind' | 'check',
): unknown;

export function checkProject(
  rootDir: string,
  options?: {
    configPath?: string;
    depth?: 'parse' | 'bind' | 'check';
  },
): Promise<ProjectCheckResult>;

export function findConfig(rootDir: string): string | undefined;
export function findRootFiles(
  rootDir: string,
  options?: {
    include?: readonly string[];
    exclude?: readonly string[];
  },
): string[];
export function loadConfig(configPath: string): Promise<KindScriptConfig>;
export function resolveConfig(options: {
  configPath?: string;
  rootDir: string;
  overrides?: Partial<KindScriptConfig>;
}): Promise<KindScriptConfig>;
