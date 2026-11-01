# HTML-first PPT Implementation Plan

> Use executing-plans inline. User explicitly replaced the website shortcut with WorkBuddy HTML review before editable export.

**Goal:** Withdraw the PPT.AI copy/open route; require a real HTML deck review before editable PPTX generation.
**Architecture:** Keep existing task/run/version storage. Add immutable HTML versions, a sandboxed page endpoint, explicit version-bound export approval, and separate CLI html/html-modify/export phases. WorkBuddy authors both HTML and PPTX; platform hosts, validates, confirms and archives.
**Spec:** Current user instruction; docs/ui-feedback-standard.md. Retain upload, structured outline, stable progress and two-hour fixes.

- [x] Remove website UI/routes/prompt dependency, preserve old records without deleting data.
- [x] HTML manifest, bounded/self-contained document validation and sandbox/CSP serving.
- [x] Separate outline → HTML → review → editable export; enforce version/revision gates server-side, cancellation and late-output protection.
- [x] Actual HTML iframe delivery view, per-page HTML changes, immutable history and explicit confirmation.
- [x] Isolated tests for gate bypass, stale approval, HTML safety, publication/download, cancellation and legacy PPTX preservation.
- [x] Update docs and activate only when no teaching jobs are running. No paid model run or automatic retry in this iteration.

Developer checks passed; user acceptance and real model end-to-end HTML/export remain pending. Local activation verified HTTP 200 and unchanged hashes for all 75 existing data files.

HTML is the final review representation; PPTX is generated only after user approval of that representation. Python/PPTX skill routing is deferred to export, rather than loading the heavy export workflow during outline/HTML creation. HTML supports static standalone pages with inline assets; active scripts, remote resources and third-party embeds are disallowed. Export requires native editable text, not whole-page screenshot wrapping.
