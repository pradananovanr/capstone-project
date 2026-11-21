/**
 * QA-Gen: Interactive Test Case Generator
 * =========================================
 * Modular Vanilla JavaScript — no external frameworks.
 *
 * Module overview:
 *  1. CONFIG       – constants, sample data
 *  2. SANITIZER    – XSS-safe text escaping
 *  3. RULE ENGINE  – generates test cases from user input
 *  4. STORAGE      – localStorage persistence helpers
 *  5. RENDER       – builds DOM cards from test-case objects
 *  6. STATS        – summary counter updates
 *  7. FILTER       – scenario-type filtering
 *  8. EXPORT       – Markdown copy + CSV download
 *  9. UI HELPERS   – toast notifications, loading state
 * 10. INIT         – event binding + startup
 */

'use strict';

/* ============================================================
   1. CONFIG
   ============================================================ */

/** @type {string} localStorage key for persisted test cases */
const STORAGE_KEY = 'qa_gen_test_cases';

/** Sample input pre-fills */
const SAMPLE_INPUT = {
  featureName: 'POST /api/v1/login',
  moduleCategory: 'Authentication',
  priority: 'High',
  acceptanceCriteria:
    'Valid credentials (email + password) must return HTTP 200 with a JWT token. ' +
    'Invalid credentials must return HTTP 401. ' +
    'Account locked after 5 failed attempts.',
};

/* ============================================================
   2. SANITIZER
   XSS prevention: escape HTML entities before inserting any
   user-supplied text into innerHTML.
   ============================================================ */

/**
 * Escapes a string so it is safe for insertion into innerHTML.
 * @param {string} str
 * @returns {string}
 */
function sanitize(str) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return String(str).replace(/[&<>"']/g, (ch) => map[ch]);
}

/* ============================================================
   3. RULE-BASED TEST CASE GENERATION ENGINE
   ============================================================ */

/**
 * Base test-case templates shared across all module categories.
 * Each template function receives the user's input object and
 * returns a partial test-case descriptor.
 *
 * @typedef {Object} TCInput
 * @property {string} featureName
 * @property {string} moduleCategory
 * @property {string} priority
 * @property {string} acceptanceCriteria
 *
 * @typedef {Object} TCDescriptor
 * @property {string} category   – 'Positive' | 'Negative' | 'Edge Case'
 * @property {string} title
 * @property {string} preconditions
 * @property {string[]} steps
 * @property {string} expected
 */

/** Authentication-specific rule set */
const RULES_AUTHENTICATION = [
  ({ featureName }) => ({
    category: 'Positive',
    title: `Valid credentials return successful response`,
    preconditions: `Registered user account exists with active status. ${featureName} endpoint is reachable.`,
    steps: [
      `Navigate to / call ${featureName}.`,
      `Supply a valid registered email address.`,
      `Supply the correct password for that account.`,
      `Submit the request.`,
    ],
    expected: `HTTP 200. Response body contains a valid JWT access token and user profile metadata.`,
  }),
  ({ featureName }) => ({
    category: 'Positive',
    title: `Remember-me / persistent session is honoured`,
    preconditions: `User account is active. API supports a "rememberMe" flag.`,
    steps: [
      `Call ${featureName} with valid credentials and rememberMe: true.`,
      `Inspect the returned token expiry.`,
    ],
    expected: `Token TTL is extended (e.g. 30 days) compared to default session.`,
  }),
  ({ featureName }) => ({
    category: 'Negative',
    title: `Invalid password returns 401 Unauthorized`,
    preconditions: `Registered user account exists.`,
    steps: [
      `Call ${featureName} with a valid email but an incorrect password.`,
      `Observe the HTTP status code and response body.`,
    ],
    expected: `HTTP 401. Error message: "Invalid credentials." No token is returned.`,
  }),
  ({ featureName }) => ({
    category: 'Negative',
    title: `Non-existent email returns 401 (no account enumeration)`,
    preconditions: `The email address does not exist in the system.`,
    steps: [
      `Call ${featureName} with an unregistered email and any password.`,
      `Observe the response.`,
    ],
    expected: `HTTP 401 with a generic error message. The system must NOT disclose whether the email is registered.`,
  }),
  ({ featureName }) => ({
    category: 'Negative',
    title: `Missing required field returns 400 Bad Request`,
    preconditions: `${featureName} endpoint is running.`,
    steps: [
      `Call ${featureName} with the password field omitted.`,
      `Then repeat the test omitting the email field.`,
    ],
    expected: `HTTP 400. Response lists the missing field names in a validation errors array.`,
  }),
  ({ featureName }) => ({
    category: 'Edge Case',
    title: `Account lockout after 5 consecutive failed attempts`,
    preconditions: `Account has never been locked. Brute-force protection is enabled.`,
    steps: [
      `Call ${featureName} with a valid email but a wrong password five times in rapid succession.`,
      `Attempt a 6th login — this time with the correct password.`,
    ],
    expected: `6th attempt returns HTTP 423 (Locked) or HTTP 403. Lockout duration/policy is communicated to the user.`,
  }),
  ({ featureName }) => ({
    category: 'Edge Case',
    title: `SQL injection payload in email field is rejected`,
    preconditions: `WAF and input validation are active.`,
    steps: [
      `Call ${featureName} with email set to: ' OR '1'='1' --.`,
      `Observe the server response.`,
    ],
    expected: `HTTP 400 or 422. No data is returned. The payload is treated as plain text, not executed.`,
  }),
  ({ featureName }) => ({
    category: 'Edge Case',
    title: `XSS payload in password field is sanitized`,
    preconditions: `${featureName} endpoint is live.`,
    steps: [
      `Call ${featureName} with password set to: <script>alert('xss')</script>.`,
      `Inspect the error response body for reflected script.`,
    ],
    expected: `HTTP 400/422. Response body does not echo the script tag. No script execution occurs.`,
  }),
];

/** Payment-specific rule set */
const RULES_PAYMENT = [
  ({ featureName }) => ({
    category: 'Positive',
    title: `Successful payment with valid card details`,
    preconditions: `Test payment gateway sandbox is configured. Valid test card (e.g. Visa 4111…) is available.`,
    steps: [
      `Call ${featureName} with valid card number, CVV, expiry, and amount.`,
      `Confirm the transaction reference is returned.`,
    ],
    expected: `HTTP 200. Response contains transaction ID, status "APPROVED", and timestamp.`,
  }),
  ({ featureName }) => ({
    category: 'Positive',
    title: `Idempotency key prevents duplicate charges`,
    preconditions: `Payment API supports idempotency keys.`,
    steps: [
      `Submit a payment via ${featureName} with idempotency-key: "test-idem-001".`,
      `Re-submit the identical request with the same idempotency key within the window.`,
    ],
    expected: `HTTP 200 with the same transaction ID on both calls. No second charge is created.`,
  }),
  ({ featureName }) => ({
    category: 'Negative',
    title: `Declined card returns appropriate error`,
    preconditions: `Sandbox is configured with a "declined" test card.`,
    steps: [
      `Call ${featureName} using the decline-trigger test card number.`,
    ],
    expected: `HTTP 402 or 200 with status "DECLINED". Message indicates decline reason (e.g. insufficient funds).`,
  }),
  ({ featureName }) => ({
    category: 'Negative',
    title: `Expired card returns 422 Unprocessable Entity`,
    preconditions: `${featureName} is live.`,
    steps: [
      `Call ${featureName} with a card expiry date in the past (e.g. 01/20).`,
    ],
    expected: `HTTP 422. Error message: "Card has expired." Transaction is not initiated.`,
  }),
  ({ featureName }) => ({
    category: 'Negative',
    title: `Zero or negative amount returns 400 Bad Request`,
    preconditions: `${featureName} is live.`,
    steps: [
      `Call ${featureName} with amount: 0.`,
      `Repeat with amount: -50.`,
    ],
    expected: `HTTP 400. Validation error: "Amount must be a positive number."`,
  }),
  ({ featureName }) => ({
    category: 'Edge Case',
    title: `Boundary value: maximum allowed transaction amount`,
    preconditions: `System has a configured per-transaction limit (e.g. $10,000).`,
    steps: [
      `Call ${featureName} with amount equal to the limit: 10000.`,
      `Call again with amount = 10000.01 (one cent over).`,
    ],
    expected: `Limit value is accepted (200). Over-limit value returns HTTP 422 with an amount-limit error.`,
  }),
  ({ featureName }) => ({
    category: 'Edge Case',
    title: `SQL injection in cardholder name field`,
    preconditions: `${featureName} endpoint is running.`,
    steps: [
      `Call ${featureName} with cardholderName: "Robert'); DROP TABLE payments; --".`,
    ],
    expected: `HTTP 400/422. Payload is rejected as a text validation error. Database tables are not affected.`,
  }),
  ({ featureName }) => ({
    category: 'Edge Case',
    title: `Concurrent duplicate submissions handled gracefully`,
    preconditions: `No idempotency key used.`,
    steps: [
      `Fire two identical payment requests to ${featureName} simultaneously.`,
      `Check the database and response for duplicate transactions.`,
    ],
    expected: `Exactly one transaction record is created. The second request returns a 409 Conflict or is deduplicated.`,
  }),
];

/** CRUD Data-specific rule set */
const RULES_CRUD = [
  ({ featureName }) => ({
    category: 'Positive',
    title: `Create resource with all required fields`,
    preconditions: `Authenticated session with CREATE permission. ${featureName} is reachable.`,
    steps: [
      `Send a POST/PUT to ${featureName} with a fully populated valid payload.`,
      `Check the response body and Location header.`,
    ],
    expected: `HTTP 201. Response contains the created resource with a generated ID and created_at timestamp.`,
  }),
  ({ featureName }) => ({
    category: 'Positive',
    title: `Read resource returns correct data`,
    preconditions: `Resource with ID "test-001" exists.`,
    steps: [
      `Send a GET request to ${featureName}/{id} with id = "test-001".`,
    ],
    expected: `HTTP 200. Response body matches the stored resource fields exactly.`,
  }),
  ({ featureName }) => ({
    category: 'Positive',
    title: `Update resource with valid partial payload (PATCH)`,
    preconditions: `Resource "test-001" exists. User has WRITE permission.`,
    steps: [
      `Send PATCH to ${featureName}/test-001 with only the fields to change.`,
      `Follow up with a GET to verify the changes were applied.`,
    ],
    expected: `HTTP 200. Only the patched fields are updated; all others remain unchanged.`,
  }),
  ({ featureName }) => ({
    category: 'Negative',
    title: `Read non-existent resource returns 404`,
    preconditions: `Resource "id-does-not-exist" has never been created.`,
    steps: [
      `Send GET to ${featureName}/id-does-not-exist.`,
    ],
    expected: `HTTP 404. Error message: "Resource not found."`,
  }),
  ({ featureName }) => ({
    category: 'Negative',
    title: `Create with missing required field returns 400`,
    preconditions: `${featureName} requires a "name" field.`,
    steps: [
      `Send POST to ${featureName} omitting the "name" field entirely.`,
    ],
    expected: `HTTP 400. Validation error array lists "name is required."`,
  }),
  ({ featureName }) => ({
    category: 'Negative',
    title: `Unauthorized user cannot delete resource (403)`,
    preconditions: `Caller has READ-only role; DELETE permission is not granted.`,
    steps: [
      `Attempt DELETE ${featureName}/test-001 with read-only credentials.`,
    ],
    expected: `HTTP 403 Forbidden. Resource is not deleted. Audit log records the attempt.`,
  }),
  ({ featureName }) => ({
    category: 'Edge Case',
    title: `Duplicate create request returns 409 Conflict`,
    preconditions: `Resource "test-001" already exists with a unique constraint.`,
    steps: [
      `Send POST to ${featureName} with the same unique identifier as an existing resource.`,
    ],
    expected: `HTTP 409 Conflict. Response body indicates which field caused the uniqueness violation.`,
  }),
  ({ featureName }) => ({
    category: 'Edge Case',
    title: `Oversized payload is rejected`,
    preconditions: `${featureName} has a payload size limit (e.g. 1 MB).`,
    steps: [
      `Construct a payload exceeding the documented size limit.`,
      `Send POST to ${featureName}.`,
    ],
    expected: `HTTP 413 Payload Too Large. Request is rejected without crashing the service.`,
  }),
];

/** User Profile-specific rule set */
const RULES_USER_PROFILE = [
  ({ featureName }) => ({
    category: 'Positive',
    title: `Retrieve own profile returns full data`,
    preconditions: `User is authenticated and profile exists.`,
    steps: [
      `Call GET ${featureName} with a valid auth token.`,
    ],
    expected: `HTTP 200. Response contains id, email, name, avatar_url, and preferences.`,
  }),
  ({ featureName }) => ({
    category: 'Positive',
    title: `Update display name with valid input`,
    preconditions: `User is authenticated.`,
    steps: [
      `Call PATCH/PUT ${featureName} with { "displayName": "John Doe" }.`,
      `Verify the change with a subsequent GET.`,
    ],
    expected: `HTTP 200. displayName is updated and reflected in the GET response.`,
  }),
  ({ featureName }) => ({
    category: 'Negative',
    title: `Unauthenticated request returns 401`,
    preconditions: `No auth token is supplied.`,
    steps: [
      `Call ${featureName} without an Authorization header.`,
    ],
    expected: `HTTP 401. Response body: "Authentication required."`,
  }),
  ({ featureName }) => ({
    category: 'Negative',
    title: `User cannot access another user's profile (IDOR check)`,
    preconditions: `User A is authenticated. User B's profile ID is known.`,
    steps: [
      `Call ${featureName}/{userB_id} using User A's token.`,
    ],
    expected: `HTTP 403 Forbidden. User A cannot read or modify User B's profile data.`,
  }),
  ({ featureName }) => ({
    category: 'Negative',
    title: `Invalid avatar file type returns 415 Unsupported Media`,
    preconditions: `Profile update supports avatar upload.`,
    steps: [
      `Upload a .exe file as the avatar to ${featureName}.`,
    ],
    expected: `HTTP 415 or 400. Error: "Only image files (PNG, JPG, WEBP) are accepted."`,
  }),
  ({ featureName }) => ({
    category: 'Edge Case',
    title: `Display name at maximum character boundary (50 chars)`,
    preconditions: `System allows display names up to 50 characters.`,
    steps: [
      `PATCH ${featureName} with a display name of exactly 50 characters.`,
      `PATCH again with a 51-character display name.`,
    ],
    expected: `50-char name is saved (200). 51-char name is rejected (400) with a length validation error.`,
  }),
  ({ featureName }) => ({
    category: 'Edge Case',
    title: `XSS payload in bio field is sanitized on output`,
    preconditions: `Profile has a bio field.`,
    steps: [
      `PATCH ${featureName} with bio: "<img src=x onerror=alert(1)>".`,
      `GET the profile and inspect the bio value in the response.`,
    ],
    expected: `Stored value is HTML-entity-encoded or stripped. Script/event handlers do not execute on render.`,
  }),
  ({ featureName }) => ({
    category: 'Edge Case',
    title: `Unicode and emoji characters in name are handled correctly`,
    preconditions: `Internationalization is supported.`,
    steps: [
      `PATCH ${featureName} with displayName: "田中 太郎 🚀".`,
      `GET the profile and verify the value.`,
    ],
    expected: `HTTP 200. Unicode and emoji characters are stored and returned without corruption.`,
  }),
];

/**
 * Map module categories to their rule arrays.
 * @type {Object.<string, Function[]>}
 */
const CATEGORY_RULES = {
  'Authentication': RULES_AUTHENTICATION,
  'Payment':        RULES_PAYMENT,
  'CRUD Data':      RULES_CRUD,
  'User Profile':   RULES_USER_PROFILE,
};

/**
 * Generate structured test case objects from user input.
 * @param {TCInput} input
 * @returns {Object[]}  Array of test-case objects with full metadata
 */
function generateTestCases(input) {
  const rules = CATEGORY_RULES[input.moduleCategory] || RULES_CRUD;

  return rules.map((ruleFn, idx) => {
    const descriptor = ruleFn(input);
    const paddedIdx = String(idx + 1).padStart(3, '0');

    return {
      id:          `TC-${paddedIdx}`,
      category:    descriptor.category,       // Positive | Negative | Edge Case
      title:       descriptor.title,
      preconditions: descriptor.preconditions,
      steps:       descriptor.steps,
      expected:    descriptor.expected,
      priority:    input.priority,
      module:      input.moduleCategory,
      feature:     input.featureName,
      status:      'Pending',                 // Default execution status
      createdAt:   Date.now(),
    };
  });
}

/* ============================================================
   4. STORAGE — localStorage persistence
   ============================================================ */

/**
 * Persist the current test-case array to localStorage.
 * @param {Object[]} testCases
 */
function saveToStorage(testCases) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(testCases));
  } catch (e) {
    // Quota exceeded or private browsing — degrade silently
    console.warn('[QA-Gen] localStorage unavailable:', e.message);
  }
}

/**
 * Load test cases from localStorage.
 * @returns {Object[]}
 */
function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/* ============================================================
   5. RENDER — DOM construction from test-case objects
   ============================================================ */

/**
 * Map category string to CSS badge class.
 * @param {string} category
 * @returns {string}
 */
function badgeClass(category) {
  if (category === 'Positive')  return 'badge-positive';
  if (category === 'Negative')  return 'badge-negative';
  return 'badge-edge';            // Edge Case
}

/**
 * Map priority string to CSS priority-badge class.
 * @param {string} priority
 * @returns {string}
 */
function priorityClass(priority) {
  if (priority === 'High')   return 'priority-high';
  if (priority === 'Medium') return 'priority-medium';
  return 'priority-low';
}

/**
 * Build an HTML string for a single test-case card.
 * All user data passes through sanitize() before innerHTML.
 * @param {Object} tc
 * @returns {string}
 */
function buildCardHTML(tc) {
  // Build the steps list
  const stepsHTML = tc.steps
    .map((s) => `<li>${sanitize(s)}</li>`)
    .join('');

  // Build status <option> elements
  const statuses = ['Pending', 'Passed', 'Failed'];
  const optionsHTML = statuses
    .map((s) => `<option value="${s}"${s === tc.status ? ' selected' : ''}>${s}</option>`)
    .join('');

  return `
    <article class="tc-card" role="listitem"
      data-id="${sanitize(tc.id)}"
      data-category="${sanitize(tc.category)}"
      data-status="${sanitize(tc.status)}">

      <!-- Card Header -->
      <div class="tc-card-header">
        <span class="tc-id">${sanitize(tc.id)}</span>
        <span class="badge ${badgeClass(tc.category)}">${sanitize(tc.category)}</span>
        <span class="priority-badge ${priorityClass(tc.priority)}">${sanitize(tc.priority)}</span>
        <span class="tc-title">${sanitize(tc.title)}</span>
      </div>

      <!-- Feature context pill -->
      <p class="text-xs text-slate-600 mb-3 truncate" title="${sanitize(tc.feature)}">
        <span class="text-slate-500">Feature:</span>
        <span class="text-indigo-400 ml-1">${sanitize(tc.feature)}</span>
        <span class="mx-1 text-slate-700">·</span>
        <span class="text-slate-500">${sanitize(tc.module)}</span>
      </p>

      <!-- Preconditions -->
      <div class="tc-section">
        <p class="tc-section-label">Preconditions</p>
        <p class="tc-section-content">${sanitize(tc.preconditions)}</p>
      </div>

      <!-- Test Steps -->
      <div class="tc-section">
        <p class="tc-section-label">Test Steps</p>
        <ol class="tc-steps">${stepsHTML}</ol>
      </div>

      <!-- Expected Result -->
      <div class="tc-section">
        <p class="tc-section-label">Expected Result</p>
        <p class="tc-expected">${sanitize(tc.expected)}</p>
      </div>

      <!-- Footer: Status Dropdown -->
      <div class="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between gap-3 flex-wrap">
        <label class="text-xs text-slate-500 font-semibold uppercase tracking-wider" for="status-${sanitize(tc.id)}">
          Execution Status
        </label>
        <select
          id="status-${sanitize(tc.id)}"
          class="status-select"
          data-id="${sanitize(tc.id)}"
          data-status="${sanitize(tc.status)}"
          aria-label="Set status for ${sanitize(tc.id)}">
          ${optionsHTML}
        </select>
      </div>
    </article>
  `;
}

/**
 * Render all visible test cases into #tc-container.
 * Applies the current active filter.
 * @param {Object[]} testCases
 * @param {string}   activeFilter  – 'all' | 'Positive' | 'Negative' | 'Edge Case'
 */
function renderTestCases(testCases, activeFilter) {
  const container   = document.getElementById('tc-container');
  const emptyState  = document.getElementById('empty-state');
  const noResults   = document.getElementById('no-filter-results');

  // Filter
  const visible = activeFilter === 'all'
    ? testCases
    : testCases.filter((tc) => tc.category === activeFilter);

  // Build HTML
  const html = visible.map(buildCardHTML).join('');
  container.innerHTML = html;

  // Empty state visibility
  const hasAny = testCases.length > 0;
  emptyState.classList.toggle('hidden', hasAny);
  noResults.classList.toggle('hidden', !hasAny || visible.length > 0);

  // Re-attach status-change listeners after re-render
  attachStatusListeners();
}

/* ============================================================
   6. STATS — summary counter updates
   ============================================================ */

/**
 * Recompute and display the summary stats from the full
 * (unfiltered) test-case array.
 * @param {Object[]} testCases
 */
function updateStats(testCases) {
  const counts = { total: testCases.length, Passed: 0, Failed: 0, Pending: 0 };
  testCases.forEach((tc) => {
    if (tc.status in counts) counts[tc.status]++;
  });

  animateStatValue('stat-total',   counts.total);
  animateStatValue('stat-passed',  counts.Passed);
  animateStatValue('stat-failed',  counts.Failed);
  animateStatValue('stat-pending', counts.Pending);
}

/**
 * Update a single stat counter element with a brief bump animation.
 * @param {string} elementId
 * @param {number} newValue
 */
function animateStatValue(elementId, newValue) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const prev = parseInt(el.textContent, 10);
  if (prev === newValue) return;

  el.textContent = newValue;
  el.classList.remove('bump');
  // Trigger reflow to restart animation
  void el.offsetWidth;
  el.classList.add('bump');
  setTimeout(() => el.classList.remove('bump'), 300);
}

/* ============================================================
   7. FILTER — scenario-type filtering
   ============================================================ */

/** @type {string} Currently active filter */
let activeFilter = 'all';

/**
 * Activate a filter button by its data-filter value and re-render.
 * @param {string} filter
 * @param {Object[]} testCases
 */
function setFilter(filter, testCases) {
  activeFilter = filter;

  // Update button active states
  document.querySelectorAll('.filter-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.filter === filter);
  });

  renderTestCases(testCases, activeFilter);
}

/* ============================================================
   8. EXPORT — Markdown copy & CSV download
   ============================================================ */

/**
 * Serialize test cases to a Markdown string suitable for
 * pasting into Confluence, Notion, or GitHub.
 * @param {Object[]} testCases
 * @returns {string}
 */
function toMarkdown(testCases) {
  if (!testCases.length) return '<!-- No test cases generated yet -->';

  const lines = [`# QA-Gen Test Cases\n`];
  const { featureName, moduleCategory } =
    testCases[0]
      ? { featureName: testCases[0].feature, moduleCategory: testCases[0].module }
      : {};

  if (featureName) lines.push(`**Feature:** ${featureName}  `);
  if (moduleCategory) lines.push(`**Module:** ${moduleCategory}  \n`);

  testCases.forEach((tc) => {
    lines.push(`## ${tc.id} — ${tc.title}`);
    lines.push(`- **Category:** ${tc.category}`);
    lines.push(`- **Priority:** ${tc.priority}`);
    lines.push(`- **Status:** ${tc.status}`);
    lines.push(`\n**Preconditions:** ${tc.preconditions}\n`);
    lines.push(`**Test Steps:**`);
    tc.steps.forEach((s, i) => lines.push(`${i + 1}. ${s}`));
    lines.push(`\n**Expected Result:** ${tc.expected}\n`);
    lines.push('---\n');
  });

  return lines.join('\n');
}

/**
 * Serialize test cases to RFC 4180-compliant CSV.
 * @param {Object[]} testCases
 * @returns {string}
 */
function toCSV(testCases) {
  const headers = ['Test ID', 'Category', 'Title', 'Priority', 'Module', 'Feature', 'Preconditions', 'Steps', 'Expected Result', 'Status'];

  /**
   * Wrap a cell value: escape double-quotes, quote if necessary.
   * @param {string} val
   * @returns {string}
   */
  const cell = (val) => {
    const s = String(val).replace(/"/g, '""');
    return /[,"\n\r]/.test(s) ? `"${s}"` : s;
  };

  const rows = testCases.map((tc) => [
    tc.id,
    tc.category,
    tc.title,
    tc.priority,
    tc.module,
    tc.feature,
    tc.preconditions,
    tc.steps.join(' | '),
    tc.expected,
    tc.status,
  ].map(cell).join(','));

  return [headers.map(cell).join(','), ...rows].join('\r\n');
}

/**
 * Trigger a browser file download.
 * @param {string} content
 * @param {string} filename
 * @param {string} mimeType
 */
function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ============================================================
   9. UI HELPERS
   ============================================================ */

/** Shared in-memory test case store (single source of truth) */
let testCases = [];

/**
 * Show a brief toast notification.
 * @param {string} message  – text to display
 * @param {'success'|'error'|'info'} [type='success']
 */
function showToast(message, type = 'success') {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    document.body.appendChild(toast);
  }

  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  toast.textContent = `${icons[type] ?? '✅'} ${message}`;
  toast.classList.add('show');

  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), 3000);
}

/**
 * Toggle the loading state on the Generate button.
 * @param {boolean} loading
 */
function setLoadingState(loading) {
  const btn     = document.getElementById('btn-generate');
  const icon    = document.getElementById('generate-icon');
  const spinner = document.getElementById('generate-spinner');
  const label   = document.getElementById('generate-label');

  btn.disabled = loading;
  icon.classList.toggle('hidden', loading);
  spinner.classList.toggle('hidden', !loading);
  label.textContent = loading ? 'Generating…' : 'Generate Test Cases';
}

/**
 * Validate the generator form.
 * @returns {boolean}  true if valid
 */
function validateForm() {
  const featureName = document.getElementById('feature-name').value.trim();
  const category    = document.getElementById('module-category').value;

  let valid = true;

  const featureError = document.getElementById('feature-error');
  if (!featureName) {
    featureError.classList.remove('hidden');
    document.getElementById('feature-name').focus();
    valid = false;
  } else {
    featureError.classList.add('hidden');
  }

  const categoryError = document.getElementById('category-error');
  if (!category) {
    categoryError.classList.remove('hidden');
    if (valid) document.getElementById('module-category').focus();
    valid = false;
  } else {
    categoryError.classList.add('hidden');
  }

  return valid;
}

/* ============================================================
   STATUS DROPDOWN — delegated change handler
   ============================================================ */

/**
 * Attach change listeners to all rendered status <select> elements.
 * Called after every render cycle.
 */
function attachStatusListeners() {
  document.querySelectorAll('.status-select').forEach((sel) => {
    // Remove previous listener by cloning and replacing
    const fresh = sel.cloneNode(true);
    sel.replaceWith(fresh);
    fresh.addEventListener('change', onStatusChange);
  });
}

/**
 * Handle a status dropdown change.
 * Updates the in-memory store, persists, re-renders stats,
 * and updates the card's data-status attribute for CSS accent.
 * @param {Event} e
 */
function onStatusChange(e) {
  const selectEl = e.target;
  const id       = selectEl.dataset.id;
  const newStatus = selectEl.value;

  // Update in-memory store
  const tc = testCases.find((t) => t.id === id);
  if (!tc) return;
  tc.status = newStatus;

  // Persist
  saveToStorage(testCases);

  // Update the card's data-status for the CSS left-border accent
  const card = selectEl.closest('.tc-card');
  if (card) {
    card.dataset.status = newStatus;
  }

  // Update the select's own data-status for color styling
  selectEl.dataset.status = newStatus;

  // Refresh stats counters
  updateStats(testCases);
}

/* ============================================================
  10. INIT — event binding + startup
   ============================================================ */

/**
 * Wire up all DOM event listeners.
 * Called once after DOMContentLoaded.
 */
function initEventListeners() {

  // ── Character counter for acceptance criteria ──
  const criteriaEl = document.getElementById('acceptance-criteria');
  const countEl    = document.getElementById('criteria-count');
  criteriaEl.addEventListener('input', () => {
    countEl.textContent = criteriaEl.value.length;
  });

  // ── Priority radio pills: sync checked state to visual ──
  document.querySelectorAll('.priority-pill input[type="radio"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      // Find and default-check Medium on load is handled below
    });
  });

  // ── Load Sample button ──
  document.getElementById('btn-load-sample').addEventListener('click', () => {
    document.getElementById('feature-name').value      = SAMPLE_INPUT.featureName;
    document.getElementById('module-category').value   = SAMPLE_INPUT.moduleCategory;
    document.getElementById('acceptance-criteria').value = SAMPLE_INPUT.acceptanceCriteria;
    countEl.textContent = SAMPLE_INPUT.acceptanceCriteria.length;

    // Set priority radio
    const priorityRadio = document.querySelector(
      `.priority-pill input[value="${SAMPLE_INPUT.priority}"]`
    );
    if (priorityRadio) priorityRadio.checked = true;

    // Clear validation errors
    document.getElementById('feature-error').classList.add('hidden');
    document.getElementById('category-error').classList.add('hidden');

    showToast('Sample input loaded! Click Generate to continue.', 'info');
  });

  // ── Form submission ──
  document.getElementById('generator-form').addEventListener('submit', (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    // Gather form values
    const featureName = document.getElementById('feature-name').value.trim();
    const moduleCategory = document.getElementById('module-category').value;
    const priorityChecked = document.querySelector('.priority-pill input:checked');
    const priority = priorityChecked ? priorityChecked.value : 'Medium';
    const acceptanceCriteria = document.getElementById('acceptance-criteria').value.trim();

    // Brief artificial delay so spinner is visible
    setLoadingState(true);
    setTimeout(() => {
      const input = { featureName, moduleCategory, priority, acceptanceCriteria };
      testCases = generateTestCases(input);

      saveToStorage(testCases);
      setFilter('all', testCases);  // Reset filter and render
      updateStats(testCases);
      setLoadingState(false);
      showToast(`${testCases.length} test cases generated!`);

      // Scroll to dashboard on mobile
      document.getElementById('tc-container').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 400);
  });

  // ── Filter buttons ──
  document.getElementById('filter-bar').addEventListener('click', (e) => {
    const btn = e.target.closest('.filter-btn');
    if (!btn) return;
    setFilter(btn.dataset.filter, testCases);
  });

  // ── Copy Markdown ──
  document.getElementById('btn-copy-md').addEventListener('click', () => {
    if (!testCases.length) {
      showToast('No test cases to copy.', 'error');
      return;
    }
    const md = toMarkdown(testCases);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(md)
        .then(() => showToast('Markdown copied to clipboard!'))
        .catch(() => fallbackCopy(md));
    } else {
      fallbackCopy(md);
    }
  });

  // ── Download CSV ──
  document.getElementById('btn-download-csv').addEventListener('click', () => {
    if (!testCases.length) {
      showToast('No test cases to download.', 'error');
      return;
    }
    const csv      = toCSV(testCases);
    const feature  = testCases[0]?.feature ?? 'export';
    const filename = `qa-gen_${feature.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${Date.now()}.csv`;
    downloadFile(csv, filename, 'text/csv;charset=utf-8;');
    showToast('CSV downloaded!');
  });

  // ── Clear All ──
  document.getElementById('btn-clear').addEventListener('click', () => {
    if (!testCases.length) return;
    if (!confirm('Clear all generated test cases? This cannot be undone.')) return;
    testCases = [];
    saveToStorage(testCases);
    activeFilter = 'all';
    renderTestCases(testCases, activeFilter);
    updateStats(testCases);
    // Reset filter buttons
    document.querySelectorAll('.filter-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.filter === 'all');
    });
    showToast('All test cases cleared.', 'info');
  });
}

/**
 * Fallback clipboard copy using a temporary textarea.
 * @param {string} text
 */
function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px;';
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
  showToast('Markdown copied to clipboard!');
}

/**
 * Application startup.
 * Loads persisted test cases from localStorage and renders them.
 */
function init() {
  // Set Medium priority checked by default
  const mediumRadio = document.querySelector('.priority-pill input[value="Medium"]');
  if (mediumRadio) mediumRadio.checked = true;

  initEventListeners();

  // Restore persisted state
  testCases = loadFromStorage();
  if (testCases.length) {
    renderTestCases(testCases, activeFilter);
    updateStats(testCases);
    showToast(`${testCases.length} test cases restored from last session.`, 'info');
  }
}

// ── Bootstrap ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
