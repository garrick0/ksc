// API handler — HTTP layer that transforms between JSON and protobuf.
// This file demonstrates several violation patterns developers commonly make.

import { User, UpdateUserRequest } from './user_pb';
import { AuditEvent } from './event_pb';

// ── Non-protobuf types: these should NOT be flagged ────────────────

interface HttpRequest {
  body: unknown;
  headers: Record<string, string>;
  method: string;
  path: string;
}

interface HttpResponse {
  status: number;
  body: unknown;
}

interface AppConfig {
  maxRetries: number;
  timeout: number;
  debug: boolean;
}

// Correct: accessing plain object fields is fine
function getConfig(): AppConfig {
  return { maxRetries: 3, timeout: 5000, debug: false };
}

export function readConfig(): void {
  const config = getConfig();
  console.log(`Retries: ${config.maxRetries}, timeout: ${config.timeout}`);
}

// ── VIOLATIONS: direct protobuf field access in request handling ────

// BUG: reads protobuf fields directly when converting to HTTP response
export function userToHttpResponse(user: User): HttpResponse {
  return {
    status: 200,
    body: {
      name: user.name,       // VIOLATION: .name on User
      email: user.email,     // VIOLATION: .email on User
      age: user.age,         // VIOLATION: .age on User
    },
  };
}

// BUG: direct property write on protobuf
export function populateUserFromBody(user: User, body: Record<string, unknown>): void {
  user.name = body.name as string;    // VIOLATION: direct write .name on User
  user.email = body.email as string;  // VIOLATION: direct write .email on User
  user.age = body.age as number;      // VIOLATION: direct write .age on User
}

// BUG: chained access — getUser() returns a protobuf, then direct field access
export function getRequestUserName(req: UpdateUserRequest): string {
  const user = req.getUser();  // Correct: method call
  if (!user) return 'unknown';
  return user.name;            // VIOLATION: .name on User
}

// BUG: bracket notation on protobuf
export function getUserField(user: User, key: string): unknown {
  return user[key as keyof User];  // VIOLATION: element access on User
}

// ── Correct usage patterns ──────────────────────────────────────────

// Correct: using getters to build the response
export function userToHttpResponseCorrect(user: User): HttpResponse {
  return {
    status: 200,
    body: {
      name: user.getName(),
      email: user.getEmail(),
      age: user.getAge(),
    },
  };
}

// Correct: using setters
export function populateUserFromBodyCorrect(user: User, body: Record<string, unknown>): void {
  user.setName(body.name as string);
  user.setEmail(body.email as string);
  user.setAge(body.age as number);
}

// Correct: toObject() escape hatch
export function userToPlainObject(user: User): Record<string, unknown> {
  const obj = user.toObject();
  return {
    displayName: obj.name,   // Fine: obj is a plain object
    contact: obj.email,      // Fine: obj is a plain object
  };
}

// Correct: method call chain
export function auditEventSummary(event: AuditEvent): string {
  return `${event.getAction()} by ${event.getUserId()} at ${event.getTimestamp()}`;
}
