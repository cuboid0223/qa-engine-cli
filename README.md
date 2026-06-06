# QA Engine

AI 驅動的 QA 測試系統，透過 **Claude Code** 與 `npx playwright-cli`，對 web 應用執行系統性流程驗證。

**核心定位**：regression guard，不是 bug finder。四階段 workflow（Plan → Generate → Test+Heal → Promote），每階段產出獨立可稽核的檔案，中間可人工介入；只有通過 flake gate、被人工核可的 flow 才會 promote 進版控的 `tests/e2e/` 套件，成為持久的回歸基準。Heal 是 Phase C 的選用 tail（`heal:` 開才跑），不是獨立階段。

---

## 架構

```
Claude Code
    ↕ slash commands (/plan /generate /test /heal /run /reauth /promote)
 Flow-Guard (defined in CLAUDE.md)
    ↕ Bash (Phase A / Phase C heal explore)
npx playwright-cli
    ↕
  Browser
    ↓
目標 Web App
```

**設定模型**：根目錄 `playwright.config.ts` 是唯讀 resolver（找最新 session，僅供本機方便），`playwright.config.base.ts` 是人工維護的 factory（`createSessionConfig`）。真正權威的是每個 session / 每個 committed flow 自帶的 `playwright.config.ts`。CI 與指定 session 一律帶 `--config`。

**setup chain**（由 Playwright `dependencies` 保證順序）：
```
tsso-setup  →  mock-user-setup  →  chrome | chrome-<role>
```

---

## 四階段 Workflow

```mermaid
flowchart LR
    User(["使用者"])

    User -->|"/plan or /run"| A
    subgraph A["Phase A — Plan"]
        A1["playwright-cli 探索（snapshot -i + grep，省 token）\n+ 讀 docs（oracle）"]
        A1 --> A2["cases.md（人可讀、可編輯）"]
    end

    A2 -->|"審查後 /generate"| B
    subgraph B["Phase B — Generate"]
        B1["讀 cases.md → stable selector\n+ 驗證 Cleanup / Assertion strength"]
        B1 --> B2["flow.spec.ts + session playwright.config.ts"]
    end

    B2 -->|"/test（可加 heal:）"| C
    subgraph C["Phase C — Test + Heal"]
        C1["Stage 1 功能跑（--config）"]
        C1 --> C2["Stage 2 flake gate\n(--repeat-each=3 --retries=0)"]
        C2 --> C3["STABLE / FAILED / FLAKY(quarantine)"]
        C3 -.->|"heal: 開且有失敗"| C4["heal tail：分類 DRIFT/REGRESSION/FLAKE\n只修 selector/wait；regression flag\n→ 最終 flake gate"]
    end

    C3 -->|"全綠且人工核可後 /promote"| D
    C4 -.-> D
    subgraph D["Phase D — Promote"]
        D1["flake gate 3/3 → 複製進 committed tests/e2e/"]
    end

    User -->|"/reauth"| R1
    R1["強制刷新 tsso-base.json"]
```

| Phase            | 指令          | 輸入                                        | 輸出                                                |
| ---------------- | ----------- | ----------------------------------------- | ------------------------------------------------- |
| A — Plan         | `/plan`     | target + (docs) + (locale)                | `cases.md`                                        |
| B — Generate     | `/generate` | `cases.md`                                | `flow.spec.ts` + session `playwright.config.ts`   |
| C — Test + Heal  | `/test`、`/heal` | `flow.spec.ts`（heal tail 吃 Phase C 失敗結果） | HTML report + JUnit + (quarantine.md) +（heal 開）修好的 spec.ts + `.patch` |
| D — Promote      | `/promote`  | 全綠的 session                             | `tests/e2e/<slug>/`（committed 回歸套件）           |
| 全流程            | `/run`      | 同 /plan（可加 `heal:` / `gate:`）          | A→B→C（C 內含 heal tail if heal）                  |
| 重新登入          | `/reauth`   | `.env` 憑證                                | `playwright/.auth/tsso-base.json`                 |

**為什麼分階段**：每階段單一職責、中間產物可審查可重跑。Heal 是 Phase C 的選用 tail，Promote 自成一階段，讓「修測試」「把這版行為簽成正確基準」這兩件事永遠在人能看見的邊界內進行。

---

## 指令說明

### `/plan` — Phase A：探索 → cases.md

```
/plan
target: http://localhost:3000
docs: ./prd.md           # optional — PRD / spec，僅作 oracle（貼 [prd]/[baseline] 標籤 + flag 衝突）
```

透過 `npx playwright-cli` 瀏覽目標 app，**只把實際觀察到的行為**寫進 `cases.md`（observed-only），`docs` 僅用來替觀察到的斷言貼 oracle 標籤、並 flag 與 PRD 的衝突——絕不注入畫面上沒有的斷言。探索採省 token 紀律：預設 `snapshot -i`（只回互動元素）、用 grep 找元素而非整份讀、每條 flow 設探索上限（見 `phase-a-explore.md`）。

### `/generate` — Phase B：cases.md → spec.ts

```
/generate <folder>    # 不帶則用最新
```

讀 `cases.md` 產生 `flow.spec.ts` 與 session `playwright.config.ts`（factory 呼叫）。會把 refs 轉成穩定 selector，並驗證每個 TC 的 **Cleanup** 欄位與 **outcome 斷言**（套套邏輯會被擋下並點名）。

### `/test` — Phase C：跑測試 + flake gate（+ 選用 heal）

```
/test <folder>
heal: false      # optional — 有失敗時跑 heal tail（預設 false / AUTO_HEAL）
gate: true       # optional — 跑 flake gate（預設 true）
```
```
# Stage 1 功能跑
npx playwright test --config tests/generated/<ts>/playwright.config.ts
# Stage 2 flake gate（gate: false 可跳過）
npx playwright test --config tests/generated/<ts>/playwright.config.ts --repeat-each=3 --retries=0 --grep "<passed TCs>"
```

setup chain 依序 `tsso-setup → mock-user-setup → chrome[-role]`。結果分類為 **STABLE / FAILED / FLAKY**；flaky 寫進 `quarantine.md`，**不算綠**。完整 trace：`npx playwright show-report`。`heal:` 開且有失敗時，接著跑 heal tail（見下）；`heal: false` 時只報 pass/fail，不做 CLI 重開分類。

### `/heal` — Phase C（heal 模式，= `/test heal:true`）：分類失敗 → 修漂移、flag regression

```
/heal <folder>
```

Phase C 的選用 tail，不是獨立階段。若本 session 已有 Phase C 結果（`test-results/` JUnit+trace）會**跳過初跑**直接吃既有結果；否則先跑一次。讀 `test-results/`，先用 `playwright-cli` 重新探索拿 fresh snapshot，再把失敗分類：**DRIFT**（重解 selector）、**FLAKE**（只調等待）、**REGRESSION / TEST-DEFECT / AUTH**（不改、直接 flag）。修過的以 `--repeat-each=3` 重跑 3/3 才算修好，最後對所有 pass TC 再過一次完整 flake gate。**絕不修改斷言、不加 skip/sleep 逼綠燈。**

### `/promote` — Phase D：flake gate → 進 committed 套件

```
/promote <folder>
```

先跑 flake gate（`--repeat-each=3 --retries=0`，必須 3/3），再把核可的 flow 從 gitignored 的 `tests/generated/` 複製進版控的 `tests/e2e/<slug>/`。失敗或 flaky 一律中止——絕不把不穩定的測試 commit 進去。重複 promote 同一 flow 即「更新」，`git diff tests/e2e/<slug>/cases.md` 就是行為變更的稽核軌跡。

### `/run` — 全流程

```
/run
target: http://localhost:3000
docs: ./prd.md
heal: true            # optional — Phase C 有失敗時自動跑 heal tail（預設 false）
gate: true            # optional — 跑 Phase C flake gate（預設 true；false 給快速迭代）
```

依序 A → B → C（`heal:` 開則 C 內含 heal tail）。**Promote 永遠手動**，不納入 `/run`——把某版行為簽成正確基準應由人決定。

### `/reauth` — 重新整理登入狀態

手動強制刷新 `playwright/.auth/tsso-base.json`，不動 cases.md / spec.ts / session。

---

## 輸入參數

| 參數       | 必填 | 說明                                            |
| -------- | --- | --------------------------------------------- |
| `target` | 是  | 測試目標 URL（亦可由 `TARGET_URL` 提供）                 |
| `docs`   | 否  | PRD / spec 的 URL 或本地路徑——**僅作 oracle**：替觀察到的斷言貼 `[prd]`/`[baseline]` 標籤、flag 衝突，不作為斷言來源 |
| `locale` | 否  | 瀏覽器語系（預設 `zh-TW`）                             |
| `heal`   | 否  | `/test`、`/run`：失敗時跑 Phase C heal tail（預設 false / `AUTO_HEAL`） |
| `gate`   | 否  | `/test` `/run`：跑 Phase C flake gate（預設 true）  |

> **沒有 `source` 參數。** Flow-Guard 是 regression guard：它只把 target 上**實際觀察到**的行為寫成斷言（observed-only），所以 `cases.md` 永遠對得上畫面。cleanup endpoint 由 Phase A 觀察建立資料時送出的網路請求取得（`playwright-cli requests`），不讀原始碼。
>
> **Oracle（`[prd]` vs `[baseline]`）**：每條斷言記錄「我們為何相信這個預期值」。`[prd]` = 有 `docs:` 規格背書（帶正確性份量）；`[baseline]` = 規格沒寫，只是現狀快照（只保證沒變、不保證對）。沒給 `docs:` → 全部 `[baseline]`。規格與現狀衝突時寫觀察值並標 `[baseline ⚠ PRD 不符]`，不卡流程。「現狀是否正確」的判斷集中在 `/promote`：報告會列出所有 `[baseline]` 斷言,**按下 promote = 宣告這些現狀為正確基準**。這正好補上 PRD 落後（PM 不一定更新）時缺的那塊。

---

## 設定

### 1. 安裝依賴

```
npm install                        # 含 @playwright/cli（playwright-cli 指令）
npm install -D @types/node         # 消除 config 的型別紅字
```
> 不需安裝 Chromium。所有測試使用系統 Chrome（`channel: 'chrome'`）。

### 2. 設定憑證

```
cp .env.example .env
```
```
TARGET_URL=http://localhost:3000
TSSO_USERNAME=...
TSSO_PASSWORD=...
AUTO_HEAL=false                    # optional — /run 預設是否自動 heal
```

---

## 目錄結構

```
qa-engine/
├── CLAUDE.md                     ← Flow-Guard 核心定義（四階段）
├── playwright.config.ts          ← 唯讀 resolver（指向最新 session，勿手改／勿被寫入）
├── playwright.config.base.ts     ← 人工維護的 factory（createSessionConfig）
├── package.json
├── .env.example
│
├── .claude/
│   ├── settings.json             ← 工具白名單（CLI-only）
│   ├── commands/
│   │   ├── plan.md
│   │   ├── generate.md
│   │   ├── test.md
│   │   ├── heal.md               ← /heal（Phase C 的 heal 模式 alias）
│   │   ├── promote.md            ← /promote（Phase D）
│   │   ├── run.md
│   │   └── reauth.md
│   └── rules/
│       ├── cases-template.md     ← cases.md 結構（含 Cleanup + Assertion 規則）
│       ├── phase-a-explore.md    ← 省 token 探索紀律
│       ├── phase-b-generate.md   ← spec 生成（factory config）
│       ├── assertion-strength.md ← 斷言強度把關
│       ├── pattern-annotation.md
│       ├── dynamic-waits.md
│       ├── test-data-cleanup.md  ← 依 Cleanup 欄位生成 teardown
│       ├── flake-gate.md         ← Phase C / D 共用 flake gate
│       ├── phase-c-heal.md       ← Heal 決策樹（Phase C heal tail）
│       └── phase-d-promote.md    ← Promote（slug / copy / provenance）
│
├── playwright/
│   ├── setup/
│   │   └── tsso.setup.ts         ← 人工維護；tsso-setup project 執行
│   └── .auth/
│       └── tsso-base.json        ← TSSO 基礎 session（gitignored）
│
├── tests/
│   ├── generated/                ← 每次 run 產生（gitignored，臨時）
│   │   └── <YYYYMMDD-HHMMSS>/
│   │       ├── cases.md
│   │       ├── flow.spec.ts / flow.{role}.spec.ts
│   │       ├── playwright.config.ts        ← session 權威設定（factory 呼叫）
│   │       ├── mock-user.setup.ts
│   │       ├── mock-users.json
│   │       ├── quarantine.md               ← flaky TC（若有）
│   │       ├── heal-<HHMMSS>.patch         ← Phase C heal tail（若有）
│   │       └── .auth/state*.json
│   │
│   └── e2e/                      ← Phase D promote（committed 回歸套件）
│       └── <slug>/
│           ├── cases.md                    ← 行為契約 / 基準
│           ├── flow*.spec.ts
│           ├── playwright.config.ts        ← factory 呼叫
│           ├── mock-user.setup.ts
│           ├── mock-users.json
│           ├── PROVENANCE                  ← 來源 session + App 版本
│           └── .auth/state*.json           ← gitignored
│
├── playwright-report/
└── test-results/
```

`.gitignore` 重點：`tests/generated/` 整個 ignore；`tests/e2e/` commit，但 `tests/e2e/*/.auth/` 要 ignore（auth state 永不進版控）。

---

## CI

CI 跑**已 promote 的 committed 套件**，絕不叫 AI 即時生測試。一律用 `--config` 指向特定 flow：

```
# 跑全部已核可的 flow
for dir in tests/e2e/*/; do
  npx playwright test --config "$dir/playwright.config.ts"
done

# 單一 flow
npx playwright test --config tests/e2e/leave-request/playwright.config.ts
```

---

## 生命週期

```
/run（A→B→C，C 含選用 heal tail）→ 產生候選
        ↓ 人工審查
/promote → flake gate 3/3 → 進版控 tests/e2e/
        ↓
CI 之後只跑 tests/e2e/（持久回歸基準）
```

第一次某 flow promote 是「新增」；之後 App 改了、重跑、重 promote 就是「更新」，PR 上的 `git diff` 精準顯示被驗證的行為改了什麼——reviewer 審行為變更，跟審 code 一樣。