/** AUTO-GENERATED — do not edit. */
import type { AttributeDepGraph } from '@ksc/grammar';

export const depGraph: AttributeDepGraph = {
  "attributes": [
    "violations",
    "eqeqeqViolation",
    "noVarViolation",
    "noDebuggerViolation",
    "noEmptyViolation",
    "noBitwiseViolation",
    "noExplicitAnyViolation",
    "noDupeKeysViolation",
    "noSelfCompareViolation",
    "maxParamsThreshold",
    "maxParamsViolation",
    "noEmptyInterfaceViolation",
    "noDuplicateImportsViolation",
    "nestDepth",
    "maxDepthThreshold",
    "maxDepthViolation",
    "arrayTypeViolation",
    "typeDeclStyleViolation",
    "noConsoleViolation",
    "noEvalViolation",
    "noNewWrappersViolation",
    "noPlusPlusViolation",
    "noTemplateCurlyViolation",
    "noCondAssignViolation",
    "noDuplicateCaseViolation",
    "noSelfAssignViolation",
    "defaultCaseViolation",
    "defaultCaseLastViolation",
    "noUselessCatchViolation",
    "noMultiAssignViolation",
    "yodaViolation",
    "noEmptyFunctionViolation",
    "useIsNanViolation",
    "noSparseArraysViolation",
    "noEmptyPatternViolation",
    "noNonNullAssertionViolation",
    "noNamespaceViolation",
    "noRequireImportsViolation",
    "noEmptyObjectTypeViolation",
    "typeAssertionStyleViolation",
    "noDuplicateEnumValuesViolation",
    "preferAsConstViolation",
    "noDupeClassMembersViolation",
    "noUselessConstructorViolation",
    "noEmptyStaticBlockViolation",
    "shadowDepth",
    "shadowEnv",
    "noShadowViolation",
    "alwaysTerminates",
    "noUnreachableViolation",
    "noFallthroughViolation",
    "complexityThreshold",
    "complexityViolation",
    "allEslintViolations"
  ],
  "edges": [
    [
      "violations",
      "allEslintViolations"
    ],
    [
      "maxParamsViolation",
      "maxParamsThreshold"
    ],
    [
      "maxDepthViolation",
      "nestDepth"
    ],
    [
      "maxDepthViolation",
      "maxDepthThreshold"
    ],
    [
      "noShadowViolation",
      "shadowEnv"
    ],
    [
      "noShadowViolation",
      "shadowDepth"
    ],
    [
      "noUnreachableViolation",
      "alwaysTerminates"
    ],
    [
      "noFallthroughViolation",
      "alwaysTerminates"
    ],
    [
      "complexityViolation",
      "complexityThreshold"
    ],
    [
      "allEslintViolations",
      "eqeqeqViolation"
    ],
    [
      "allEslintViolations",
      "noVarViolation"
    ],
    [
      "allEslintViolations",
      "noDebuggerViolation"
    ],
    [
      "allEslintViolations",
      "noEmptyViolation"
    ],
    [
      "allEslintViolations",
      "noBitwiseViolation"
    ],
    [
      "allEslintViolations",
      "noExplicitAnyViolation"
    ],
    [
      "allEslintViolations",
      "noSelfCompareViolation"
    ],
    [
      "allEslintViolations",
      "maxParamsViolation"
    ],
    [
      "allEslintViolations",
      "noEmptyInterfaceViolation"
    ],
    [
      "allEslintViolations",
      "maxDepthViolation"
    ],
    [
      "allEslintViolations",
      "arrayTypeViolation"
    ],
    [
      "allEslintViolations",
      "typeDeclStyleViolation"
    ],
    [
      "allEslintViolations",
      "noConsoleViolation"
    ],
    [
      "allEslintViolations",
      "noEvalViolation"
    ],
    [
      "allEslintViolations",
      "noNewWrappersViolation"
    ],
    [
      "allEslintViolations",
      "noPlusPlusViolation"
    ],
    [
      "allEslintViolations",
      "noTemplateCurlyViolation"
    ],
    [
      "allEslintViolations",
      "noCondAssignViolation"
    ],
    [
      "allEslintViolations",
      "noSelfAssignViolation"
    ],
    [
      "allEslintViolations",
      "defaultCaseViolation"
    ],
    [
      "allEslintViolations",
      "defaultCaseLastViolation"
    ],
    [
      "allEslintViolations",
      "noUselessCatchViolation"
    ],
    [
      "allEslintViolations",
      "noMultiAssignViolation"
    ],
    [
      "allEslintViolations",
      "yodaViolation"
    ],
    [
      "allEslintViolations",
      "noEmptyFunctionViolation"
    ],
    [
      "allEslintViolations",
      "useIsNanViolation"
    ],
    [
      "allEslintViolations",
      "noSparseArraysViolation"
    ],
    [
      "allEslintViolations",
      "noEmptyPatternViolation"
    ],
    [
      "allEslintViolations",
      "noNonNullAssertionViolation"
    ],
    [
      "allEslintViolations",
      "noNamespaceViolation"
    ],
    [
      "allEslintViolations",
      "noRequireImportsViolation"
    ],
    [
      "allEslintViolations",
      "noEmptyObjectTypeViolation"
    ],
    [
      "allEslintViolations",
      "typeAssertionStyleViolation"
    ],
    [
      "allEslintViolations",
      "preferAsConstViolation"
    ],
    [
      "allEslintViolations",
      "noUselessConstructorViolation"
    ],
    [
      "allEslintViolations",
      "noEmptyStaticBlockViolation"
    ],
    [
      "allEslintViolations",
      "noShadowViolation"
    ],
    [
      "allEslintViolations",
      "complexityViolation"
    ],
    [
      "allEslintViolations",
      "noDupeKeysViolation"
    ],
    [
      "allEslintViolations",
      "noDuplicateImportsViolation"
    ],
    [
      "allEslintViolations",
      "noDuplicateCaseViolation"
    ],
    [
      "allEslintViolations",
      "noDuplicateEnumValuesViolation"
    ],
    [
      "allEslintViolations",
      "noDupeClassMembersViolation"
    ],
    [
      "allEslintViolations",
      "noUnreachableViolation"
    ],
    [
      "allEslintViolations",
      "noFallthroughViolation"
    ]
  ],
  "order": [
    "eqeqeqViolation",
    "noVarViolation",
    "noDebuggerViolation",
    "noEmptyViolation",
    "noBitwiseViolation",
    "noExplicitAnyViolation",
    "noSelfCompareViolation",
    "maxParamsThreshold",
    "maxParamsViolation",
    "noEmptyInterfaceViolation",
    "nestDepth",
    "maxDepthThreshold",
    "maxDepthViolation",
    "arrayTypeViolation",
    "typeDeclStyleViolation",
    "noConsoleViolation",
    "noEvalViolation",
    "noNewWrappersViolation",
    "noPlusPlusViolation",
    "noTemplateCurlyViolation",
    "noCondAssignViolation",
    "noSelfAssignViolation",
    "defaultCaseViolation",
    "defaultCaseLastViolation",
    "noUselessCatchViolation",
    "noMultiAssignViolation",
    "yodaViolation",
    "noEmptyFunctionViolation",
    "useIsNanViolation",
    "noSparseArraysViolation",
    "noEmptyPatternViolation",
    "noNonNullAssertionViolation",
    "noNamespaceViolation",
    "noRequireImportsViolation",
    "noEmptyObjectTypeViolation",
    "typeAssertionStyleViolation",
    "preferAsConstViolation",
    "noUselessConstructorViolation",
    "noEmptyStaticBlockViolation",
    "shadowEnv",
    "shadowDepth",
    "noShadowViolation",
    "complexityThreshold",
    "complexityViolation",
    "noDupeKeysViolation",
    "noDuplicateImportsViolation",
    "noDuplicateCaseViolation",
    "noDuplicateEnumValuesViolation",
    "noDupeClassMembersViolation",
    "alwaysTerminates",
    "noUnreachableViolation",
    "noFallthroughViolation",
    "allEslintViolations",
    "violations"
  ],
  "declarations": {
    "violations": {
      "direction": "syn"
    },
    "eqeqeqViolation": {
      "direction": "syn"
    },
    "noVarViolation": {
      "direction": "syn"
    },
    "noDebuggerViolation": {
      "direction": "syn"
    },
    "noEmptyViolation": {
      "direction": "syn"
    },
    "noBitwiseViolation": {
      "direction": "syn"
    },
    "noExplicitAnyViolation": {
      "direction": "syn"
    },
    "noDupeKeysViolation": {
      "direction": "syn"
    },
    "noSelfCompareViolation": {
      "direction": "syn"
    },
    "maxParamsThreshold": {
      "direction": "inh"
    },
    "maxParamsViolation": {
      "direction": "syn"
    },
    "noEmptyInterfaceViolation": {
      "direction": "syn"
    },
    "noDuplicateImportsViolation": {
      "direction": "syn"
    },
    "nestDepth": {
      "direction": "inh"
    },
    "maxDepthThreshold": {
      "direction": "inh"
    },
    "maxDepthViolation": {
      "direction": "syn"
    },
    "arrayTypeViolation": {
      "direction": "syn"
    },
    "typeDeclStyleViolation": {
      "direction": "syn"
    },
    "noConsoleViolation": {
      "direction": "syn"
    },
    "noEvalViolation": {
      "direction": "syn"
    },
    "noNewWrappersViolation": {
      "direction": "syn"
    },
    "noPlusPlusViolation": {
      "direction": "syn"
    },
    "noTemplateCurlyViolation": {
      "direction": "syn"
    },
    "noCondAssignViolation": {
      "direction": "syn"
    },
    "noDuplicateCaseViolation": {
      "direction": "syn"
    },
    "noSelfAssignViolation": {
      "direction": "syn"
    },
    "defaultCaseViolation": {
      "direction": "syn"
    },
    "defaultCaseLastViolation": {
      "direction": "syn"
    },
    "noUselessCatchViolation": {
      "direction": "syn"
    },
    "noMultiAssignViolation": {
      "direction": "syn"
    },
    "yodaViolation": {
      "direction": "syn"
    },
    "noEmptyFunctionViolation": {
      "direction": "syn"
    },
    "useIsNanViolation": {
      "direction": "syn"
    },
    "noSparseArraysViolation": {
      "direction": "syn"
    },
    "noEmptyPatternViolation": {
      "direction": "syn"
    },
    "noNonNullAssertionViolation": {
      "direction": "syn"
    },
    "noNamespaceViolation": {
      "direction": "syn"
    },
    "noRequireImportsViolation": {
      "direction": "syn"
    },
    "noEmptyObjectTypeViolation": {
      "direction": "syn"
    },
    "typeAssertionStyleViolation": {
      "direction": "syn"
    },
    "noDuplicateEnumValuesViolation": {
      "direction": "syn"
    },
    "preferAsConstViolation": {
      "direction": "syn"
    },
    "noDupeClassMembersViolation": {
      "direction": "syn"
    },
    "noUselessConstructorViolation": {
      "direction": "syn"
    },
    "noEmptyStaticBlockViolation": {
      "direction": "syn"
    },
    "shadowDepth": {
      "direction": "inh"
    },
    "shadowEnv": {
      "direction": "inh"
    },
    "noShadowViolation": {
      "direction": "syn"
    },
    "alwaysTerminates": {
      "direction": "syn"
    },
    "noUnreachableViolation": {
      "direction": "syn"
    },
    "noFallthroughViolation": {
      "direction": "syn"
    },
    "complexityThreshold": {
      "direction": "inh"
    },
    "complexityViolation": {
      "direction": "syn"
    },
    "allEslintViolations": {
      "direction": "syn"
    }
  }
};