# DO IT SERVICES — Operational Platform Project To-Do List

This document provides a highly structured, atomic, and sequentially ordered to-do list for building the **DO IT SERVICES Operations Platform** (Progressive Web App). Each task is designed to be complete and self-contained, resolving dependencies sequentially so there is zero overlap.

---

## Phase 1: Database Setup & Relational Modeling (PostgreSQL)

- [x] **Task 1: Configure Database Infrastructure**  
  Initialize the database (PostgreSQL local engine / Neon Cloud fallback) and configure the `.env` environmental schema containing connection URLs and crypt-hash configurations.
- [x] **Task 2: Define Users Table Schema**  
  Create the `users` table with UUID primary key, `name`, `phone` (indexed for unique lookup), `role` (Enum: `'admin'`, `'staff'`), and `password_hash` (Argon2id).
- [x] **Task 3: Define Retailers Table Schema**  
  Create the `retailers` table with UUID primary key, `retailer_name` (indexed), `address`, `email` (for statement receipts), `phone`, and a secure unique `ledger_token` (UUID hex string) used for secure, public, login-free web ledger access.
- [x] **Task 4: Define Attendance / KM Tracking Table Schema**  
  Create the `attendance` table with UUID primary key, `user_id` referencing `users.id`, `date`, `start_km`, `end_km` (nullable), `start_time`, `end_time` (nullable), and shift `status` (`'active'`, `'completed'`).
- [x] **Task 5: Define Collections Table Schema**  
  Create the `collections` table with UUID primary key, `retailer_id` referencing `retailers.id`, `staff_id` referencing `users.id`, `portal_id` (nullable, referencing `portals.id` to identify stores like Blinkit/Muthoot), `total_amount`, `remarks`, `status` (`'pending'`, `'verified'`, `'deposited'`), and `created_at`.
- [x] **Task 6: Define Denominations Table Schema**  
  Create the dual-purpose `denominations` table with UUID primary key, `collection_id` (nullable, unique FK), `deposit_id` (nullable, unique FK), integer counts for ₹500, ₹200, ₹100, ₹50, ₹20, ₹10, `coins` (Decimal), and `online_amount` (Decimal) supporting cashless online UPI/scan transactions.
- [x] **Task 7: Define Bank Deposits & Payouts Table Schema**  
  Create the `bank_deposits` table supporting dual-destination cash turnovers: `deposit_type` (`'portal'` / `'retailer'`), `portal_id` (nullable FK), `retailer_id` (nullable FK), `payment_mode` (`'cash'`, `'online'`), `amount`, `deposit_date`, `reference_no` (unique, nullable), `status` (`'pending'`, `'verified'`), and `verified_by` (nullable FK).
- [x] **Task 8: Define Ledger Table Schema**  
  Create the `ledgers` table with UUID primary key, `retailer_id` referencing `retailers.id`, `transaction_type` (`'credit'`, `'debit'`), `amount`, `balance` (running outstanding debt balance), `collection_id` (nullable FK), and `created_at`.
- [x] **Task 9: Establish Performance Indexes & Constraints**  
  Add database performance indexes on collections, ledgers, foreign keys, and unique tokens. Successfully verify compiler configurations and relationship cascading via mock verification tests.


---

## Phase 2: Backend Foundation & Authentication (FastAPI)

- [x] **Task 10: Initialize FastAPI Project Directory**  
  Configure backend structure and settings loaders (`app/core/config.py` and `app/main.py`) extracting configurations dynamically from active env variables.
- [x] **Task 11: Implement Password Hashing Utility**  
  Create cryptography system using Argon2id profiles (`app/core/security.py`) to hash, verify, and isolate system password structures.
- [x] **Task 12: Implement JWT Utility Module**  
  Build standard token compilers returning short-live JSON Web Access tokens and long-live rotating refresh tokens.
- [x] **Task 13: Build Authentication Request & Response Schemas**  
  Define Pydantic schema validation wrappers (`app/schemas/auth.py`) formatting phone strings and filtering permissions.
- [x] **Task 14: Implement Login Endpoint (`POST /auth/login`)**  
  Create custom login router validating phone records, injecting access tokens in payloads, and setting secure HttpOnly refresh cookies.
- [x] **Task 15: Implement Token Refresh Endpoint (`POST /auth/refresh`)**  
  Build automatic refresh token rotation validating session cookies and issuing replacement credentials.
- [x] **Task 16: Implement Logout Endpoint (`POST /auth/logout`)**  
  Create logout path clearing active session cookie contexts in host clients.
- [x] **Task 17: Build Auth Dependencies & Role-Based Access Guards**  
  Build OAuth2 Header Bearer decoders (`app/dependencies.py`) and RoleChecker class guards (`require_admin`, `require_staff`).


---

## Phase 3: Backend Core Operational APIs

- [x] **Task 18: Build Portal / Store Management APIs**  
  Implement endpoints: `POST /portals` (Admin only), `GET /portals` (returns all active portals/stores with bank details), `PUT /portals/{id}` (Admin only), and `DELETE /portals/{id}` (Admin only).
- [x] **Task 19: Build Retailer Management APIs**  
  Implement endpoints: `POST /retailers` (Admin only), `PUT /retailers/{id}` (Admin only), and `GET /retailers` (returns assigned retailers with secure public ledger hashes).
- [x] **Task 20: Build Attendance / KM Entry APIs**  
  Implement endpoints: `POST /attendance/check-in` (logs start KM and active status) and `POST /attendance/check-out` (logs end KM, updates attendance status to completed, and verifies KM calculation).
- [x] **Task 21: Build Collection Schema & Cash+Online Validation Schemas**  
  Define Pydantic schemas validating collections and denomination counters supporting standard notes (500, 200, 100, 50, 20, 10, coins) and cashless `online_amount` entries.
- [x] **Task 22: Implement Collection Submission Endpoint (`POST /collections`)**  
  Build endpoint to submit retailer collections tied optionally to a portal/store. Programmatically verify that collection `total_amount` strictly equals the note counts sum plus the `online_amount`.
- [x] **Task 23: Implement Collections Retrieval API (`GET /collections`)**  
  Build endpoints querying collections with deep filters (date range, staff, retailer, portal, status) and returning expand details.
- [x] **Task 24: Implement Collection Verification & Ledger + Email Alerts API**  
  Build Admin-only endpoint `PUT /collections/{id}/verify` marking collection verified, logging ledger credits, and triggering an automated SMTP email to the retailer with their custom public, login-free ledger sheet link (`/ledger/{ledger_token}`).
- [x] **Task 25: Implement Bank Deposit / Payout Submission API (`POST /bank-deposits`)**  
  Build endpoint for staff recording dual-destination turnovers: Option A (deposit money to portal bank accounts with optional denominations) or Option B (refund payout to retailers with payment modes).
- [x] **Task 26: Implement Bank Deposit Verification API (`PUT /bank-deposits/{id}/verify`)**  
  Build endpoint (Admin only) to verify deposits, updating status and linking the verifying administrator user.
- [x] **Task 27: Create Admin Dashboard Summary Endpoint (`GET /admin/summary`)**  
  Implement dashboard API returning today's aggregated collection values, visited stores/retailers, unsubmitted deposits, and pending verification counts.
- [x] **Task 28: Create Public Retailer Ledger Statement API (`GET /public/ledger/{token}`)**  
  Build a public, login-free read-only endpoint returning a retailer's contact details, current outstanding running balance, and full transaction history list.
- [x] **Task 29: Create Report Generation & Export APIs**  
  Implement report compilation handlers exporting data directly in clean formats for collections, staff compliance, and ledger sheets.



---

## Phase 4: Frontend Base Setup & PWA Configuration (Next.js)

- [x] **Task 29: Initialize Next.js Project Shell**  
  Set up the Next.js 16 project in `/frontend` utilizing React 19, TypeScript, and Tailwind CSS v4 in standard layout.
- [x] **Task 30: Configure Manifest & Assets**  
  Create the PWA `manifest.json` defining theme colors, standalone display modes, desktop/mobile app icons, and launch splash structures.
- [x] **Task 31: Integrate Service Worker Caching**  
  Set up next-pwa/Serwist to compile service workers, manage asset caching, and handle offline-ready routing.
- [x] **Task 32: Install shadcn/ui Component Library**  
  Set up `shadcn/ui` workspace configuration with all base styles, custom configurations, and Lucide react icons.
- [x] **Task 33: Design Global State Store (Zustand)**  
  Create Zustand stores to manage Authentication state, User permissions, Active network status, and Toast notifications.
- [x] **Task 34: Setup Data Fetching Engine (TanStack Query)**  
  Initialize TanStack Query client with custom error boundaries, retries, automatic query invalidation, and custom cache-lifetime definitions.
- [x] **Task 35: Set Up Local Offline DB (Dexie.js / IndexedDB)**  
  Initialize Dexie.js schemas mapping out table stores for offline retailers list, cached historical summaries, and a sequential queue for unsynced collections.

---

## Phase 5: Frontend Auth & App Shell Layouts

- [x] **Task 36: Design Splash & Check-Auth View**  
  Build a Splash screen that queries local credentials, attempts secure token refresh, and handles routing to dashboard or login routes.
- [x] **Task 37: Design Mobile-First Login View**  
  Build login view matching the design spec, utilizing a custom numerical keyboard option for phone inputs, custom password show/hide, and interactive loading states.
- [x] **Task 38: Build Staff App Bottom Navigation Shell**  
  Build a custom, high-contrast bottom navigation bar for staff (Home, Entry, History, Profile) meeting thumb-reach guidelines (minimum 48px height touch targets).
- [x] **Task 39: Build Responsive Admin Layout Sidebar & Bottom Drawer**  
  Build the Admin app shell: responsive left sidebar for desktop, and collapsible bottom sheets/drawers for admin mobile viewing.

---

## Phase 6: Frontend Staff Panel Workflows (PWA)

- [x] **Task 40: Build Attendance & KM Check-In Panel**  
  Create the home screen card prompting staff to check-in by entering their starting KM before any collection entries can be unlocked.
- [x] **Task 41: Build Searchable Retailer Selector component**  
  Build a high-performance searchable select component for retailer selection. In offline mode, automatically read list from Dexie.js database.
- [x] **Task 42: Build Large Touch-Friendly Amount Entry Input**  
  Build a visual, clear amount input widget with big touch buttons and instant currency formatting.
- [x] **Task 43: Build Denomination Incrementor Cards**  
  Build card-based incrementor rows using big `[-]` and `[+]` touch targets for ₹500, ₹200, ₹100, ₹50, ₹20, ₹10, and coins.
- [x] **Task 44: Build Sticky Total & Match Status Bar**  
  Design a bottom-sticky real-time feedback bar comparing entered collection amount vs denomination breakdown total. Highlight matches in green with checkmark; highlight differences in red and disable submit button.
- [x] **Task 45: Build Remarks Chips Selector**  
  Implement touchable remarks chips ("Closed shop", "Partial payment", "Short cash") to reduce typing efforts on mobile.
- [x] **Task 46: Build Attendance Check-Out Card**  
  Build a clean card allowing staff to enter end KM, calculating the total distance traveled, and completing their shift.
- [x] **Task 47: Implement Local Offline-Queue Interceptor**  
  Configure form submissions: if network status is offline, intercept, save to Dexie.js offline-sync queue, display amber sync badges, and trigger success notification.
- [x] **Task 48: Implement Automatic Background Sync Engine**  
  Build a background daemon monitoring connection state. Upon recovery, automatically process Dexie.js sync queue sequentially, clearing completed items and showing notifications.
- [x] **Task 49: Build Staff Dashboard Overview UI**  
  Build Staff home screen displaying clean KPI cards: Today's Total, Visited Retailers, Shift KM, and Unsynced Queue items count.
- [x] **Task 50: Build Staff Historical Submissions List**  
  Build scrollable chronological history screen utilizing expandable cards showing full denomination details and sync verification tags.

---

## Phase 7: Frontend Admin Command Center

- [x] **Task 51: Build Live Admin Overview KPIs**  
  Create top metrics summary grid (Today's Total, Active Staff, Pending Verifications, Bank Deposit statuses).
- [x] **Task 52: Build Collection Trends Charts**  
  Integrate responsive Recharts graphs: daily collection bar charts and cumulative trends line graphs.
- [x] **Task 53: Build Advanced Collections Table**  
  Build high-density collections table with column sorting, paging, search, and deep filters (date range, staff, retailer, status, amount, KM range).
- [x] **Task 54: Build Collection Verification & Edit Drawer**  
  Build a sliding details panel showing full details of a collection, denomination card grids, and a primary "Verify & Log to Ledger" action button.
- [x] **Task 55: Build Retailer Directory & Ledger Cards**  
  Build retailer directory with add/edit drawer, staff assignment dropdown, and details card displaying complete Khatabook-style ledger transaction history.
- [x] **Task 56: Build Staff Compliance & Tracking Panel**  
  Create staff monitoring board displaying individual shift attendance metrics, start/end KM, compliance status, and active maps/locations (if applicable).
- [x] **Task 57: Build PDF / Excel Report Exporters**  
  Add clean export configurations translating admin tables into print-ready operational PDFs and Excel collection spreadsheets.

---

## Phase 8: Deployment, Security & Stabilization

- [x] **Task 58: Compose Production Dockerfiles**  
  Write optimized production multi-stage Dockerfiles for Next.js frontend and FastAPI backend applications.
- [x] **Task 59: Configure Reverse Proxy (Nginx) & SSL**  
  Write Nginx configuration file setting up SSL certificate automation (Let's Encrypt), setting secure response headers, and rate limiting APIs to prevent brute-force attacks.
- [x] **Task 60: Establish Cloudflare CDN & WAF Policies**  
  Setup Cloudflare edge routing, strict SSL policy, DDoS protection, and Web Application Firewall security rules on api and app subdomains.
- [x] **Task 61: Configure Scheduled Database Backups**  
  Build Cron/Job configurations triggering encrypted PostgreSQL backups daily and pushing them directly to secure Cloudflare R2 object storage.
- [x] **Task 62: Perform Final End-to-End Testing & Hardening**  
  Execute extensive system verification tests: mock high-latency connections, simulate offline multi-transaction flows, test concurrent synchronization conflicts, and execute final security scans.

---

> [!IMPORTANT]
> Keep task execution completely linear. When implementing any task, ensure that all preceding tasks have been fully completed and verified before starting. This guarantees zero overlapping dependencies.
