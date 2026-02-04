# API Verification Tools

HTTP endpoint and contract verification.

---

## When API Verification Applies

Only run API verification when:
- Task involves API changes (endpoints, responses, contracts)
- Acceptance criteria include HTTP behavior ("returns 200", "body contains X")
- Integration with external services

**Skip for:** UI-only changes, pure refactors, documentation.

---

## Discovery: What's the API Stack?

### Detect Server

```bash
# Check for common servers in package.json
jq -r '.dependencies | keys[]' package.json 2>/dev/null | grep -E '^(express|fastify|hono|next|koa)$'

# Check for Python frameworks
grep -l 'fastapi\|flask\|django' requirements.txt pyproject.toml 2>/dev/null
```

### Detect API Test Tools

```bash
# Hurl
command -v hurl > /dev/null && echo "hurl"

# Check for API testing in package.json scripts
jq -r '.scripts | keys[]' package.json 2>/dev/null | grep -i api
```

### Find API Base URL

```bash
# Check common env files
grep -h 'API_URL\|BASE_URL\|PORT' .env .env.local 2>/dev/null | head -1

# Default fallback
echo "http://localhost:3000"
```

---

## Universal Checks (Always Available)

These work regardless of project setup:

### Health Check

```bash
curl -sf "${BASE_URL:-http://localhost:3000}/health" && echo "PASS" || echo "FAIL"
```

### Status Code Check

```bash
status=$(curl -s -o /dev/null -w "%{http_code}" "$URL")
[ "$status" = "200" ] && echo "PASS" || echo "FAIL: got $status"
```

### JSON Field Presence

```bash
curl -s "$URL" | jq -e '.data.id' > /dev/null && echo "PASS" || echo "FAIL"
```

---

## Hurl (If Available)

Declarative API tests. Check with `command -v hurl`.

```hurl
# test.hurl
GET http://localhost:3000/api/users
HTTP 200
[Asserts]
jsonpath "$.data" count > 0
```

```bash
hurl test.hurl --test
```

---

## Project Test Scripts

**Prefer project scripts when available:**

```bash
# Check package.json
TEST_API=$(jq -r '.scripts["test:api"] // .scripts["test:integration"] // empty' package.json)
if [ -n "$TEST_API" ]; then
  npm run ${TEST_API#npm run }
fi

# Check Makefile
make -qp 2>/dev/null | grep -q '^test-api:' && make test-api
```

---

## Request Templates

### GET with Headers

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  "$BASE_URL/api/protected"
```

### POST with Body

```bash
curl -s -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"secret"}' \
  "$BASE_URL/api/auth/login"
```

---

## Response Validation

### JSON Path Assertions

```bash
response=$(curl -s "$URL")

# Field exists
echo "$response" | jq -e '.data.id' > /dev/null

# Field value
echo "$response" | jq -e '.data.status == "active"' > /dev/null

# Array not empty
echo "$response" | jq -e '.data.items | length > 0' > /dev/null
```

### Response Time

```bash
time_total=$(curl -s -o /dev/null -w "%{time_total}" "$URL")
# Compare with awk (avoids bc dependency)
awk "BEGIN {exit ($time_total > 0.2)}" && echo "PASS" || echo "FAIL: ${time_total}s > 200ms"
```

---

## Contract Testing (Thorough Tier)

### If OpenAPI Spec Exists

```bash
# Check for spec
SPEC=$(ls openapi.yaml openapi.json api.yaml api.json 2>/dev/null | head -1)

if [ -n "$SPEC" ]; then
  # If specmatic available
  command -v specmatic > /dev/null && specmatic test --spec "$SPEC"
fi
```

### Schema Validation

```bash
# If ajv-cli available and schema exists
if command -v ajv > /dev/null && [ -f "schema.json" ]; then
  curl -s "$URL" | ajv validate -s schema.json -d /dev/stdin
fi
```

---

## Tool Selection by Tier

| Tier | Approach |
|------|----------|
| Quick | Health endpoint only |
| Standard | Key endpoints from criteria |
| Thorough | Full contract + schema validation |

---

## No API Tools Available

If project has no API testing setup:

```
AskUserQuestion:
  question: "How should I verify the API?"
  header: "API"
  options:
    - label: "curl commands"
      description: "Generate curl commands for each criterion"
    - label: "Skip API verification"
      description: "API not changed or tested elsewhere"
    - label: "Show me the endpoints"
      description: "List what to test, I'll verify manually"
```

---

## Generating Verification Commands

For each API criterion, generate the verification command:

| Criterion | Generated Command |
|-----------|-------------------|
| "Returns 200" | `curl -s -o /dev/null -w "%{http_code}" URL` |
| "Body contains user.id" | `curl -s URL \| jq -e '.user.id'` |
| "Response < 200ms" | `curl -s -o /dev/null -w "%{time_total}" URL` |
| "Returns error for invalid input" | `curl -s -X POST -d '{}' URL \| jq -e '.error'` |
