// Namespace import pattern — some teams import protobuf modules this way.
// Violations should still be detected through namespace-qualified access.

import * as userProto from './user_pb';
import * as eventProto from './event_pb';

// ── VIOLATIONS via namespace imports ───────────────────────────────

export function createUserSummary(): string {
  const user = new userProto.User();
  user.setName('Bob');
  user.setAge(25);

  // VIOLATION: direct .name access on User (via namespace import)
  const summary = `${user.name} (age ${user.age})`;
  return summary;
}

export function getEventAction(): string {
  const event = new eventProto.AuditEvent();
  event.setAction('login');

  // VIOLATION: direct .action access on AuditEvent (via namespace import)
  return event.action;
}

// ── Correct namespace usage ─────────────────────────────────────────

export function createUserCorrect(): string {
  const user = new userProto.User();
  user.setName('Bob');
  user.setAge(25);

  return `${user.getName()} (age ${user.getAge()})`;
}
