import assert from 'node:assert/strict';
import { api, makeT } from './load.mjs';

const t = makeT();

// --- Tool formatting -------------------------------------------------------
assert.equal(api.formatToolStart(t, 'bash'), 'Tool bash started');
assert.equal(api.formatToolStart(t, ''), 'A tool started');
assert.equal(api.formatToolStart(t, undefined), 'A tool started');

assert.equal(
  api.formatToolEnd(t, { name: 'bash', isError: false, detailed: false }),
  'Tool bash finished',
);
assert.equal(
  api.formatToolEnd(t, { name: 'bash', isError: false, detailed: true, seconds: '1.2' }),
  'Tool bash finished in 1.2 seconds',
);
assert.equal(
  api.formatToolEnd(t, {
    name: 'read',
    isError: false,
    detailed: true,
    seconds: '0.4',
    summary: 'package.json',
  }),
  'Tool read finished in 0.4 seconds. package.json',
);
assert.equal(
  api.formatToolEnd(t, {
    name: 'read',
    isError: false,
    detailed: true,
    summary: 'package.json',
  }),
  'Tool read finished. package.json',
);
assert.equal(
  api.formatToolEnd(t, { name: 'bash', isError: true, detailed: false }),
  'Tool bash failed',
);
assert.equal(
  api.formatToolEnd(t, {
    name: 'bash',
    isError: true,
    detailed: true,
    summary: 'command exited with code 1',
  }),
  'Tool bash failed. command exited with code 1',
);
assert.equal(
  api.formatToolEnd(t, { name: '', isError: true, detailed: true, summary: 'denied' }),
  'A tool failed. denied',
);
assert.equal(
  api.formatToolEnd(t, { name: '', isError: false, detailed: true, summary: 'ok' }),
  'A tool finished. ok',
);

// --- Pending interactions --------------------------------------------------
assert.equal(
  api.formatPending(t, { kind: 'approval', toolName: 'bash', reason: '' }),
  'Approval requested for bash',
);
assert.equal(
  api.formatPending(t, {
    kind: 'approval',
    toolName: 'bash',
    reason: 'Run the focused test suite',
  }),
  'Approval requested for bash. Run the focused test suite',
);
assert.equal(
  api.formatPending(t, {
    kind: 'question',
    questions: [{ id: 'q1', question: 'Which browser should I test?' }],
  }),
  'Question: Which browser should I test?',
);
assert.equal(
  api.formatPending(t, {
    kind: 'question',
    questions: [{ question: 'First?' }, { question: 'Second?' }],
  }),
  '2 questions. First: First?',
);
assert.equal(
  api.formatPending(t, {
    kind: 'plan-review',
    questions: [{ question: 'Approve this plan?' }],
  }),
  'Plan review requested: Approve this plan?',
);
assert.equal(
  api.formatPending(t, { kind: 'question', questions: [] }),
  'A question needs an answer',
);

// --- Queue merging ---------------------------------------------------------
let queue = [];
queue = api.mergeAnnouncementQueue(queue, {
  text: 'Tool bash started',
  kind: 'tool',
  mergeKey: 'tool:call-1',
});
assert.equal(queue.length, 1);
queue = api.mergeAnnouncementQueue(queue, {
  text: 'Tool bash finished',
  kind: 'tool',
  mergeKey: 'tool:call-1',
});
assert.equal(queue.length, 1, 'a finish replaces its still-queued start');
assert.equal(queue[0].text, 'Tool bash finished');

queue = api.mergeAnnouncementQueue(queue, {
  text: 'Tool read started',
  kind: 'tool',
  mergeKey: 'tool:call-2',
});
assert.equal(queue.length, 2, 'different call ids do not merge');

queue = api.mergeAnnouncementQueue(queue, {
  text: 'Approval requested',
  kind: 'pending',
});
assert.equal(queue.length, 3, 'items without a merge key append');

// --- Result summaries ------------------------------------------------------
assert.equal(
  api.toolResultSummary({
    isError: false,
    content: [{ type: 'text', text: '  hello\n  world  ' }],
  }),
  'hello world',
);
assert.equal(
  api.toolResultSummary({
    isError: true,
    error: { code: 'ENOENT', reason: 'file not found' },
    content: [],
  }),
  'file not found',
);
assert.equal(api.toolDurationSeconds({ time: 1250, callTime: 250 }), '1.0');
assert.equal(api.toolDurationSeconds({ time: 10 }), null);
assert.equal(api.toolDurationSeconds({ time: 10, callTime: 20 }), null);

// --- Settings normalization ------------------------------------------------
const normalized = api.normalizeSettings({
  verbosity: 'detailed',
  speed: 'slow',
  focusRing: 'strong',
  motion: 'reduce',
  unexpected: 'value',
});
assert.equal(normalized.verbosity, 'detailed');
assert.equal(normalized.speed, 'slow');
assert.equal(normalized.focusRing, 'strong');
assert.equal(normalized.motion, 'reduce');
assert.equal('unexpected' in normalized, false);

const fallback = api.normalizeSettings({
  verbosity: 'loud',
  speed: 'instant',
  focusRing: 'glow',
  motion: 'warp',
});
assert.deepEqual({ ...fallback }, { ...api.DEFAULTS });

// --- Turn headings ---------------------------------------------------------
assert.equal(
  api.turnStatus(t, { status: 'closed', end: { data: { reason: { kind: 'completed' } } } }),
  'completed',
);
assert.equal(
  api.turnStatus(t, { status: 'closed', end: { data: { reason: { kind: 'aborted' } } } }),
  'stopped',
);
assert.equal(
  api.turnStatus(t, { status: 'closed', end: { data: { reason: { kind: 'error' } } } }),
  'failed',
);
assert.equal(
  api.turnStatus(t, { status: 'closed', end: { data: { reason: { kind: 'max-tokens' } } } }),
  'ended at the output-token limit',
);
assert.equal(api.turnStatus(t, { status: 'open' }), 'ended');

// --- Truncation ------------------------------------------------------------
assert.equal(api.truncate('  a\n b  '), 'a b');
assert.equal(api.truncate('x'.repeat(200), 20).length, 20);
assert.equal(api.truncate('x'.repeat(200), 20).endsWith('…'), true);

console.log('announce.test.mjs ok');
