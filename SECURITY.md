# Fill Pro Security Policy

## 1. Reporting Security Issues
If you discover a potential security vulnerability within Fill Pro, please report it privately via security@toolls.io.

## 2. Security Safeguards in Fill Pro
- **No Remote Code Execution:** All dependencies and scripts are bundled locally inside the extension.
- **Sensitive Field Exclusions:** Passwords, OTPs, CVVs, and payment credentials are automatically skipped by the form scanner and generation engine.
- **Input Sanitization:** AI responses are strictly validated against declarative Zod schemas before any execution action is permitted.
