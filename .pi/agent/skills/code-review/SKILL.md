---
name: code-review
description: "Review the changes since a fixed point (commit, branch, tag, or merge-base) along two axes: Standards (does the code follow this repo's documented coding standards?) and Spec (does the code match what the originating issue/spec asked for?). Each axis runs on both the reviewer and reviewer-alt agents in parallel sub-agents, reported side by side. Use when the user wants to review a branch, a PR, work-in-progress changes, or asks to \"review since X\"."
---

Read and follow the upstream skill at `../../git/github.com/mattpocock/skills/skills/engineering/code-review/SKILL.md` (relative to this skill's directory), with these local changes:

## Step 4: each axis runs on two agents

Send each axis's prompt, exactly as upstream builds it, to both the `reviewer` and the `reviewer-alt` agent definitions. Issue all four sub-agent calls together, in parallel. If the Spec axis is skipped, both of its sub-agents are skipped.

If `reviewer-alt` is unavailable (the definition is missing, or the delegation fails), say so in the final report and carry on with `reviewer` alone.

## Step 5: aggregate

Under each axis heading, present both reports separately under `### reviewer` and `### reviewer-alt`. Don't merge or rerank them; you may note where they agree or contradict.

In the closing summary, give finding counts and the worst issue per axis, per agent.
