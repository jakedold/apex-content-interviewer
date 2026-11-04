# Nicole: asking Claude Code to make an app change

## What you do

Open this project in Claude Code and describe what you want changed in your own words. You do not need to write a technical prompt, make a plan, edit code, run commands, or create a pull request.

For example:

> On the campaign report, make it easier to tell which doctors have not started yet.

You can also attach a screenshot and say what you want to be different.

The project includes a `CLAUDE.md` file with instructions for Claude Code. Claude Code loads that file when it opens the project, so you do not have to copy and paste setup instructions each time.

## What Claude does

Claude checks the current app, makes the change in a separate draft, runs the checks, and opens a review page called a pull request. Claude should explain the result in everyday language and give you the link. If it asks you to run commands or manage code, tell it:

> Please follow the instructions in the project and handle the technical steps yourself. Tell me only if something is actually blocked, and explain it in plain language.

Claude may ask you a question if it cannot tell what result you want. Answer with what the app should do; Claude handles the implementation.

## What happens before the live app changes

The pull request is a review page. It does not change the live app. Jake reviews it and decides whether to merge it. After he merges, GitHub checks the change and updates the live app automatically. You do not need to visit Cloudflare or deploy anything yourself.

If a change involves an n8n workflow, the saved project file does not update the live workflow by itself. Claude should tell Jake that a separate live-workflow step is needed.
