---
name: code-review
description: "Review the changes since a fixed point (commit, branch, tag, or merge-base) along two axes: Standards (does the code follow this repo's documented coding standards?) and Spec (does the code match what the originating issue/spec asked for?). Each axis runs on both the reviewer and reviewer-alt agents in parallel sub-agents, reported side by side. Use when the user wants to review a branch, a PR, work-in-progress changes, or asks to \"review since X\"."
---

Read and follow the upstream skill at `../../git/github.com/mattpocock/skills/skills/engineering/code-review/SKILL.md` (relative to this skill's directory), with these local changes:

- **Step 4:** send each axis's prompt, exactly as upstream builds it, to both the `reviewer` and `reviewer-alt` agent definitions, all in parallel (a skipped Spec axis skips both). If `reviewer-alt` is unavailable (missing definition or failed delegation), say so in the final report and carry on with `reviewer` alone.
- **Step 5:** under each axis heading, present the two reports separately as `### reviewer` and `### reviewer-alt`, without merging or reranking (noting agreements or contradictions is fine). The closing summary gives finding counts and the worst issue per axis, per agent.
