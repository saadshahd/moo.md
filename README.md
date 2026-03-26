<img src="assets/cover-rounded.png" alt="moo.md - Stay present with AI" width="100%">

# hope @ moo.md

Why does this exist? Why introduce theatrical friction?

Because **YOU** the human -> end up being the world model. The LLM powered agentic coder is just your hands with tiny muscle memory.

---

Before moo:

> "Build a settings page" → starts coding → wrong pattern → rebuilds → ships something nobody asked for

After moo:

> "Build a settings page" → clarifies what matters → shapes the approach → builds with confidence

---

## Try it

```bash
/plugin marketplace add saadshahd/moo.md
/plugin install hope@moo.md
```

You say: `/hope:full build a settings page` and moo:

- clarifies intent — What settings? Who sees them? What should this NOT do?
- shapes design — 2 approaches with tradeoffs. You pick before writing code.
- consults experts — Surfaces what you'd miss. One actionable next step.

<details>
<summary><strong>See it in action</strong> — real session, messy scenario</summary>

<br>

### Intent — "Make the homepage better."

> **[INTENT]** Specific questions, not "what do you want?"

**moo asks:**
1. What's the main thing the homepage should accomplish?
2. What specifically feels wrong or weak about it right now?
3. What should the homepage NOT do or become?

**You answer:**
1. "Get more signups. We're at 2% conversion, want 5%."
2. "People don't understand what we do. Hero is too clever. Signup button is below the fold."
3. "No long-scroll landing page. No chatbot widget."

> Two more rounds — product details, tech stack, traffic split, social proof assets. Each question targets a specific gap.

> **[ECHO]** 33 words. You confirm or edit before anything proceeds.

**moo echoes back:** Rewrite homepage copy and layout (Next.js/Tailwind) to clearly communicate the AI email marketing value prop, move signup above the fold, and add social proof — targeting 5% conversion, especially on mobile.

> **[ASSUMPTIONS]** Surfaces decisions you never stated — forces you to choose.

**Page length** — you said no long-scroll. How many sections?
- A) Max 4 &nbsp; B) Max 5 *(you pick)* &nbsp; C) Max 3

**Signup mechanism** — what fields?
- A) Email-only + "Get Started Free" *(you pick)* &nbsp; B) Email + company name &nbsp; C) Separate signup page

**Mobile target** — mobile is at 1.2%. Separate target?
- A) Same 5% &nbsp; B) Mobile 3.5%, desktop 5%+ *(you pick)* &nbsp; C) No separate target

---

### Shape — "How should we build this?"

> **[CONSULT]** Experts debate. Real tension, not rubber-stamping.

moo identifies the key architectural decision: **should the hero section lead with the product or the outcome?**

**Krug** (usability): "Don't make me think. Lead with what the product does — users scan, they don't read. Clever taglines fail."

**Cialdini** (persuasion): "Lead with the outcome — social proof and results pull harder than feature descriptions. Show the 50M emails number above the fold."

**Tension:** Krug wants clarity-first ("AI email marketing for e-commerce"). Cialdini wants proof-first ("50M+ emails sent for brands like yours"). Different advice, real tradeoff.

> **[SHAPE]** Two concrete approaches with tradeoffs. You pick before code.

| | Approach A: Clarity-first | Approach B: Proof-first |
|---|---|---|
| **Hero** | "AI-powered email campaigns for e-commerce" + signup | "50M+ emails sent" + brand logos + signup |
| **Strength** | Instant comprehension | Instant credibility |
| **Risk** | Feels generic without differentiation | Confusing if visitor doesn't know the category |
| **Best when** | Product category is unfamiliar | Product category is obvious, trust is the gap |

**You pick Approach A** — visitors don't know the category yet. Proof moves to section 2.

---

### Brief — precise spec, no code written yet

| | |
|---|---|
| **Objective** | Rewrite homepage copy and layout. 5% desktop / 3.5% mobile conversion. |
| **Non-goals** | No visual redesign, no long-scroll, no chatbot, no CMS changes. |
| **Acceptance** | Hero = "result + how." Signup in first viewport. Social proof within 2 scrolls. Single CTA style. |
| **Stop conditions** | Conversion drops below 2%. Lighthouse below 90. Page exceeds 5 sections. |

*From "make the homepage better" to a spec with stop conditions — before a line of code.*

</details>

---

## Gratitude

[Nate B. Jones](https://www.natebjones.com/) · [Superpowers](https://github.com/obra/superpowers) · [Farnam Street](https://fs.blog/blog/)
