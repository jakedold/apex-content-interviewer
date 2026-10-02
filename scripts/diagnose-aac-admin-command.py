#!/usr/bin/env python3
"""Print a safe summary of recent AAC Admin Command Router executions.

The script intentionally does not print workflow inputs, request headers, credentials,
or full execution payloads. It prints only execution metadata and n8n error messages.
"""

from __future__ import annotations

import getpass
import argparse
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

BASE_URL = os.environ.get("N8N_BASE_URL", "https://n8n.apexdentalautomation.com").rstrip("/")
DEFAULT_WORKFLOW_NAME = "AAC - 24 - Admin Command Router"


def api(api_key: str, path: str) -> Any:
    request = urllib.request.Request(f"{BASE_URL}/api/v1{path}", method="GET")
    request.add_header("Accept", "application/json")
    request.add_header("X-N8N-API-KEY", api_key)
    try:
        with urllib.request.urlopen(request, timeout=45) as response:
            raw = response.read().decode("utf-8")
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"GET {path} failed with HTTP {exc.code}: {raw[:500]}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"GET {path} failed: {exc}") from exc


def list_workflows(api_key: str) -> list[dict[str, Any]]:
    result = api(api_key, "/workflows?limit=250")
    return list(result.get("data", []))


def safe_error_summary(execution: dict[str, Any]) -> list[str]:
    lines: list[str] = []
    data = execution.get("data") or {}
    result_data = data.get("resultData") or {}

    top_error = result_data.get("error")
    if isinstance(top_error, dict):
        message = top_error.get("message") or top_error.get("description")
        node = top_error.get("node")
        node_name = node.get("name") if isinstance(node, dict) else None
        if node_name:
            lines.append(f"Top-level error node: {node_name}")
        if message:
            lines.append(f"Top-level error: {message}")
    elif top_error:
        lines.append(f"Top-level error: {top_error}")

    run_data = result_data.get("runData") or {}
    if isinstance(run_data, dict):
        for node_name, runs in run_data.items():
            if not isinstance(runs, list):
                continue
            for run in runs:
                if not isinstance(run, dict):
                    continue
                error = run.get("error")
                if not error:
                    continue
                if isinstance(error, dict):
                    message = error.get("message") or error.get("description") or error.get("name")
                else:
                    message = str(error)
                lines.append(f"Node error [{node_name}]: {message}")

    return lines


def main() -> int:
    parser = argparse.ArgumentParser(description="Safely summarize recent n8n workflow executions.")
    parser.add_argument("--workflow", default=DEFAULT_WORKFLOW_NAME, help="Exact n8n workflow name")
    args = parser.parse_args()
    workflow_name = args.workflow

    api_key = os.environ.get("N8N_API_KEY", "").strip()
    if not api_key:
        api_key = getpass.getpass("Paste n8n API key (input hidden): ").strip()
    if not api_key:
        print("No API key supplied.", file=sys.stderr)
        return 2

    workflows = list_workflows(api_key)
    matches = [workflow for workflow in workflows if workflow.get("name") == workflow_name]
    if len(matches) != 1:
        print(f"Expected exactly one workflow named {workflow_name!r}; found {len(matches)}.", file=sys.stderr)
        return 1

    workflow_id = str(matches[0]["id"])
    params = urllib.parse.urlencode({"workflowId": workflow_id, "limit": "10"})
    result = api(api_key, f"/executions?{params}")
    executions = list(result.get("data", []))

    print(f"Workflow: {workflow_name}")
    print(f"Workflow ID: {workflow_id}")
    print(f"Workflow active: {bool(matches[0].get('active'))}")
    print("Recent executions:")
    if not executions:
        print("  No executions returned by the API.")
        return 0

    for execution in executions:
        print(
            "  "
            f"id={execution.get('id')} "
            f"status={execution.get('status')} "
            f"started={execution.get('startedAt')} "
            f"stopped={execution.get('stoppedAt')}"
        )

    target = next((execution for execution in executions if execution.get("status") in {"error", "crashed"}), executions[0])
    execution_id = str(target["id"])
    detail = api(api_key, f"/executions/{urllib.parse.quote(execution_id)}?includeData=true")
    summaries = safe_error_summary(detail)

    print()
    print(f"Diagnostic detail for execution {execution_id}:")
    if summaries:
        for line in summaries:
            print(f"  {line}")
    else:
        print("  No explicit n8n error object was found in the execution data.")
        print("  The execution status above is still useful for the next troubleshooting step.")

    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        print("\nCancelled.", file=sys.stderr)
        raise SystemExit(130)
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise SystemExit(1)
