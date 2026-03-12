import { Person, Address } from './person_pb';

// --- VIOLATIONS: direct field access on protobuf types ---

function processViolations(p: Person) {
  // Direct property reads (VIOLATION)
  const name = p.name;       // VIOLATION: .name on Person
  const age = p.age;         // VIOLATION: .age on Person

  // Direct property write (VIOLATION)
  p.name = 'test';  // VIOLATION: .name assignment on Person
}

function addressViolation(addr: Address) {
  const street = addr.street; // VIOLATION: .street on Address
}

// --- VIOLATION: element access on protobuf type ---

function elementAccessViolation(p: Person) {
  const name = p['name'];   // VIOLATION: element access on Person
}

// --- VIOLATION: chained access ---

function chainedViolation(p: Person) {
  // getAddress() returns Address (protobuf type)
  // .street on Address is a violation
  const street = p.getAddress().street; // VIOLATION: .street on Address (chained)
}

// --- OK: correct getter usage ---

function processOk(p: Person) {
  const name = p.getName();     // OK: method call
  const age = p.getAge();       // OK: method call
  p.setName('Alice');           // OK: setter method call
  p.setAge(30);                 // OK: setter method call
  const addr = p.getAddress();  // OK: method call
  const obj = p.toObject();     // OK: utility method
  p.serializeBinary();          // OK: method call
}

// --- OK: toObject() escape hatch ---

function toObjectEscapeHatch(p: Person) {
  const obj = p.toObject();
  // obj is { name: string; age: number } — NOT a protobuf type
  const name = obj.name;     // OK: plain object, not protobuf
  const age = obj.age;       // OK: plain object, not protobuf
}

function okMethodRef(p: Person) {
  const getter = p.getName;     // OK: symIsMethod is true (method reference)
}

// --- OK: non-protobuf types ---

interface Config {
  timeout: number;
  name: string;
}

function nonProtobuf(c: Config) {
  c.timeout;  // OK: not a protobuf type
  c.name;     // OK: not a protobuf type
}
