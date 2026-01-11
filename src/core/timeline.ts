import type { TimelineEvent, TextCreateEvent, TextUpdateEvent } from './types';

export interface NormalizedTimeline {
  events: TimelineEvent[];
  duration: number;
  textElements: Map<string, TextElementState>;
}

export interface TextElementState {
  id: string;
  creates: TextCreateEvent[];
  updates: TextUpdateEvent[];
}

/**
 * Normalize and sort timeline events
 */
export function normalizeTimeline(events: TimelineEvent[]): NormalizedTimeline {
  // Sort by timestamp (order of emission)
  const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);
  
  // Track text elements
  const textElements = new Map<string, TextElementState>();
  
  // Calculate duration
  let duration = 0;
  
  for (const event of sorted) {
    if (event.type === 'text.create') {
      const textEvent = event as TextCreateEvent;
      const t1 = textEvent.args.t1;
      if (t1 > duration) {
        duration = t1;
      }
      
      const id = textEvent.args.id;
      if (!textElements.has(id)) {
        textElements.set(id, { id, creates: [], updates: [] });
      }
      textElements.get(id)!.creates.push(textEvent);
    }
    
    if (event.type === 'text.update') {
      const updateEvent = event as TextUpdateEvent;
      const t1 = updateEvent.args.t1;
      if (t1 > duration) {
        duration = t1;
      }
      
      const id = updateEvent.args.id;
      if (!textElements.has(id)) {
        textElements.set(id, { id, creates: [], updates: [] });
      }
      textElements.get(id)!.updates.push(updateEvent);
    }
  }
  
  // Add some buffer time after last event
  duration += 1;
  
  return {
    events: sorted,
    duration,
    textElements,
  };
}

/**
 * Validate timeline for determinism requirements
 */
export function validateTimeline(events: TimelineEvent[]): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const seenIds = new Set<string>();
  
  // Check for unique event IDs
  for (const event of events) {
    if (seenIds.has(event.id)) {
      errors.push(`Duplicate event ID: ${event.id}`);
    }
    seenIds.add(event.id);
  }
  
  // Check text.create events have required fields
  for (const event of events) {
    if (event.type === 'text.create') {
      const args = event.args as Record<string, unknown>;
      if (typeof args.t0 !== 'number') {
        errors.push(`Event ${event.id}: t0 must be a number`);
      }
      if (typeof args.t1 !== 'number') {
        errors.push(`Event ${event.id}: t1 must be a number`);
      }
      if (typeof args.id !== 'string') {
        errors.push(`Event ${event.id}: element id must be a string`);
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Generate deterministic snapshot of timeline for testing
 */
export function snapshotTimeline(events: TimelineEvent[]): string {
  // Create stable representation
  const snapshot = events.map(event => ({
    id: event.id,
    type: event.type,
    args: sortObjectKeys(event.args),
  }));
  
  return JSON.stringify(snapshot, null, 2);
}

function sortObjectKeys(obj: Record<string, unknown>): Record<string, unknown> {
  const sorted: Record<string, unknown> = {};
  const keys = Object.keys(obj).sort();
  
  for (const key of keys) {
    const val = obj[key];
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      sorted[key] = sortObjectKeys(val as Record<string, unknown>);
    } else {
      sorted[key] = val;
    }
  }
  
  return sorted;
}
