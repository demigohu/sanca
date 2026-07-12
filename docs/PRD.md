# Sanca — Product Requirements Document (PRD)

> **Versi:** 1.1  
> **Tanggal:** 8 Juli 2026  
> **Status:** Active — APAC Stellar Hackathon 2026  
> **Track:** DeFi & Ecosystem Composability ($20,000)  
> **Deadline submission:** 15 Juli 2026  
> **Demo Day:** 18 Juli 2026  
> **Grand Finale:** 24 Juli 2026  

---

## Daftar Isi

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement & Opportunity](#2-problem-statement--opportunity)
3. [Vision, Mission & Positioning](#3-vision-mission--positioning)
4. [Goals & Success Metrics](#4-goals--success-metrics)
5. [Target Users & Personas](#5-target-users--personas)
6. [Scope Definition](#6-scope-definition)
7. [Product Overview & Core Mechanics](#7-product-overview--core-mechanics)
8. [Functional Requirements](#8-functional-requirements)
9. [Non-Functional Requirements](#9-non-functional-requirements)
10. [System Architecture](#10-system-architecture)
11. [Smart Contract Requirements](#11-smart-contract-requirements)
12. [Backend Services Requirements](#12-backend-services-requirements)
13. [Frontend Requirements](#13-frontend-requirements)
14. [Integration Requirements](#14-integration-requirements)
15. [Data Model & Events](#15-data-model--events)
16. [UX & Accessibility Requirements](#16-ux--accessibility-requirements)
17. [Economics & Parameters](#17-economics--parameters)
18. [Security Requirements](#18-security-requirements)
19. [Testing Strategy](#19-testing-strategy)
20. [Deployment & Environments](#20-deployment--environments)
21. [Hackathon Deliverables](#21-hackathon-deliverables)
22. [Implementation Roadmap](#22-implementation-roadmap)
23. [Post-Hackathon Roadmap](#23-post-hackathon-roadmap)
24. [Risks & Mitigations](#24-risks--mitigations)
25. [Team & RACI](#25-team--raci)
26. [Acceptance Criteria (Definition of Done)](#26-acceptance-criteria-definition-of-done)
27. [Appendix](#27-appendix)

---

## 1. Executive Summary

**Sanca** adalah aplikasi tabungan komunitas (arisan / ROSCA) yang terasa seperti aplikasi web2, tetapi berjalan di atas Stellar smart contracts. User login dengan email/social, top up dan cash out dengan fiat via Coridor, ikut savings circle, dan otomatis mendapat yield dari DeFindex vault. Pemenang setiap periode dipilih secara adil dengan drand verifiable randomness.

**Tagline:** *"Community savings that composes Stellar DeFi — DeFindex yield, drand fairness, ecosystem integrations."*

**One-sentence pitch (submission):**

> Sanca is a composable consumer ROSCA on Stellar — wiring Privy wallets, fee-bump relayers, DeFindex yield vaults, Coridor ramps, and drand verifiable randomness into one savings-circle protocol without rebuilding DeFi from scratch.

### Status Proyek (8 Juli 2026)

| Komponen | Status | Catatan |
|----------|--------|---------|
| `sanca_pool` smart contract | ✅ Done | 22 unit tests; BLS drand on-chain; settle baca keeper dari factory |
| `sanca_factory` smart contract | ✅ Done | `set_keeper` / `get_keeper` (admin); `yield_split_bps` platform-wide (default 9000) |
| DeFindex vault integration | ✅ Done | Pool holds dfTokens; `MemberVaultShares` per member |
| Keeper service | ✅ Done | Satu proses: `factory.get_all_pools()` → settle semua pool; `npm run set-keeper` |
| Full testnet lifecycle script | ✅ Done | Factory keeper + join → settle → liquidation → withdraw |
| Relayer / fee-bump service | ✅ Done | Express POST `/relay`; method whitelist; factory pool registry |
| Frontend (Next.js root) | 🟡 In progress | Privy + Soroban hooks; circles/dashboard/profile |
| Privy embedded wallet | ✅ Done | Login email/social; Stellar embedded wallet; relayer signing |
| Coridor Ramps | ✅ Done | `/topup`, `/cashout`, SEP-10/24, Blend USDC |
| MoonPay Ramps | 📦 Archived | Geo-block Indonesia; `_archive/moonpay/` (local only) |
| Demo video & pitch deck | ❌ Not started | Due ~14 Juli |

> **Redeploy wajib** setelah refactor keeper + yield split (factory WASM baru). Pool lama tidak compatible.

### Progress log (6 Juli 2026)

**Migrasi & struktur repo**
- ✅ Pindah `contracts/`, `keeper/`, `relayer/` ke root (hapus nested `sanca/sanca`, legacy EVM dead code)
- ✅ Root Next.js UI tetap; backend subfolder terpisah
- ✅ Env: `.env.local` (frontend), `keeper/.env`, `relayer/.env`

**Smart contracts**
- ✅ Keeper **factory-level**: `factory.set_keeper` (admin) → semua pool pakai keeper yang sama saat `settle_cycle`
- ✅ Hapus `pool.set_keeper` per creator
- ✅ `yield_split_bps` **factory constant** (constructor default 9000); hapus dari `create_pool` args
- ✅ `create_pool` require factory keeper sudah di-set (`NoKeeper`)

**Frontend Stellar**
- ✅ `lib/stellar.ts`, `lib/pool.ts`, hooks: `usePools`, `useCreatePool`, `useJoinPool`, `useContribute`, `useWithdraw`, `useContractInvoke`
- ✅ Privy provider + wallet connect
- ✅ Halaman: landing, onboarding, circles, dashboard, profile, keeper status
- ✅ Fix circles load: `NEXT_PUBLIC_SIMULATION_SOURCE` (G-address untuk simulate read)
- ✅ Create circle: tanpa yield split input (platform 90%)

**Backend services**
- ✅ Keeper: discover pools dari factory, bukan `POOL_ADDRESS` per pool
- ✅ Relayer: fee-bump inner tx dari Privy wallet

**Coridor (fiat ramp — primary)**
- ✅ `/topup`, `/cashout`, `lib/coridor/*`, `hooks/useCoridorRamp`
- ✅ SEP-10 auth + SEP-24 interactive iframe (`api.coridor.fun`)
- ✅ Withdraw auto-send Blend USDC + memo via relayer
- ✅ Same USDC issuer as Sanca pools — no swap after top-up

**MoonPay (archived — local only)**
- 📦 `_archive/moonpay/` — geo-block Indonesia

**Belum / perlu setelah redeploy kamu**
- 🔲 Update `NEXT_PUBLIC_FACTORY_ADDRESS` ke factory baru
- 🔲 `factory.set_keeper` + fund keeper wallet
- 🔲 E2E demo: create → join → contribute → keeper settle → withdraw
- 🔲 Demo video & pitch deck

> **Backend sudah selesai.** Keeper + relayer = seluruh backend off-chain Sanca.

> **Coridor live:** anchor at `sep.coridor.fun` · widget `api.coridor.fun` · sandbox: Simulate di widget.

### Progress log (11 Juli 2026)

**Ramp pivot: MoonPay → Coridor (self-hosted anchor)**
- ✅ `lib/coridor/` SEP-10/24 + interactive widget
- ✅ Blend USDC only — top-up langsung bisa join arisan
- ✅ Relayer allows Blend USDC payments (Coridor withdraw)
- ✅ `www.sanca.space` added to Coridor `clients.yaml`

### Tim

| Role | Fokus |
|------|-------|
| **Developer A** (smart contract + backend) | Contracts, keeper, relayer, Privy signing flow, Coridor SEP-10/24 |
| **Developer B** (frontend) | Port UI Sanca lama → Stellar + Privy, halaman user-facing |

---

## 2. Problem Statement & Opportunity

### 2.1 Masalah

Di Indonesia dan APAC, **arisan** (ROSCA) adalah mekanisme tabungan komunitas yang sudah ada ratusan tahun:

- Kelompok kecil (5–20 orang) setor fixed amount setiap periode (minggu/bulan).
- Satu orang per periode menerima **seluruh pot** (prize).
- Urutan penerima bisa diundi atau disepakati.

**Pain points arisan tradisional:**

| Pain Point | Dampak |
|------------|--------|
| Organizer bisa kabur dengan dana | Kepercayaan rendah |
| Tidak ada enforcement kontribusi | Satu member default, semua rugi |
| Dana idle tidak menghasilkan | Opportunity cost |
| Undian tidak transparan | Curiga manipulasi |
| Cash-only, tidak ada jejak | Sulit audit |
| Onboarding crypto rumit | User non-web3 tidak bisa pakai |

### 2.2 Peluang Stellar + Hackathon

| Faktor | Mengapa Sanca cocok |
|--------|---------------------|
| **Real-world fit (25%)** | Arisan = primitif keuangan nyata APAC |
| **Stellar strengths** | SAC USDC, DeFindex composability, fee-bump, fast settlement |
| **Coridor** | Fiat on/off-ramp untuk user non-crypto (IDR via VA/QRIS/OVO → Blend USDC) |
| **Privy** | Email/social login tanpa seed phrase |
| **DeFindex** | Yield otomatis tanpa buat vault sendiri |
| **drand** | Randomness verifiable, fair winner selection |

### 2.3 Competitive Differentiation

Sanca **bukan** generic DeFi vault atau payment app. Kombinasi unik:

1. ROSCA lifecycle lengkap on-chain (collateral lock → cycles → liquidation → withdraw)
2. Yield-bearing collateral via DeFindex (bukan idle cash)
3. drand VRF untuk shuffle winner order
4. Web2 UX: Privy + relayer + Coridor (user tidak perlu XLM atau seed phrase)
5. Positioning lokal: arisan Indonesia, saldo IDR, Bahasa Indonesia

---

## 3. Vision, Mission & Positioning

### 3.1 Vision

Menjadi platform tabungan komunitas terpercaya di APAC — di mana komunitas lokal bisa menabung bersama, menghasilkan yield, dan menerima payout secara adil, tanpa perlu memahami blockchain.

### 3.2 Mission (Hackathon)

Membuktikan bahwa arisan on-chain di Stellar bisa:

- **Berjalan end-to-end** di testnet
- **Terasa seperti app web2** (login email, top up fiat, tanpa gas fee)
- **Menggunakan ekosistem Stellar secara dalam** (Soroban, SAC, DeFindex, fee-bump, drand)

### 3.3 Positioning untuk Juri

| Aspek | Pesan ke juri |
|-------|---------------|
| Track | DeFi & Ecosystem Composability |
| User | Komunitas arisan APAC — plus developer/juri yang menilai composability ke DeFindex, SAC, drand |
| Problem | ROSCA butuh yield + enforcement; DeFi butuh consumer utility di luar crypto natives |
| Solution | Composable ROSCA: pool contract + DeFindex vault + drand + wallet + ramp |
| Composability | DeFindex vault, Coridor ramp, Privy wallet, drand, Soroban factory/pool |
| Demo | Full flow: login → top up → join → contribute → settle (yield bonus) → withdraw |

---

## 4. Goals & Success Metrics

### 4.1 Primary Goals (Hackathon)

| # | Goal | Measurable Success |
|---|------|-------------------|
| G1 | Smart contract production-ready di testnet | Full lifecycle pass, ≥21 unit tests, BLS + liquidation E2E |
| G2 | Full E2E demo di testnet | 1 user journey tanpa error di demo path |
| G3 | Web2 UX | Login email, no seed phrase, no XLM required |
| G4 | Coridor integration | Live widget **atau** mock flow yang meyakinkan |
| G5 | Submission materials | Video ≤5 min, README, pitch deck, repo public |

### 4.2 Secondary Goals

| # | Goal | Measurable Success |
|---|------|-------------------|
| G6 | Keeper auto-settlement | Pool settle otomatis saat cycle end |
| G7 | IDR display | Saldo & contribution ditampilkan dalam IDR |
| G8 | Multi-pool support | User bisa browse & join pool yang berbeda |

### 4.3 Judging Criteria Mapping

| Kriteria | Bobot | How Sanca Delivers | Target Score |
|----------|-------|-------------------|--------------|
| Technical + Stellar usage | 25% | Soroban factory/pool, DeFindex cross-contract, on-chain BLS drand, fee-bump relayer | High |
| Real-world fit | 25% | ROSCA/arisan APAC; stablecoin savings with real DeFindex yield | High |
| Innovation | 20% | Yield-bearing composable ROSCA + drand + relayer + embedded wallet; not a clone vault | High |
| UX & accessibility | 5% | Email login, IDR, no crypto jargon | Medium-High |
| Viability & GTM | 10% | Pilot komunitas, revenue dari yield fee | Medium |
| Team & continue | 5% | Codebase substantial, roadmap jelas | Medium |

### 4.4 KPI Demo Day

| KPI | Target |
|-----|--------|
| Demo duration | ≤5 menit live |
| Demo failure rate | 0% pada happy path |
| Contract calls shown | create_pool, join, contribute, settle_cycle, withdraw |
| Integrations shown | Privy login, relayer (no XLM), DeFindex yield, Coridor top-up |
| Unique selling moment | "User menang cycle + dapat yield bonus" |

---

## 5. Target Users & Personas

### 5.1 Primary Persona: **Sari — Ibu Komunitas**

| Attribute | Detail |
|-----------|--------|
| Usia | 32 |
| Lokasi | Yogyakarta, Indonesia |
| Crypto literacy | Zero — tidak tahu XLM, wallet, seed phrase |
| Behavior | Sudah ikut arisan RT 5 tahun, setor Rp 100.000/minggu |
| Goal | Menabung teratur, dapat giliran payout, tidak dirugikan |
| Pain | Takut organizer kabur, lupa setor, undian curang |
| Device | Android, mobile web |

**User story:** Sari login dengan Google, top up Rp 500.000 via Coridor, join circle "Arisan RT 05" (10 member × Rp 50.000/minggu), contribute otomatis setiap minggu, menang di minggu ke-3 dan dapat payout + bonus yield.

### 5.2 Secondary Persona: **Budi — Circle Creator**

| Attribute | Detail |
|-----------|--------|
| Usia | 28 |
| Role | Admin komunitas online (Discord/Telegram) |
| Goal | Buat savings circle untuk komunitas, enforce rules |
| Pain | Sulit track siapa sudah bayar, sulit enforce default |

**User story:** Budi buat circle baru (10 member, Rp 100.000/minggu, periode 7 hari), share link ke grup, monitor progress di dashboard.

### 5.3 Tertiary Persona: **Juri / Investor**

| Attribute | Detail |
|-----------|--------|
| Goal | Evaluasi technical depth, real-world fit, viability |
| Needs | Live demo, clear architecture, working testnet contracts |

---

## 6. Scope Definition

### 6.1 In Scope (Hackathon — MUST SHIP)

| Area | Deliverable |
|------|-------------|
| Smart contracts | `sanca_factory`, `sanca_pool` di testnet |
| DeFindex | Collateral deposit, yield calculation, redeem on settle |
| drand | Keeper fetch + **on-chain BLS12-381 verify** (CAP-0059) + Fisher-Yates shuffle |
| Keeper | Auto `settle_cycle` when cycle ends |
| Relayer | Fee-bump untuk user tx (join, contribute, withdraw, create_pool) |
| Privy | Email/social login, embedded Stellar wallet, sign inner tx |
| Frontend | Port UI lama: landing, dashboard, circle detail, create/join/contribute |
| Coridor | SEP-10/24 top-up & cash-out + iframe widget (live **or** mock) |
| Demo | Full E2E testnet demo + video |
| Docs | README, architecture, setup guide |

### 6.2 In Scope (SHOULD SHIP jika waktu memungkinkan)

| Area | Deliverable |
|------|-------------|
| Indexer | Simple event polling via RPC `getEvents` |
| IDR conversion | Display amounts in IDR with live/mock rate |
| Activity history | Contribution & payout timeline per user |
| Notifications | In-app toast saat cycle settled / user menang |

### 6.3 Out of Scope (Hackathon)

| Item | Reason |
|------|--------|
| Mainnet deployment | Testnet only for hackathon |
| Passkey smart accounts | Post-hackathon roadmap |
| **SAC receipt token (sPSP per pool)** | Post-hackathon — see §7.6; `MemberVaultShares` + app UI sufficient for web2 |
| Custom DeFindex vault | Use existing PaltaLabs testnet vault |
| Multi-asset pools (non-USDC) | Complexity; USDC only |
| AI keeper / volatility rebalancing | Future feature |
| Mobile native app | Mobile web sufficient |
| KYC/AML beyond Coridor anchor | Delegate to anchor / payment partner |
| SubQuery indexer | Overkill for hackathon |
| Multi-language (beyond ID + EN) | ID primary, EN for juri |

---

## 7. Product Overview & Core Mechanics

### 7.1 Apa itu Savings Circle (ROSCA)?

```
10 member × Rp 100.000/minggu = Rp 1.000.000 pot per minggu
Minggu 1: Member A menang → terima Rp 1.000.000
Minggu 2: Member B menang → terima Rp 1.000.000
...
Minggu 10: Member J menang → terima Rp 1.000.000
Total per member: setor Rp 1.000.000, terima Rp 1.000.000 (net zero + yield bonus)
```

### 7.2 Sanca ROSCA Lifecycle

```
┌─────────┐    all members join     ┌─────────┐
│  OPEN   │ ──────────────────────▶ │ ACTIVE  │
│         │    (collateral locked   │         │
│         │     → DeFindex vault)   │         │
└─────────┘                         └────┬────┘
                                         │
                    ┌────────────────────┼────────────────────┐
                    │  Per cycle:        │                    │
                    │  1. contribute     │                    │
                    │  2. settle_cycle   │                    │
                    │  3. winner payout  │                    │
                    └────────────────────┼────────────────────┘
                                         │
                              all cycles done
                                         │
                                         ▼
                                   ┌───────────┐
                                   │ COMPLETED │
                                   │ withdraw  │
                                   │ collateral│
                                   └───────────┘
```

### 7.3 Collateral Model

Saat **join**, member lock:

```
collateral = contribution_per_period × max_members
```

Contoh: 10 member, 5 USDC/minggu → collateral = 50 USDC per member.

- Collateral langsung dideposit ke **DeFindex vault** → earn yield.
- Jika member **miss contribution**, collateral dilikuidasi untuk cover missing amount.
- Setelah pool **completed**, member **withdraw** sisa collateral + compounded yield.

### 7.4 Winner Selection

1. Saat pool penuh → state = **Active**.
2. Saat **first settle_cycle**, member list di-shuffle dengan drand randomness (Fisher-Yates).
3. Urutan disimpan sebagai `WinnerOrder`.
4. Cycle N → winner = `WinnerOrder[N]`.
5. Tidak ada randomness baru per cycle — urutan sudah fixed setelah shuffle pertama.

### 7.5 Yield Model

| Parameter | Default | Arti |
|-----------|---------|------|
| `yield_split_bps` | 9000 (90%) | **Factory config** — % available yield → winner cycle ini; sisanya compound untuk semua |
| `platform_fee_bps` | 1000 (10%) | % yield bonus → platform |
| Remaining 10% yield | — | Tetap di vault, compound untuk semua member saat withdraw |

**Winner receives:** `prize + (yield_bonus × (1 - platform_fee_bps))`  
**Platform receives:** `yield_bonus × platform_fee_bps`  
**All members benefit:** compounded yield di vault saat withdraw

### 7.6 DeFindex Custody & Vault Share Accounting

**Two-layer model** (hackathon implementation):

```
Member --USDC--> SancaPool --deposit()--> DeFindex Vault
                                              │
                                              ▼
                                    dfToken minted to POOL contract (not user wallet)
```

| Layer | Representation | Holder |
|-------|----------------|--------|
| DeFindex | dfToken (vault share token) | Pool contract address |
| Sanca | `MemberVaultShares` (on-chain `Map<Address, i128>`) | Per-member ledger inside pool |

**Why not transfer dfToken to users?** ROSCA requires pooled custody, liquidation, and proportional yield redeem — easier with one vault depositor (the pool) and an internal cap table.

**Operations:**

| Event | Share accounting |
|-------|-------------------|
| `join()` | `MemberVaultShares[member] += shares`; deposit to DeFindex |
| Liquidation (missed contribute) | Redeem from vault; deduct **only defaulter's** shares (`ShareDeduction::Member`) |
| Yield paid to winner | Redeem from vault; deduct **proportionally** from all members (`ShareDeduction::Proportional`) |
| `withdraw()` | Member redeems **their own** `MemberVaultShares` (not equal split) |

**Post-hackathon — SAC receipt token (sPSP):** Optional wrapper SAC minted to user wallet on `join()`, burned on `withdraw()` / liquidation. Gives wallet visibility and composability without changing DeFindex custody model. **Not required for hackathon** — frontend reads `get_member_vault_shares` + vault PPS for display.

### 7.7 Cycle Timing & Keeper Settlement Semantics

> **Status:** Documented behavior (on-chain v1). UX clarity = **P1 hackathon**; fixed absolute schedule = **post-hackathon**.

#### 7.7.1 On-chain behavior (current)

Cycle timing di `sanca_pool` **bukan jadwal absolut per cycle**. Satu pasang timestamp:

| Field | Arti |
|-------|------|
| `cycle_start_time` | Mulai cycle **saat ini** |
| `period_duration` | Durasi cycle (detik, UI input hari × 86_400) |
| `get_cycle_end_time()` | `cycle_start_time + period_duration` |

Saat **`settle_cycle` sukses**, contract:

1. Menyelesaikan cycle N (winner, liquidation, yield bonus).
2. `current_cycle += 1`.
3. **`cycle_start_time = env.ledger().timestamp()`** (waktu settle, bukan deadline semula).
4. `last_drand_round = drand_round` (monotonic).

**Implikasi:** Cycle berikutnya **selalu mulai dari momen settle**, bukan dari kapan cycle seharusnya berakhir. Telat settle = **seluruh timeline geser ke depan**.

**Contoh:**

| Event | Waktu |
|-------|--------|
| Pool full → cycle 0 mulai | Senin 10:00 |
| Cycle 0 seharusnya settle (`cycle_end`) | Selasa 10:00 (1 day) |
| Keeper offline | Selasa–Kamis |
| Cycle 0 **baru** settle | Kamis 14:00 |
| **Cycle 1 mulai** | **Kamis 14:00** (bukan Selasa 10:00) |
| Cycle 1 settle (keeper on) | Jumat 14:00 |

#### 7.7.2 Keeper uptime & catch-up

| Pertanyaan | Jawaban |
|------------|---------|
| Keeper harus on 24/7? | **Production: ya** (VPS/systemd). Dev/demo: boleh off, tapi pool **pause** sampai settle. |
| Cycle lewat tapi keeper off — hilang? | **Tidak.** Cycle **tidak advance** tanpa `settle_cycle`. Saat keeper on lagi → settle **catch-up**. |
| Langsung settle pas on? | **Ya**, pada poll pertama (~`POLL_INTERVAL_MS`, default 15s) jika: pool **Active**, `now >= cycle_end_time`, drand round > `last_drand_round`, dan `factory.get_keeper()` = keeper wallet. |
| Bisa settle banyak cycle telat sekaligus? | **Tidak.** Satu tx = **satu cycle**. Setelah settle, cycle baru + tunggu `period_duration` lagi (kecuali period sudah lewat karena edge case timing). |
| Expiry deadline settle? | **Tidak ada** — cycle yang overdue tetap bisa di-settle kapan saja. |

**Drand:** Keeper pakai **latest** quicknet beacon; contract hanya minta round **strictly increasing** + BLS valid — catch-up tidak butuh round historis.

**Prasyarat settle (selain keeper):** Semua member ideally sudah `contribute()`; yang miss → **liquidation** collateral (bukan abort settle).

#### 7.7.3 UX ambiguity (known product issue)

User expectation (web2 arisan):

> "Cycle 1 hari = Senin–Selasa, Rabu–Kamis, …" (jadwal **fixed**)

On-chain reality:

> "Cycle 1 hari = **dari settle terakhir** + 1 hari"

Tanpa penjelasan UI, countdown / "Created" / cycle labels terasa **ambigu** — terutama jika keeper telat atau off.

**Hackathon UX requirements (P1):**

| UI state | Kondisi | Copy (ID) contoh |
|----------|---------|------------------|
| **Cycle active** | `now < cycle_end_time` | Countdown ke akhir periode |
| **Settlement pending** | `now >= cycle_end_time` && pool Active | "Periode selesai — menunggu keeper mengundi pemenang" |
| **Cycle advanced** | Setelah event `cycle_end` | Tampilkan cycle baru + `cycle_start` aktual |

**Tampilkan dua konsep waktu di circle detail (P1):**

1. **Scheduled end** — `cycle_start + period_duration` (deadline kontribusi / periode).
2. **Actual timeline** — catatan bahwa cycle berikutnya dimulai **setelah settlement**, bukan otomatis di jadwal kalender.

**Jangan:** countdown negatif diam-diam; jangan tampilkan "over 56 years ago" untuk timestamp `0` (pool Open belum start).

#### 7.7.4 Post-hackathon protocol options

| Approach | Behavior | Trade-off |
|----------|----------|-----------|
| **A. Fixed schedule (recommended v2)** | `cycle_end[i] = pool_start + (i+1) × period` — settle boleh telat, cycle index tetap; UI jadwal tidak geser | Lebih kompleks di contract; perlu definisi overlap / grace |
| **B. Grace + events** | Emit `settlement_delayed` jika `now > cycle_end + grace` | UX + alerting; contract tetap v1 reset-on-settle |
| **C. Keeper SLA + monitoring** | Alert jika `now > cycle_end + N menit` | Ops-only; tidak ubah semantics |

**Rekomendasi:** Hackathon = **7.7.3 UX** saja. v2 = **Approach A** jika produk butuh jadwal arisan seperti web2.

---

## 8. Functional Requirements

### FR-1: Authentication & Wallet

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-1.1 | User login via email, Google, or phone via Privy | P0 | ✅ |
| FR-1.2 | Privy auto-create Stellar embedded wallet on first login | P0 | ✅ |
| FR-1.3 | User never sees seed phrase in normal flow | P0 | ✅ |
| FR-1.4 | Session persists across page reload | P0 | ✅ |
| FR-1.5 | Logout clears session | P1 | ✅ |
| FR-1.6 | Display truncated wallet address in profile (advanced) | P2 | ✅ |

**Acceptance:** User bisa login dengan Google, wallet Stellar terbuat otomatis, dashboard load tanpa manual wallet connect.

---

### FR-2: Fiat On-Ramp (Top Up)

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-2.1 | "Isi Saldo" button di dashboard | P0 | ✅ (`/topup`) |
| FR-2.2 | User input amount in IDR | P0 | 🟡 mock |
| FR-2.3 | Show estimated USDC amount | P0 | 🟡 mock |
| FR-2.4 | Open Coridor deposit widget (SEP-24 interactive) | P0 | ✅ |
| FR-2.5 | Coridor widget: VA / QRIS / OVO (Xendit sandbox) | P0 | ✅ |
| FR-2.6 | On success, USDC credited to Privy wallet | P0 | ✅ |
| FR-2.7 | Show updated balance in dashboard | P0 | 🟡 |
| FR-2.8 | Fallback mock flow if staging not available | P0 | ✅ |

**Acceptance:** User klik Top Up → input IDR → complete flow → saldo USDC naik di dashboard. Mock acceptable jika staging belum ready, dengan label "Demo Mode" internal.

---

### FR-3: Fiat Off-Ramp (Cash Out)

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-3.1 | "Tarik Saldo" button di dashboard | P0 | ✅ (`/cashout`) |
| FR-3.2 | User input USDC amount to withdraw | P0 | 🟡 mock |
| FR-3.3 | Show estimated IDR payout | P0 | 🟡 mock |
| FR-3.4 | Open Coridor withdraw widget (SEP-24 interactive) | P0 | ✅ |
| FR-3.5 | Auto-send Blend USDC + Stellar memo to anchor via relayer | P0 | ✅ |
| FR-3.6 | Fallback mock flow if staging not available | P0 | ✅ |

**Acceptance:** User bisa tarik USDC ke fiat (real atau mock) setelah menerima payout.

---

### FR-4: Create Savings Circle

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-4.1 | "Buat Tabungan" form | P0 | ✅ |
| FR-4.2 | Fields: name, description, max_members, contribution, period — **bukan** yield_split (factory default) | P0 | ✅ |
| FR-4.3 | Show summary: total collateral per member, total pot per cycle | P0 | ✅ |
| FR-4.4 | Submit via relayer → `SancaFactory.create_pool` | P0 | ✅ |
| FR-4.5 | Redirect to circle detail page after creation | P0 | 🟡 (redirect `/circles`) |
| FR-4.6 | Creator auto-set as first member option (join separately) | P1 | ❌ |

**Validation rules (enforced on-chain):**
- `max_members`: 2–50
- `contribution_per_period`: ≥ 5 USDC (5_000_000 with 6 decimals)
- `period_duration`: > 0
- `yield_split_bps`: di-set saat deploy factory (default 9000); admin bisa `set_yield_split_bps`

**Acceptance:** Creator bisa buat pool, pool address muncul, state = Open.

---

### FR-5: Join Savings Circle

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-5.1 | Browse/list available circles | P0 | ✅ |
| FR-5.2 | Circle detail: name, members, contribution, period, status, slots remaining | P0 | ✅ |
| FR-5.3 | "Ikut Tabungan" button when pool Open and not full | P0 | ✅ |
| FR-5.4 | Show collateral required before join | P0 | ✅ |
| FR-5.5 | Check USDC balance ≥ collateral + gas (relayer handles gas) | P0 | 🟡 |
| FR-5.6 | Approve USDC to pool contract | P0 | ✅ |
| FR-5.7 | Call `SancaPool.join()` via relayer | P0 | ✅ |
| FR-5.8 | Show success + updated member list | P0 | ✅ |
| FR-5.9 | When pool full → state changes to Active, show "Pool Started" | P0 | ✅ (on-chain) |

**Acceptance:** User join pool, collateral locked, member count increases. When full, pool activates.

---

### FR-6: Contribute (Per Cycle)

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-6.1 | "Bayar Cicilan" button visible when pool Active and cycle running | P0 | ✅ |
| FR-6.2 | Show contribution amount and deadline (cycle end time) | P0 | 🟡 |
| FR-6.2a | Distinguish **cycle active** vs **settlement pending** (`now >= cycle_end`) — see [§7.7](#77-cycle-timing--keeper-settlement-semantics) | P1 | ❌ |
| FR-6.3 | Disable button if already contributed this cycle | P0 | ✅ |
| FR-6.4 | Approve + `SancaPool.contribute()` via relayer | P0 | ✅ |
| FR-6.5 | Show contribution status per member (optional) | P1 | ❌ |

**Acceptance:** Member contribute once per cycle, on-chain `Contributed` event emitted.

---

### FR-7: Cycle Settlement (Keeper)

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-7.1 | Keeper polls factory + all pools every 15s | P0 | ✅ |
| FR-7.2 | When `now >= cycle_end_time`, fetch latest drand beacon | P0 | ✅ |
| FR-7.3 | Submit `settle_cycle(round, sig_uncompressed, sig_compressed)` — BLS verified on-chain | P0 | ✅ |
| FR-7.4 | First settle shuffles winner order | P0 | ✅ |
| FR-7.5 | Transfer prize + yield bonus to winner | P0 | ✅ |
| FR-7.6 | Liquidate collateral for missed contributions | P0 | ✅ |
| FR-7.7 | Advance cycle counter | P0 | ✅ |
| FR-7.8 | When all cycles done → state = Completed | P0 | ✅ |
| FR-7.9 | Frontend shows winner notification after settlement | P1 | ❌ |
| FR-7.10 | Document & surface: next cycle starts **at settle time**, not original schedule — see [§7.7](#77-cycle-timing--keeper-settlement-semantics) | P1 | ❌ |
| FR-7.11 | Keeper catch-up: no manual CLI if keeper restarts after overdue cycle (automatic on next poll) | P0 | ✅ |

**Acceptance:** Pool auto-settles without manual CLI intervention during demo.

---

### FR-8: Withdraw (After Completion)

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-8.1 | "Tarik Tabungan" button when pool Completed | P0 | ❌ |
| FR-8.2 | Show estimated return (remaining collateral + compounded yield) | P1 | ❌ |
| FR-8.3 | Call `SancaPool.withdraw()` via relayer | P0 | ❌ |
| FR-8.4 | USDC returned to user wallet | P0 | ✅ (on-chain) |
| FR-8.5 | Disable button after successful withdraw | P0 | ❌ |

**Acceptance:** Member withdraw once after pool completed, receives USDC.

---

### FR-9: Relayer (Fee-Bump)

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-9.1 | `POST /relay` accepts signed inner transaction XDR | P0 | ❌ |
| FR-9.2 | Validate network = testnet | P0 | ❌ |
| FR-9.3 | Simulate inner tx via RPC before submit | P0 | ❌ |
| FR-9.4 | Whitelist contract methods: create_pool, join, contribute, withdraw | P0 | ❌ |
| FR-9.5 | Build fee-bump envelope, sign with relayer key | P0 | ❌ |
| FR-9.6 | Submit to Stellar RPC, return tx hash | P0 | ❌ |
| FR-9.7 | Poll tx status, return final status to frontend | P1 | ❌ |
| FR-9.8 | Rate limit: 100 tx/day per address | P2 | ❌ |

**Acceptance:** User with 0 XLM can join/contribute/withdraw successfully.

---

### FR-10: Dashboard & Activity

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-10.1 | Dashboard shows USDC balance + IDR equivalent | P0 | ❌ |
| FR-10.2 | List active circles user joined | P0 | ❌ |
| FR-10.3 | Show next payout date / cycle countdown | P1 | ❌ |
| FR-10.3a | **Settlement pending** state when period ended but cycle not settled yet | P1 | ❌ |
| FR-10.4 | Activity feed: contributions, wins, withdrawals | P1 | ❌ |
| FR-10.5 | Circle detail timeline: cycles, winners, amounts | P1 | ❌ |

---

## 9. Non-Functional Requirements

### 9.1 Performance

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-1 | Page load (dashboard) | < 3s on 4G |
| NFR-2 | Transaction submit → confirmation | < 30s (Stellar testnet) |
| NFR-3 | Relayer response time | < 2s (excluding chain confirmation) |
| NFR-4 | Keeper poll interval | 15s default |

### 9.2 Reliability

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-5 | Demo happy path success rate | 100% on rehearsed demo |
| NFR-6 | Keeper uptime during demo | Always-on (pm2 / docker) |
| NFR-7 | Relayer availability | 99% during demo window |

### 9.3 Security

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-8 | Relayer cannot modify signed inner tx | Enforced by Stellar protocol |
| NFR-9 | Relayer secrets not in frontend | Env vars / secret manager |
| NFR-10 | Contract auth on all state-changing fn | `require_auth()` ✅ |
| NFR-11 | No private keys in git | .env gitignored |

### 9.4 Usability

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-12 | Primary language | Bahasa Indonesia |
| NFR-13 | No crypto jargon on main flows | "Saldo", "Tabungan", "Hadiah" |
| NFR-14 | Mobile responsive | 375px+ viewport |
| NFR-15 | Error messages human-readable | ID language, actionable |

### 9.5 Maintainability

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-16 | Contract unit test coverage | All critical paths |
| NFR-17 | README with setup steps | < 30 min to run locally |
| NFR-18 | Env example files | All services documented |

---

## 10. System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER (Mobile Web)                            │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Next.js Frontend (Port dari Sanca lama)           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │ Privy Auth   │  │ Circle UI    │  │ Coridor SEP-24 Widget      │  │
│  │ Login        │  │ Dashboard    │  │ Top Up / Cash Out          │  │
│  └──────┬───────┘  └──────┬───────┘  └────────────┬─────────────┘  │
│         │                 │                       │                 │
│         └─────────────────┴───────────────────────┘                 │
│                           │                                         │
│              Build + sign inner Soroban tx (Privy rawSign)          │
└─────────────────────────┬───────────────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
   ┌────────────┐  ┌────────────┐  ┌──────────────┐
   │  Relayer   │  │  Keeper    │  │ Coridor API  │
   │  Service   │  │  Service   │  │ (SEP-24)     │
   │  (fee-bump)│  │  (settle)  │  │              │
   └─────┬──────┘  └─────┬──────┘  └──────────────┘
         │               │
         └───────┬───────┘
                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     Stellar Testnet (Soroban RPC)                    │
│  ┌─────────────────┐    ┌───────────────────────────────────────┐   │
│  │  SancaFactory   │───▶│  SancaPool (per circle)               │   │
│  │  CDKQ7U3J...    │    │  - ROSCA lifecycle                    │   │
│  └─────────────────┘    │  - drand shuffle                      │   │
│                         │  - DeFindex adapter                   │   │
│                         └────────────────┬──────────────────────┘   │
│                                          │                          │
│                         ┌────────────────┼────────────────┐         │
│                         ▼                ▼                ▼         │
│                   DeFindex Vault    Blend USDC SAC    drand binding │
│                   CBMVK2JK...       CAQCFVLO...                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 10.1 Service Boundaries

| Service | Port | Owner | Responsibility |
|---------|------|-------|----------------|
| Frontend | 3000 | Dev B | UX, Privy, tx building, Coridor widgets |
| Relayer | 3001 | Dev A | Fee-bump user transactions |
| Keeper | 3002 | Dev A | Auto settle_cycle |
| Stellar RPC | external | — | `https://soroban-testnet.stellar.org` |

---

## 11. Smart Contract Requirements

### 11.1 `sanca_factory`

**Address (testnet):** `CDKQ7U3JSNZGW722FVA2HKKSYBIUZBTA2G2FL2EB5VCJ37F2C6UEPWFG`  
*(Redeployed 4 Jul 2026 with `drand_public_key` in constructor. Legacy: `CCDV5FAS...`)*

| Function | Auth | Description | Status |
|----------|------|-------------|--------|
| `create_pool(...)` | creator | Deploy new SancaPool (keeper harus sudah di-set di factory) | ✅ |
| `set_pool_wasm_hash(...)` | admin | Update pool WASM | ✅ |
| `set_drand_public_key(...)` | admin | Update drand quicknet G2 pubkey (192 bytes) | ✅ |
| `set_keeper(...)` | admin | Platform keeper untuk settle semua pool | ✅ |
| `get_keeper()` | — | Read platform keeper | ✅ |
| `set_yield_split_bps(...)` | admin | Update % yield ke winner (default 9000) | ✅ |
| `get_yield_split_bps()` | — | Read platform yield split | ✅ |
| `get_all_pools()` | — | List all pool addresses | ✅ |

### 11.2 `sanca_pool`

| Function | Auth | Description | Status |
|----------|------|-------------|--------|
| `join()` | member | Lock collateral → DeFindex | ✅ |
| `contribute()` | member | Pay cycle contribution | ✅ |
| `settle_cycle(round, sig_u, sig_c)` | factory keeper | BLS verify drand, shuffle, payout, liquidation | ✅ |
| `withdraw()` | member | Redeem vault shares after completion | ✅ |
| `get_pool_info()` | — | State, cycle, members count | ✅ |
| `get_members()` | — | Member list | ✅ |
| `get_cycle_winner(cycle)` | — | Winner address | ✅ |
| `get_member_collateral(addr)` | — | Remaining collateral | ✅ |
| `get_member_vault_shares(addr)` | — | Member's DeFindex vault share balance | ✅ |
| `get_vault_shares()` | — | Pool total vault shares | ✅ |
| `get_winner_order()` | — | Shuffled winner order (after 1st settle) | ✅ |
| `get_cycle_end_time()` | — | Cycle deadline timestamp | ✅ |
| `has_contributed(addr, cycle)` | — | Contribution status | ✅ |

**On-chain modules:** `lib.rs` (ROSCA logic), `drand.rs` (BLS12-381 quicknet verification, CAP-0059).

### 11.3 Contract Gaps (Remaining)

| Gap | Priority | Notes |
|-----|----------|-------|
| SAC receipt token per pool (sPSP) | P2 | Post-hackathon — wallet-visible claim on pool's dfToken position; see §7.6 |
| `#[contractevent]` migration | P3 | Deprecated `publish()` warnings |
| Pool pause/emergency | P3 | Not needed for hackathon |
| Drand round ↔ wall-clock binding | P3 | Round monotonicity only; optional stricter timestamp check |

### 11.3.1 Recently Completed (was P2)

| Item | Implementation |
|------|----------------|
| On-chain BLS drand verification | `drand.rs`: pairing check, subgroup verify, compressed↔uncompressed binding, `SHA256(compressed_sig)` seed |
| Per-member vault share tracking | `MemberVaultShares` map; liquidation deducts defaulter only; yield redeem proportional; fair `withdraw()` |

### 11.4 Testnet Constants

| Name | Value |
|------|-------|
| DeFindex USDC vault | `CBMVK2JK6NTOT2O4HNQAIQFJY232BHKGLIMXDVQVHIIZKDACXDFZDWHN` |
| Blend USDC token | `CAQCFVLOBK5GIULPNZRGATJJMIZL5BSP7X5YJVMGCPTUEPFM4AVSRCJU` |
| Factory | `CDKQ7U3JSNZGW722FVA2HKKSYBIUZBTA2G2FL2EB5VCJ37F2C6UEPWFG` |
| Example pool (lifecycle test) | `CBVRDDG7T3AULMJQ26VNTAWG2U4UH3JEZUXJQ537UA34KLWXXKSHGO3M` |
| Drand quicknet hash | `52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971` |
| Drand API | `https://drand.cloudflare.com/{chain-hash}/public/latest` |
| Decompress helper | `contracts/scripts/decompress_drand.mjs` (G1/G2 → Soroban CAP-0059 bytes) |

### 11.5 Identities (CLI testing)

- `sanca-deployer` — factory admin, pool creator
- `sanca-member`, `sanca-member2`, `sanca-member3` — test members
- Keeper key — separate funded account

---

## 12. Backend Services Requirements

### 12.1 Relayer Service

**Tech:** Node.js + Express/Fastify + `@stellar/stellar-sdk`

**Directory:** `sanca/relayer/` (to be created)

#### API Spec

```
POST /relay
Content-Type: application/json

Request:
{
  "network": "testnet",
  "signedInnerXdr": "AAAAAgAAAAC..."
}

Response 200:
{
  "status": "success",
  "hash": "abc123...",
  "ledger": 12345
}

Response 400:
{
  "status": "error",
  "code": "INVALID_METHOD",
  "message": "Method not whitelisted"
}
```

#### Validation Rules

1. Parse inner transaction envelope
2. Verify signature present on inner tx
3. Verify destination contract ∈ {Factory, known Pool}
4. Verify invoked method ∈ whitelist
5. Simulate via RPC — reject if simulation fails
6. Build `FeeBumpTransaction` with relayer as fee source
7. Submit and poll

#### Environment Variables

```env
RELAYER_SECRET=S...
NETWORK=testnet
RPC_URL=https://soroban-testnet.stellar.org
FACTORY_ADDRESS=CDKQ7U3JSNZGW722FVA2HKKSYBIUZBTA2G2FL2EB5VCJ37F2C6UEPWFG
PORT=3001
MAX_FEE=100000
```

---

### 12.2 Keeper Service

**Directory:** `keeper/` ✅

**Implemented:**
- Poll `factory.get_all_pools()` + settle each active pool
- Verify `factory.get_keeper()` matches keeper wallet
- Fetch drand quicknet + decompress G1 (CAP-0059) + `settle_cycle`
- `npm run set-keeper` — admin sets factory keeper once (bukan per pool)
- systemd deploy guide in `keeper/README.md`
- **Catch-up:** jika keeper off saat `cycle_end` lewat, settle otomatis saat service hidup lagi (lihat [§7.7](#77-cycle-timing--keeper-settlement-semantics))

**Operational expectation:**

| Environment | Keeper uptime |
|-------------|---------------|
| Production | Always-on (VPS/systemd) |
| Demo / dev | Boleh stop-start; timeline pool **geser** sesuai §7.7 |

**Remaining:**

| Task | Priority | Status |
|------|----------|--------|
| Deploy keeper to always-on server | P0 | 🔲 |
| Health check endpoint `/health` | P1 | 🔲 |
| Alert on repeated settle failures | P2 | 🔲 |

#### Environment Variables

```env
FACTORY_ADDRESS=C...
KEEPER_SECRET=S...
ADMIN_SECRET=S...   # once for npm run set-keeper
NETWORK=testnet
RPC_URL=https://soroban-testnet.stellar.org
DRAND_CHAIN_HASH=52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971
POLL_INTERVAL_MS=15000
```

---

### 12.3 Indexer (Simple)

**Priority:** P1 — SHOULD for frontend data

**Approach:** Lightweight TypeScript service or Next.js API route

| Responsibility | Method |
|----------------|--------|
| List all pools | Factory `get_total_pools` + `get_pool_by_index` |
| Pool state | Simulate `get_pool_info` per pool |
| Events history | RPC `getEvents` filtered by contract |
| User's pools | Filter members by user address |

**No SubQuery for hackathon** — direct RPC polling sufficient.

---

## 13. Frontend Requirements

### 13.1 Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router) |
| Styling | Tailwind CSS + shadcn/ui |
| Wallet | Privy SDK (`@privy-io/react-auth`) |
| Blockchain | `@stellar/stellar-sdk` |
| State | React Query / SWR for RPC data |
| i18n | ID primary (hardcoded OK for hackathon) |

### 13.2 Page Map

| Route | Page | Priority | Source |
|-------|------|----------|--------|
| `/` | Landing + login CTA | P0 | Port dari Sanca lama |
| `/onboarding` | Explain arisan + Sanca (3 slides) | P1 | New |
| `/dashboard` | Balance, active circles, quick actions | P0 | Port |
| `/circles` | Browse all circles | P0 | Port |
| `/circles/create` | Create circle form | P0 | Port |
| `/circles/[id]` | Circle detail, join, contribute, status | P0 | Port |
| `/topup` | Coridor deposit (IDR → Blend USDC) | P0 | ✅ |
| `/cashout` | Coridor withdraw (Blend USDC → IDR) | P0 | ✅ |
| `/activity` | Transaction history | P1 | Port |
| `/profile` | Account, wallet address | P2 | Port |

### 13.3 Stellar integration map

| Layer | Implementation |
|-------|------------------|
| Wallet | Privy embedded wallet |
| Contract calls | Soroban invoke via stellar-sdk |
| User fees | Fee-bump relayer (no XLM UX) |
| On-chain reads | Soroban RPC simulate + contract views |
| USDC (pools) | Blend USDC SAC on Stellar (7 decimals) |
| USDC (ramp) | Blend USDC classic via Coridor (7 decimals) — same issuer as pools |
| UI | Reuse shadcn components, pages, styling |

**Keep:** Layout, design system, page structure, copy (ID), circle cards, forms.  
**Replace:** Blockchain interaction layer (wallet, tx build, relayer, RPC reads).

### 13.4 Transaction Build Flow (Frontend)

```typescript
// Pseudocode — every user action
async function executeContractCall(params) {
  // 1. Build Soroban transaction
  const tx = await buildSorobanTx({
    contract: poolAddress,
    method: 'contribute',
    args: [userAddress],
    source: userAddress,
  });

  // 2. Simulate to get auth entries
  const prepared = await simulateAndPrepare(tx);

  // 3. Sign with Privy
  const signedInnerXdr = await privySignTransaction(prepared);

  // 4. Submit via relayer
  const result = await fetch('/api/relay', {
    method: 'POST',
    body: JSON.stringify({ signedInnerXdr }),
  });

  // 5. Poll + show success toast
  await pollTransaction(result.hash);
}
```

### 13.5 UI Copy Guidelines (Bahasa Indonesia)

| Crypto Term | User-Facing Term |
|-------------|------------------|
| Wallet | Akun / Dompet |
| USDC | Saldo (tampilkan IDR equivalent) |
| Gas fee | *(hidden — relayer handles)* |
| Smart contract | Tabungan |
| Join pool | Ikut Tabungan |
| Contribute | Bayar Cicilan |
| Withdraw | Tarik Tabungan |
| Yield bonus | Bonus DeFi |
| Cycle | Periode / Minggu ke-N |
| Collateral | Tabungan terkunci |
| Transaction hash | *(hidden by default)* |

---

## 14. Integration Requirements

### 14.1 Privy Embedded Wallet

| Step | Action | Owner | Due |
|------|--------|-------|-----|
| 1 | Configure Privy app: enable Stellar chain | Dev A | Day 1 |
| 2 | Install `@privy-io/react-auth` in Next.js | Dev B | Day 1 |
| 3 | Wrap app with `PrivyProvider` | Dev B | Day 1 |
| 4 | Implement login UI (Google + email) | Dev B | Day 2 |
| 5 | Get Stellar wallet address post-login | Dev B | Day 2 |
| 6 | Implement `rawSign` for Soroban tx hash | Dev A | Day 3 |
| 7 | Test sign + relayer submit E2E | Dev A | Day 4 |

**Privy Stellar notes:**
- Tier 2 support via `rawSign`
- Verify signature with `Keypair.verify(hash, signature, publicKey)`
- User wallet is G-address (classic Stellar account)

---

### 14.2 Coridor Ramps (SEP-10 / SEP-24)

| Step | Action | Owner | Status |
|------|--------|-------|--------|
| 1 | Configure `NEXT_PUBLIC_CORIDOR_HOME_DOMAIN` + anchor `clients.yaml` | Dev A | ✅ |
| 2 | `lib/coridor/` — SEP-10 auth (`getSep10Token`) | Dev A | ✅ |
| 3 | SEP-24 interactive iframe (`/topup`, `/cashout`) | Dev B | ✅ |
| 4 | Withdraw: auto-send Blend USDC + memo via relayer | Dev A | ✅ |
| 5 | Mock mode `NEXT_PUBLIC_CORIDOR_MOCK` untuk demo | Dev B | ✅ |

**Coridor endpoints:**
- SEP-10/24 anchor: `sep.coridor.fun`
- Widget API: `api.coridor.fun`
- Payment methods (sandbox): VA, QRIS, OVO via Xendit — gunakan **Simulate** di widget

**Blend USDC issuer (testnet):** `GATALTGTWIOT6BUDBCZM3Q4OQ4BO2COLOAZ7IYSKPLC2PMSOPPGF5V56`  
**Keuntungan:** Issuer sama dengan Sanca pools & DeFindex — top-up langsung bisa join arisan, tanpa swap.

**Env vars:**

```bash
NEXT_PUBLIC_CORIDOR_HOME_DOMAIN=sep.coridor.fun
NEXT_PUBLIC_CORIDOR_MOCK=false
NEXT_PUBLIC_POOL_USDC_ISSUER=GATALTGTWIOT6BUDBCZM3Q4OQ4BO2COLOAZ7IYSKPLC2PMSOPPGF5V56
```

**Pitch line for juri:** Settlement 100% Stellar (Soroban, DeFindex, drand); Coridor = fiat rail IDR ↔ Blend USDC untuk user Indonesia.

---

### 14.3 DeFindex Vault

| Requirement | Status |
|-------------|--------|
| Vault address configured in factory | ✅ |
| `deposit()` on join | ✅ |
| `get_asset_amounts_per_shares()` for yield calc | ✅ |
| `withdraw()` on member withdraw + liquidation | ✅ |
| Per-member share ledger (`MemberVaultShares`) | ✅ |
| Pool holds dfTokens; users tracked via internal map | ✅ (see §7.6) |
| Handle zero yield gracefully | ✅ |

**No additional work** unless vault address changes.

---

### 14.4 drand

| Requirement | Status |
|-------------|--------|
| Quicknet chain hash configured (factory + pool) | ✅ |
| Keeper fetches latest beacon + decompresses G1 | ✅ |
| On-chain: round monotonicity check | ✅ |
| On-chain: BLS12-381 pairing verify (CAP-0059) | ✅ |
| On-chain: compressed ↔ uncompressed sig binding | ✅ |
| On-chain: randomness = `SHA256(compressed_signature)` | ✅ |
| Fisher-Yates shuffle with verified randomness seed | ✅ |
| Testnet E2E (3 cycles, live drand) | ✅ |

---

## 15. Data Model & Events

### 15.1 On-Chain Events (SancaPool)

| Event Topic | When | Data |
|-------------|------|------|
| `joined` | Member joins | member, collateral, shares |
| `started` | Pool full → Active | start_time, max_members |
| `contrib` | Member contributes | cycle, member, amount |
| `winner` | Cycle settled | cycle, winner, prize, yield_bonus |
| `yield` | Yield distributed | cycle, yield_bonus, platform_fee |
| `cycle_end` | Cycle advanced | cycle, next_cycle, timestamp |
| `completed` | All cycles done | — |
| `withdrawn` | Member withdraws | member, amount |
| `liquid` | Collateral liquidated | cycle, member, amount |
| `keeper` | Keeper set | keeper address |

### 15.2 Frontend State (Client)

```typescript
interface UserState {
  address: string;
  usdcBalance: bigint;
  idrBalance: number; // computed
  activePools: PoolSummary[];
}

interface PoolSummary {
  address: string;
  name: string;
  state: 'Open' | 'Active' | 'Completed';
  currentCycle: number;
  maxMembers: number;
  memberCount: number;
  contributionPerPeriod: bigint;
  periodDuration: number;
  cycleEndTime: number;
  isMember: boolean;
  hasContributedThisCycle: boolean;
  myCollateral: bigint;
  myVaultShares: bigint;       // get_member_vault_shares — DeFindex share units
  estimatedVaultUsdc: bigint;  // myVaultShares × PPS (simulate get_asset_amounts_per_shares)
}
```

---

## 16. UX & Accessibility Requirements

### 16.1 Core UX Principles

1. **Zero crypto friction** — no seed phrase, no XLM, no wallet extensions
2. **Familiar language** — arisan terminology, not DeFi jargon
3. **Mobile first** — 80%+ target users on mobile
4. **Progressive disclosure** — hide blockchain details by default
5. **Clear money display** — IDR primary, USDC secondary

### 16.2 Key UX Flows (Wireframe Descriptions)

#### Flow A: First-Time User

```
Landing → "Mulai dengan Google" → Onboarding (3 slides) → Dashboard (empty)
→ "Isi Saldo" → Coridor → Dashboard (Rp 500.000) → Browse Circles → Join
```

#### Flow B: Contribute

```
Dashboard → Active Circle card → Circle Detail → "Bayar Cicilan" (enabled)
→ Confirm Rp 50.000 → Loading "Memproses..." → Success "Cicilan berhasil!"
```

#### Flow C: Win Cycle

```
(Push/in-app notification) "Selamat! Kamu menang di Minggu ke-3!"
→ Circle Detail → Show payout: Rp 500.000 + Bonus DeFi Rp 5.000
→ "Tarik Saldo" → Coridor cash out
```

### 16.3 Error States

| Error | User Message (ID) |
|-------|-------------------|
| Insufficient balance | "Saldo tidak cukup. Isi saldo dulu ya." |
| Pool full | "Tabungan ini sudah penuh." |
| Already contributed | "Kamu sudah bayar cicilan periode ini." |
| Pool not active | "Tabungan belum dimulai." |
| Settlement pending | "Periode selesai — menunggu pengundian pemenang." |
| Tx failed | "Transaksi gagal. Coba lagi ya." |
| Network error | "Koneksi bermasalah. Periksa internet kamu." |

### 16.4 Accessibility

| Requirement | Target |
|-------------|--------|
| Color contrast | WCAG AA |
| Touch targets | ≥ 44px |
| Font size | ≥ 16px body |
| Screen reader | Semantic HTML (P2) |

---

## 17. Economics & Parameters

### 17.1 Default Pool Parameters (UI)

| Parameter | Default | Range | Notes |
|-----------|---------|-------|-------|
| `max_members` | 10 | 2–50 | UI recommendation 5–10 |
| `contribution_per_period` | 10 USDC | ≥ 5 USDC | Min sesuai anchor config |
| `period_duration` | 7 days | 1/7/14/30 days | 1 day for demo/testnet |
| `yield_split_bps` | 9000 | 0–10000 | **Factory** — 90% yield ke winner; set saat deploy |
| `platform_fee_bps` | 1000 | 0–5000 | 10% of yield bonus, set in factory |

### 17.2 Example Economics (Demo)

```
Circle: 3 members × 5 USDC/week × 3 weeks

Member collateral on join: 5 × 3 = 15 USDC each
Total in vault: 45 USDC

Per cycle pot: 3 × 5 = 15 USDC
Yield (example): ~0.01 USDC/cycle (depends on DeFindex APY)

Winner per cycle gets: 15 USDC + ~0.009 USDC yield bonus (90% of yield)
Platform gets: ~0.001 USDC (10% of yield bonus)

After 3 cycles: each member withdraws ~15 USDC + compounded yield share
```

### 17.3 Revenue Model (Post-hackathon)

| Source | Rate |
|--------|------|
| Platform fee on yield bonus | 10% |
| Creation fee | 0 (hackathon), 0.1 USDC (future) |
| Relayer subsidy | Platform-funded |

---

## 18. Security Requirements

### 18.1 Smart Contract

| Control | Implementation |
|---------|----------------|
| Auth on state changes | `require_auth()` ✅ |
| Reentrancy | Soroban single-threaded ✅ |
| Integer overflow | `checked_*` arithmetic ✅ |
| Unauthorized settle | Keeper-only ✅ |
| Drand replay | Round monotonicity ✅ |
| Double join/contribute/withdraw | Error enums ✅ |

### 18.2 Relayer

| Control | Implementation |
|---------|----------------|
| Method whitelist | Only SancaFactory + SancaPool methods |
| Cannot modify inner tx | Stellar protocol guarantee |
| Rate limiting | 100 tx/day per address |
| Secret management | Env var, not committed |
| Simulation before submit | Reject failing txs |

### 18.3 Frontend

| Control | Implementation |
|---------|----------------|
| No secrets in client | Only public Privy app ID |
| HTTPS only | Production deployment |
| CORS | Relayer accepts only frontend origin |

### 18.4 Known Limitations (Disclose to Juri)

1. **Drand:** Full BLS12-381 on-chain (CAP-0059); keeper only fetches/decompresses — contract verifies pairing + derives randomness.
2. **Vault shares:** Per-member accounting via `MemberVaultShares` (not equal split). No SAC receipt token in wallet for hackathon — balance shown in app.
3. **Single USDC issuer:** Blend USDC untuk ramp dan pools — tidak perlu swap setelah top-up.
4. **Drand round timing:** Contract enforces monotonic round, not wall-clock alignment with cycle end.
5. **Cycle schedule shifts on late settle:** `cycle_start_time` resets to settle ledger time — not a fixed calendar ROSCA schedule. See [§7.7](#77-cycle-timing--keeper-settlement-semantics). Frontend must show **settlement pending** state.
6. **BLS / crypto:** Soroban example pattern; not independently audited for production.

---

## 19. Testing Strategy

### 19.1 Smart Contract Tests

```bash
cd sanca/contracts
cargo build --target wasm32v1-none --release
cargo test -p sanca-pool
```

| Test Category | Tests | Status |
|---------------|-------|--------|
| Constructor | 1 | ✅ |
| Join auth/validation | 3 | ✅ |
| Contribute auth/validation | 2 | ✅ |
| Settle cycle timing | 2 | ✅ |
| drand / BLS validation | 3 | ✅ |
| Yield distribution | 2 | ✅ |
| Liquidation | 2 | ✅ |
| Withdraw | 2 | ✅ |
| Full lifecycle | 1 | ✅ |
| Winner order | 1 | ✅ |
| Quicknet BLS round 123 | 1 | ✅ |
| Per-member vault shares (liquidation) | 1 | ✅ |
| **Total** | **22** | ✅ |

### 19.2 Testnet Integration Test

```bash
cd sanca/contracts
bash scripts/full_lifecycle_test.sh          # 1s period, liquidation test ON
TEST_LIQUIDATION=0 bash scripts/full_lifecycle_test.sh  # skip liquidation scenario
PERIOD_DURATION=60 bash scripts/full_lifecycle_test.sh  # 60s period
```

**Script coverage (4 Jul 2026):**
- Deploy pool WASM + update factory drand pubkey
- 3 members join → DeFindex deposit
- Optional liquidation: `sanca-member3` skips contribute cycle 0
- 3× `settle_cycle` with live drand + **BLS on-chain**
- Assert defaulter collateral/shares reduced; defaulter withdraws less USDC
- Print `get_member_vault_shares` table: after join, after liquidation, before/after withdraw

### 19.3 Backend Tests

| Service | Test |
|---------|------|
| Relayer | Unit: parse XDR, whitelist validation. Integration: submit real fee-bump tx |
| Keeper | Manual: run against test pool, verify settle |

### 19.4 Frontend Tests

| Test | Method |
|------|--------|
| Login flow | Manual |
| Create/join/contribute | Manual E2E against testnet |
| Demo rehearsal | 3x full run without failure |

### 19.5 Demo Test Script

Pre-demo checklist (run 24h before Demo Day):

- [ ] Privy login works
- [ ] Relayer funded with XLM
- [ ] Keeper running and pool registered
- [ ] Demo pool created (3 members, 1-day period OR pre-settled pool)
- [ ] Coridor top-up works (live or mock)
- [ ] All 3 demo accounts funded with USDC
- [ ] Frontend deployed to public URL
- [ ] Video recorded as backup

---

## 20. Deployment & Environments

### 20.1 Environments

| Env | Network | Purpose |
|-----|---------|---------|
| Local | Testnet | Development |
| Staging | Testnet | Pre-demo rehearsal |
| Demo | Testnet | Demo Day live |
| Production | Pubnet | Post-hackathon (out of scope) |

### 20.2 Deployment Targets

| Component | Platform | URL |
|-----------|----------|-----|
| Frontend | Vercel | `sanca.app` or `sanca-xxx.vercel.app` |
| Relayer | Railway / Fly.io | `relayer.sanca.app` |
| Keeper | Railway / Fly.io | Internal (no public URL) |
| Contracts | Stellar Testnet | Immutable once deployed |

### 20.3 Environment Variables Checklist

**Frontend (.env.local):**
```env
NEXT_PUBLIC_PRIVY_APP_ID=
NEXT_PUBLIC_STELLAR_NETWORK=testnet
NEXT_PUBLIC_FACTORY_ADDRESS=CDKQ7U3JSNZGW722FVA2HKKSYBIUZBTA2G2FL2EB5VCJ37F2C6UEPWFG
NEXT_PUBLIC_USDC_ADDRESS=CAQCFVLOBK5GIULPNZRGATJJMIZL5BSP7X5YJVMGCPTUEPFM4AVSRCJU
NEXT_PUBLIC_RELAYER_URL=https://relayer.sanca.app
NEXT_PUBLIC_RPC_URL=https://soroban-testnet.stellar.org
```

**Relayer (.env):**
```env
RELAYER_SECRET=S...
PORT=3001
RPC_URL=https://soroban-testnet.stellar.org
FACTORY_ADDRESS=CDKQ7U3JSNZGW722FVA2HKKSYBIUZBTA2G2FL2EB5VCJ37F2C6UEPWFG
```

**Keeper (.env):**
```env
POOL_ADDRESS=C...
KEEPER_SECRET=S...
RPC_URL=https://soroban-testnet.stellar.org
POLL_INTERVAL_MS=15000
```

---

## 21. Hackathon Deliverables

### 21.1 Required Submission (by 15 Juli 2026)

| Deliverable | Format | Owner | Due |
|-------------|--------|-------|-----|
| Public GitHub repo | GitHub | Both | 14 Jul |
| README with setup instructions | Markdown | Dev A | 14 Jul |
| Architecture diagram | PNG/Mermaid in README | Dev A | 14 Jul |
| Demo video (≤5 min) | MP4/YouTube | Both | 14 Jul |
| Pitch deck (≤10 slides) | PDF/Google Slides | Both | 14 Jul |
| Live demo URL | HTTPS | Dev B | 14 Jul |
| Testnet contract addresses | In README | Dev A | 14 Jul |

### 21.2 Demo Video Storyboard (5 min)

| Time | Scene |
|------|-------|
| 0:00–0:30 | Problem: arisan tradisional, trust issues |
| 0:30–1:00 | Solution intro: Sanca on Stellar |
| 1:00–1:30 | Login with Google (Privy) |
| 1:30–2:00 | Top up via Coridor (IDR → Blend USDC) |
| 2:00–2:30 | Browse & join savings circle |
| 2:30–3:00 | Pay contribution (no XLM needed) |
| 3:00–3:30 | Show cycle settlement + winner + yield bonus |
| 3:30–4:00 | Cash out via Coridor |
| 4:00–4:30 | Architecture: Stellar + DeFindex + drand + Privy |
| 4:30–5:00 | Closing: APAC real-world finance |

### 21.3 Pitch Deck Outline

1. Title + team
2. Problem (arisan di Indonesia)
3. Solution (Sanca)
4. Demo screenshot
5. How it works (user flow diagram)
6. Technology (Stellar stack diagram)
7. Composability (DeFindex, Coridor, Privy, drand)
8. Market (APAC ROSCA market size)
9. Business model (yield fee)
10. Roadmap + ask

---

## 22. Implementation Roadmap

### 22.1 Sprint Calendar (4–15 Juli 2026)

#### **Phase 0: Foundation (4–5 Juli) — Days 1–2**

| Task | Owner | Hours | Done? |
|------|-------|-------|-------|
| Configure Coridor anchor + `clients.yaml` | Dev A | 1h | ✅ |
| Setup Privy app + Stellar config | Dev A | 2h | ❌ |
| Create `sanca/relayer/` scaffold | Dev A | 3h | ❌ |
| Implement `POST /relay` basic fee-bump | Dev A | 4h | ❌ |
| PrivyProvider + login page | Dev B | 4h | ❌ |
| Port landing page from old Sanca | Dev B | 4h | ❌ |
| Deploy keeper to always-on server | Dev A | 2h | ❌ |

**Phase 0 Exit Criteria:** User can login via Privy. Relayer accepts and submits a test fee-bump tx.

---

#### **Phase 1: Core Blockchain UX (6–8 Juli) — Days 3–5**

| Task | Owner | Hours | Done? |
|------|-------|-------|-------|
| Soroban tx builder utility (`lib/stellar.ts`) | Dev A | 6h | ❌ |
| Privy rawSign integration | Dev A | 4h | ❌ |
| Relayer method whitelist + simulation | Dev A | 3h | ❌ |
| Port dashboard page | Dev B | 6h | ❌ |
| Port circles list + detail pages | Dev B | 8h | ❌ |
| Create circle form → `create_pool` | Dev B | 4h | ❌ |
| Join flow → approve + `join` | Dev B | 4h | ❌ |
| Contribute flow → `contribute` | Dev B | 3h | ❌ |
| E2E test: create → join → contribute | Both | 4h | ❌ |

**Phase 1 Exit Criteria:** Full contract interaction from frontend via Privy + relayer works on testnet.

---

#### **Phase 2: Coridor + Settlement UX (9–11 Juli) — Days 6–8**

| Task | Owner | Hours | Done? |
|------|-------|-------|-------|
| Coridor SEP-10 auth + SEP-24 interactive | Dev A/B | 6h | ✅ |
| Coridor withdraw: Blend USDC + memo via relayer | Dev A | 6h | ✅ |
| Top up page | Dev B | 4h | ✅ |
| Cash out page | Dev B | 4h | ✅ |
| IDR display with exchange rate | Dev B | 2h | ❌ |
| Winner notification UI | Dev B | 2h | ❌ |
| Withdraw flow in frontend | Dev B | 3h | ❌ |
| Register keeper on demo pool | Dev A | 1h | ❌ |
| Full lifecycle demo rehearsal #1 | Both | 3h | ❌ |

**Phase 2 Exit Criteria:** Full E2E demo path works once (login → topup → join → contribute → settle → win → cashout).

---

#### **Phase 3: Polish & Submission (12–15 Juli) — Days 9–12**

| Task | Owner | Hours | Done? |
|------|-------|-------|-------|
| Bug fixes from rehearsal | Both | 8h | ❌ |
| Activity/history page | Dev B | 4h | ❌ |
| Indexer / pool listing API | Dev A | 4h | ❌ |
| Demo rehearsal #2 + #3 | Both | 4h | ❌ |
| Record demo video | Both | 4h | ❌ |
| Write README + architecture docs | Dev A | 3h | ❌ |
| Create pitch deck | Both | 3h | ❌ |
| Deploy frontend to Vercel (production) | Dev B | 2h | ❌ |
| Final submission | Both | 2h | ❌ |

**Phase 3 Exit Criteria:** All deliverables submitted. Demo success rate 100% on happy path.

---

### 22.2 Critical Path

```
Privy login → Relayer fee-bump → Frontend contract calls
     ↓
Coridor (or mock) → Top up USDC
     ↓
Join + Contribute (full ROSCA flow)
     ↓
Keeper settle → Winner payout
     ↓
Demo video + submission
```

**Blocker #1:** Relayer + Privy signing (Days 1–4)  
**Blocker #2:** Coridor anchor uptime + Vercel env (parallel track with mock fallback)  
**Blocker #3:** Frontend port (Days 1–8, parallel with backend)

---

## 23. Post-Hackathon Roadmap

### Phase A: Production Hardening (Aug–Sep 2026)

| Item | Description |
|------|-------------|
| **SAC receipt token (sPSP)** | Mint/burn per-pool SAC on join/withdraw for wallet visibility; wrapper over pool dfToken position |
| Mainnet deployment | Pubnet contracts + audit |
| Passkey smart accounts | Self-custody upgrade path |
| Independent crypto audit | BLS drand + liquidation paths |
| SubQuery indexer | Scalable event indexing |
| Mobile PWA | Installable app |

### Phase B: Growth (Q4 2026)

| Item | Description |
|------|-------------|
| Pilot with real community | 1 arisan group in Yogyakarta |
| Multi-anchor support | Self-hosted Anchor + local payment (QRIS) |
| Local stablecoins | IDR on-chain via anchor |
| Push notifications | Cycle reminders |
| Fixed cycle schedule (v2) | Absolute `pool_start + n×period` — settle late without shifting UX timeline; see §7.7.4 |
| Referral program | Community growth |

### Phase C: Scale (2027)

| Item | Description |
|------|-------------|
| SCF grant application | Continued development funding |
| Multi-country | Vietnam (họ hụi), Philippines (paluwagan) |
| AI keeper | Volatility-aware yield optimization |
| Governance token | Community ownership (evaluate carefully) |

---

## 24. Risks & Mitigations

| # | Risk | Impact | Likelihood | Mitigation |
|---|------|--------|------------|------------|
| R1 | Coridor widget / payment fails in demo | High | Medium | Pre-test IDR flow; mock fallback; record backup video |
| R2 | Privy Stellar rawSign integration issues | High | Medium | Start Day 1; fallback to Freighter for demo |
| R3 | Relayer fee-bump Soroban auth complexity | High | Medium | Dev A focuses exclusively Days 1–4 |
| R4 | DeFindex vault testnet downtime | Medium | Low | Pre-deposit USDC before demo; monitor vault |
| R5 | Keeper fails during live demo | High | Medium | Pre-settle demo pool before demo; video backup; always-on keeper in prod |
| R5a | Late settle shifts cycle timeline (UX confusion) | Medium | Medium | §7.7 UX: settlement pending + explain next cycle starts at settle; v2 fixed schedule |
| R6 | Frontend port takes longer than expected | Medium | Medium | Prioritize demo path pages only |
| R7 | 2-person team bandwidth | High | High | Strict scope: no nice-to-haves until Phase 3 |
| R8 | Coridor anchor downtime | Medium | Low | Mock mode fallback; health check `api.coridor.fun/health` |
| R9 | drand API downtime | Low | Low | Cache last beacon; retry logic in keeper |
| R10 | Testnet ledger timing (60s period too short for live demo) | Medium | Medium | Pre-seed a pool in advance; use 1-day period for live |

---

## 25. Team & RACI

| Task | Dev A (Contract/Backend) | Dev B (Frontend) |
|------|--------------------------|------------------|
| Smart contracts | **R/A** | I |
| Keeper service | **R/A** | I |
| Relayer service | **R/A** | C |
| Privy integration | **R** | **A** (UI) |
| Coridor integration | **R/A** | C |
| Frontend pages | C | **R/A** |
| Demo video | **R** | **R** |
| Pitch deck | C | **R** |
| README/docs | **R/A** | C |
| Testnet deployment | **R/A** | I |

**R** = Responsible, **A** = Accountable, **C** = Consulted, **I** = Informed

---

## 26. Acceptance Criteria (Definition of Done)

### 26.1 MVP (Minimum Viable Product) — Must pass ALL for submission

- [ ] User logs in with Google via Privy
- [ ] User has embedded Stellar wallet (G-address) without seed phrase
- [ ] User can top up USDC (Coridor live or mock)
- [ ] User can create a savings circle
- [ ] User can join a savings circle (collateral locked in DeFindex)
- [ ] User can contribute to active cycle
- [ ] Keeper auto-settles cycle on testnet
- [ ] Winner receives prize + yield bonus
- [ ] User can withdraw after pool completion
- [ ] User can cash out USDC (Coridor live or mock)
- [ ] User never needs XLM (relayer handles fees)
- [ ] Frontend deployed to public HTTPS URL
- [ ] Demo video recorded
- [ ] README with contract addresses and setup guide

### 26.2 Full Product (Target state)

- [ ] All MVP criteria
- [ ] Browse all pools (indexer/list API)
- [ ] Activity history page
- [ ] IDR display throughout
- [ ] Winner notification in-app
- [ ] Mobile responsive on all pages
- [ ] 3 successful demo rehearsals
- [ ] Coridor live flow tested from Indonesia (not mock)
- [ ] Pitch deck finalized
- [ ] ≥21 contract unit tests passing

### 26.3 Per-Feature DoD Template

Each feature is done when:
1. Works on Stellar testnet (not just local mock)
2. Error states handled with user-friendly ID messages
3. Tested on mobile viewport
4. No console errors in happy path
5. Documented in README if setup required

---

## 27. Appendix

### A. Glossary

| Term | Definition |
|------|------------|
| ROSCA | Rotating Savings and Credit Association |
| Arisan | Indonesian name for ROSCA |
| SAC | Stellar Asset Contract — token standard on Soroban |
| DeFindex | Stellar yield vault protocol by PaltaLabs |
| drand | Distributed randomness beacon (League of Entropy) |
| Fee-bump | Stellar transaction type where a third party pays the fee |
| Privy | Embedded wallet SDK for web2-like auth |
| Keeper | Off-chain service that calls `settle_cycle` |
| Relayer | Off-chain service that submits fee-bump transactions |
| Collateral | Full future contributions locked upfront |
| Yield split | Percentage of yield paid to cycle winner vs compounded |
| dfToken | DeFindex vault share token — held by pool contract in Sanca custody model |
| MemberVaultShares | On-chain map tracking each member's share of pool's DeFindex position |
| sPSP (planned) | Post-hackathon SAC receipt token — wallet-visible claim on member vault share (§7.6) |
| PPS | Price Per Share (DeFindex vault) |
| `cycle_start_time` | Ledger timestamp when the **current** cycle began; reset to settle time after each `settle_cycle` (§7.7) |
| Settlement pending | UI state: `now >= cycle_end_time` but `settle_cycle` not yet executed |

### B. Reference Documents

| Document | Path |
|----------|------|
| Product spec (architecture) | `docs/stellar-apac-product-spec.md` |
| Yield mechanics | `docs/yield.md` |
| Relayer design | `docs/relayer-fee-bump.md` |
| Project context | `docs/project-context.md` |
| Brainstorm | `docs/brainstorm-stellar-apac.md` |
| Keeper README | `keeper/README.md` |

### C. External Links

| Resource | URL |
|----------|-----|
| Stellar docs | https://developers.stellar.org |
| Soroban docs | https://soroban.stellar.org |
| DeFindex | https://defindex.io |
| Privy docs | https://docs.privy.io |
| Coridor anchor | `sep.coridor.fun` / `api.coridor.fun` |
| drand API | https://api.drand.sh |
| APAC Hackathon | Stellar community channels |

### D. Demo Pool Pre-Seed Script

For Demo Day, pre-create a pool before the live presentation:

```bash
# 1. Create pool (3 members, 5 USDC, 1-day period)
# 2. Join 3 pre-funded accounts
# 3. Run 1-2 cycles in advance
# 4. During demo: login as member → contribute → show win → cash out
```

This avoids waiting for cycle duration during live demo.

### E. Coridor Setup Checklist

1. **Anchor:** Deploy Anchor Platform at `sep.coridor.fun`; widget at `api.coridor.fun`.
2. **Vercel env:** `NEXT_PUBLIC_CORIDOR_HOME_DOMAIN=sep.coridor.fun`, `NEXT_PUBLIC_CORIDOR_MOCK=false`.
3. **clients.yaml:** Add `www.sanca.space`, `sanca.space`, `localhost:3000`.
4. **Test deposit:** Login → `/topup` → Continue with Coridor → VA/QRIS → **Simulate** (Xendit sandbox).
5. **Test withdraw:** `/cashout` → complete widget → confirm auto USDC + memo via relayer.
6. **Demo script:** Same Blend USDC for ramp and pools — no swap step needed.

---

*End of PRD v1.1*
