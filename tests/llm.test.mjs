import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDateContext,
  buildMessages,
  extractEventJson,
  normalizeEvent,
  parseRequest
} from '../extension/lib/llm.js';

test('buildDateContext produces both calendars in the target zone', () => {
  // 2026-07-14 20:30 UTC is already 2026-07-15 00:00 in Tehran (UTC+3:30).
  const now = new Date('2026-07-14T20:30:00Z');
  const ctx = buildDateContext('Asia/Tehran', now);
  assert.equal(ctx.gregorianDate, '2026-07-15');
  assert.match(ctx.jalaliDate, /^1405-04-24/);
  assert.equal(ctx.timeZone, 'Asia/Tehran');
  assert.equal(ctx.time, '00:00');
});

test('buildMessages embeds dates and duration', () => {
  const ctx = buildDateContext('Asia/Tehran', new Date('2026-07-14T12:00:00Z'));
  const msgs = buildMessages('lunch tomorrow', ctx, 45);
  assert.equal(msgs.length, 2);
  assert.equal(msgs[1].content, 'lunch tomorrow');
  assert.ok(msgs[0].content.includes(ctx.gregorianDate));
  assert.ok(msgs[0].content.includes(ctx.jalaliDate));
  assert.ok(msgs[0].content.includes('45-minute'));
});

test('extractEventJson handles clean JSON, fences, and prose', () => {
  const obj = { summary: 'Lunch', start: '2026-07-15T13:00:00' };
  const json = JSON.stringify(obj);
  assert.deepEqual(extractEventJson(json), obj);
  assert.deepEqual(extractEventJson('```json\n' + json + '\n```'), obj);
  assert.deepEqual(extractEventJson('Here is the event:\n' + json + '\nDone.'), obj);
  assert.deepEqual(
    extractEventJson('{"summary": "brace } in string", "start": "x"}'),
    { summary: 'brace } in string', start: 'x' }
  );
});

test('extractEventJson rejects garbage', () => {
  assert.throws(() => extractEventJson('no json here'), /No JSON object/);
  assert.throws(() => extractEventJson('{"unterminated": '), /unterminated/i);
  assert.throws(() => extractEventJson(''), /empty/);
});

test('normalizeEvent fills defaults and validates', () => {
  const event = normalizeEvent(
    {
      summary: '  Lunch with Sara ',
      location: 'not provided',
      description: null,
      start: '2026-07-15T13:00:00',
      end: null,
      attendees: ['sara@example.com', 'not-an-email', 42]
    },
    { defaultDurationMinutes: 90 }
  );
  assert.equal(event.summary, 'Lunch with Sara');
  assert.equal(event.location, null);
  assert.equal(event.start, '2026-07-15T13:00:00');
  assert.equal(event.end, '2026-07-15T14:30:00');
  assert.deepEqual(event.attendees, ['sara@example.com']);
});

test('normalizeEvent repairs end <= start', () => {
  const event = normalizeEvent(
    { summary: 'X', start: '2026-07-15T13:00:00', end: '2026-07-15T12:00:00' },
    { defaultDurationMinutes: 60 }
  );
  assert.equal(event.end, '2026-07-15T14:00:00');
});

test('normalizeEvent strips a stray offset by taking wall-clock fields', () => {
  const event = normalizeEvent({ summary: 'X', start: '2026-07-15T13:00:00+03:30' });
  assert.equal(event.start, '2026-07-15T13:00:00');
});

test('normalizeEvent rejects missing essentials', () => {
  assert.throws(() => normalizeEvent({ start: '2026-07-15T13:00:00' }), /title/);
  assert.throws(() => normalizeEvent({ summary: 'X' }), /date and time/);
  assert.throws(() => normalizeEvent({ summary: 'X', start: '2026-13-40T99:00' }), /date and time/);
  assert.throws(() => normalizeEvent(null), /event object/);
});

test('parseRequest end-to-end against a stubbed DeepInfra API', async () => {
  const cfg = {
    deepinfraApiKey: 'test-key',
    model: 'test-model',
    defaultDurationMinutes: 60
  };
  let captured;
  const fetchStub = async (url, init) => {
    captured = { url, init };
    return {
      ok: true,
      status: 200,
      json: async () => ({
        choices: [
          {
            message: {
              content:
                '{"summary":"جلسه با علی","location":null,"description":null,' +
                '"start":"2026-07-16T10:00:00","end":null,"attendees":[]}'
            }
          }
        ]
      })
    };
  };
  const event = await parseRequest('جلسه با علی فردا ساعت ده صبح', cfg, 'Asia/Tehran', fetchStub);
  assert.equal(event.summary, 'جلسه با علی');
  assert.equal(event.start, '2026-07-16T10:00:00');
  assert.equal(event.end, '2026-07-16T11:00:00');

  assert.equal(captured.url, 'https://api.deepinfra.com/v1/openai/chat/completions');
  assert.equal(captured.init.headers.Authorization, 'Bearer test-key');
  const body = JSON.parse(captured.init.body);
  assert.equal(body.model, 'test-model');
  assert.equal(body.temperature, 0);
});

test('parseRequest maps HTTP errors to actionable codes', async () => {
  const cfg = { deepinfraApiKey: 'k', model: 'm', defaultDurationMinutes: 60 };
  const respond = (status) => async () => ({
    ok: false,
    status,
    text: async () => 'err'
  });
  await assert.rejects(parseRequest('x', cfg, 'UTC', respond(401)), (e) => e.code === 'INVALID_API_KEY');
  await assert.rejects(parseRequest('x', cfg, 'UTC', respond(429)), (e) => e.code === 'RATE_LIMITED');
  await assert.rejects(parseRequest('x', cfg, 'UTC', respond(500)), (e) => e.code === 'LLM_UNAVAILABLE');
  await assert.rejects(
    parseRequest('x', { ...cfg, deepinfraApiKey: '' }, 'UTC', respond(200)),
    (e) => e.code === 'NO_API_KEY'
  );
});
