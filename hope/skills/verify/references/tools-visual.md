# Visual Verification Tools

UI/browser verification with optional Gemini enhancement.

---

## When Visual Verification Applies

Only run visual verification when:
- Task involves UI changes (components, pages, styles)
- Acceptance criteria include visual elements ("button visible", "no error banners")
- User explicitly requests visual proof

**Skip for:** API-only changes, backend logic, CLI tools.

---

## Provider Selection

```
IF $GEMINI_API_KEY exists:
  visual_provider = "gemini"  # Better at visuals, 36x cheaper
ELSE:
  visual_provider = "claude"  # Native vision
```

On Gemini failure → automatic Claude fallback.

---

## Discovery: What Visual Tools Are Available?

### Check Project for Testing Framework

```bash
# Playwright
jq -e '.devDependencies["@playwright/test"]' package.json > /dev/null 2>&1 && echo "playwright"

# Cypress
jq -e '.devDependencies.cypress' package.json > /dev/null 2>&1 && echo "cypress"

# Puppeteer
jq -e '.devDependencies.puppeteer' package.json > /dev/null 2>&1 && echo "puppeteer"
```

### If No Framework Detected

1. Ask user if visual verification needed
2. Offer to use Claude/Gemini vision directly on screenshots
3. User can provide screenshot path manually

---

## Claude in Chrome (Interactive)

Native extension for interactive verification. Minimal tokens, no config.

### When to Use

- Quick visual checks during development
- Interactive debugging
- Real-time feedback on UI

### Workflow

1. User navigates to page in Chrome with Claude extension
2. Claude can see the page directly
3. Verification happens in conversation

---

## Screenshot-Based Verification

### Capture Screenshot

**If Playwright available:**
```bash
npx playwright screenshot http://localhost:3000 screenshot.png
npx playwright screenshot http://localhost:3000 page.png --wait-for-selector ".login-button"
```

**If not available:**
```bash
# Ask user to provide screenshot
# Or use system screenshot tool
```

### Verify with Claude Vision

```
Read screenshot.png and verify:
1. Login button visible
2. No error banners
3. Form fields aligned
```

### Verify with Gemini (When Available)

```bash
if [ -n "$GEMINI_API_KEY" ]; then
  IMG_BASE64=$(base64 -i screenshot.png 2>/dev/null || base64 -w0 screenshot.png)

  cat > /tmp/gemini_verify.json << JSONEOF
{
  "contents": [{
    "parts": [
      {"text": "Verify: 1) Login button visible 2) No errors. PASS or FAIL each."},
      {"inline_data": {"mime_type": "image/png", "data": "$IMG_BASE64"}}
    ]
  }]
}
JSONEOF

  curl -s -X POST \
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro:generateContent" \
    -H "x-goog-api-key: $GEMINI_API_KEY" \
    -H "Content-Type: application/json" \
    -d @/tmp/gemini_verify.json
fi
```

---

## Before/After Comparison

For regression testing:

### With Gemini

```bash
BEFORE_B64=$(base64 -i before.png 2>/dev/null || base64 -w0 before.png)
AFTER_B64=$(base64 -i after.png 2>/dev/null || base64 -w0 after.png)

cat > /tmp/compare.json << JSONEOF
{
  "contents": [{
    "parts": [
      {"text": "Compare BEFORE and AFTER. List differences. PASS if intended change occurred, FAIL if regression."},
      {"inline_data": {"mime_type": "image/png", "data": "$BEFORE_B64"}},
      {"inline_data": {"mime_type": "image/png", "data": "$AFTER_B64"}}
    ]
  }]
}
JSONEOF
```

### With Playwright (If Available)

```typescript
test('visual regression', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await expect(page).toHaveScreenshot('baseline.png', {
    maxDiffPixels: 100
  });
});
```

---

## Fallback Logic

```
1. Check if visual testing framework exists in project
2. If yes → use project's framework
3. If no → ask user for screenshot or URL
4. Use Gemini (if key exists) or Claude vision
5. If Gemini fails → fallback to Claude
```

---

## Tool Selection by Tier

| Tier | Approach |
|------|----------|
| Quick | Skip visual (too slow) |
| Standard | Element presence check if framework available |
| Thorough | Full screenshot + vision analysis |

---

## No Visual Tools Available

If no visual testing framework and user needs visual verification:

```
AskUserQuestion:
  question: "How should I verify the UI?"
  header: "Visual"
  options:
    - label: "I'll provide screenshots"
      description: "Take screenshots manually, share path"
    - label: "Skip visual verification"
      description: "Trust code changes are correct"
    - label: "Add Playwright"
      description: "Install @playwright/test for automation"
```
