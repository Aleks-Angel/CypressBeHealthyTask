// Posts a one-line Cypress run summary to Slack via an Incoming Webhook.
//
// Opt-in and silent by default: if SLACK_WEBHOOK_URL is unset, notifySlack() is a
// no-op (local runs stay quiet, no errors). Wired into run-random.js AFTER the
// mochawesome report is generated, so the merged JSON exists to summarize.
//
// Phase 1 (this file): text/Block Kit summary only. Incoming webhooks can't upload
// files, so the failure screenshot is NOT inline — the message links to the run's
// artifact/report instead. Phase 2 (bot token + files.upload) is deferred; see the
// slack-notifications memory.
//
// Failures here NEVER affect the test run's exit code — a Slack outage must not red
// a green suite. All network/parse errors are caught and logged, then swallowed.

const fs = require('fs');
const path = require('path');

const REPORT_PATH = path.join(__dirname, '..', 'cypress', 'results', 'merged-report.json');

/** Human-readable duration from milliseconds (e.g. 824385 → "13m 44s"). */
function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms < 0) return 'n/a';
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

/**
 * Plain-language label for what kicked off the run — friendly for non-technical
 * viewers (managers/leads). On CI it keeps the `GitHub Actions · <sha>` detail in
 * parentheses for devs; local runs are just "Local run".
 */
function triggeredBy() {
  if (process.env.GITHUB_ACTIONS !== 'true') return 'Local run';
  const labels = {
    schedule: 'Hourly automated check',
    workflow_dispatch: 'Manual run',
    push: 'Code push',
    pull_request: 'Pull request check',
  };
  const label = labels[process.env.GITHUB_EVENT_NAME] || 'GitHub Actions';
  const sha = (process.env.GITHUB_SHA || '').slice(0, 7);
  const detail = sha ? `GitHub Actions · ${sha}` : 'GitHub Actions';
  return `${label} (${detail})`;
}

/**
 * Link to the GitHub Actions run page (where the cypress-results artifact +
 * final-report.html download). Returns null for local runs — they have no run
 * URL, so the message stays link-free.
 */
function githubRunUrl() {
  if (process.env.GITHUB_ACTIONS !== 'true') return null;
  const server = process.env.GITHUB_SERVER_URL || 'https://github.com';
  const repo = process.env.GITHUB_REPOSITORY;
  const runId = process.env.GITHUB_RUN_ID;
  if (!repo || !runId) return null;
  return `${server}/${repo}/actions/runs/${runId}`;
}

/**
 * Classify WHY a run skipped, so the Slack message can be specific instead of
 * lumping the two unrelated causes together. The reason is already in the skipped
 * test's step trail (the `cy.log` markers differ): out-of-stock vs unreachable
 * (WAF/bot-protection). Walks the merged report for the pending test and inspects
 * its `context` (where the after:spec augmenter injects the trail).
 *
 * @param {object} report - parsed merged mochawesome report
 * @returns {'out-of-stock'|'unreachable'|null} null = couldn't tell (generic msg)
 */
function classifySkipReason(report) {
  const tests = [];
  const walk = (node) => {
    (node.tests || []).forEach(t => tests.push(t));
    (node.suites || []).forEach(walk);
  };
  (report.results || []).forEach(walk);
  const skipped = tests.find(t => t.pending || t.state === 'pending' || t.skipped === true);
  const ctx = skipped && skipped.context ? String(skipped.context) : '';
  if (/out of stock/i.test(ctx)) return 'out-of-stock';
  if (/unreachable|cloudflare|bot-protection/i.test(ctx)) return 'unreachable';
  return null;
}

/**
 * Read the merged mochawesome report and reduce it to the numbers we surface.
 * Returns null if the report is missing/unreadable (e.g. the run crashed before
 * the report was generated) so the caller can post a degraded "no report" message.
 * On a skipped run also resolves `skipReason` (out-of-stock vs unreachable).
 */
function readStats() {
  try {
    const raw = fs.readFileSync(REPORT_PATH, 'utf8');
    const report = JSON.parse(raw);
    const { stats } = report;
    if (!stats) return null;
    const out = {
      passes: stats.passes ?? 0,
      failures: stats.failures ?? 0,
      pending: stats.pending ?? 0,
      duration: formatDuration(stats.duration),
    };
    if (out.pending > 0 && out.passes === 0 && out.failures === 0) {
      out.skipReason = classifySkipReason(report);
    }
    return out;
  } catch {
    return null;
  }
}

/** Perf-score colour, Lighthouse-style: 🟢 ≥90, 🟡 50–89, 🔴 <50. */
const perfEmoji = (s) => (s >= 90 ? '🟢' : s >= 50 ? '🟡' : '🔴');
const fmtMs = (v) => (v == null ? 'n/a' : v >= 1000 ? `${(v / 1000).toFixed(1)}s` : `${Math.round(v)}ms`);

/**
 * Short, readable name for a never-finishing request (so the card says *what*
 * hung, not just a count). Prefers the OpenCart `route` tail (e.g.
 * `klaviyoSyncKlaviyoCookie`), else the last path segment, else the host.
 */
function shortRequest(u) {
  try {
    const parsed = new URL(u);
    const route = parsed.searchParams.get('route');
    if (route) return route.split('/').filter(Boolean).pop();
    return parsed.pathname.split('/').filter(Boolean).pop() || parsed.hostname;
  } catch {
    return String(u).slice(0, 60);
  }
}

/**
 * Build the Slack Block Kit payload for a finished run.
 * @param {object} info
 * @param {object|null} [info.perf] Lighthouse metrics — present only on a GREEN
 *   order run we audited (run-random.js gates the audit on pass + webhook). Adds
 *   a perf line to the header + a Performance field.
 */
function buildPayload({ brand, lang, url, exitCode, stats, perf }) {
  // Three outcomes: failed (real checkout failure), skipped (store unreachable
  // from CI — WAF/bot-protection on the runner IP, so the order flow was skipped
  // and the result is inconclusive), or passed.
  const skipped = stats ? stats.failures === 0 && stats.passes === 0 && stats.pending > 0 : false;
  const failed = stats ? stats.failures > 0 : exitCode !== 0;
  const state = failed ? 'failed' : skipped ? 'skipped' : 'passed';
  const emoji = { failed: '🔴', skipped: '⏭️', passed: '🟢' }[state];
  // Perf only rides along on a green pass; show it in the header too.
  const headline = `BeHealthy random domain order run ${state}`
    + (perf ? `   ·   🔦 Perf ${perf.score} ${perfEmoji(perf.score)}` : '');

  // Two unrelated skip causes get their own wording (never lumped together):
  // out-of-stock (the picked product can't be bought) vs unreachable (WAF/
  // bot-protection blocked the CI IP). skipReason comes from the report's trail.
  const skipReason = stats && stats.skipReason;
  const skipResult = {
    'out-of-stock': '⏭️ Skipped — product out of stock (no order to place; checkout not tested this run)',
    unreachable: '⏭️ Skipped — store unreachable from CI / bot-protection (checkout not tested this run)',
  }[skipReason] || '⏭️ Skipped — checkout not tested this run (inconclusive)';

  const resultLine = !stats
    ? `⚠️ No report found (run exited ${exitCode}) — likely crashed before reporting`
    : skipped
      ? skipResult
      : `✅ ${stats.passes} passed   ❌ ${stats.failures} failed   ⏭ ${stats.pending} pending   ⏱ ${stats.duration}`;

  // One-line, plain-language verdict for non-technical viewers (managers/leads).
  const skipSentence = {
    'out-of-stock': 'The product picked for this run was out of stock, so there was no order to place. Checkout was not tested this run — nothing wrong with the store.',
    unreachable: "The store couldn't be reached from CI (bot-protection on the test server's IP). Checkout was not tested this run — not a known problem.",
  }[skipReason] || 'Checkout was not tested this run (inconclusive) — not a known problem.';

  const summarySentence = {
    failed: 'A test order did not complete — checkout may be broken on this store. Please review.',
    skipped: skipSentence,
    passed: 'A test order completed successfully — checkout is working on this store.',
  }[state];

  const fields = [
    { type: 'mrkdwn', text: `*Store:*\n${brand} × ${lang}` },
    { type: 'mrkdwn', text: `*Website:*\n${url}` },
    { type: 'mrkdwn', text: `*Result:*\n${resultLine}` },
  ];
  if (perf) {
    let perfText = `${perf.score} ${perfEmoji(perf.score)} │ TTFB ${fmtMs(perf.ttfb)} │ LCP ${fmtMs(perf.lcp)} │ SpeedIdx ${fmtMs(perf.si)}`;
    if (perf.unfinished && perf.unfinished.length) {
      const n = perf.unfinished.length;
      const more = n > 1 ? ` (+${n - 1} more)` : '';
      perfText += `\n⚠️ ${n} request${n > 1 ? 's' : ''} never finished: \`${shortRequest(perf.unfinished[0])}\`${more}`;
    }
    fields.push({ type: 'mrkdwn', text: `*Performance:*\n${perfText}` });
  }
  fields.push({ type: 'mrkdwn', text: `*Triggered by:*\n${triggeredBy()}` });

  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: `${emoji} ${headline}`, emoji: true },
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: summarySentence },
    },
    { type: 'section', fields },
  ];

  // On CI, add a clickable link to the run page (artifact + report download).
  // Local runs have no run URL → no link block.
  const runUrl = githubRunUrl();
  if (runUrl) {
    blocks.push({ type: 'context', elements: [{ type: 'mrkdwn', text: `<${runUrl}|View report ↗>` }] });
  }

  return {
    text: `${emoji} ${headline} — ${brand} × ${lang} — ${resultLine}`, // notification/fallback text
    blocks,
  };
}

/**
 * Post a run summary to Slack. No-op when SLACK_WEBHOOK_URL is unset. Never throws.
 * @param {{brand:string, lang:string, url:string, exitCode:number, perf?:object}} info
 *   random-pick metadata from run-random.js (brand = display name via
 *   domains.brandLabel) + the cypress exit code. `perf` is the Lighthouse metrics,
 *   present only on a green order run that was audited.
 */
async function notifySlack({ brand, lang, url, exitCode, perf }) {
  const webhook = process.env.SLACK_WEBHOOK_URL;
  if (!webhook) {
    // Opt-in: skip when not configured, but say so — otherwise a missing env var
    // looks like a silent failure (especially locally, where it's easy to forget
    // to set it in a fresh shell session).
    console.log('ℹ️  SLACK_WEBHOOK_URL not set — skipping Slack notification.');
    return;
  }

  const stats = readStats();
  const payload = buildPayload({ brand, lang, url, exitCode, stats, perf });

  try {
    const res = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    // Drain the body so undici releases (and unrefs) the keep-alive socket.
    // If we leave it unread, the handle stays ref'd and the later exit races
    // with its teardown — the Windows libuv UV_HANDLE_CLOSING assertion.
    await res.text().catch(() => {});
    if (!res.ok) {
      console.error(`⚠️ Slack notify failed: HTTP ${res.status} ${res.statusText}`);
    } else {
      console.log('📣 Slack notification sent.');
    }
  } catch (err) {
    console.error('⚠️ Slack notify error (ignored):', err.message);
  }
}

module.exports = { notifySlack, formatDuration, buildPayload, readStats };
