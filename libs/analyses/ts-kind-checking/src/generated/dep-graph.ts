/** AUTO-GENERATED — do not edit. */
import type { AttributeDepGraph } from '@ksc/grammar';

export const depGraph: AttributeDepGraph = {
  "attributes": [
    "definitions",
    "diagnostics",
    "kindDefs",
    "defEnv",
    "defLookup",
    "kindAnnotations",
    "contextFor",
    "violationFor",
    "allViolations",
    "nodeCount",
    "protobufTypes",
    "protobufTypeEnv",
    "protobufViolation",
    "allProtobufViolations"
  ],
  "edges": [
    [
      "definitions",
      "kindDefs"
    ],
    [
      "diagnostics",
      "allViolations"
    ],
    [
      "diagnostics",
      "allProtobufViolations"
    ],
    [
      "defEnv",
      "kindDefs"
    ],
    [
      "defLookup",
      "defEnv"
    ],
    [
      "kindAnnotations",
      "defLookup"
    ],
    [
      "contextFor",
      "kindAnnotations"
    ],
    [
      "violationFor",
      "contextFor"
    ],
    [
      "allViolations",
      "violationFor"
    ],
    [
      "protobufTypeEnv",
      "protobufTypes"
    ],
    [
      "protobufViolation",
      "protobufTypeEnv"
    ],
    [
      "allProtobufViolations",
      "protobufViolation"
    ]
  ],
  "order": [
    "kindDefs",
    "definitions",
    "defEnv",
    "defLookup",
    "kindAnnotations",
    "contextFor",
    "violationFor",
    "allViolations",
    "protobufTypes",
    "protobufTypeEnv",
    "protobufViolation",
    "allProtobufViolations",
    "diagnostics",
    "nodeCount"
  ],
  "declarations": {
    "definitions": {
      "direction": "syn"
    },
    "diagnostics": {
      "direction": "syn"
    },
    "kindDefs": {
      "direction": "syn"
    },
    "defEnv": {
      "direction": "inh"
    },
    "defLookup": {
      "direction": "syn"
    },
    "kindAnnotations": {
      "direction": "syn"
    },
    "contextFor": {
      "direction": "inh"
    },
    "violationFor": {
      "direction": "syn"
    },
    "allViolations": {
      "direction": "syn"
    },
    "nodeCount": {
      "direction": "collection"
    },
    "protobufTypes": {
      "direction": "syn"
    },
    "protobufTypeEnv": {
      "direction": "inh"
    },
    "protobufViolation": {
      "direction": "syn"
    },
    "allProtobufViolations": {
      "direction": "syn"
    }
  }
};