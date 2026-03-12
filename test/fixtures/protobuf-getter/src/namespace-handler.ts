import * as proto from './person_pb';

// --- Namespace import: violations should still be detected ---

function namespaceViolation() {
  const p = new proto.Person();
  const name = p.name;     // VIOLATION: .name on Person (via namespace import)
}

function namespaceOk() {
  const p = new proto.Person();
  const name = p.getName(); // OK: method call
  p.setName('Bob');          // OK: setter method call
}
