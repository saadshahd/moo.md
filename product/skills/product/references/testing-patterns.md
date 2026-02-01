# Testing Patterns

Machine-verifiable acceptance criteria for PRD tasks.

## The Rule

Every acceptance criterion must be **boolean** — either true or false, with no judgment required.

| Vague (Bad) | Verifiable (Good) |
|-------------|-------------------|
| "Works correctly" | "Returns 200 with `success: true`" |
| "Looks good" | "Button has `bg-blue-500` class" |
| "Is fast enough" | "Response < 200ms at p95" |
| "Handles errors well" | "Shows error toast on 4xx/5xx" |
| "User-friendly" | "Form validates before submit" |

---

## Pattern Categories

### Command Verification

Run a command, check exit code or output.

```markdown
- [ ] Run `npm test` → exits with code 0
- [ ] Run `npm run lint` → no errors
- [ ] Run `npm run typecheck` → no type errors
- [ ] Run `curl /health` → returns "ok"
```

**Verification type:** `execution output`

---

### File Verification

Check file exists or contains expected content.

```markdown
- [ ] File `src/config.ts` contains `apiUrl`
- [ ] File `.env.example` exists with `DATABASE_URL`
- [ ] Directory `src/components/Button` exists
- [ ] `package.json` has `"react": "^18"`
```

**Verification type:** `execution output` (via grep/cat)

---

### API Verification

Test HTTP endpoints with expected responses.

```markdown
- [ ] POST `/api/users` → returns 201 with `{id, email}`
- [ ] GET `/api/users/123` → returns 200 with user object
- [ ] DELETE `/api/users/999` → returns 404
- [ ] POST `/api/login` with wrong password → returns 401
```

**Verification type:** `execution output` (via curl)

---

### UI Navigation Verification

Navigate to URL, check visible content.

```markdown
- [ ] Navigate to `/dashboard` → user name visible
- [ ] Navigate to `/settings` → "Profile" tab active
- [ ] Navigate to `/404-test` → "Page not found" displayed
- [ ] Navigate to `/login` while authed → redirects to `/dashboard`
```

**Verification type:** `observation` (manual) or `execution output` (e2e test)

---

### UI Action Verification

Perform action, check result.

```markdown
- [ ] Click "Submit" → redirects to `/success`
- [ ] Click "Delete" → confirmation modal appears
- [ ] Type invalid email → error message "Invalid email format"
- [ ] Submit empty form → "Required" shown on name field
```

**Verification type:** `observation` (manual) or `execution output` (e2e test)

---

### State Verification

Check application or database state.

```markdown
- [ ] After signup, `users` table has new row
- [ ] After delete, item removed from list state
- [ ] `user.role` equals "admin" after promotion
- [ ] Session cookie set after login
```

**Verification type:** `execution output` (query) or `observation` (devtools)

---

### Performance Verification

Measure timing or resource usage.

```markdown
- [ ] `/api/search` responds in < 200ms at p95
- [ ] Page load < 3s on 3G throttled
- [ ] Bundle size < 500KB gzipped
- [ ] Memory usage < 100MB after 1000 requests
```

**Verification type:** `measurement`

---

### Integration Verification

Test external service interactions.

```markdown
- [ ] Stripe webhook creates payment record
- [ ] Email sent via SendGrid on signup
- [ ] S3 upload returns accessible URL
- [ ] OAuth flow completes with token stored
```

**Verification type:** `execution output` (logs) or `observation` (service dashboard)

---

## Forbidden Patterns

These are NOT acceptance criteria:

| Pattern | Problem | Fix |
|---------|---------|-----|
| "Works as expected" | What's expected? | Specify exact behavior |
| "No bugs" | Unmeasurable | Specific test cases |
| "Good UX" | Subjective | Measurable action outcomes |
| "Fast" | How fast? | Specific latency target |
| "Secure" | How verified? | Specific security test |
| "Clean code" | Opinion | Lint rules pass |
| "Well tested" | What coverage? | ≥80% coverage, specific tests |

---

## Verification Type Mapping

| Pattern Type | Default Verification | Notes |
|--------------|---------------------|-------|
| Command | execution output | Preferred — deterministic |
| File | execution output | grep/cat/test commands |
| API | execution output | curl with assertions |
| UI Navigation | observation | Or e2e test output |
| UI Action | observation | Or e2e test output |
| State | execution output | DB query or API call |
| Performance | measurement | Benchmark tools |
| Integration | execution output | Log assertions |

---

## Example: Full Task with Criteria

```markdown
### T-005: Add email validation to signup form

**Acceptance Criteria:**
- [ ] Invalid email format shows "Please enter a valid email" error
- [ ] Valid email format clears error state
- [ ] Form submit blocked when email invalid
- [ ] Run `npm test -- email-validation` → exits code 0

**Verification Plan:**
| Criterion | Type | Method |
|-----------|------|--------|
| Invalid shows error | observation | Manual test in browser |
| Valid clears error | observation | Manual test in browser |
| Submit blocked | execution output | e2e test |
| Unit tests pass | execution output | npm test |
```

---

## Automating Verification

When possible, encode criteria as automated tests:

```typescript
// T-005 acceptance criteria encoded
describe('email validation', () => {
  it('shows error for invalid email', async () => {
    await page.fill('[name=email]', 'invalid');
    await expect(page.locator('.error')).toHaveText('Please enter a valid email');
  });

  it('clears error for valid email', async () => {
    await page.fill('[name=email]', 'valid@example.com');
    await expect(page.locator('.error')).not.toBeVisible();
  });

  it('blocks submit when invalid', async () => {
    await page.fill('[name=email]', 'invalid');
    await page.click('button[type=submit]');
    await expect(page).toHaveURL('/signup'); // didn't navigate
  });
});
```

**Goal:** Convert `observation` to `execution output` where practical.
