# CrediiFlow — Plain English QA Audit & Bug Summary

**Date:** August 30, 2026  
**Audience:** Management, Product Owners, Developers & Stakeholders  
**Current Status:** 🔴 **NOT READY FOR RELEASE** (Must fix critical security and financial balance issues first)

---

## 📌 At A Glance: What Happened?

We performed a deep quality and security check across the CrediiFlow platform. We found **27 items** that need attention.

- **4 Critical Issues (P0):** Immediate risks of data theft, database compromise, or ledger/financial balance corruption.
- **8 High Priority (P1):** Security loopholes, logout gaps, and access control bugs.
- **10 Medium Priority (P2):** Calculation edge cases, performance risks, and data validation gaps.
- **5 Low Priority (P3):** Housekeeping, duplicate code, and minor visual/navigation fixes.

---

## 🚨 1. The 4 Critical Showstoppers (Fix Immediately)

These 4 bugs represent severe financial and security risks and block the launch.

### 1. Passwords and Master Security Keys Saved in Git
* **What is happening:** The secret password to the production database and the digital signature key for user logins were saved directly into the code repository.
* **Why it matters:** Anyone with access to the codebase can read the database or create fake admin logins that bypass all passwords.
* **How to fix:** Immediately change the database password and secret keys, remove the `.env` file from Git, and ignore it in `.gitignore`.

---

### 2. Built-in Default Security Key
* **What is happening:** If the server starts up without a security key defined, it silently uses a hardcoded, publicly visible test password (`dev-secret-key...`).
* **Why it matters:** Hackers know this default key. They can forge fake SuperAdmin tokens and take over any account.
* **How to fix:** Make the server refuse to start unless a real, secure secret key is provided.

---

### 3. Admin Login Keys Exposed in Web Addresses (URLs)
* **What is happening:** When a SuperAdmin clicks "Impersonate Admin" to help a customer, the 24-hour secret login token is placed directly into the browser URL bar (e.g. `?impersonate_token=...`).
* **Why it matters:** URLs get stored in browser histories, proxy logs, and analytics tools. If someone gets this link, they can control that client's account for 24 hours.
* **How to fix:** Use a 60-second temporary one-time handshake ticket instead of sending full 24-hour login keys in the URL.

---

### 4. Financial Balance Desync When Deleting Collections
* **What is happening:** When a payment collection is deleted, the system deletes the record first in one step, and then tries to recalculate the shopkeeper's balance in a second step.
* **Why it matters:** If the server crashes, loses connection, or gets interrupted between step 1 and step 2, the retailer's balance stays incorrect permanently (money discrepancies).
* **How to fix:** Combine the delete and balance recalculation into a single atomic action (either both succeed together or neither happens).

---

## ⚠️ 2. High-Risk Vulnerabilities (Security & Logic)

| Bug ID | Simple Name | What Happens? | Why It's Dangerous | Plain English Fix |
|---|---|---|---|---|
| **BUG-005** | **Zombie Logins After Logout** | When a user clicks "Logout", their computer forgets the key, but the server doesn't cancel it. | A stolen login key remains valid for up to 7 days even if the user logged out. | Keep a version counter on user accounts so logging out instantly kills all old keys. |
| **BUG-006** | **No Login Attempt Limits** | There is no limit to how many passwords a bot can guess on the login screen. | Hackers can use automated scripts to guess passwords until they break in (Brute Force). | Lock accounts or slow down requests after 5 wrong password attempts. |
| **BUG-007** | **System Errors Show Code & Secrets** | When an unexpected crash happens, technical database error messages are shown directly on the user's screen. | Attackers can see internal database column names and code structures. | Show a friendly message ("Something went wrong") and save technical details only in internal logs. |
| **BUG-008** | **Suspended Businesses Can Keep Using App** | When a client account is suspended by SuperAdmin, their server connection is still cached in memory. | A deactivated or non-paying client can continue making transactions until the server reboots. | Clear the cache immediately when an account is paused or suspended. |
| **BUG-009** | **Staff Deletion Bypass** | An admin can still delete staff members even when SuperAdmin locked entity modifications. | Bypasses safety locks set by platform management. | Enforce the safety lock check on the delete staff button too. |
| **BUG-010** | **Double-Crediting Payments** | If a collection verification is triggered twice, two ledger records are created for one payment. | Retailers get credited twice for the same collected cash. | Check if a ledger record already exists before creating a new one. |
| **BUG-011** | **Maintenance Mode Can Be Skipped** | Sending a special header (`X-Maintenance-Bypass: true`) allows anyone to bypass maintenance mode without logging in. | Users can use the platform while updates or repairs are actively underway. | Require SuperAdmin credentials before allowing maintenance bypass. |
| **BUG-012** | **Misleading Security Claim on Login** | Login footer claims "Secure AES-256 Encrypted Session", but standard JWT/TLS is used. | Misleading compliance and marketing claim. | Change wording to "Protected by TLS 1.3 & Secure JWT Authentication". |

---

## ⚙️ 3. Medium Issues (Data Quality, Validation & Stability)

* **BUG-013 (FastAPI Lifecycle):** Uses an outdated startup method that will break when FastAPI libraries are updated in the future.
* **BUG-014 (Timezones):** Deprecated Python clock calls cause inconsistent time comparisons between UTC and Indian Standard Time (IST).
* **BUG-015 (Phone Number Validation):** Login box accepts any random characters instead of validating a real 10-digit phone number.
* **BUG-016 (Phantom "Partner" Role):** System allows creating accounts as "Partner", but the app doesn't have permissions or pages for partners.
* **BUG-017 (Zero or Negative Collections):** The app allows staff to submit ₹0.00 or negative money collections, creating confusing ledger clutter.
* **BUG-018 (Delete Collection Split Steps):** Duplicate of BUG-004 emphasizing balance safety during database transactions.
* **BUG-019 (Multi-Tenant Data Mix-Up in Browser):** All client dashboards store temporary data under the exact same browser storage key. Opening two clients in the same browser can briefly mix up their data on screen.
* **BUG-020 (Login Keys in Browser Storage):** Access keys saved in `localStorage` can be targeted if malicious scripts ever run on the page.
* **BUG-021 (Password Denial-of-Service):** Sending a huge 50-megabyte password string can freeze the server CPU during password checks. Limit passwords to 128 characters.
* **BUG-022 (Duplicate Bank Deposit Crash):** If two users type the same bank slip reference number, the app crashes with an internal 500 error instead of showing "Reference number already used".

---

## 🧹 4. Low Priority & Housekeeping Items

* **BUG-023 (Duplicate Project Folder):** The codebase has a cloned folder (`do-it-services/`) inside itself, causing developer confusion.
* **BUG-024 (404 Back Button):** Clicking "Go Back" on the page-not-found screen always sends the user to the home page instead of their previous page.
* **BUG-025 (Server Health Checks):** Cloud monitoring pings fail if they don't provide a client tenant header.
* **BUG-026 (Remember Me Privacy):** Phone number is saved as plain text in the browser.
* **BUG-027 (Startup Settings Overwrite):** Every time the server restarts, it resets custom 5-minute edit windows back to 10 minutes.

---

## 📋 Recommended Action Plan (Plain English)

```
[Phase 1: Security & Secrets]
  - Rotate all leaked database passwords & JWT keys
  - Add .env to .gitignore
  - Stop sending login keys in URLs
  
[Phase 2: Financial & Data Safety]
  - Make collection deletions recalculate balance in ONE step
  - Prevent duplicate ledger entries on payment approvals
  - Limit login attempts (prevent password guessing)

[Phase 3: Permissions & Access]
  - Invalidate user sessions when they click Logout
  - Immediately disconnect suspended client businesses
  - Sanitize crash messages so technical errors aren't shown to users

[Phase 4: Cleanup & Polish]
  - Remove duplicate codebase folders
  - Validate phone numbers & amounts properly
  - Clean up browser storage keys and navigation buttons
```
