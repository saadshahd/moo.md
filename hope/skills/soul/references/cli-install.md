# CLI Tool Installation Pattern

Detect, ask, install, verify pattern for external CLI tools.

## Process

### 1. Check Availability

```bash
which <tool-name>
# OR
command -v <tool-name>
```

### 2. If Missing: Ask Permission

Use AskUserQuestion tool:

```
The <tool-name> CLI is not installed. Would you like me to install it?

Command: `npm install -g <package>@<version>`

This tool is required for <purpose>.

[Yes, install it] / [No, show manual instructions]
```

### 3. If Approved: Install

```bash
npm install -g <package>@<version>
```

### 4. Verify Installation

```bash
<tool-name> --version
```

If verification fails, provide manual installation instructions and troubleshooting.

### 5. If Declined: Continue Anyway

Generate output that would require the tool, but include install instructions:

```
Note: To render this output, install <tool-name>:
npm install -g <package>@<version>
```

---

## Pinned Versions

Pin alpha/experimental tools to specific versions to avoid breaking changes.

| Tool | Package | Version | Purpose |
|------|---------|---------|---------|
| wiremd | wiremd | 0.1.5 | Markdown wireframes |
| marp | @marp-team/marp-cli | latest | Presentation slides |
| mmdc | @mermaid-js/mermaid-cli | latest | Mermaid diagrams |
| style-dictionary | style-dictionary | latest | Design tokens |

---

## Installation Commands

```bash
# WireMD (pin version — alpha tool)
npm install -g wiremd@0.1.5

# Marp CLI
npm install -g @marp-team/marp-cli

# Mermaid CLI
npm install -g @mermaid-js/mermaid-cli

# Style Dictionary
npm install -g style-dictionary
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Permission denied | Use `sudo npm install -g` or fix npm permissions |
| npm not found | Install Node.js from nodejs.org |
| Command not found after install | Check PATH includes npm global bin |

---

## Commands Using This Pattern

- `/wireframe` — WireMD wireframes
- `/slides` — Marp presentations
- `/tokens` — Style Dictionary design tokens
