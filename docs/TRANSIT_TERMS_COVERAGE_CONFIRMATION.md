# Phase 3B3B — Provider Terms & Coverage Confirmation

Research + terms analysis + coverage confirmation + architecture decision only. No provider
integrated, no account created, no plan purchased, no API key introduced, no authenticated
request made to any transit provider, no ORS request, no change to walking, access points,
the dataset, `app/src/`, or `scripts/`. This phase closes the two questions Phase 3B3A left
open — read the actual terms of use, and confirm Okinawa/Kyoto/Osaka coverage — and turns
them into a concrete architecture decision.

> **Revision note (independent review).** An independent review before merge found this
> document's original Scenario D classification (traditional live app, display-and-discard →
> flat `PERMITTED`) understated a real, unreconciled tension with Ekispert Article 27(9)/(10),
> and found that additional official sources — the Ekispert API MCP Server / "for AI" program —
> had not been considered. §1.5–§1.7 and the revised §1.3/§7 below are the reconciliation.
> Nothing about the Okinawa coverage findings, the pricing findings, or the NAVITIME findings
> changed; this revision is scoped to the AI/competing-service question only.

## 0. Documents reviewed, with exact version/date

| Document | Source | Revision reviewed |
|---|---|---|
| 「駅すぱあと API スタンダードプラン」利用規約 | [PDF](https://docs.ekispert.com/v1/WebService_TOS.pdf), fetched and parsed with `pdftotext` this session (not summarized by an intermediary) | **2025年12月15日改訂 (2025-12-15)** — confirmed the latest of 16 listed revisions (制定 2010-10-01 through the list ending at 2025-12-15); still the current document at the reviewed URL |
| ナビタイム直接契約 利用規約 (NAVITIME direct-contract terms) | [page](https://api-sdk.navitime.co.jp/api/specs/description/ntj_tou.html) | No revision date surfaced by the fetch; read via automated extraction, not manually cross-verified character-by-character the way the Ekispert PDF was |
| ナビタイムAPI RapidAPI 利用規約 | [page](https://api-sdk.navitime.co.jp/api/specs/description/rapid_tou.html) | Same caveat as above |
| 駅すぱあとに搭載されている情報 (coverage/spec page) | [ekispert.jp/about/spec](https://ekispert.jp/about/spec) | Page states **"2026年9月現在"** (as of September 2026) — current at review time |
| Okinawa prefecture bus-navigation partner page | [watta-bus.com](https://www.watta-bus.com/about/busnaviokinawa.php) | Live page, fetched directly, quoted verbatim below |
| 駅すぱあと API pricing | [api-info.ekispert.com/plan/](https://api-info.ekispert.com/plan/) | Live page, re-confirmed this session |
| 駅すぱあと API MCPサーバー ("for AI" docs) | [docs.ekispert.com/v1/for-ai/mcp-server/](https://docs.ekispert.com/v1/for-ai/mcp-server/) | Fetched directly this session; added in this revision |
| MCPサーバー plan/pricing page | [api-info.ekispert.com/mcp/](https://api-info.ekispert.com/mcp/) | Fetched directly this session; added in this revision |
| MCP Server release announcement | [blog.ekispert.com/2026/02/09/mcp-server-release](https://blog.ekispert.com/2026/02/09/mcp-server-release) | Official Val Laboratory blog, fetched directly this session; added in this revision |
| Get Started guide (Standard Plan) | [docs.ekispert.com/v1/get-started/guide/](https://docs.ekispert.com/v1/get-started/guide/) | Fetched directly this session; added in this revision |

**Epistemic note on rigor**: the Ekispert Standard Plan ToS was extracted with `pdftotext -layout`
from the actual downloaded PDF and read directly, line by line, in this session — every quote
below is copy-pasted from that extraction, not a paraphrase from an intermediary summarizer.
The NAVITIME pages were read through an automated fetch-and-summarize tool; the quotes below
are internally consistent across two independently-fetched pages (direct contract and RapidAPI
both cite the same Article 5 §5/§2 wording), which is corroborating but not the same standard of
verification as the Ekispert PDF. This distinction matters for how much weight each conclusion
below should carry, and is flagged again where relevant.

## 1. Ekispert — Article-by-article analysis, applied to Nihon Travel Explorer

### 1.1 The document itself

Full title: 「駅すぱあと API スタンダードプラン」利用規約 (Terms of Use for "Ekispert API Standard
Plan"), operated by 株式会社ヴァル研究所 (Val Laboratory Inc.). Article 1 §3: **the Japanese text
is the authoritative version** — any English translation is subordinate. Everything below is
translated from the Japanese by this session, not sourced from an official English translation
(none was located).

### 1.2 Article 27 (禁止事項 — Prohibited Acts) — the critical article

Verbatim (excerpted, numbering preserved), extracted from the PDF:

> **第２７条（禁止事項）**
> １．契約者は本サービスの利用に関して、以下の行為を行ってはならないものとします。なお、
> 以下の行為をしようとする第三者を支援する場合、及び、AIを利用して以下の行為を実行する
> 場合を含みます。
> ...
> （６）本サービスの出力データ又はアウトプット内容を、AIの開発、機能拡張又は学習に利用す
> る行為
> （７）本サービスの利用により出力されるデータを二次利用・転売する行為
> （８）鉄道時刻情報の利用により出力されるデータを保持して再利用する行為（鉄道時刻情報
> は、毎回取得される必要があります。）
> （９）本サービスの出力データ又はアウトプット内容を使用して、本サービスと競合するサービ
> スを開発、提供又は販売する行為
> （10）当社から事前の書面による承諾を受けることなく、当社の事業と競合するサービス（次の
> いずれかに該当するサービスを指します。）を開発、提供又は販売する行為
>     ①経路検索・乗換案内サービス
>     ②公共交通データ提供サービス
>     ③公共交通データを取り扱うAIモデルや分析ツール
>     ④公共交通データを取り扱うコンサルティング
>     ⑤その他①②③④に関連するサービス

Translation of the operative clauses:

- **Preamble**: the contractor must not perform the listed acts **in relation to use of the
  Service**. This explicitly **includes assisting a third party attempting the act, and
  performing the act using AI** — i.e., routing a prohibited act through an AI tool does not
  exempt it.
- **(6)**: using the Service's **output data or output content** for **AI development, feature
  expansion, or training/learning** — prohibited, full stop, regardless of category of data.
- **(7)**: **secondary use or resale** of data output through use of the Service — prohibited,
  unqualified by data category.
- **(8)**: **retaining and reusing** data output from railway timetable information — prohibited;
  the clause states explicitly that **railway timetable information must be obtained each
  time** (毎回取得される必要があります). This is narrower in scope (railway timetables
  specifically) but stricter in kind (bans private retention, not just public redistribution).
- **(9)**: using output data/content to develop, provide, or sell a **competing service** —
  prohibited outright.
- **(10)**: developing, providing, or selling a service that competes with Val Laboratory's own
  business, **without prior written consent**, where "competing service" is explicitly defined
  to include: ① route-search/transfer-guide services, ② public-transport-data provision
  services, ③ **AI models or analysis tools that handle public-transport data**, ④ consulting
  using public-transport data, ⑤ anything related to ①–④. Unlike (9), this is **gated by prior
  written consent**, not an absolute ban — the contract itself names the escape hatch.

Supporting clauses read for context: Article 26 (認証キー / auth key — standard
confidentiality/liability-attribution obligations, not a caching rule); Article 17 §4 (usage
contract grants a **right of use**, not a transfer of intellectual property — Val Laboratory
retains IP in the Service and its output); Article 17 §3(3) (Val Laboratory does not provide
support for inquiries about the *content* of transit data itself — e.g., timetable/fare
questions — a support-scope disclaimer, not a caching rule); Article 9 §3 (grounds to refuse a
contract — payment default history, false application info — **no restriction limiting
contracting to corporations**; nothing here excludes an individual); Article 14 (grounds for
Val Laboratory to terminate — includes ordinary breach of the terms after a cure period, per
§(7), and immediate termination for the other enumerated grounds).

### 1.3 Applied to our six scenarios

**Revised in this pass** — D and F below were reclassified after reconciling Article 27(9)/(10)
against Ekispert's own observed licensing pattern and its official MCP Server / "for AI"
program. See §1.5–§1.7 for the full reasoning; this table states the conclusions only.

| # | Scenario | Classification | Basis |
|---|---|---|---|
| A | Use Claude/Codex to write integration code, **without** giving them real Ekispert responses | **PERMITTED** | Not touched by any clause — this is ordinary software development assisted by an AI coding tool, working from public API documentation, exactly as a human developer would. Article 27(6) is about the Service's *output data*, not about the tooling used to write the client code. Article 27(2)'s reverse-engineering prohibition targets the Service's own source code/algorithm, not a caller's integration code. |
| B | Send **real** Ekispert responses to Claude/Codex to analyze/help design a parser | **REQUIRES VENDOR CONFIRMATION (mitigated)** | Not explicitly addressed by Article 27 itself, but §1.5 found Val Laboratory's own MCP Server guidance instructing that "AI agents should be used with an opt-out (excluded-from-training) configuration" — official acknowledgment that AI-mediated handling of output data is expected, provided training is off. That narrows but does not close the question, since it addresses *their* MCP-mediated flow, not the general case of pasting captured output into a separate AI coding assistant. The clean, zero-cost mitigation is unchanged: **never paste real captured Ekispert output into any AI chat tool** — use synthetic/mock data structurally identical to the documented schema instead. This phase does not need a vendor answer to proceed **because the mitigation is free**. |
| C | Use Ekispert output to **train, fine-tune, or otherwise extend** a model | **PROHIBITED** | Article 27(6), verbatim, unambiguous. Nothing about the MCP Server changes this — MCP governs the *calling interface*, not what may be done with the data once received. |
| D | A traditional app that calls Ekispert **live** and simply displays the result to the requesting user, without persisting it | **PERMITTED AS A GENERAL API PATTERN — NIHON-SPECIFIC USE REQUIRES VENDOR CONFIRMATION** | Displaying a live result to the user who requested it, in the same session, is the ordinary licensed pattern the product is built and marketed for (§1.6) — not itself blocked by Article 27. But Nihon Travel Explorer's own stated trajectory (help order places/cities, generate planning recommendations) risks drifting from "display a route" toward the named, gated categories in Article 27(9)/(10) as it grows — see §1.6/§1.7 for exactly where that line is and why this is no longer a flat, unqualified `PERMITTED`. |
| E | Store Ekispert responses in **GitHub / `data/logistics/`**, the pattern this project has used for ORS walking results | **PROHIBITED** | Two independent grounds. First, Article 27(7)'s "二次利用・転売" (secondary use/resale) is unqualified by data category, and committing output to a **public** repository is unambiguously making it available to arbitrary third parties — squarely secondary use, not an edge case needing interpretation. Second, for anything derived from railway timetable information specifically, Article 27(8) separately and explicitly bans even **private** retention/reuse ("must be obtained each time"). This directly forecloses the historical `data/logistics/walking-*-results.json` pattern for Ekispert content. Unaffected by the MCP Server findings — E is about persistence, which MCP does not touch. |
| F | An AI tool that **directly consumes** Ekispert transit data to generate recommendations | **SUBJECT TO AUTHORIZATION** | Confirmed, and now more precisely reasoned in §1.7: Ekispert's own MCP Server explicitly supports and markets *AI-agent-mediated querying* (an agent calling the API as a tool, on a user's behalf, in real time) — that alone is not what (10)③ targets. What (10)③ targets is building a **standalone product whose core offering is public-transport-data analysis/modeling as a service**, which still requires Val Laboratory's **prior written consent**. Nihon's long-term ambition (an AI-driven recommendation/planning feature built around transit data as a core input, not just a query relay) sits closer to the gated category than to the MCP Server's supported pattern, and this phase has neither sought nor received that consent. |

### 1.4 Storage/caching, broken out by data type

Per the task's own caution: **a specific ban on retaining railway timetable output does not
imply a ban on retaining every other data type, and the mere existence of some other provider's
"serialized route data" concept does not mean Ekispert's output can be persisted wholesale.**
No "serialized route data" carve-out was found anywhere in the Ekispert Standard Plan ToS text
reviewed — if one exists, it is not in this document.

| Data type | Can it be stored? | Basis |
|---|---|---|
| Route search result (distance/duration/transfers as returned) | **Cannot be stored publicly** (Art. 27(7)); privately, only if it does not include railway-timetable-derived content (Art. 27(8) bars that unconditionally) | (7) + (8) |
| Station metadata (as returned by the API) | **Cannot be stored publicly** (still "output data" under (7)'s unqualified wording); private-only retention is **not clear** — no explicit carve-out either way | (7); REQUIRES VENDOR CONFIRMATION for private-only |
| Line metadata | Same as station metadata | (7); REQUIRES VENDOR CONFIRMATION for private-only |
| Railway timetable | **Must be obtained fresh every time — cannot be retained even privately** | (8), explicit |
| Bus timetable | Not individually named in (8) (which names only 鉄道時刻情報, *railway* timetable info) — so the "fetch every time" rule's literal scope may not extend to it — but (7)'s blanket ban on public secondary-use/resale of *any* output data still applies. Private-only retention: **not clear** | (7) certain for public; (8) does not literally name bus; private caching REQUIRES VENDOR CONFIRMATION |
| Fare | Same treatment as station/line metadata | (7); REQUIRES VENDOR CONFIRMATION for private-only |
| Serialized route data (a token/ID representing a computed route, rerequestable later) | **No such concept or carve-out was found in this ToS.** Do not assume one exists. | Not found — REQUIRES VENDOR CONFIRMATION if this pattern is ever considered |
| Identifiers (station IDs, line IDs, etc., without their descriptive/schedule payload) | **Not clear** — no explicit carve-out found distinguishing bare identifiers from the data they identify | REQUIRES VENDOR CONFIRMATION |
| Derived metrics **our own application computes** (e.g., "N queries succeeded," "average delta vs. the haversine estimate was X%") | **Likely permitted to publish** — this is our own analytical work product about the comparison, not a redistribution of the Service's actual output content (no specific transit time, station name, or fare is disclosed). This is a reasoned inference, not an explicit permission, and is flagged as lower-confidence than the other rows. | Not explicitly addressed either way — REQUIRES VENDOR CONFIRMATION (low risk) |

### 1.5 Additional official sources: the MCP Server / "for AI" program

An independent review before merge flagged that the original pass over this document did not
consult Ekispert's own AI-specific program pages, only the general ToS/pricing/coverage pages.
Fetched directly this session:

- [駅すぱあと API MCPサーバー](https://docs.ekispert.com/v1/for-ai/mcp-server/) ("for AI" docs)
- [MCPサーバー plan/pricing page](https://api-info.ekispert.com/mcp/)
- [Official release announcement](https://blog.ekispert.com/2026/02/09/mcp-server-release) (2026-02-09), Val Laboratory's own blog

**What the MCP Server is.** An official Model Context Protocol server that lets an AI agent —
"Claude をはじめとする AI エージェント（LLM）" (Claude and other AI agents/LLMs) — call the
Ekispert API's route-search and station-lookup functions directly, from natural-language
instructions, without the caller handling raw API parameters. It works with any MCP client
(Claude Desktop, Claude Code, VS Code, etc.).

**Positioning — broader than developer tooling.** The listed use cases are not limited to
helping a developer write integration code. They explicitly include **"AIチャットボットへの経路検索
機能の組み込み"** (embedding route search into AI chatbots) and **"AIエージェントを活用した業務
アプリケーション"** (business applications built on AI agents), alongside enterprise examples like
automated travel-expense verification ("渋谷から品川まで、申請金額が500円なのですが、これは妥当
ですか？" — an AI agent runs the route search itself to check a reimbursement claim) and consumer
trip-planning. **This is a real, official signal that AI-agent-mediated querying of Ekispert is
an intended, supported product pattern — not an edge case this project would be the first to
attempt.**

**The one explicit condition stated.** The MCP Server documentation instructs:

> 「AIエージェントはオプトアウト（学習対象外）の設定でご利用ください」
> ("Please use AI agents with an opt-out (excluded-from-training) configuration.")

This is Val Laboratory's own operational reconciliation of Article 27(6) with AI-mediated use:
having an AI agent process a query and relay the answer is treated as compliant **provided the
agent/platform is configured so the data is not used to train it**. It does not say "AI may
never touch the data" — it says "AI may touch the data; make sure it isn't learning from it."

**Access requirements — not free, not unconditional.**

> 「駅すぱあと API スタンダードプラン」のご契約で、ご利用いただけます」(available through a
> Standard Plan contract); a 90-day free trial access key exists; **free-plan customers are
> excluded**; and — separately — **「2026年後半以降（仮）の利用には、別途ご契約が必要です」**
> (a separate contract will be required for usage from late 2026 onward, tentative). MCP
> requests are themselves billable ("MCPサーバー利用分のリクエスト数は課金対象となります").

It was **not confirmed** whether the pay-as-you-go (Amazon, one-time-purchase) tier counts as a
qualifying "Standard Plan contract" for MCP access, or whether MCP requires the separate
subscription-based Standard Plan specifically. Neither page reviewed explicitly states that MCP
usage remains governed by the same Article 27 that governs the underlying API contract — but
since MCP is offered **"through" that same contract**, rather than as a separately-termed
product, the far more natural reading is that it is the same contract's terms, reached through a
different calling convention, not a parallel product with its own unpublished rules. This is this
session's own inference, not a line quoted from either page — flagged as such.

### 1.6 Reconciling Article 27(9)/(10) with the API's own observed licensing pattern

The independent review's concern is legitimate on the text alone: Article 27(9)/(10)① names
"経路検索・乗換案内サービス" (route-search/transfer-guide services) as a restricted category, and
that is a literal description of what any transit-display feature does. Read in isolation, that
could seem to make *every* customer's ordinary use of the API a violation — which cannot be the
intended reading, because it would make the product unusable for its own advertised purpose.
Two pieces of evidence, both already gathered in §3 and re-examined here, resolve this more
precisely than the original pass did:

1. **Observed real licensing**: Okinawa Prefecture's own bus-navigation portal (`watta-bus.com`,
   quoted in §3) is, functionally, exactly a route-search/transfer-guide consumer service —
   built on top of Ekispert, named and celebrated as a partner integration, not described
   anywhere as a violation requiring special dispensation. Ekispert's product materials
   generally describe being embedded in "government agencies and major portal sites" this way.
   If (9)/(10)① meant "any app that shows a user a route using our data," this entire class of
   ordinary, celebrated customer integration would be impossible — so it must mean something
   narrower.
2. **The application-form scoping mechanism**: Article 17 §1 states the specific services/
   content a contractor may use are "定められる" (defined) in the usage contract, and Article
   27(4) separately prohibits using the Service "利用申込書の記載と異なる使用範囲、目的、態様又は
   方法で" (in a scope, purpose, manner, or method different from what the application form
   states). Read together, this describes the *ordinary* mechanism by which a specific use case
   — e.g., "a personal trip-planning app that shows users transit routes" — becomes clearly
   licensed: **declaring it accurately on the application form at contract signup**, not a
   separate side negotiation. The Get Started guide independently confirms the application form
   captures binding specifics (it ties a registered *domain* to the application, for instance).

**The more defensible reading, from public evidence alone**: Article 27(9)/(10)① targets a
customer becoming a competing **data/routing provider to other third-party developers or
businesses** (i.e., competing with Val Laboratory's own business model of selling route-search
capability to *other* customers) — not a single consumer-facing application that uses the
licensed API, within its declared scope, to show its own users a route. This is consistent with
Article 27(7)'s parallel logic (secondary use/resale means redistributing the *data itself* to
others, not using it to power your own product's feature).

**This is this session's own reasoned interpretation of public evidence, not a legal opinion and
not a vendor confirmation.** It is offered as the most defensible reading available without
contacting Val Laboratory — not as certainty. It is also why Scenario D is no longer a flat,
unconditional `PERMITTED`: the reasoning above supports "a declared, ordinary transit-display
feature" cleanly, but Nihon Travel Explorer's own stated ambitions go further than that (§1.7).

### 1.7 Three distinct things Article 27(6) and Article 27(10) actually govern

The independent review is correct that these must not be conflated. Restated precisely, with the
MCP Server findings folded in:

1. **Using an LLM as an interface/tool-caller *to* Ekispert** — a user asks a question, an AI
   agent (Claude, Codex, an in-app assistant) calls Ekispert's API (directly or via its MCP
   Server) to answer *that specific request*, and relays the real-time answer. This is Article
   27(6)'s subject only incidentally, and Val Laboratory's own MCP Server documentation
   treats this pattern as supported, **provided the agent is configured opt-out of training**
   (§1.5). This is not "using output data for AI development" in the sense (6) prohibits — the
   AI is a relay, not a development/training pipeline.
2. **Using Ekispert's output to train, fine-tune, or otherwise extend a model** — squarely
   Article 27(6), squarely prohibited, and entirely unaffected by whether an MCP Server exists.
   MCP governs the calling interface; it does not touch what the recipient may do with the data
   once received.
3. **Developing an AI analysis/recommendation *product* whose core offering is built around
   public-transport data** — this is what Article 27(10)③ actually names as a gated competing-
   service category ("AI models or analysis tools that handle public-transport data"),
   requiring Val Laboratory's prior written consent regardless of how the underlying API is
   called. The MCP Server's own marketing examples (an expense-auditing agent, a chatbot
   feature) are themselves AI-mediated uses of transit data, offered under the Standard Plan
   without an individually-negotiated consent step described anywhere in the pages reviewed —
   which suggests (10)③ is not triggered merely by "AI touches the data as part of a feature."
   The distinguishing factor, on the evidence available, is whether transit data is *one input
   to a single user-facing query* (supported, low-risk) versus whether **analyzing or
   recommending across transit data is the product's core value proposition** — closer to what
   (10)③ actually names, and where Nihon Travel Explorer's own stated future direction (helping
   order places/cities, generating planning recommendations from logistics data) is heading.

**Applied to Nihon Travel Explorer's actual trajectory**: today's narrowly-scoped need (show a
real, live transit time for one edge, on request, to the user who asked) sits in category 1 —
supported by the API's own design and Ekispert's observed licensing pattern (§1.6), gated only by
the opt-out condition already stated by Val Laboratory. The project's own longer-term ambitions
(sequencing places, generating recommendations *from* logistics data) drift toward category 3,
which needs Val Laboratory's prior written consent under Article 27(10)③ regardless of how
carefully the calling interface is built. **These are not the same decision, and this document
must not present them as though they were.**

## 2. NAVITIME — terms analysis

Reviewed via two pages, direct-contract and RapidAPI channels, both citing the same Article 5
provisions (read via automated fetch, not manually cross-verified line-by-line the way the
Ekispert PDF was — treat with correspondingly less certainty):

> Article 5 §5 (direct contract, quoted by the fetch): 「本申込書に定めたデータを本申込書に定
> めた用途のために保存する場合を除き…本件サービスを通じてナビタイムから提供を受けたデー
> タ（本件サービスの使用により出力された緯度経度情報も含みますがこれに限られません。）を
> キャッシュ等に保存してはならない」
>
> Article 5 §5 (RapidAPI channel, same wording): 「お客様は、本サービスを通じて当社から提供を
> 受けたデータ（本サービスの利用により出力された緯度経度情報も含みますがこれに限られませ
> ん。）をキャッシュ等に保存してはならないものとします。」

Translation: data received via the service (**explicitly including but not limited to** output
lat/lng coordinates) **must not be cached/stored**, **except** for data the application
form/contract specifically authorizes for a purpose the form/contract specifically states.

> Article 5 §2 (both channels, same wording): 「第三者に対して、譲渡、使用許諾（利用許諾）、
> 貸与その他の一切の処分をしてはならない」

Translation: no transfer, licensing, lending, or any other disposition to a third party —
comparable in effect to Ekispert's Art. 27(7), and arguably broader since it isn't limited to
"output data" by name.

**No explicit AI/machine-learning clause was found** in either NAVITIME page reviewed — unlike
Ekispert's named Article 27(6). This is a real difference in what the text says, not
necessarily a difference in what is actually permitted: NAVITIME's blanket "no caching except
contract-authorized" (§5) would itself block storing data for AI training purposes, since
training requires retaining a dataset — the same practical result as Ekispert's explicit
clause, reached through the general storage rule rather than an AI-specific one. Article 5 §6
(direct contract) reportedly lists **nine** prohibited use cases; only one was surfaced by this
session's fetch (combining probe data with road-network attribute data for redistribution) —
**the other eight were not read**, so any NAVITIME-specific AI or competing-service restriction
beyond what's quoted above is unconfirmed, not ruled out.

Applying the same six scenarios:

| # | Scenario | Classification | Basis |
|---|---|---|---|
| A | Write integration code without giving AI real data | **PERMITTED** | Same reasoning as Ekispert — untouched by any data-storage or use clause. |
| B | Send real responses to Claude/Codex | **REQUIRES VENDOR CONFIRMATION** | No explicit clause either way; same third-party-transmission risk as Ekispert; same free mitigation (use synthetic data). |
| C | Train/fine-tune on output | **REQUIRES VENDOR CONFIRMATION** (likely prohibited in effect, not by an explicit AI clause) | No explicit AI clause, but Article 5 §5's blanket storage ban would itself prevent retaining a training dataset in the first place. |
| D | Live app, display-and-discard | **PERMITTED AS A GENERAL API PATTERN — NIHON-SPECIFIC USE REQUIRES VENDOR CONFIRMATION** | Same reasoning as Ekispert — the paradigm use case a live-routing API is built for — but the same caveat applies regardless of provider: this classifies *the pattern*, not Nihon Travel Explorer's specific, full intended product, whose planning-recommendation ambition is the open question (§1.6/§1.7), not something particular to Ekispert's Article 27. |
| E | Store responses in GitHub/`data/logistics/` | **PROHIBITED** | Article 5 §5 is, if anything, *broader* than Ekispert's — it names lat/lng output explicitly as an example of what may not be cached, "including but not limited to," with no data-category carve-out at all. |
| F | AI tool directly consuming the data for recommendations | **REQUIRES VENDOR CONFIRMATION** | Only one of the nine Article 5 §6 prohibited-use examples was read; whether an AI recommendation tool falls into one of the other eight is genuinely unknown, not assumed clear. |

### 2.2 Live viability and contracting channel

- **Direct contract**: custom pricing, negotiated with NAVITIME Japan; a **90-day trial** exists.
  Whether an individual/personal-portfolio project can obtain a direct contract (versus this
  being a corporate-sales-only channel) was **not confirmed** — Article 9-equivalent eligibility
  language was not surfaced by the pages reviewed.
- **RapidAPI / SBI API Hub**: self-serve signup exists; realistic usable tier is **$200–300/month**
  per Phase 3B3A's research, re-confirmed unchanged this session; a free/trial tier caps at 500
  requests.
- A **live** (non-caching) architecture is plausible for NAVITIME on the terms actually read — the
  blanket storage ban doesn't prohibit calling the API per-request and rendering the result. Cost
  is the dominant blocker for NAVITIME specifically, not the legal terms.

### 2.3 Okinawa coverage — NAVITIME

**NOT CONFIRMED for the API.** NAVITIME's own consumer map product does list Yui Rail
(`navitime.co.jp/railroad/00001012/ゆいレール`) — but per the task's own instruction, "the
NAVITIME app covers something" is **not** the same fact as "the NAVITIME API/contract gives
access to that data." No page reviewed this session confirmed that the contracted API product
(as opposed to the consumer-facing map site) exposes Yui Rail or the four Okinawa bus operators.
This is recorded as unconfirmed, not assumed either way.

## 3. Ekispert — Okinawa & national coverage confirmation

From [ekispert.jp/about/spec](https://ekispert.jp/about/spec), current as of the page's own
stated date (2026年9月現在):

| Mode | Coverage figure (as published) |
|---|---|
| Rail (鉄道, including monorail/cable car — モノレール、ケーブルカー含む) | ~210 companies, ~9,300 stations, ~1,100 lines |
| Route bus (路線バス, "100%対応") | 429 companies, ~160,040 stops, ~30,050 routes |
| Airlines (航空) | 20 companies, 88 airports, ~300 routes |
| Ferry (船舶) | ~755 ports, ~470 routes |

These are aggregate national figures — they do **not** by themselves name Okinawa's specific
operators. Two independent, named confirmations were found instead:

1. **Val Laboratory's own free demo** (`roote.ekispert.net`, i.e. Ekispert's own "駅すぱあと for
   web," running on the same engine) returns real, working route searches between named Okinawa
   stops — e.g. 「那覇バスターミナル ⇒ コンベンションセンター前」 and 「那覇空港国内線旅客ターミナル
   ⇒ コンベンションセンター前」, both resolved against a labeled 沖縄県路線バス (Okinawa Prefecture
   route bus) operator in the URL's own parameters.
2. **Okinawa Prefecture's official bus-navigation portal** (`watta-bus.com`,
   「のりもの NAVI Okinawa」/「バスなび沖縄」), fetched directly this session, states verbatim:
   > 「全国の経路検索のパイオニア「駅すぱあと」のシステムで、乗り換えやゆいレールの連結検索
   > が可能」
   > 「県内の主要路線バス（琉球バス交通、沖縄バス、那覇バス、東陽バス）を対象に」

This **names all four target operators explicitly** (Ryukyu Bus Kotsu, Okinawa Bus, Naha Bus,
Toyo Bus) and **explicitly confirms Yui Rail connection search** ("ゆいレールの連結検索が可能"),
sourced from a real, independent, official production deployment that runs on Ekispert's engine —
not from Ekispert's own marketing copy alone.

| Operator | Status |
|---|---|
| Yui Rail / Okinawa Urban Monorail (ゆいレール/沖縄都市モノレール) | **CONFIRMED** — named directly by the prefecture's own Ekispert-powered portal |
| Naha Bus (那覇バス) | **CONFIRMED** — named directly |
| Okinawa Bus (沖縄バス) | **CONFIRMED** — named directly |
| Ryukyu Bus Kotsu (琉球バス交通) | **CONFIRMED** — named directly |
| Toyo Bus (東陽バス) | **CONFIRMED** — named directly |
| JR (nationwide) | **CONFIRMED** — Ekispert's core, long-standing product function; also implicit in the ~210-company/~9,300-station aggregate |
| Shinkansen | **PARTIAL** — not broken out as a separate line item on the coverage page, but Ekispert's product materials describe Shinkansen support generically (per Phase 3B3A's research, re-confirmed unchanged); folded into the aggregate rail figure, not independently itemized this session |
| Kyoto/Osaka private rail (Hankyu, Keihan, Kintetsu, Nankai, etc.) | **PARTIAL** — general marketing/product-description claims of "nationwide private rail" coverage were found, but **no operator-by-name confirmation** the way Okinawa's bus operators and Yui Rail were found. The aggregate rail figure (~210 companies) is consistent with these being included, but consistency is not confirmation. |
| Metro/subway (nationwide) | **PARTIAL** — implied by the rail aggregate and Ekispert's core positioning as a nationwide transfer-guide product; not independently itemized |
| Ferry (where applicable) | **PARTIAL** — a national aggregate figure exists (~755 ports); no Okinawa-specific inter-island ferry confirmation was sought or found |

**Caveat that must not be dropped**: the busnavi-okinawa confirmation demonstrates Ekispert's
underlying *data* covers these operators, via a *production deployment*. It does not, by itself,
prove the specific commercial tier/contract this project would sign up for exposes the exact
same data through the API product — that is a reasonable, low-risk assumption (the underlying
engine and database are what the API sells), not a certainty, and should be spot-checked once an
actual account exists.

## 4. Real cost, reconfirmed

### Ekispert

| Option | Price (JPY) | What it gets you |
|---|---|---|
| Free plan | ¥0 | Rail/airline info, a simplified route-search feature; **average-wait-time search only, no real timetable-based search** |
| Pay-as-you-go, 5,000 requests | ¥5,500 (via Amazon.co.jp) | No subscription; one-time purchase |
| Pay-as-you-go, 10,000 requests | ¥11,000 | Same |
| Pay-as-you-go, 20,000 requests | ¥22,000 | Same |
| Standard Plan (subscription) | Initial fee + usage-based charges, not published — requires direct inquiry | Full feature set |
| Enterprise (on-premises) | Not disclosed | Custom |

No separate, itemized railway-timetable or per-operator licensing surcharge was found on the
pricing page or in the Standard Plan ToS — but Article 17 §3(3)'s support-scope disclaimer
(no inquiry support for data *content* questions) is a reminder that data-quality issues are the
contractor's own risk to manage, not necessarily that there are hidden fees.

### NAVITIME

| Option | Price | Notes |
|---|---|---|
| Direct contract, trial | Free, 90 days | Custom pricing after; eligibility for an individual not confirmed |
| RapidAPI/SBI, free/trial tier | Free | 500 requests, 50 requests/minute |
| RapidAPI/SBI, usable tier | **$200–300/month** | Re-confirmed unchanged from Phase 3B3A |

### Illustrative MXN order of magnitude (approximate, NOT a live FX quote — verify before any purchase)

| JPY/USD figure | Illustrative MXN (≈) |
|---|---|
| ¥5,500 | ≈ MXN $700 |
| ¥11,000 | ≈ MXN $1,400 |
| ¥22,000 | ≈ MXN $2,900 |
| $200 USD/mo | ≈ MXN $3,600/mo |
| $300 USD/mo | ≈ MXN $5,400/mo |

These use a rough placeholder conversion (~¥1 ≈ MXN $0.13; ~$1 USD ≈ MXN $18) that this session
did **not** verify against a live rate — they exist only to give a rough sense of scale, not to
be relied on for a purchase decision. Nothing was purchased.

## 5. Architectures, evaluated against what was actually read

| | A — Versioned static | B — Live transit | C — Hybrid (metadata static, schedule live) | D — Open-data hybrid | E — No commercial provider yet |
|---|---|---|---|---|---|
| ToS compatibility | **Incompatible** — Ekispert Art. 27(7)/(8) and NAVITIME Art. 5 §5 both prohibit exactly this pattern for a public repo | **Compatible as a general pattern** — the paradigm use case both ToS documents are written for; **Nihon-specific activation is `REQUIRES VENDOR CONFIRMATION`, not certain**, per §7.2 — a narrow live-display feature is well-supported by public evidence, but the project's own longer-term planning-recommendation ambition risks Article 27(10)③ regardless of storage pattern | **Same caveat as B** for the live part; the "static metadata" part inherits the same per-category uncertainty as §1.4/§2.1 | Compatible for the genuinely open-licensed portion (ODPT/GTFS); commercial portion same caveat as B/C | N/A — no provider means no ToS risk at all |
| Technical | Simple — matches existing `lookupTransfer`/precomputed-artifact pattern | Requires a live backend call path at request time — a real architectural addition this project has never had (every phase to date explicitly avoided runtime provider calls) | Same live requirement as B, plus a second, smaller static artifact | Requires building or hosting a routing engine (e.g. OpenTripPlanner) for the open-data portion — materially larger effort | None |
| Cost | Same request cost as B/D regardless of storage pattern | Ongoing per-request cost, same tiers as §4 | Same as B for the live portion | Free for open-data portion; commercial cost for the rest | Zero |
| Reproducibility | High (a committed JSON file is trivially reproducible) — **but not legally available** | Low in the traditional sense — a live answer is a fact about *when* it was asked, not a stable artifact; §6 of `TRANSIT_PROVIDER_DECISION.md`'s `schedule-aware` provenance discipline exists precisely for this | Partial — whatever *is* legally static stays reproducible; the live part is not | Static open-data portion is highly reproducible (GTFS is designed for this); commercial portion is not | N/A |
| User experience | N/A (not legally available) | Real-time, potentially slower (network round-trip at request time) but genuinely current | Same live latency for the schedule-critical part | Same, plus a risk of gaps where open data doesn't cover an operator | Status quo: haversine estimates only, honestly labelled `estimated` |
| Maintenance | N/A | Ongoing operational dependency on a third party at runtime — a new category of failure mode this project has not had before (walking is precomputed and offline; the app never fails because ORS is down) | Same new dependency, narrower surface | Two dependencies (open-data ingestion pipeline + live commercial calls) instead of one | None — status quo |
| Public-repo/portfolio compatibility | **Fails** — this is exactly what §1.4/2.1 rule out for a public repo | **Clean** — nothing provider-restricted ever enters the repo; only code/schema does | Clean for the live part; the static part must be scoped to categories actually confirmed safe (§6 below) | Clean for the open-data static portion (by design, GTFS is meant to be redistributed); commercial live portion same as B | Clean — there's nothing to leak |
| Schedule freshness | N/A | Always current — this is architecture B's actual advantage over A | Current for the live part | Current for the live part; static open data ages until re-synced | N/A |
| Okinawa coverage | N/A (not available) | **Confirmed for Ekispert** (§3) | Same | Open-data Okinawa coverage (ODPT/GTFS) was **not** confirmed in Phase 3B3A and was not re-checked this session — a real gap for this architecture specifically | N/A |
| Commercial dependency | N/A | Real — an ongoing paid relationship with Val Laboratory (or NAVITIME) becomes a runtime dependency of the app | Same, narrower | Two dependencies instead of one, but each individually smaller | None |

## 6. GitHub public-repo implications, by category

This repository is also a public portfolio piece (§12 of the task). Restated plainly from §1.4/
§2.1, organized by what actually matters for a commit decision:

| Category | Publishable in this public repo? |
|---|---|
| Integration code (a provider client, types, tests against synthetic fixtures) | **Yes.** Code is not "output data." No clause in either ToS restricts publishing the *code that calls* the service. |
| Schemas (our own `TransitProviderProvenance`-shaped types, request/response shape documentation written in our own words) | **Yes**, provided the schema doesn't itself embed real captured response content as an example — describe the shape, don't paste a real payload. |
| Synthetic/mock fixtures (invented station names, invented times, structurally matching the documented API shape but not real query results) | **Yes.** These are not "the Service's output data" — they were never obtained from the Service. This is the safe way to write tests and demonstrate the integration in a public portfolio without touching the restricted category at all. |
| Real provider output — route results, station/line master data as returned, timetables, fares | **No**, per §1.4/§2.1 — this is precisely what Article 27(7)/(8) (Ekispert) and Article 5 §5/§2 (NAVITIME) restrict, and a public repository is the clearest possible case of "made available to third parties." |
| Station IDs / route IDs (bare identifiers, no schedule/fare payload attached) | **Not confirmed either way** — treat as restricted until confirmed, not as a loophole. |
| Derived travel times/comparisons **we compute** (e.g., "average delta vs. our haversine estimate") | **Likely yes**, as reasoned in §1.4's last row — but flagged as an inference, not a vendor-confirmed permission. |

**Conclusion for this project specifically**: unlike openrouteservice's walking results (whose
CC BY 4.0/attribution-based terms are exactly why `data/logistics/walking-*-results.json` could
be committed in Phase 3B2A–H), **neither Ekispert nor NAVITIME's terms permit publishing real
API output in this public repository.** Any future transit integration must keep real provider
responses out of version control entirely — a structurally different rule than this project's
walking precedent, not a variation of it.

## 7. Decision gate

This document originally closed with a single `PROCEED WITH HYBRID` conclusion. An independent
review before merge correctly pointed out that this collapsed two genuinely different decisions
into one, and that the second was not actually settled by anything in §1–§6. They are separated
below, and neither is presented as more settled than the evidence supports.

### 7.1 Architecture decision — **PROCEED WITH HYBRID DESIGN**

This part *is* settled by what was actually read. Both of Phase 3B3A's named blockers are
resolved: the terms have been read (in detail for Ekispert; with reasonable but lesser
confidence for NAVITIME), and Okinawa coverage is confirmed for the recommended provider. What
follows holds regardless of how §7.2 resolves:

**What is static/versioned:**

- Integration code, types, and the `TransitProviderProvenance` schema (§8 of
  `TRANSIT_PROVIDER_DECISION.md`, still a specification only — not implemented by this phase
  either).
- Synthetic fixtures for tests — never real captured provider output.
- Our own derived, aggregate comparison statistics (not the underlying real data itself).
- Everything this project already has: the estimated `nearby.json` relations, and the validated
  walking artifacts — all untouched, all still governed by ORS's own, more permissive terms.

**What is live, never persisted:**

- Any real Ekispert route result, station/line data, timetable, or fare — queried at request
  time, rendered to the user who asked, and discarded. Never written to `data/logistics/`, never
  committed, never cached beyond the single request/response cycle (and even that transient
  handling should avoid ever reaching a general-purpose AI chat tool as real content — §1.3
  scenario B).

**Recommended provider: Ekispert API**, on cost fit (a genuine non-subscription pay-as-you-go
tier), confirmed Okinawa/Yui-Rail/four-named-bus-operator coverage, and the most detailed,
actually-read terms of any candidate. **Recommended secondary: NAVITIME API**, viable on the same
live-only architecture, weaker on cost and on confirmed coverage (Okinawa not confirmed for its
API), and read with somewhat less certainty this session.

### 7.2 Provider activation decision — **REQUIRES VENDOR CONFIRMATION**

This is the part the independent review found presented with more confidence than the evidence
supports, and it is not the same question as 7.1. **"Can we design toward a live-only
architecture" and "are we authorized to connect real Ekispert to Nihon Travel Explorer for its
own specific, stated purpose" are different questions, and only the first is answered by this
phase.**

What §1.6/§1.7 establish, from public evidence only:

- A narrowly-scoped, declared, ordinary transit-display feature (show the requesting user a real
  route/time) is **very likely** within the API's intended, licensed use — supported by
  Ekispert's own observed customer pattern (e.g., the Okinawa bus portal) and by the
  application-form-declared-scope mechanism Article 17 §1/27(4) describe.
- Nihon Travel Explorer's own longer-term, stated direction — helping order places/cities,
  generating planning recommendations from logistics data — drifts toward Article 27(10)③'s
  named, gated category ("AI models or analysis tools that handle public-transport data") in a
  way that a simple live-display feature does not.
- **This phase did not determine where, exactly, Nihon's actual eventual product sits on that
  spectrum**, because that depends on product decisions not yet made (how much of the roadmap's
  planning-recommendation ambition actually gets built, and how), not on anything more that could
  be learned from reading public documents.

**Conclusion: provider activation — i.e., actually contracting Ekispert and wiring real queries
into Nihon Travel Explorer, even for the narrow live-display case — is not blocked by anything
found, but is also not affirmatively cleared for Nihon's specific, full intended trajectory.**
It is classified `REQUIRES VENDOR CONFIRMATION`, not `PROHIBITED` and not `PERMITTED`: a written
answer from Val Laboratory (§7.3) would resolve it with actual certainty; this phase's own
public-document reasoning resolves it only with reasonable, not certain, confidence for the
narrow display case, and does not resolve it at all for the planning-recommendation direction.

**What remains open, and does not block the architecture decision (7.1) but does gate specific
future work:**

- Scenario B (real output shown to an AI coding assistant) — mitigated by never doing it, not
  resolved by a vendor answer. No action required unless a future phase wants certainty instead
  of avoidance.
- Scenario F / the planning-recommendation direction — gated on prior written consent from Val
  Laboratory (Ekispert) per Article 27(10)③. Not pursued without it.
- Whether Nihon's narrow, near-term live-display use case itself needs that same written consent,
  or is adequately covered by ordinary application-form scoping — genuinely unresolved without
  asking (§7.3's question 4).
- Private-only (non-public) caching of non-timetable categories (station/line metadata, fares,
  bare identifiers) — genuinely unclear from the text; treated as restricted until confirmed,
  which only matters if a future phase wants to reduce request volume via an internal cache —
  the live architecture recommended here does not need this answered to proceed.
- Kyoto/Osaka private-rail operator-level confirmation — only "PARTIAL" for Ekispert; worth a
  targeted follow-up before actually integrating Kansai coverage specifically, but does not
  block the Okinawa-driven recommendation above, since Okinawa was the coverage question this
  phase was specifically asked to resolve (it carries 32% of the current non-walking gap).
- NAVITIME's remaining 8 of 9 Article 5 §6 prohibited-use examples were not read — a gap in this
  session's research, not a finding.
- Whether the pay-as-you-go tier qualifies as a "Standard Plan contract" for MCP Server access —
  not confirmed (§1.5).

### 7.3 Vendor question — drafted, not sent

Per the independent review's specific request, this is the concrete question this project would
send Val Laboratory if a future phase decides certainty is worth pursuing before any provider
activation. **Not sent by this phase.**

**English:**

> We are developing a personal/portfolio Japan-trip-planning application that would use the
> Ekispert API live to display real routes, travel times, and transfers to the user who requests
> them (no output data would be stored — every query is made fresh, and results are rendered and
> discarded). In a later phase, we may use those live results as an ephemeral input — never
> stored, never used to train or fine-tune any model — to help a user compare or order a small
> set of candidate destinations for planning purposes. We do not intend to build a standalone
> public-transport-data analysis product for other customers. Does this use — specifically the
> planning-comparison part — require the prior written consent contemplated in Article 27(10),
> and is it permitted under the Standard Plan or pay-as-you-go tier, or does it require a
> different arrangement?

**Japanese (for direct use if a future phase sends it):**

> 弊社は、個人のポートフォリオとして日本旅行計画アプリケーションを開発しており、ユーザーの
> リクエストに応じて実際の経路・所要時間・乗り換えをライブでご提供いただいた「駅すぱあと
> API」の出力データを画面に表示する用途を想定しています（出力データは保存せず、毎回新規に
> 取得し、表示後は破棄します）。将来的なフェーズでは、この結果を一時的な入力として——保存せ
> ず、AIモデルの学習や拡張にも使用せず——ユーザーが少数の候補地を比較・順序付けする計画支援
> 機能に用いる可能性があります。他のお客様向けに公共交通データ分析製品を単独で開発・提供する
> 意図はありません。この用途——特に計画比較機能の部分——について、第27条第10項が想定する
> 事前の書面による承諾が必要でしょうか。また、スタンダードプランまたは買い切り型プランの
> 範囲でこの用途は許可されますか、それとも別途契約が必要でしょうか。

Also still open from the original pass (unchanged):

1. Does Article 27(6)'s AI-training prohibition extend to transiently sharing a real API response
   with a general-purpose AI coding assistant, where the response is not stored and not knowingly
   used to train the assistant's own models?
2. Does Article 27(8)'s "railway timetable information must be obtained each time" rule extend to
   bus timetable information, or is it limited to railway (鉄道) as literally written?
3. Is private, non-redistributed caching of station metadata, line metadata, or fares permitted,
   distinct from the public secondary-use/resale Article 27(7) addresses?

This phase does not send any of these questions. They are recorded so a future phase can, if it
decides certainty is worth the wait.

## 8. What was NOT decided here

- No provider was contracted, no account created, no plan purchased, no API key introduced.
- No live architecture was implemented — §7.1's recommendation is a decision to build *toward*,
  not code written this phase.
- **Provider activation for Nihon Travel Explorer's specific, full intended use is not cleared**
  — §7.2 classifies it `REQUIRES VENDOR CONFIRMATION`, reasoned as likely-fine for a narrow
  live-display feature and genuinely open for the planning-recommendation direction. This is a
  materially different statement than "Ekispert is authorized for integration."
- No answer to scenario B or F beyond "mitigate/gate" — neither was escalated to the vendor.
- No confirmation of private-only caching for non-timetable categories.
- No operator-level confirmation for Kyoto/Osaka private rail.
- No `TransitProviderProvenance` type added to `app/src/lib/transfer.ts`.
- No access point changed; `JP-181` not corrected; no default created.
- No inter-hub (Shinkansen/flight) data-model decision — unchanged from Phase 3B3A.

## 9. Proposed next phase (not started)

**Phase 3B3C — Live Transit Integration Design** (name proposed, not authorized here): design
(without implementing, and using only public documentation and synthetic fixtures — no real
Ekispert account or query) the actual request/response flow for a live-only Ekispert
integration — where in the request lifecycle the call happens, how `TransitProviderProvenance`
gets attached to an ephemeral (not stored) result, and how the UI would need to change to
support a network-dependent, non-precomputed transfer time alongside the existing precomputed
walking data. This design work does not depend on §7.2's open question and can proceed against
mock data regardless of how it resolves. Still not Phase 3C (route/day planning) — this is about
*validating one edge on demand*, not sequencing a trip.

**Provider activation itself — actually contracting Ekispert and connecting real queries to
Nihon Travel Explorer — is a separate, later decision from this design work**, and per §7.2
should not proceed for the project's full intended trajectory until either Val Laboratory
confirms §7.3's question in writing, or a future phase deliberately narrows Nihon's transit
feature to just the low-risk live-display case (§1.6) and accepts that boundary going forward.
