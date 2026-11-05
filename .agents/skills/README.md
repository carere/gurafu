# Repository skills

Skills in this directory are committed with Delimoov so sandbox checkouts receive
both the engineering workflows and their repository adaptations. Agents should use
these copies when available. Personal home-directory skills are maintained separately.

## Matt Pocock upstream

The installed Matt Pocock skills were reconciled against
[`mattpocock/skills` at `49dd158d1076134a641b33efb035946536778336`](https://github.com/mattpocock/skills/tree/49dd158d1076134a641b33efb035946536778336)
on 2026-10-13. The upstream MIT notice is in [MATT-POCOCK-LICENSE](MATT-POCOCK-LICENSE).
The `pr` skill retains its additional attribution in [pr/CREDITS.md](pr/CREDITS.md).

`pr` is model-invoked when writing PR descriptions. `retro` is user-invoked to
suggest improvements after a coding session. `ask-matt` routes to both alongside
the existing engineering workflows. Experimental and miscellaneous upstream skills
were not added. The existing `resolving-merge-conflicts` skill remains installed,
even though it is absent from this upstream revision.

## Preserve these adaptations on updates

- **Spec templates:** [to-spec/SKILL.md](to-spec/SKILL.md) selects
  [wayfinder-spec-template.md](to-spec/wayfinder-spec-template.md) for a source issue
  labelled `wayfinder:map`; otherwise it uses
  [regular-spec-template.md](to-spec/regular-spec-template.md). Preserve both files
  and their selection rule rather than restoring upstream's inline template.
- **Domain layout:** [domain-modeling/CONTEXT-FORMAT.md](domain-modeling/CONTEXT-FORMAT.md)
  defines `docs/context/root.md` for one context, or `docs/context/map.md` and sibling
  context files for multiple contexts.
  [ADR-FORMAT.md](domain-modeling/ADR-FORMAT.md) defines flat ADRs for one context,
  or `docs/adr/root/` and `docs/adr/<context>/` for multiple contexts. Preserve lazy
  creation, ownership boundaries, scoped numbering and migration checks. Update all
  consuming skills and setup templates together; upstream glossary filenames are
  legacy inputs to migrate, rather than new canonical outputs. `teach` has its own
  learning-workspace glossary and is independent of project domain documentation.
- **PRs:** [pr/SKILL.md](pr/SKILL.md) uses upstream's Summary / Evidence / Merge Danger template as the
  authoritative PR body format. UI features require playable video evidence with
  commit/environment and fixture labels; non-UI changes retain upstream evidence
  guidance. CI reads the template directly from the skill.
- **Standards:** review and retrospective guidance use `CODING_STANDARD.md` and
  respect the repository's existing tools and contributor instructions.

For the next update, compare the pinned upstream revision, the repository copies
and the selected new upstream revision. Merge upstream changes while retaining
these adaptations and any subsequent local edits. Check supporting resources,
relative links, invocation metadata and cross-skill paths before updating this pin.
