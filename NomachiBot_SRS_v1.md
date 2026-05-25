# SOFTWARE REQUIREMENTS SPECIFICATION
## NomachiBot — Debt Agreement Telegram Mini App
**Version:** 1.0 — Initial Specification (built from zero)
**Date:** May 2026
**Target Platform:** Telegram Mini App + standalone public web
**Primary Market:** Uzbekistan (scalable globally)
**Stack:** React · Node.js · PostgreSQL · Puppeteer
**Key Decisions:** Borrower initiates · Lender logs repayments · No interest · Up to 3 witnesses · Open public ledger · Optional selfies · 3 languages (UZ / RU / EN)

---

# PART 0 — Technical Review of the Original Strategic Plan

This section audits the original strategic document before specifying requirements. Issues are ordered by severity. All design decisions incorporated into version 1.0 are also noted here.

---

## 0.1 What Works — Keep As-Is

- Core concept: Telegram Mini App for P2P debt agreements — valid and market-proven.
- Authentication via Telegram initData HMAC — correct, secure, zero third-party dependency.
- React 18 + TypeScript + Vite for the Mini App frontend — right choice.
- Node.js / Express backend — full-stack JS, easy to maintain.
- PostgreSQL for the financial ledger — ACID compliance is mandatory for money data.
- Self-hosted file storage for PDFs and photos — correct for cost and data control.
- QR code embedded in the PDF linking to a live status page — practical and clever.
- CompreFace as a self-hosted face recognition server — valid for a future biometric phase.
- Phased implementation (simple v1.0 first, biometrics later) — correct instinct.

---

## 0.2 Critical Conflicts — These Will Break the Build

### Conflict 1 — QuestPDF (.NET / C#) inside a Node.js backend
**SHOWSTOPPER:** QuestPDF is a C# library. It cannot run inside a Node.js process. A separate .NET runtime would be needed, adding a third language and runtime with zero benefit. Replaced by Puppeteer (headless Chrome → PDF). One library, no language conflicts.

### Conflict 2 — Four redundant PDF libraries
**CONFLICT:** PlutoPrint, fpdf2, pikepdf, and QuestPDF are all listed for PDF generation. fpdf2 and pikepdf are Python — they require a separate microservice when the backend is Node.js. All four are replaced by Puppeteer (Node.js native).

### Conflict 3 — face-api.js is unmaintained
**HIGH RISK:** justadudewhohacks/face-api.js has had no meaningful updates in years. Its TensorFlow.js dependency changed API significantly in v3/v4. Known incompatibilities with Telegram's WebView (WKWebView on iOS). For v1.0: replaced with a native `<input type="file" accept="image/*" capture="user">` camera input — works on all platforms with no library.

### Conflict 4 — Camera stream access in Telegram WebApp is restricted on iOS
**PLATFORM RISK:** Telegram's custom WebView does not support unrestricted WebRTC getUserMedia() on iOS. The original plan's liveness detection depends on this. For v1.0 this is avoided entirely. For Phase 2: test on target devices before committing.

### Conflict 5 — adorsys/p2p-lending is an Ethereum blockchain project
**IRRELEVANT:** This GitHub repo is a smart-contract platform on Ethereum. It has no bearing on a Telegram Mini App with a Postgres backend. Remove from reference list.

### Conflict 6 — rPPG liveness detection is not viable in a mobile browser
**NOT PRODUCTION-READY:** Remote photoplethysmography requires 30+ FPS video and sub-pixel color analysis. Mobile browsers inside Telegram compress the stream and vary frame rate. This technique is research-grade, not suitable for a consumer v1.0.

---

## 0.3 Legal Correction — Data Localisation

**CONTRADICTION:** The original document simultaneously claims Uzbekistan mandates biometric data be stored locally (Article 27-1) AND cites a Dentons article (March 2026) saying Uzbekistan dismantled its strict data localisation regime. These directly contradict each other.

**Updated position:** Self-hosting remains best practice for cost and control but is no longer a strict legal mandate in Uzbekistan as of 2026. The selfie-as-signature argument (Article 107, Civil Code) is reasonable but untested in court. The PDF must carry a disclaimer: "This document is a formal record of mutual intent. Consult a lawyer for legal enforcement."

---

## 0.4 Version 1.0 — Design Decisions Incorporated

- No interest or any financial calculation other than: `months = CEILING(total_amount / monthly_payment)`
- Contract is initiated by the BORROWER, not the lender.
- Simple real-time debt calculator: user enters total amount + monthly payment → months updates instantly on every keystroke.
- Mandatory fields for every participant: first name, last name, Telegram ID.
- Optional fields: patronymic, phone, address, selfie.
- LENDER logs repayments (not the borrower) — the lender records each payment as it is received.
- Up to 3 optional witnesses — each witness can optionally take a selfie and confirm.
- Full three-language support: Uzbek (primary), Russian (secondary), English (tertiary).
- Contract data and all payment updates are publicly accessible to anyone who scans the QR — no login required.
- Download button on the public page regenerates a fresh PDF with all payment history and QR code at the bottom.

---

## 0.5 Simplified Stack Comparison

| Component | Original Plan | NomachiBot v1.0 |
|---|---|---|
| Who initiates | Lender | Borrower |
| Who logs repayments | Borrower | Lender |
| Interest calculation | Simple interest formula | None — removed entirely |
| Debt calculator | Server-side, one-time | Client-side, real-time as user types |
| Mandatory identity | Full details required | First name, last name, Telegram ID |
| Selfie | Mandatory for both parties | Optional for all participants |
| Witnesses | Not mentioned | Up to 3 optional witnesses |
| Public access | Login required to view | Anyone with QR sees full history |
| PDF library | PlutoPrint + fpdf2 + pikepdf + QuestPDF | Puppeteer only |
| QR code | kozakdenys/qr-code-styling | qrcode npm package |
| Face capture | face-api.js + TensorFlow.js | Native `<input capture="user">` |
| Caching | Redis | None for v1.0 |
| AI / OCR | PaddleOCR + LayoutLMv3 + ERNIE | None for v1.0 — Phase 3 |
| Backend languages | Node.js + Python + .NET | Node.js only |
| Localisation | Not specified | Uzbek · Russian · English |

---

# PART 1 — Software Requirements Specification (SRS) — NomachiBot v1.0

---

## 1.1 Project Overview

| Field | Value |
|---|---|
| Product Name | NomachiBot — Debt Agreement Telegram Mini App |
| Product Type | Telegram Mini App + publicly accessible web |
| Core Purpose | Enable individuals to create, countersign, and publicly track a zero-interest debt agreement, entirely inside Telegram. |
| Participants | Borrower (initiates) · Lender (confirms, logs repayments) · up to 3 optional Witnesses |
| Primary Market | Uzbekistan; architecture ready to scale to CIS and beyond |
| v1.0 Scope | Contract creation, optional selfies per participant, PDF generation, QR code, public live ledger, downloadable updated PDF. |

---

## 1.2 Roles and Participants

| Role | Who | Key Actions |
|---|---|---|
| Borrower | Person receiving money | Initiates contract. Enters all terms. Optionally takes selfie. Generates invite links for lender and witnesses. |
| Lender | Person giving money | Opens invite link. Reviews terms. Enters own details. Optionally takes selfie. Confirms contract. Logs all repayments received from the borrower. |
| Witness 1–3 | Optional observers | Open witness invite link. Enter own details. Optionally take selfie. Confirm their participation. No financial role. |
| Guest | Anyone with the QR | Scans QR code. Views full contract info and repayment history. No login required. Can download the current PDF. |
| Admin | System operator | Internal panel only. View contracts, delete flagged content, user management. Not a product feature. |

---

## 1.3 Goals and Non-Goals for v1.0

### Goals — v1.0 must have

- Borrower creates a contract by entering: their own mandatory identity fields, lender's mandatory identity fields, total debt amount, monthly repayment amount.
- Real-time calculator: as borrower types the monthly amount, the number of months updates instantly. No interest, no fees, no financial calculation beyond `months = CEILING(total / monthly)`.
- Borrower optionally adds up to 3 witnesses by name (and their Telegram username if known).
- System generates unique shareable invite links: one for the lender, one for each witness.
- Lender opens their link, reviews terms, enters/confirms their own details, optionally takes a selfie, and confirms the contract.
- Each witness independently opens their link, enters/confirms their own details, optionally takes a selfie, and confirms.
- Once the lender confirms, the contract status changes to 'active' and the PDF is generated.
- PDF layout: each participant has their own info block (name, patronymic, Telegram username, phone, address) with their selfie photo displayed directly beside it — or a placeholder if no selfie was taken.
- A QR code is printed at the BOTTOM of the PDF, linking to the public status page.
- Public status page: accessible by anyone without login. Shows all contract details, all participant info, full repayment history.
- Download button on the public page regenerates and downloads a fresh PDF with all current payment updates and the QR code at the bottom.
- Lender logs repayments as they are received from the borrower. Each entry is shown on the public page and in the downloadable PDF.

### Non-Goals — out of v1.0 scope

- No interest, compound interest, late fees, or any financial calculation other than `months = CEILING(total / monthly)`.
- No server-side face recognition or biometric matching — Phase 2.
- No liveness detection — Phase 2.
- No payment processing or bank integrations.
- No blockchain or smart contracts.
- No native iOS/Android apps.
- No automated payment reminders — Phase 2.

---

## 1.4 Identity Fields per Participant

These rules apply equally to the Borrower, the Lender, and each Witness.

| Field | Required? | Notes |
|---|---|---|
| First name | **MANDATORY** | Text input. Min 2 characters. |
| Last name | **MANDATORY** | Text input. |
| Telegram ID | **MANDATORY** | Auto-populated from Telegram account for the authenticated user. For lender / witnesses entered by borrower: @username text field (Telegram validates at confirmation step). |
| Patronymic name | Optional | Text input. Common in Uzbek/CIS naming conventions. |
| Phone number | Optional | Formatted input. +998 prefix suggested for Uzbekistan. Validates E.164 format. |
| Address | Optional | Free-text textarea. City, street, apartment. |
| Selfie photo | Optional | Native camera input (`<input capture="user">`). If not taken, PDF shows a neutral avatar placeholder. Warning shown before capture: "This photo will be visible to anyone who scans the QR code." |

---

## 1.5 The Debt Calculator — Functional Specification

The debt calculator is the core UI element on the contract creation screen. There is no interest rate field. The formula is:

```
Number of Months = CEILING( Total Debt Amount ÷ Monthly Repayment Amount )
```

**Example:** $1,000 total ÷ $100/month = 10 months. $1,000 ÷ $300/month = 4 months (3.33 rounds up).

### Real-Time Behaviour

- Both fields are number inputs: Total Debt Amount and Monthly Repayment Amount.
- Number of Months is a read-only display — never entered by the user.
- Every time either input changes (on every keystroke), the months value recalculates instantly using `Math.ceil(total / monthly)`. No API call is made.
- If monthly > total: display "1 month" (one payment covers the debt).
- If monthly is 0 or empty: display "—" (not calculated yet).
- Result is shown prominently in a highlighted box next to the two input fields.
- A summary line shows: "Last payment: $X" where X = total mod monthly (or full monthly if evenly divisible).

### Calculator UI Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Total Debt Amount:    [ $ 1,000.00             ]           │
│  Monthly Repayment:    [ $ 100.00               ]           │
│                                                             │
│          ┌──────────────────────────────────┐              │
│          │   10 months to repay             │  ← live      │
│          │   Last payment: $100.00          │              │
│          └──────────────────────────────────┘              │
└─────────────────────────────────────────────────────────────┘
```

---

## 1.6 Contract Creation Flow (Borrower Initiates)

### Step 1 — Borrower fills the contract form

- **Section A — My details (Borrower):** Mandatory fields pre-populated from Telegram. Borrower can edit first/last name, add patronymic, phone, address, take selfie.
- **Section B — Lender details:** Borrower enters lender's @username (mandatory), first name (mandatory), last name (mandatory), patronymic, phone, address (all optional).
- **Section C — Witnesses (optional):** Borrower can add 1, 2, or 3 witnesses. Each witness needs at minimum: first name, last name, Telegram @username.
- **Section D — Debt Terms:** Total Amount, Monthly Repayment Amount, Currency (UZS / USD / EUR), Start Date, optional Description/Purpose of loan.
- **Section E — Repayment preview:** Live calculator output plus a table showing the expected repayment schedule (Month 1: due date · amount · balance, etc.).

### Step 2 — Borrower submits

- POST /api/contracts — creates a draft contract with status 'pending_lender'.
- System generates a lender invite link and one invite link per witness.
- Borrower's selfie (if taken) is uploaded and stored immediately.
- App displays all invite links with copy and Telegram share buttons.

### Step 3 — Lender confirms

- Lender opens their invite link inside Telegram.
- App shows the full contract terms (read-only).
- Lender reviews, can edit their own pre-filled details, optionally takes selfie.
- Lender taps 'Confirm and Sign' → POST /api/contracts/:uuid/lender-confirm.
- Contract status → 'active'. PDF generation triggered.

### Step 4 — Witnesses confirm (optional, parallel)

- Each witness opens their unique link independently.
- Witness reviews contract, enters/confirms their details, optionally takes selfie.
- Taps 'I confirm as witness' → POST /api/contracts/:uuid/witness-confirm/:witness_index.
- Witness confirmation is NOT blocking — contract activates when the lender confirms. Witnesses may confirm at any time after.
- PDF is regenerated automatically each time a new witness confirms.

### Step 5 — Contract activates + PDF generated

- On lender confirmation: contract status → 'active'.
- PDF generated by Node.js backend using Puppeteer.
- Bot sends Telegram notifications to borrower, lender, and any witnesses who have already confirmed.

---

## 1.7 Functional Requirements

Tags: [M] = Must Have (v1.0) · [S] = Should Have (v1.0) · [D] = Defer to later phase.

### FR-01 Authentication

- [M] Validate every request using Telegram initData HMAC-SHA256. Reject if hash mismatch or timestamp > 1 hour old.
- [M] On first visit: upsert user record from initData (telegram_id, first_name, last_name, username). Issue JWT (24h expiry).
- [M] Invite link recipients authenticate themselves when they open the link. The system knows which contract and which role they are filling.

### FR-02 Contract Creation

- [M] Borrower fills contract form as described in Section 1.6.
- [M] Real-time months calculator: client-side JS, no API call, updates on every input event.
- [M] No interest field. No interest calculation. Total amount and monthly repayment amount are the only financial inputs.
- [M] Currency selector: UZS, USD, EUR.
- [M] Start date: date picker, defaults to today.
- [M] Optional free-text description / purpose of the loan (e.g. "Car purchase", "Medical expenses").
- [M] Each participant has an independent set of identity fields as per Section 1.4.
- [M] Selfie capture per participant: native camera input, optional, server-side resize to 400×400 px (sharp), stored at contracts/{uuid}/photos/{role}.jpg.
- [S] Borrower can save a draft and return later (status = 'draft').

### FR-03 Contract Confirmation Flow

- [M] System generates unique invite tokens per role. Format: https://t.me/{Bot}/app?startapp={uuid}_{role}_{token}
- [M] Lender confirm endpoint: validate token, save lender's details and optional selfie, set status = 'active', trigger PDF generation.
- [M] Witness confirm endpoint: validate token and witness index (1, 2, or 3), save witness details and optional selfie, trigger PDF regeneration.
- [M] A participant can only confirm their own role. The system checks the JWT matches the invite token role.
- [S] Lender and witnesses can re-take selfie before confirming.

### FR-04 PDF Generation

- [M] Generated using Puppeteer (headless Chrome). Triggered on lender confirmation. Regenerated on each witness confirmation.
- [M] PDF is A4 format, print-ready.
- [M] PDF structure:
  - Header: App name + logo, Contract UUID (full), creation date.
  - Title: "Debt Agreement / Qarz Shartnomasi / Долговое Соглашение"
  - Debt Terms section: total amount, currency, monthly repayment, number of months, start date, description.
  - Repayment schedule table: Month #, due date, amount, cumulative paid, balance.
  - Participants section: one block per participant in order (Borrower → Lender → Witness 1 → Witness 2 → Witness 3). Each block: role label, full name, patronymic (if provided), Telegram username, phone (if provided), address (if provided) — and the participant's selfie photo directly to the RIGHT of this information. If no selfie: a grey placeholder silhouette.
  - Payment History section: table of all logged repayments (date, amount, notes, running balance). Shows "No payments logged yet" if empty.
  - Disclaimer: "This document is a formal record of mutual intent between the parties named above. It does not constitute a notarized legal instrument. Consult a qualified lawyer for legal enforcement or dispute resolution."
  - QR code at the BOTTOM of the last page, centered. Caption: "Scan to view live repayment status and download updated PDF". URL: https://yourdomain.com/public/status/{uuid}
- [M] PDF filename: nomachi_{uuid_short}_{date}.pdf
- [S] PDF generated in the language selected by the borrower at contract creation. Language stored on the contract record.

### FR-05 Repayment Logging

- [M] LENDER logs a repayment when money is received: date (default today), amount, optional note.
- [M] System records the payment, recalculates remaining balance, stores running_balance on the payment row.
- [M] Both the public status page and the downloadable PDF update to reflect the new payment.
- [M] If total paid >= total amount: contract status → 'settled'. All participants notified.
- [S] Borrower receives a Telegram bot notification when a repayment is logged by the lender.

### FR-06 Public Status Page (QR Target)

- [M] URL: https://yourdomain.com/public/status/:uuid — no authentication, no login required.
- [M] Page displays ALL of the following:
  - Contract UUID (partial for display)
  - All participant blocks: same layout as PDF (name, patronymic, username, phone, address, selfie if available)
  - Debt terms: total, monthly, number of months, currency, start date, description
  - Repayment progress: amount paid, amount remaining, months completed vs total, progress bar
  - Full repayment history table: each logged payment with date, amount, notes
  - Contract status badge: Active / Settled / Overdue
- [M] Download PDF button: GET /public/status/:uuid/pdf — regenerates PDF with all current data (including full payment history) and triggers browser download.
- [M] Page is mobile-responsive. Works in any smartphone browser after scanning the QR.
- [M] Page does NOT require the visitor to have Telegram or to be logged in.
- [S] Rate limit: max 120 requests/hour per IP (express-rate-limit, no Redis needed).

### FR-07 Dashboard (Authenticated Users)

- [M] User sees all contracts where they are the borrower, lender, or a witness. Three tabs: Borrowing | Lending | Witnessing.
- [M] Contract cards show: counterparty name, role badge, status, remaining amount.
- [M] Tapping a card opens the contract detail (same data as public page, plus the ability to log repayments if lender).
- [S] Lender can manually mark a contract as settled (prompts confirmation from both parties).

---

## 1.8 Data Model

### Table: users
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| telegram_id | BIGINT UNIQUE | From Telegram initData |
| first_name | TEXT | |
| last_name | TEXT | |
| username | TEXT | Telegram @username |
| created_at | TIMESTAMPTZ | |

### Table: contracts
| Column | Type | Notes |
|---|---|---|
| uuid | UUID PK | |
| borrower_user_id | UUID FK → users | |
| total_amount | NUMERIC(15,2) | |
| currency | TEXT | 'UZS' or 'USD' or 'EUR' |
| monthly_amount | NUMERIC(15,2) | |
| n_months | INTEGER | Computed: CEILING(total / monthly) |
| start_date | DATE | |
| description | TEXT | Optional loan purpose |
| language | TEXT | 'uz' or 'ru' or 'en' — set at creation |
| status | TEXT | draft / pending_lender / active / settled / overdue |
| pdf_path | TEXT | Path to latest generated PDF |
| created_at | TIMESTAMPTZ | |
| activated_at | TIMESTAMPTZ | Set when lender confirms |

NOTE: There is NO interest_rate column. Intentionally omitted.

### Table: participants
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| contract_uuid | UUID FK → contracts | |
| role | TEXT | borrower / lender / witness1 / witness2 / witness3 |
| invite_token | TEXT | Cryptographically random 32-byte hex. Single-use, 30-day expiry. |
| first_name | TEXT | |
| last_name | TEXT | |
| patronymic | TEXT | Optional |
| telegram_username | TEXT | |
| phone | TEXT | Optional |
| address | TEXT | Optional |
| photo_path | TEXT | Nullable. Path to selfie stored on server. |
| confirmed_at | TIMESTAMPTZ | Nullable. Set when participant confirms. |
| confirmed_by_user_id | UUID FK → users | Nullable. |

NOTE: This unified table covers borrower, lender, and all witnesses. PDF layout iterates over participants in role order.

### Table: payments
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| contract_uuid | UUID FK → contracts | |
| logged_by_user_id | UUID FK → users | Must be the LENDER of this contract |
| amount | NUMERIC(15,2) | |
| payment_date | DATE | |
| note | TEXT | Optional |
| logged_at | TIMESTAMPTZ | |
| running_balance | NUMERIC(15,2) | Computed and stored for fast retrieval |

### Table: notifications
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| user_id | UUID FK → users | |
| contract_uuid | UUID FK → contracts | |
| type | TEXT | e.g. contract_activated, payment_logged, contract_settled |
| sent_at | TIMESTAMPTZ | |

---

## 1.9 Technology Stack — Final Specification

| Layer | Technology | Rationale |
|---|---|---|
| Mini App frontend | React 18 + TypeScript + Vite | Standard Telegram Mini App stack. Fast HMR. Strong typing for financial fields. |
| Telegram SDK | @tma.js/sdk (official) | Official Telegram Mini Apps JS SDK. Actively maintained. |
| Backend API | Node.js 20 + Express + TypeScript | Single language across entire stack. TypeScript prevents type errors in financial calculations. |
| Database | PostgreSQL 16 + Prisma ORM | ACID compliance required. Prisma provides type-safe queries and migration management. |
| Telegram Bot | telegraf v4 | Sends notifications when contracts activate and repayments are logged. |
| PDF generation | Puppeteer (headless Chrome) | Renders HTML template to PDF. Full CSS layout, images, and QR codes inline. No language conflicts. |
| QR code | qrcode (npm) | Generates PNG or base64 data URL. Injected directly into Puppeteer HTML template. |
| Photo capture | HTML `<input type="file" accept="image/*" capture="user">` | Native OS camera dialog. Works on all platforms. No WebView camera API, no library. |
| Image resizing | sharp (npm) | Resizes selfies to 400×400 px server-side. Lightweight native bindings. |
| HTML template engine | Handlebars (.hbs) | Auto-escapes all user-supplied content. Prevents HTML injection into PDF. |
| UI components | Tailwind CSS + shadcn/ui | Telegram's dark/light theme CSS variables map to Tailwind tokens. |
| File storage | Server local filesystem | Paths stored in DB. Upgrade to MinIO / S3-compatible later if needed. |
| Auth | Telegram initData + JWT (jsonwebtoken) | HMAC validation then JWT for API sessions. 24h expiry. |
| Security headers | helmet (npm) | Content-Security-Policy, X-Frame-Options, etc. |
| Rate limiting | express-rate-limit (npm) | IP-based, in-memory. No Redis required for v1.0. |
| Localisation | i18next + react-i18next | Three languages: Uzbek (uz), Russian (ru), English (en). Auto-detected from Telegram language_code. |
| Deployment | Ubuntu 24 VPS + Nginx + PM2 | Simple, controllable, cost-effective. Min: 2 vCPU / 4 GB RAM (Puppeteer needs headroom). |

---

## 1.10 API Endpoints — v1.0

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | /api/auth/telegram | Public | Validates initData, returns JWT. |
| GET | /api/me | JWT | Current user profile. |
| POST | /api/contracts | JWT | Create draft contract (borrower only). |
| GET | /api/contracts | JWT | List all contracts for current user. |
| GET | /api/contracts/:uuid | JWT | Full contract details. Only participants. |
| POST | /api/contracts/:uuid/photo | JWT | Upload selfie for the requesting participant. |
| POST | /api/contracts/:uuid/lender-confirm | Invite token | Lender confirms. Triggers status → active + PDF generation. |
| POST | /api/contracts/:uuid/witness-confirm/:n | Invite token | Witness n (1–3) confirms. Triggers PDF regeneration. |
| POST | /api/contracts/:uuid/payments | JWT | Lender logs a repayment received. JWT must belong to the lender. |
| GET | /api/contracts/:uuid/payments | JWT | Payment history (authenticated). |
| GET | /public/status/:uuid | Public | Full contract data + all participants + payment history. No login. |
| GET | /public/status/:uuid/pdf | Public | Regenerate + download current PDF with full payment history. |

---

## 1.11 PDF Layout Specification

The PDF is generated from a Handlebars HTML template rendered by Puppeteer. The layout is identical whether generated at contract activation or downloaded from the public page (the public download always regenerates to include the latest payments).

| Section | Content |
|---|---|
| Header | App logo (left) · Contract UUID (right) · "Debt Agreement / Qarz Shartnomasi" centered · creation date. |
| Debt Terms | Total amount · Currency · Monthly repayment · Number of months · Start date · Purpose / description (if provided). |
| Repayment Schedule | Table: Month # / Due Date / Payment Amount / Balance After. Last row shows total. |
| Participants | One block per participant, in this order: Borrower → Lender → Witness 1 → Witness 2 → Witness 3. Each block is a two-column layout. LEFT: Role label (bold), Full name, Patronymic (if provided), Telegram @username, Phone (if provided), Address (if provided), Confirmed: [date or "Pending"]. RIGHT: Selfie photo (400×400, cropped circle) or grey placeholder silhouette if no selfie. |
| Payment History | Table: # / Date / Amount Paid / Note / Running Balance. Shows "No payments logged yet" if empty. |
| Disclaimer | "This document is a formal record of mutual intent between the parties named above. It does not constitute a notarized legal instrument. Consult a qualified lawyer for legal enforcement or dispute resolution." |
| QR Code (bottom) | Centered on the last page. Size: 150×150 px. Caption: "Scan to view live status and download updated PDF". URL: https://yourdomain.com/public/status/{uuid} |

**Critical Puppeteer note:** Inject selfie photos as base64 data URLs directly in the HTML template (`data:image/jpeg;base64,...`). Do NOT use file:// paths — Puppeteer sandbox blocks them. Read each photo with `fs.readFileSync(photoPath)` and convert to base64 before rendering.

---

## 1.12 Non-Functional Requirements

| Requirement | Specification |
|---|---|
| PDF generation time | < 8 seconds per PDF (Puppeteer cold start ~2s + template render ~1s). |
| API response time | < 500ms for all data reads under normal load. |
| App load time | < 3 seconds inside Telegram on 4G. |
| File upload limit | 5 MB per photo. MIME type validated server-side with the file-type npm package (reads magic bytes, not extension). |
| Photo formats accepted | JPEG, PNG, WEBP only. Resize to 400×400 using sharp before storage. |
| Auth tokens | JWT: 24h expiry. Invite tokens: single-use, expire after 30 days. |
| Data backup | pg_dump daily cron. 7-day retention. Test restore before launch. |
| Photo privacy | Selfie photos are shown on the public page. Participants are warned before capture: "This photo will be visible to anyone who scans the QR code." |
| Puppeteer sandbox | Run with --no-sandbox on VPS. Optionally create a dedicated low-privilege user for the Puppeteer subprocess. Validate all template inputs to prevent HTML injection. |
| Rate limiting | Public endpoints: 120 req/hr per IP. Auth endpoints: 20 req/hr per IP. express-rate-limit in-memory. |
| PDF concurrent jobs | Max 2 concurrent Puppeteer PDF jobs (semaphore). Prevents memory spikes on burst requests. |

---

# PART 2 — Step-by-Step Build Roadmap — NomachiBot v1.0

The roadmap is structured so each phase produces something testable before the next phase begins. This is version 1.0, built from zero.

- **Solo developer estimate:** 6–8 weeks
- **With AI pair-programming agent:** 3–4 weeks
- **Rule:** Do not skip phases or merge them — each produces a testable checkpoint.

---

## Phase 1 — Foundation (Days 1–5)

**Goal:** Server reachable · database running · bot responds to /start · HTTPS live.

| # | Task | Details |
|---|---|---|
| 1.1 | Provision VPS | Ubuntu 24 LTS. Min: 2 vCPU, 4 GB RAM (Puppeteer needs headroom). Install: Node 20 (via nvm), PostgreSQL 16, Nginx, PM2, Git, Certbot. |
| 1.2 | Create Telegram Bot | Message @BotFather: /newbot → get BOT_TOKEN. Then /newapp → configure Mini App URL. Store BOT_TOKEN in .env. |
| 1.3 | Backend repo init | `mkdir nomachibot-api && npm init -y && npm install express typescript ts-node prisma @prisma/client jsonwebtoken telegraf multer puppeteer qrcode sharp helmet express-rate-limit dotenv file-type && npx tsc --init` |
| 1.4 | Configure Postgres | Create database 'nomachibot'. Create role 'nomachibot_user' with password. Set DATABASE_URL in .env. |
| 1.5 | Prisma schema | Define all 5 tables from Section 1.8. NOTE: contracts table has NO interest_rate field. Run: `npx prisma migrate dev --name init`. Verify tables created. |
| 1.6 | Hello World API | Express on port 3001. GET /health → `{ status: 'ok', timestamp }`. Deploy with PM2. Nginx reverse proxy. |
| 1.7 | HTTPS certificate | `certbot --nginx -d yourdomain.com`. Telegram requires HTTPS for Mini Apps. Test: `curl https://yourdomain.com/health`. |
| 1.8 | Bot /start command | Telegraf: handle /start → send message with inline button opening Mini App URL. Run as PM2 process. |

**✓ Phase 1 complete when:** HTTPS health check returns 200 and the bot opens the Mini App on /start.

---

## Phase 2 — Authentication (Days 6–9)

**Goal:** Any Telegram user who opens the Mini App gets a valid JWT. Invite token system is designed and tested.

| # | Task | Details |
|---|---|---|
| 2.1 | Frontend repo init | `npm create vite@latest nomachibot-app -- --template react-ts && npm install @tma.js/sdk axios react-router-dom tailwindcss i18next react-i18next react-hot-toast` |
| 2.2 | Telegram SDK init | In App.tsx: import from @tma.js/sdk. Call initMiniApp(). On mount: retrieve startParam — if it contains UUID + role + token, redirect to the appropriate confirmation screen. |
| 2.3 | POST /api/auth/telegram | Backend: parse initData string, validate HMAC-SHA256 against BOT_TOKEN. Reject if hash wrong or auth_date > 3600s ago. Upsert user record. Return signed JWT (24h). |
| 2.4 | JWT middleware | Express middleware: extract Bearer token, verify with jsonwebtoken, attach decoded user to req.user. Apply to all /api/* except /public/*. |
| 2.5 | Invite token design | When a contract is created: generate a cryptographically random 32-byte invite token per role using `crypto.randomBytes(32).toString('hex')`. Store in participants table. Invite link format: `https://t.me/{Bot}/app?startapp={uuid}_{role}_{token}` |
| 2.6 | Test auth | Open Mini App in Telegram. Verify GET /api/me returns your Telegram profile. |

**✓ Phase 2 complete when:** /api/me returns your Telegram user data inside the Mini App.

---

## Phase 3 — Contract Creation UI (Days 10–16)

**Goal:** Borrower can fill the full form, use the real-time calculator, optionally take a selfie, and submit a draft contract.

| # | Task | Details |
|---|---|---|
| 3.1 | Telegram theme + design system | Map CSS variables: var(--tg-theme-bg-color), --tg-theme-text-color, --tg-theme-button-color → Tailwind tokens. Create base components: Button, Input, TextArea, Select, Card, Badge, PhotoCapture. |
| 3.2 | App routing | React Router: / → dashboard, /create → new contract form, /contract/:uuid → detail, /confirm/:uuid/:role/:token → confirmation screen. Back button uses WebApp.BackButton. |
| 3.3 | My Details section (Borrower) | Pre-populate first/last name and Telegram username from JWT. Fields: First name* (pre-filled, editable), Last name* (pre-filled, editable), Patronymic (optional), Phone (optional, +998 prefix default), Address (optional). |
| 3.4 | Lender Details section | Fields: First name*, Last name*, Telegram @username* (borrower types this), Patronymic, Phone, Address. Mark mandatory fields with *. |
| 3.5 | Witnesses section | Collapsible. "Add Witness" button (up to 3 total). Each witness row: First name*, Last name*, @username* inputs. "Remove" icon per witness. Entirely optional — borrower can skip this section. |
| 3.6 | Debt Terms section | Currency selector (UZS / USD / EUR). Total Amount: number input (2 decimal places). Monthly Repayment: number input. NO interest rate field — do not add one. |
| 3.7 | Real-time calculator | TypeScript function: `calcMonths(total: number, monthly: number): number => Math.ceil(total / monthly)`. Call on every onChange of both inputs. Display result in highlighted box: "10 months to repay" + "Last payment: $100.00". Show "—" when monthly is 0 or empty. |
| 3.8 | Repayment preview table | Below the calculator: generate array of `{ month, dueDate, amount, balance }` client-side. Render as scrollable table. Update with each keystroke. |
| 3.9 | Selfie capture (Borrower) | Optional section with camera icon. `<input type="file" accept="image/*" capture="user">`. Show circular preview after capture. Show "Retake" button. Show warning: "This photo will be visible to anyone who scans the QR code." |
| 3.10 | Language selector | UZ / RU / EN switcher visible in the app header. Saves choice to localStorage. Applied to all UI strings via i18next. |
| 3.11 | Submit to backend | POST /api/contracts (JSON: all identity fields, debt terms, witness names, selected language). Then if selfie taken: POST /api/contracts/:uuid/photo (multipart). Show WebApp.MainButton spinner. |
| 3.12 | Backend: save contract | Validate: amounts > 0, monthly <= total, mandatory names present, Telegram usernames format valid. Create contract row (status='pending_lender', language=selected). Create participants rows. Generate invite tokens. Store borrower selfie if provided. |
| 3.13 | Show invite links | After creation: show each invite link with label (Lender, Witness 1, etc.), copy button, Telegram share button. Trigger haptic success feedback. |

**✓ Phase 3 complete when:** Borrower submits form, contract appears in DB with status 'pending_lender', selfie stored, invite links displayed.

---

## Phase 4 — Lender & Witness Confirmation (Days 17–22)

**Goal:** Lender and witnesses can open their invite links, confirm, optionally take selfies, and activate the contract.

| # | Task | Details |
|---|---|---|
| 4.1 | Detect invite link on open | On Mini App launch: parse startParam from @tma.js/sdk retrieveLaunchParams(). If pattern matches {uuid}_{role}_{token}: redirect to /confirm/:uuid/:role/:token. |
| 4.2 | Confirmation screen | Fetch contract summary. Display: role label, all debt terms, repayment schedule, borrower's name. Pre-fill the confirming participant's identity fields from their Telegram account. They can edit first/last name, add patronymic/phone/address. |
| 4.3 | Optional selfie on confirm | Same selfie capture component as Step 3.9. Show same QR visibility warning. Optional. |
| 4.4 | Lender confirm endpoint | POST /api/contracts/:uuid/lender-confirm with body: { token, first_name, last_name, patronymic?, phone?, address? }. Backend: validate token matches participants record for role='lender'. Save details. Save selfie if provided. Update status → 'active'. Trigger PDF generation. |
| 4.5 | Witness confirm endpoint | POST /api/contracts/:uuid/witness-confirm/:n. Same pattern. Does NOT change contract status (witnesses are non-blocking). Triggers PDF regeneration. |
| 4.6 | Success screen | After confirmation: show "Confirmed!" screen with contract UUID, link to public status page, and "Download PDF" button. |

**✓ Phase 4 complete when:** Lender opens invite link in Telegram, confirms, contract status becomes 'active' in DB.

---

## Phase 5 — PDF Generation (Days 23–27)

**Goal:** A correctly structured PDF is generated on lender confirmation and regenerated on each witness confirmation. The PDF matches the layout spec in Section 1.11.

| # | Task | Details |
|---|---|---|
| 5.1 | HTML contract template | Create a Handlebars (.hbs) template file. Sections: header, debt terms, repayment schedule table, participants, payment history, disclaimer, QR code. All styled with inline CSS (Puppeteer renders inline CSS reliably). |
| 5.2 | Participant block layout | Each participant block: a two-column `<div>` with flexbox. Left (70%): text info. Right (30%): circular `<img>` (photo as base64 data URL, or grey placeholder SVG if no photo). Iterate over participants array in order: borrower, lender, witness1, witness2, witness3. |
| 5.3 | QR code generation | `const qrDataUrl = await QRCode.toDataURL('https://yourdomain.com/public/status/' + uuid, { width: 150, margin: 2 })`. Inject as base64 `<img>` src at the bottom of the template. |
| 5.4 | Photos as base64 | Read each participant's photo with `fs.readFileSync(photoPath)`. Convert: `'data:image/jpeg;base64,' + buf.toString('base64')`. Inject into template. Never use file:// URLs — Puppeteer sandbox blocks them. |
| 5.5 | i18n in PDF | The PDF template uses the same i18n keys as the frontend. Load the correct translation file (uz / ru / en) from the contract's language field before rendering the template. |
| 5.6 | Puppeteer render | `const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] })`. Set page content with `await page.setContent(html, { waitUntil: 'networkidle0' })`. `await page.pdf({ path: outputPath, format: 'A4', printBackground: true })`. Close browser. |
| 5.7 | PDF service module | Wrap PDF logic in a PdfService class with generateContractPdf(uuid) and a semaphore (max 2 concurrent jobs). Prevents memory spikes. |
| 5.8 | Store + serve PDF | Save to /var/data/nomachibot/contracts/{uuid}/agreement.pdf. Update pdf_path in contracts table. Both /api/contracts/:uuid/pdf (auth) and /public/status/:uuid/pdf (public) serve this file. Public endpoint regenerates first. |
| 5.9 | Test PDF output | Generate a test contract with: 2 participants with selfies, 1 witness without selfie, 2 logged payments. Verify PDF layout matches Section 1.11 exactly. Print physically and scan QR code. |

**✓ Phase 5 complete when:** PDF has all sections, QR is scannable, photos appear next to participant info, placeholder appears for participants without selfies, PDF is in the correct language.

---

## Phase 6 — Public Status Page (Days 28–32)

**Goal:** Anyone who scans the QR code can view full contract data, all payments, and download an updated PDF — without logging in.

| # | Task | Details |
|---|---|---|
| 6.1 | GET /public/status/:uuid | No auth. Returns full JSON: contract terms, all participants (name, phone, address, selfie URL if available), repayment schedule, full payment history, contract status. Rate limit: 120/hr per IP. |
| 6.2 | Selfie access on public page | Photos are shown on public page because participants consented at capture. Serve via GET /public/photos/:uuid/:role — validates contract exists, no auth required. |
| 6.3 | Public page React route | Route: /public/status/:uuid. No JWT required. Fetches from API. Shows: status badge, debt terms, progress bar, all participant blocks (photo + info layout matching PDF), payment history table, Download PDF button. |
| 6.4 | GET /public/status/:uuid/pdf | No auth. Calls PdfService.generateContractPdf(uuid) — always regenerates to include latest payments. Returns file with Content-Disposition: attachment. |
| 6.5 | Mobile responsive design | Tailwind responsive classes. Participant photos: circular, max 120px on mobile. Payment history table: horizontally scrollable on small screens. |
| 6.6 | End-to-end QR test | Print or display a generated PDF. Scan QR with a phone. Verify status page loads with correct data. Tap Download PDF. Open downloaded file and verify it matches the page content including latest payments. |

**✓ Phase 6 complete when:** Scanning the QR opens the status page, Download PDF works, no login required.

---

## Phase 7 — Repayment Logging (Days 33–36)

**Goal:** Lender can log repayments as they are received. Balance updates. Public page and PDF reflect each payment. Borrower is notified.

| # | Task | Details |
|---|---|---|
| 7.1 | Contract detail screen | Tabs: Overview / Schedule / Payments. Overview: status badge, amounts, next due date. Schedule: all installments with status colours (paid=green, overdue=red, pending=grey). Payments: full history. |
| 7.2 | Log payment modal | Only shown to LENDER. Fields: Date (default today), Amount (default next installment amount), Note (optional). Submit → POST /api/contracts/:uuid/payments. Backend validates: requesting JWT belongs to the lender of this contract. |
| 7.3 | Backend: process payment | Validate: requesting user is the lender of this contract (check participants table), amount > 0, contract is active, date is not in the future. Insert payment row. Compute running_balance = previous_balance − amount. If running_balance <= 0: update contract status → 'settled', notify all participants. |
| 7.4 | Overdue detection | PM2 cron (daily 09:00 server time): find contracts where status='active' AND sum of payments for current period < expected. Mark overdue. Send bot notification to borrower and lender. |
| 7.5 | Bot notifications | On payment logged: bot sends message to BORROWER — "Lender recorded a payment of [amount] on [date]. Remaining balance: [balance]". On contract settled: notify all participants. |

**✓ Phase 7 complete when:** Lender logs a payment, balance updates on public page, borrower receives Telegram notification, PDF download reflects the payment.

---

## Phase 8 — Dashboard, Polish & Localisation (Days 37–44)

| # | Task | Details |
|---|---|---|
| 8.1 | Dashboard | Three tabs: Borrowing / Lending / Witnessing. Contract cards: counterparty name, role badge, status, remaining balance. Empty state with illustration. Tap → contract detail. |
| 8.2 | Theme integration | Read WebApp.colorScheme and WebApp.themeParams. Call WebApp.setHeaderColor() and WebApp.setBackgroundColor(). Full dark/light mode support. |
| 8.3 | Haptic feedback | WebApp.HapticFeedback: impact on button presses, notification on confirmation, error on validation failures, selection on tab switches. |
| 8.4 | Three-language localisation | i18next: create uz.json, ru.json, en.json. Translate all UI strings, error messages, and PDF template labels. Language detection order: (1) user's saved preference, (2) Telegram WebApp language_code, (3) fallback to English. Add visible UZ / RU / EN switcher in app header. Contract's language stored in DB and used for all its PDF generations. |
| 8.5 | Error handling | Axios interceptor catches all API errors → react-hot-toast notification in the active language. Never show raw error strings to users. Log errors server-side with context (uuid, user_id, route). |
| 8.6 | Manual QA | Full journey test on Android + iOS Telegram: borrower creates contract with 1 witness → share lender link → lender confirms on different device → witness confirms → download PDF → scan QR → lender logs payment → QR page updates → borrower receives notification → download updated PDF. |

**✓ Phase 8 complete when:** Full journey works on both platforms, language switcher works for all three languages, dark and light themes work correctly.

---

## Phase 9 — Security Hardening & Launch (Days 45–50)

| # | Task | Details |
|---|---|---|
| 9.1 | Environment audit | All secrets in .env (never committed). Use dotenv-safe to enforce required vars at startup. .gitignore includes .env. |
| 9.2 | File upload security | multer + file-type package: validate MIME type from file bytes (not extension). 5 MB limit. Store outside webroot. Serve via dedicated endpoint, never by guessable static URL. |
| 9.3 | Invite token expiry | Invite tokens expire after 30 days or first use (whichever comes first). Store used_at in participants table. Reject already-used tokens. |
| 9.4 | Helmet + CORS | app.use(helmet()). CORS: allow only your Mini App domain and Telegram domains. Never origin: '*' in production. |
| 9.5 | HTML injection prevention | Escape all user-supplied strings before injecting into Puppeteer HTML template. Handlebars auto-escapes all {{variable}} expressions. Never use triple-brace {{{variable}}} with user content. |
| 9.6 | Database backups | pg_dump daily cron to /var/backups/nomachibot/. 7-day retention. Run a manual restore test before going live. |
| 9.7 | Monitoring | UptimeRobot (free): monitor /health every 5 minutes. Alert if down. PM2 logs with daily rotation. Disk usage alert via cron if > 80% capacity. |

**✓ Phase 9 complete when:** Security checklist passes, backups verified, monitoring active, app is live.

---

## Post-v1.0 Roadmap

Start these only after v1.0 is live and being actively used. Do not build them in advance.

### Phase 2 — Biometric Hardening (After 100+ active users)

1. Deploy CompreFace on the same VPS via Docker Compose.
2. At confirmation: send each participant's selfie to CompreFace for face vector extraction. Store vector in participants table.
3. At payment logging: prompt a quick selfie from the LENDER. Compare against stored vector (CompreFace /recognize). Reject if confidence < 90%.
4. Add MediaPipe Face Mesh (Google, actively maintained, browser-compatible) for simple liveness: require one blink before accepting selfie.
5. Add automated Telegram bot reminders: notify borrower N days before each installment due date.

### Phase 3 — AI Document Parsing (After 500+ active users)

1. Add collateral attachment upload (PDFs, photos) to active contracts.
2. Deploy PaddleOCR as a Python Docker sidecar. Expose a single /ocr POST endpoint.
3. On attachment upload: send to OCR → extract text → store in contract_attachments table with full-text search index.
4. Show extracted key information in the contract detail screen.

---

# Appendix A — Quick Reference

## A.1 npm Packages (Full v1.0 List)

| Package | Version | Purpose |
|---|---|---|
| express | ^4.19 | Web framework |
| prisma + @prisma/client | ^5.x | Database ORM + migrations |
| telegraf | ^4.x | Telegram bot framework |
| @tma.js/sdk | latest | Official Telegram Mini App SDK (frontend) |
| jsonwebtoken | ^9.x | JWT auth tokens |
| puppeteer | ^22.x | PDF generation from HTML template |
| qrcode | ^1.5 | QR code PNG / base64 data URL generation |
| sharp | ^0.33 | Selfie photo resizing to 400×400 px |
| multer | ^1.4 | Multipart file upload handling |
| file-type | ^19.x (ESM) | Server-side MIME type validation (reads magic bytes) |
| handlebars | ^4.x | HTML template engine for PDF (auto-escapes user content) |
| helmet | ^7.x | HTTP security headers |
| express-rate-limit | ^7.x | IP-based rate limiting (in-memory, no Redis) |
| dotenv + dotenv-safe | ^16.x | Environment variable management |
| i18next + react-i18next | ^23.x | Three-language localisation: Uzbek (uz), Russian (ru), English (en) |
| react-hot-toast | ^2.x | Toast notifications in Mini App |
| crypto (Node built-in) | built-in | Generate invite tokens: crypto.randomBytes(32).toString('hex') |

## A.2 Environment Variables

| Variable | Description |
|---|---|
| DATABASE_URL | PostgreSQL connection string |
| BOT_TOKEN | Telegram Bot token from @BotFather |
| JWT_SECRET | Random 256-bit string. Generate: openssl rand -hex 32 |
| MINI_APP_URL | Your Mini App public URL (for invite links) |
| PUBLIC_BASE_URL | Your API / public domain (for QR code URLs) |
| STORAGE_PATH | Absolute path for file storage, e.g. /var/data/nomachibot |
| PORT | API server port (default 3001) |

## A.3 Key Business Rules — Complete Summary

| Rule | Specification |
|---|---|
| Who initiates the contract | BORROWER only |
| Who confirms the contract | LENDER (required) + Witnesses (optional, non-blocking) |
| Who logs repayments | LENDER only — records payments as they are received from the borrower |
| Interest rate | NONE. Not calculated, not stored, not displayed anywhere in the app. |
| Months formula | Math.ceil(total_amount / monthly_amount). Client-side, real-time, no API call. |
| Mandatory identity fields | First name, last name, Telegram ID — for every participant. |
| Optional identity fields | Patronymic, phone, address, selfie — for every participant. |
| Maximum witnesses | 3 witnesses. All optional. |
| Witness blocking | Witnesses do NOT block contract activation. Lender confirmation is sufficient. |
| PDF selfie placement | Each participant's selfie is displayed directly beside their info block. Grey placeholder if no selfie. |
| QR code placement in PDF | AT THE BOTTOM of the last page. |
| Public access | Anyone with QR sees all contract data and payments. No login required. |
| PDF download | Available from public page. Regenerated on every download to include latest payments. |
| Contract language | Set by borrower at creation (uz / ru / en). Stored in contracts.language. All PDF regenerations use this language. |
| App language | Set by user preference, detected from Telegram language_code, or chosen via UZ / RU / EN switcher in header. Independent from contract language. |

## A.4 Known Risks and Mitigations

| Risk | Probability | Mitigation |
|---|---|---|
| Camera input broken on older iOS/Telegram | Medium | Native `<input capture="user">` bypasses WebView camera API entirely. Works on iOS 16+. |
| Puppeteer memory spike on PDF burst | Medium | Semaphore: max 2 concurrent PDF jobs. Add 1 GB swap on VPS. |
| User uploads malicious file as selfie | High | Validate MIME type via file-type (reads magic bytes, not extension). Allow only jpeg/png/webp. |
| HTML injection via user-supplied fields into PDF | Medium | Handlebars auto-escapes all {{variable}} expressions. Never use {{{variable}}} with user content. |
| Invite token reuse attack | Low | Tokens are single-use. Mark used_at on first use. Reject any subsequent use of the same token. |
| Disk fills with PDFs and photos | Low (initially) | ~500 KB per contract. 10,000 contracts ≈ 5 GB. Monitor disk via cron alert at 80% capacity. |
| Legal challenge on contract validity | Medium | PDF disclaimer states this is a record of intent. Do not market as a notarized document. Consult a local lawyer before launch. |
