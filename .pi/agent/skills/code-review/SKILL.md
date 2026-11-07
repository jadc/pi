---
name: code-review
description: "Review the changes since a fixed point (commit, branch, tag, or merge-base) along two axes: Standards (does the code follow this repo's documented coding standards?) and Spec (does the code match what the originating issue/spec asked for?). Each axis runs on two models in parallel sub-agents, reported side by side. Use when the user wants to review a branch, a PR, work-in-progress changes, or asks to \"review since X\"."
---

Read and follow the upstream skill at `../../git/github.com/mattpocock/skills/skills/engineering/code-review/SKILL.md` (relative to this skill's directory), with these local changes:

- **Step 4:** run each axis's prompt, exactly as upstream builds it, twice, all in parallel (a skipped Spec axis skips both): once on your own model, and once on `openai-codex/gpt-6-astra` at xhigh thinking. If a run can't use its model, say so in the final report instead of substituting another, and carry on with the runs that worked.
- **Step 5:** under each axis heading, present the two runs separately, headed by model name, without merging or reranking (noting agreements or contradictions is fine). The closing summary gives finding counts and the worst issue per axis, per model.
