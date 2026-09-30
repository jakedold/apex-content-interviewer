#!/usr/bin/env python3
"""Repair AAC workflow credential bindings from known-good live donor workflows.

This script does not read or print credential secrets. It only copies n8n credential
references (credential id/name metadata) from other live workflows that already use
the same node type/authentication mode.

It backs up the four target workflows before changing anything, updates them in
place, restores their active state, and verifies that credential-bearing nodes are
bound afterwards.
"""

from __future__ import annotations

import copy
import datetime as dt
import getpass
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

BASE_URL = os.environ.get("N8N_BASE_URL", "https://n8n.apexdentalautomation.com").rstrip("/")
TARGET_NAMES = [
    "AAC - 02 - Dispatch Campaign Invitations",
    "AAC - 05 - Interview Completed",
    "AAC - 16 - Send Doctor Message",
    "AAC - 24 - Admin Command Router",
]

REQUIRED_CREDENTIAL_NODE_TYPES = {
    "n8n-nodes-base.googleBigQuery",
    "n8n-nodes-base.gmail",
}


class ApiError(RuntimeError):
    pass


def api(api_key: str, method: str, path: str, payload: dict[str, Any] | None = None) -> Any:
    body = None if payload is None else json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(f"{BASE_URL}/api/v1{path}", data=body, method=method)
    request.add_header("Accept", "application/json")
    request.add_header("X-N8N-API-KEY", api_key)
    if body is not None:
        request.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            raw = response.read().decode("utf-8")
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="replace")
        raise ApiError(f"{method} {path} failed with HTTP {exc.code}: {raw[:1000]}") from exc
    except urllib.error.URLError as exc:
        raise ApiError(f"{method} {path} failed: {exc}") from exc


def list_workflows(api_key: str) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    cursor: str | None = None
    while True:
        params = {"limit": "250"}
        if cursor:
            params["cursor"] = cursor
        result = api(api_key, "GET", "/workflows?" + urllib.parse.urlencode(params))
        items.extend(result.get("data", []))
        cursor = result.get("nextCursor")
        if not cursor:
            break
    return items


def update_payload(workflow: dict[str, Any]) -> dict[str, Any]:
    allowed_settings = {
        "saveExecutionProgress",
        "saveManualExecutions",
        "saveDataErrorExecution",
        "saveDataSuccessExecution",
        "executionTimeout",
        "errorWorkflow",
        "timezone",
        "executionOrder",
        "callerPolicy",
    }
    settings = workflow.get("settings") or {}
    return {
        "name": workflow["name"],
        "nodes": copy.deepcopy(workflow.get("nodes", [])),
        "connections": copy.deepcopy(workflow.get("connections", {})),
        "settings": {k: copy.deepcopy(v) for k, v in settings.items() if k in allowed_settings},
    }


def node_requires_credentials(node: dict[str, Any]) -> bool:
    node_type = str(node.get("type", ""))
    if node_type in REQUIRED_CREDENTIAL_NODE_TYPES:
        return True
    if node_type == "n8n-nodes-base.webhook" and node.get("parameters", {}).get("authentication") not in (None, "", "none"):
        return True
    return False


def credential_key(node: dict[str, Any]) -> tuple[str, str]:
    node_type = str(node.get("type", ""))
    if node_type == "n8n-nodes-base.webhook":
        auth = str(node.get("parameters", {}).get("authentication") or "")
        return node_type, auth
    return node_type, ""


def main() -> int:
    api_key = os.environ.get("N8N_API_KEY", "").strip() or getpass.getpass("Paste n8n API key (input hidden): ").strip()
    if not api_key:
        print("No API key supplied.", file=sys.stderr)
        return 2

    print(f"n8n instance: {BASE_URL}")
    workflow_summaries = list_workflows(api_key)
    by_name = {str(item.get("name", "")): item for item in workflow_summaries if item.get("id")}

    missing_targets = [name for name in TARGET_NAMES if name not in by_name]
    if missing_targets:
        raise RuntimeError("Missing target workflows: " + ", ".join(missing_targets))

    # Load all workflows so we can find known-good credential references without
    # exposing them. Donor references are used only if every observed donor for
    # the same node/auth type agrees on one credential binding.
    details: list[dict[str, Any]] = []
    for item in workflow_summaries:
        workflow_id = item.get("id")
        if workflow_id:
            details.append(api(api_key, "GET", f"/workflows/{workflow_id}"))

    donor_refs: dict[tuple[str, str], dict[str, Any]] = {}
    ambiguous: set[tuple[str, str]] = set()
    for workflow in details:
        if workflow.get("name") in TARGET_NAMES:
            continue
        for node in workflow.get("nodes", []):
            credentials = node.get("credentials")
            if not credentials or not node_requires_credentials(node):
                continue
            key = credential_key(node)
            if key in donor_refs and donor_refs[key] != credentials:
                ambiguous.add(key)
            else:
                donor_refs[key] = copy.deepcopy(credentials)

    for key in ambiguous:
        donor_refs.pop(key, None)

    target_details: dict[str, dict[str, Any]] = {}
    original_active: dict[str, bool] = {}
    timestamp = dt.datetime.now().strftime("%Y%m%d-%H%M%S")
    backup_dir = Path.home() / "Desktop" / f"aac-credential-repair-backup-{timestamp}"
    backup_dir.mkdir(parents=True, exist_ok=True)

    for name in TARGET_NAMES:
        workflow_id = str(by_name[name]["id"])
        workflow = api(api_key, "GET", f"/workflows/{workflow_id}")
        target_details[name] = workflow
        original_active[name] = bool(workflow.get("active"))
        (backup_dir / f"{workflow_id}-{name.replace('/', '_')}.json").write_text(
            json.dumps(workflow, indent=2) + "\n",
            encoding="utf-8",
        )

    # First pass: determine exactly what needs repair and fail closed if no unique
    # known-good donor credential is available.
    repairs: list[tuple[str, str, tuple[str, str]]] = []
    unresolved: list[str] = []
    for name, workflow in target_details.items():
        for node in workflow.get("nodes", []):
            if not node_requires_credentials(node) or node.get("credentials"):
                continue
            key = credential_key(node)
            if key not in donor_refs:
                unresolved.append(f"{name} -> {node.get('name')} ({key[0]} auth={key[1] or 'default'})")
            else:
                repairs.append((name, str(node.get("name", "")), key))

    print(f"Backups: {backup_dir}")
    print()
    if not repairs and not unresolved:
        print("All required AAC credential bindings are already present. No repair needed.")
        return 0

    if unresolved:
        print("Cannot repair automatically because no unique known-good donor credential was found for:")
        for item in unresolved:
            print(f"  - {item}")
        print()
        print("No live workflows were changed.")
        return 1

    print("Credential bindings to repair:")
    for name, node_name, key in repairs:
        print(f"  - {name} -> {node_name} ({key[0]}{f' / {key[1]}' if key[1] else ''})")

    changed_workflows: list[str] = []
    try:
        for name, workflow in target_details.items():
            needed = [(node_name, key) for wf_name, node_name, key in repairs if wf_name == name]
            if not needed:
                continue

            workflow_id = str(workflow["id"])
            if workflow.get("active"):
                api(api_key, "POST", f"/workflows/{workflow_id}/deactivate")

            desired = copy.deepcopy(workflow)
            by_node_name = {str(node.get("name", "")): node for node in desired.get("nodes", [])}
            for node_name, key in needed:
                by_node_name[node_name]["credentials"] = copy.deepcopy(donor_refs[key])

            api(api_key, "PUT", f"/workflows/{workflow_id}", update_payload(desired))
            changed_workflows.append(name)

            if original_active[name]:
                api(api_key, "POST", f"/workflows/{workflow_id}/activate")

        print()
        print("Verifying repaired workflows...")
        for name in TARGET_NAMES:
            workflow_id = str(by_name[name]["id"])
            workflow = api(api_key, "GET", f"/workflows/{workflow_id}")
            missing = [
                str(node.get("name", ""))
                for node in workflow.get("nodes", [])
                if node_requires_credentials(node) and not node.get("credentials")
            ]
            if missing:
                raise RuntimeError(f"{name} still has missing credential bindings: {', '.join(missing)}")
            if bool(workflow.get("active")) != original_active[name]:
                raise RuntimeError(f"{name} active state was not restored correctly.")
            print(f"  OK: {name}")

    except Exception:
        print("\nRepair failed. Restoring changed workflows from backups...", file=sys.stderr)
        for name in reversed(changed_workflows):
            original = target_details[name]
            workflow_id = str(original["id"])
            try:
                current = api(api_key, "GET", f"/workflows/{workflow_id}")
                if current.get("active"):
                    api(api_key, "POST", f"/workflows/{workflow_id}/deactivate")
                api(api_key, "PUT", f"/workflows/{workflow_id}", update_payload(original))
                if original_active[name]:
                    api(api_key, "POST", f"/workflows/{workflow_id}/activate")
                print(f"  rolled back: {name}", file=sys.stderr)
            except Exception as rollback_error:
                print(f"  rollback warning for {name}: {rollback_error}", file=sys.stderr)
        raise

    print()
    print("SUCCESS")
    print("AAC credential bindings were repaired without exposing credential secrets.")
    print(f"Backups are at: {backup_dir}")
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
