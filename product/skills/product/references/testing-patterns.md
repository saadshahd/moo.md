# Testing Patterns

Patterns for writing machine-verifiable test criteria. Use with PRD acceptance criteria.

---

## Browser Testing

### Navigation Checks

| Pattern | Example |
|---------|---------|
| Page loads | "Navigate to `/signup` - page returns 200" |
| Element visible | "Navigate to `/dashboard` - user name visible" |
| Element absent | "Navigate to `/login` - no error banner" |
| Redirect | "Navigate to `/admin` (unauthenticated) - redirects to `/login`" |

### Interaction Checks

| Pattern | Example |
|---------|---------|
| Click result | "Click Submit button - form submits" |
| Click redirect | "Click 'Sign Up' link - navigates to `/signup`" |
| Input validation | "Enter 'invalid' in email field - error 'Invalid email' appears" |
| Input acceptance | "Enter 'user@example.com' in email - no error shown" |
| Form submit | "Fill form and click Submit - redirects to `/success`" |

### State Checks

| Pattern | Example |
|---------|---------|
| Console errors | "Browser console shows no errors" |
| Network request | "Submit form - POST to `/api/users` observed" |
| Local storage | "After login, `localStorage.token` is set" |
| Cookie | "After login, `session` cookie exists" |

### Viewport Checks

| Pattern | Example |
|---------|---------|
| Mobile render | "At 375x812 viewport - CTA button visible without scrolling" |
| Responsive | "At 768px width - navigation collapses to hamburger menu" |
| Touch target | "At mobile viewport - all buttons ≥44px tap target" |

---

## API Testing

### Request/Response

| Pattern | Example |
|---------|---------|
| Status code | "GET `/api/users` returns 200" |
| Status with auth | "GET `/api/admin` without token returns 401" |
| Response body | "GET `/api/user/1` returns `{ id: 1, name: ... }`" |
| Response field | "POST `/api/login` response contains `token` field" |
| Error response | "POST `/api/users` with invalid data returns 400 with `errors` array" |

### Data Validation

| Pattern | Example |
|---------|---------|
| Required field | "POST `/api/users` without `email` returns 400" |
| Type validation | "POST `/api/users` with `age: 'old'` returns 400" |
| Unique constraint | "POST `/api/users` with existing email returns 409" |

---

## File System Checks

### File Existence

| Pattern | Example |
|---------|---------|
| File exists | "File `src/components/Button.tsx` exists" |
| File absent | "File `src/config.local.ts` does not exist in repo" |
| Directory exists | "Directory `src/features/auth/` exists" |

### File Content

| Pattern | Example |
|---------|---------|
| Contains string | "File `middleware.ts` contains `clerkMiddleware`" |
| Contains pattern | "File `package.json` contains `\"react\": \"^18`" |
| Export exists | "File `src/index.ts` exports `UserService`" |
| Import present | "File `App.tsx` imports from `./components/Header`" |

### Configuration

| Pattern | Example |
|---------|---------|
| Config value | "File `.env.example` contains `DATABASE_URL=`" |
| JSON field | "File `tsconfig.json` has `strict: true`" |
| Package dep | "File `package.json` lists `zod` in dependencies" |

---

## Command Checks

### Build/Test

| Pattern | Example |
|---------|---------|
| Exit code | "Run `npm test` - exits with code 0" |
| Output contains | "Run `npm run lint` - output contains no errors" |
| Build succeeds | "Run `npm run build` - completes without error" |
| Type check | "Run `npm run typecheck` - exits with code 0" |

### Git

| Pattern | Example |
|---------|---------|
| Clean working tree | "Run `git status` - shows 'nothing to commit'" |
| Branch exists | "Branch `feature/auth` exists" |
| Committed | "Changes in `src/auth/` are committed" |

---

## Database Checks

### Schema

| Pattern | Example |
|---------|---------|
| Table exists | "Table `users` exists in database" |
| Column exists | "Table `users` has column `email`" |
| Index exists | "Index on `users.email` exists" |
| Constraint | "Column `users.email` has UNIQUE constraint" |

### Data

| Pattern | Example |
|---------|---------|
| Record exists | "User with email `admin@example.com` exists" |
| Record count | "Table `sessions` has 0 expired records" |
| Field value | "User record has `role = 'admin'`" |

---

## Anti-Patterns

### Vague Criteria (Never Use)

| Bad | Why Bad |
|-----|---------|
| "Works correctly" | No definition of 'correctly' |
| "Looks good" | Subjective |
| "Is fast enough" | No threshold |
| "Handles errors well" | No specific errors named |
| "Is secure" | No specific checks |
| "Review the code" | Not a verification |
| "Document findings" | Not a pass/fail |

### Fix with Specificity

| Bad | Good |
|-----|------|
| "Works correctly" | "Returns 200 and response contains `success: true`" |
| "Looks good" | "Button has `bg-blue-500` class and text 'Submit'" |
| "Is fast enough" | "Response time < 200ms at p95" |
| "Handles errors" | "Returns 400 with `{ error: 'Invalid email' }` for malformed input" |
| "Is secure" | "Endpoint returns 401 without valid JWT" |

---

## Combining Patterns

### Full Task Example

```markdown
### T-003: Implement user registration API

**Description:** Create POST endpoint for user registration with validation.

**Acceptance Criteria:**
- [ ] File `src/api/users.ts` exports `registerUser` function
- [ ] POST `/api/register` with valid data returns 201
- [ ] POST `/api/register` without email returns 400 with `errors.email`
- [ ] POST `/api/register` with existing email returns 409
- [ ] POST `/api/register` stores hashed password (not plaintext)
- [ ] Run `npm run typecheck` - exits with code 0
- [ ] Run `npm test -- users.test` - exits with code 0
```

### Investigation Task Example

```markdown
### T-001: Investigate signup redirect failure

**Description:** Determine why signup redirects to 404 instead of dashboard.

**Acceptance Criteria:**
- [ ] Read `src/auth/config.ts` - log `redirectUrl` value to notes
- [ ] Read `middleware.ts` - log public routes to notes
- [ ] Navigate to `/signup` - log actual redirect destination to notes
- [ ] Notes contain root cause hypothesis with file:line reference
```

---

## Rules

- Every criterion must be boolean (pass/fail)
- Specify exact values, not ranges (unless measuring performance)
- Include quality checks (`npm test`, `npm run typecheck`) on implementation tasks
- Separate investigation from implementation
- Log findings to notes field for investigation tasks
