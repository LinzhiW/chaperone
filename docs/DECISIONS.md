# Canopy — Decision Log

> Big "we've-thought-this-through" calls live here, newest on top. Not for daily
> task tracking (that's TODO.md) — only direction-level decisions and the reasoning,
> so future-me (or another agent) doesn't re-litigate them.

---

## 2026-06-23 — Open-source / monetization: defer the license decision

**Question raised:** Should Canopy be open source? Tension: target users are
non-technical, but open-sourcing seems to force "bring your own API key," which is
unfriendly to non-tech users. Also unsure how to charge (usage is hard to meter) and
worried the product is too thin vs. Codex / Claude Code, which ship new features
constantly.

**Conclusion:** The question bundles three *independent* decisions — don't decide
them together:

1. **License** (open / closed / open-core) —
2. **Distribution** (user supplies key / we host & manage keys) —
3. **Monetization** (free / subscription / usage-based).

Key clarifications:
- "Open source → non-tech users must self-supply keys" is a **false causal link**.
  Open-sourcing the code and running a *hosted* version that manages keys can
  coexist — that's **open-core** (GitLab / PostHog / n8n model). Non-tech users use
  the hosted version.
- **Don't resell tokens / meter usage** — that's the hardest path (metering,
  fronting cost, reconciliation). Prefer **BYO-key + flat subscription on the
  orchestration layer**: tokens billed by the user directly to OpenAI/Anthropic; we
  charge a fixed price for the GUI + orchestration + skill system and never touch
  usage accounting. A higher hosted tier can bundle keys behind a flat price.
- **The real risk is #3 (thin product vs. official tools), and it's unrelated to
  licensing.** The friendly-GUI edge is *shrinking* (Claude Code already has
  desktop/web). The only **structural** moat is **provider-agnostic** (OpenAI will
  never ship a GUI that runs Gemini) plus the **skill-loadout UX** (novel but
  **unvalidated**).

**Decision:** **Do not decide the license now.** There is nothing shippable yet to
open (the execution loop has never run; the skill system is ~unbuilt). The order is:
1. Get the **core loop working** end-to-end (worker actually edits files on a branch
   → HITL → reviewer → merge) + at least one usable skill loadout.
2. Put it in front of **3 non-technical users** and watch whether the
   stop→review→merge cadence and the loadout UX actually land.
3. *Then* the license answers itself — if the differentiation holds, go **open-core**
   (open the orchestration layer for the build-in-public story; hosted version manages
   keys for non-tech users). If nobody wants it, the license question is moot.

**One-liner:** Open-source is a *result of validation*, not a decision to make now.
Agonizing over it is using a late-stage question to avoid the early, harder one —
*does anyone want this?* — which only a working loop + real users can answer.
