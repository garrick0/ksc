// Audit logger — records user actions as AuditEvent protobufs.
// This file has a MIX of correct and INCORRECT usage.

import { AuditEvent, BatchEvents } from './event_pb';
import { User } from './user_pb';

// ── Correct usage ──────────────────────────────────────────────────

export function createAuditEvent(action: string, userId: string): AuditEvent {
  const event = new AuditEvent();
  event.setAction(action);
  event.setUserId(userId);
  event.setTimestamp(Date.now());
  return event;
}

export function batchEvents(events: AuditEvent[]): BatchEvents {
  const batch = new BatchEvents();
  for (const ev of events) {
    batch.addEvents(ev);
  }
  return batch;
}

// ── VIOLATIONS: direct property access on protobuf types ───────────

// BUG: direct field access returns undefined at runtime
export function formatAuditLog(event: AuditEvent): string {
  // These silently return undefined — the data lives in array_
  return `[${event.timestamp}] ${event.action} by ${event.userId}`;
}

// BUG: reading fields directly to build a search index
export function buildSearchIndex(events: AuditEvent[]): Map<string, AuditEvent[]> {
  const index = new Map<string, AuditEvent[]>();
  for (const ev of events) {
    const key = ev.action;  // VIOLATION: direct .action access
    if (!index.has(key)) {
      index.set(key, []);
    }
    index.get(key)!.push(ev);
  }
  return index;
}

// BUG: mixed correct/incorrect — some fields via getter, some direct
export function logUserAction(user: User, event: AuditEvent): void {
  const userName = user.getName();  // Correct
  const action = event.action;      // VIOLATION: direct access on AuditEvent
  const ts = event.timestamp;       // VIOLATION: direct access on AuditEvent

  console.log(`${userName} performed ${action} at ${ts}`);
}

// BUG: element access on protobuf type
export function getEventField(event: AuditEvent, field: string): unknown {
  return event[field as keyof AuditEvent];  // VIOLATION: element access
}
