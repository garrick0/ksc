/**
 * ESLint boundary enforcement — codegen ↔ evaluation firewall.
 *
 * Rules:
 *   - libs/behavior/domain + application cannot import from libs/evaluation/
 *   - libs/behavior/adapters/ CAN import from libs/evaluation/domain/ (Ctx, KindCtx for equations)
 *   - libs/evaluation/domain/ cannot import from libs/behavior/
 *   - libs/evaluation/adapters/ CAN import from libs/behavior/adapters/ (generated dispatch, types)
 *   - Both can freely import from libs/grammar/
 *   - All wiring lives in apps/cli/ (codegen targets, compose roots)
 *   - libs/ cannot import from apps/
 */
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';

export default [
  // libs/ cannot import from apps/
  {
    files: ['libs/**/*.ts'],
    languageOptions: { parser: tsParser },
    plugins: { '@typescript-eslint': tsPlugin },
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{
          group: ['**/apps/**', '**/apps'],
          message: 'libs/ cannot import from apps/ (architectural boundary)',
        }],
      }],
    },
  },
  // Codegen domain + application cannot import from evaluation
  {
    files: ['libs/behavior/domain/**/*.ts', 'libs/behavior/application/**/*.ts'],
    languageOptions: { parser: tsParser },
    plugins: { '@typescript-eslint': tsPlugin },
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{
          group: ['**/evaluation/**', '**/evaluation'],
          message: 'codegen domain/application cannot import from evaluation (architectural boundary)',
        }],
      }],
    },
  },
  // Codegen adapters can import evaluation/domain/ (Ctx, KindCtx) but not evaluation/application/ or evaluation/adapters/
  {
    files: ['libs/behavior/adapters/**/*.ts'],
    languageOptions: { parser: tsParser },
    plugins: { '@typescript-eslint': tsPlugin },
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{
          group: ['**/evaluation/application/**', '**/evaluation/adapters/**'],
          message: 'codegen adapters can only import from evaluation/domain/ (Ctx, KindCtx for equations)',
        }],
      }],
    },
  },
  // Evaluation domain cannot import from codegen
  {
    files: ['libs/evaluation/domain/**/*.ts'],
    languageOptions: { parser: tsParser },
    plugins: { '@typescript-eslint': tsPlugin },
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{
          group: ['**/codegen/**', '**/codegen'],
          message: 'evaluation domain cannot import from codegen (architectural boundary)',
        }],
      }],
    },
  },
  // Evaluation adapters can import codegen/adapters/{generated/,types.ts} but not equations or other internals
  {
    files: ['libs/evaluation/adapters/**/*.ts'],
    languageOptions: { parser: tsParser },
    plugins: { '@typescript-eslint': tsPlugin },
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{
          group: ['**/codegen/domain/**', '**/codegen/application/**'],
          message: 'evaluation adapters cannot import from codegen domain/application (architectural boundary)',
        }, {
          group: ['**/codegen/adapters/**/equations/**'],
          message: 'evaluation adapters cannot import from codegen equations — move runtime utilities to types.ts',
        }],
      }],
    },
  },
  // Grammar is a leaf module — no deps on codegen or evaluation
  {
    files: ['libs/grammar/**/*.ts'],
    languageOptions: { parser: tsParser },
    plugins: { '@typescript-eslint': tsPlugin },
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{
          group: ['**/codegen/**', '**/codegen', '**/evaluation/**', '**/evaluation'],
          message: 'grammar is a leaf module — cannot import from codegen or evaluation',
        }],
      }],
    },
  },
];
