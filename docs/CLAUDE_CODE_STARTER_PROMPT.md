# Nicole: asking Claude Code to make an app change

## What you do

Open this project in Claude Code and describe what you want changed in your own words. You do not need a special technical prompt, a plan, code edits, commands, or pull request steps. For example:

> On the campaign report, make it easier to tell which doctors have not started yet.

You can also attach a screenshot and say what you want to be different. Claude reads the project instructions automatically, so you do not need to set up its process each time.

The project includes a `CLAUDE.md` file with instructions for Claude Code. Claude Code loads that file when it opens the project, so you do not have to copy and paste setup instructions each time.

## What Claude does

Claude checks the current app, makes the change in a separate draft, runs the checks, and opens a review page called a pull request. Claude should explain the result in everyday language and give you the link. If it asks you to run commands or manage code, tell it:

> Please follow the instructions in the project and handle the technical steps yourself. Tell me only if something is actually blocked, and explain it in plain language.

Claude may ask you a question if it cannot tell what result you want. Answer with what the app should do; Claude handles the implementation.

## How a change gets put live

1. Claude makes a separate review copy and runs the checks. The live app does not change while Claude is preparing this copy.
2. If a check fails, Claude fixes the problem and runs the checks again. Claude should not ask to put the change live until the checks pass.
3. Once the checks pass, Claude explains the change and asks: “The checks passed. If I merge this, the change will go on the live app. Would you like me to put it live now?”
4. Say “Yes, put it live” only when you want this specific change to go live. Claude will merge it and check that the automatic update finished successfully. If you say no, or do not answer, the review copy stays there and the live app does not change.
5. After a successful update, Claude tells you which part of the app to check and asks you to confirm that it looks right. If the code changes after you approve, Claude must run the checks again and ask before putting the changed version live.

## If something looks wrong

If something looks wrong, tell Claude, “Please restore the previous working version.” Claude will prepare that restoration as another review copy and run the checks. It will ask you again before putting the restoration live. This brings back the earlier app code and keeps a record of both changes. If a change could affect live records or trigger an outside action, Claude must explain that and get Jake involved first.

If a change involves an n8n workflow, the saved project file does not update the live workflow by itself. Claude should explain that a separate live-workflow step is needed before anyone makes it live.
