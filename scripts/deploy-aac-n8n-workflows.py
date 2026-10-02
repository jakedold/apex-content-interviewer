#!/usr/bin/env python3
"""Safely deploy selected AAC workflow JSON files to the live n8n instance.

- Reads the n8n API key only from N8N_API_KEY.
- Backs up the live workflows before changes.
- Preserves live credential bindings.
- Resolves Execute Workflow references by current live workflow name.
- Temporarily deactivates workflows that are currently active.
- Updates all target workflows in place.
- Restores their original active/inactive state.
- Attempts rollback from the backups if an update fails.
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
API_KEY = os.environ.get("N8N_API_KEY", "").strip()

ROOT = Path(__file__).resolve().parents[1]
CORE_TARGETS = [
    ("AAC - 02 - Dispatch Campaign Invitations", ROOT / "n8n/02-dispatch-campaign-invitations.json"),
    ("AAC - 05 - Interview Completed", ROOT / "n8n/05-interview-completed.json"),
    ("AAC - 16 - Send Doctor Message", ROOT / "n8n/16-send-doctor-message.json"),
    ("AAC - 24 - Admin Command Router", ROOT / "n8n/24-admin-command-router.json"),
]

VERIFIED_PRACTICE_TARGETS = [
    ("AAC - 06 - Generate Article", ROOT / "n8n/06-generate-article.json"),
    ("AAC - 07 - Create Doctor Review Link", ROOT / "n8n/07-create-doctor-review-link.json"),
    ("AAC - 10 - Revise Article from Doctor Feedback", ROOT / "n8n/10-revise-article-from-doctor-feedback.json"),
    ("AAC - 12 - Route to Marketing Review", ROOT / "n8n/12-route-to-marketing-review.json"),
    ("AAC - 18 - Send Marketing Review Invitation", ROOT / "n8n/18-send-marketing-review-invitation.json"),
    ("AAC - 20 - Revise Article from Marketing Feedback", ROOT / "n8n/20-revise-article-from-marketing-feedback.json"),
]

AUTHORSHIP_TARGETS = [
    ("AAC - 06 - Generate Article", ROOT / "n8n/06-generate-article.json"),
    ("AAC - 10 - Revise Article from Doctor Feedback", ROOT / "n8n/10-revise-article-from-doctor-feedback.json"),
    ("AAC - 15 - Publish Approved Article to WordPress", ROOT / "n8n/15-publish-approved-article-to-wordpress.json"),
    ("AAC - 20 - Revise Article from Marketing Feedback", ROOT / "n8n/20-revise-article-from-marketing-feedback.json"),
    ("AAC - 25 - Sync Doctor Census", ROOT / "n8n/25-sync-doctor-census.json"),
]

if "--authorship-only" in sys.argv[1:]:
    TARGETS = AUTHORSHIP_TARGETS
elif "--verified-practices-only" in sys.argv[1:]:
    TARGETS = VERIFIED_PRACTICE_TARGETS
else:
    TARGETS = CORE_TARGETS

ALLOWED_SETTINGS = {
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


class ApiError(RuntimeError):
    pass


def api(method: str, path: str, payload: dict[str, Any] | None = None) -> Any:
    url = f"{BASE_URL}/api/v1{path}"
    body = None if payload is None else json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(url, data=body, method=method)
    request.add_header("Accept", "application/json")
    request.add_header("X-N8N-API-KEY", API_KEY)
    if body is not None:
        request.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            raw = response.read().decode("utf-8")
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="replace")
        raise ApiError(f"{method} {path} failed with HTTP {exc.code}: {raw}") from exc
    except urllib.error.URLError as exc:
        raise ApiError(f"{method} {path} failed: {exc}") from exc


def list_workflows() -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    cursor: str | None = None
    while True:
        params = {"limit": "250"}
        if cursor:
            params["cursor"] = cursor
        result = api("GET", "/workflows?" + urllib.parse.urlencode(params))
        items.extend(result.get("data", []))
        cursor = result.get("nextCursor")
        if not cursor:
            break
    return items


def clean_settings(settings: dict[str, Any] | None) -> dict[str, Any]:
    settings = settings or {}
    return {key: copy.deepcopy(value) for key, value in settings.items() if key in ALLOWED_SETTINGS}


def workflow_update_payload(workflow: dict[str, Any]) -> dict[str, Any]:
    return {
        "name": workflow["name"],
        "nodes": copy.deepcopy(workflow.get("nodes", [])),
        "connections": copy.deepcopy(workflow.get("connections", {})),
        "settings": clean_settings(workflow.get("settings", {})),
    }


def credential_signature(credentials: dict[str, Any]) -> str:
    return json.dumps(credentials, sort_keys=True, separators=(",", ":"))


def align_bigquery_authentication(node: dict[str, Any]) -> None:
    """Keep the BigQuery auth selector compatible with the preserved credential."""
    if node.get("type") != "n8n-nodes-base.googleBigQuery":
        return
    credentials = node.get("credentials") or {}
    parameters = node.setdefault("parameters", {})
    if "googleBigQueryOAuth2Api" in credentials:
        parameters["authentication"] = "oAuth2"
    elif "googleApi" in credentials:
        parameters["authentication"] = "serviceAccount"


def has_compatible_credentials(node: dict[str, Any]) -> bool:
    credentials = node.get("credentials") or {}
    if node.get("type") != "n8n-nodes-base.googleBigQuery":
        return bool(credentials)
    authentication = node.get("parameters", {}).get("authentication")
    required = "googleApi" if authentication == "serviceAccount" else "googleBigQueryOAuth2Api"
    binding = credentials.get(required)
    return isinstance(binding, dict) and bool(binding.get("id"))


def prepare_desired(
    desired: dict[str, Any],
    live: dict[str, Any],
    workflow_ids_by_name: dict[str, str],
) -> dict[str, Any]:
    desired = copy.deepcopy(desired)
    live_nodes = live.get("nodes", [])

    exact_credentials: dict[tuple[str, str], dict[str, Any]] = {}
    type_credentials: dict[str, list[dict[str, Any]]] = {}

    for node in live_nodes:
        credentials = node.get("credentials")
        if not credentials:
            continue
        key = (str(node.get("name", "")), str(node.get("type", "")))
        exact_credentials[key] = copy.deepcopy(credentials)
        type_credentials.setdefault(str(node.get("type", "")), []).append(copy.deepcopy(credentials))

    unique_type_credentials: dict[str, dict[str, Any]] = {}
    for node_type, values in type_credentials.items():
        by_signature = {credential_signature(value): value for value in values}
        if len(by_signature) == 1:
            unique_type_credentials[node_type] = copy.deepcopy(next(iter(by_signature.values())))

    for node in desired.get("nodes", []):
        node_type = str(node.get("type", ""))
        node_name = str(node.get("name", ""))

        if not node.get("credentials"):
            exact = exact_credentials.get((node_name, node_type))
            if exact:
                node["credentials"] = copy.deepcopy(exact)
            elif node_type in unique_type_credentials:
                node["credentials"] = copy.deepcopy(unique_type_credentials[node_type])

        align_bigquery_authentication(node)

        if node_type == "n8n-nodes-base.executeWorkflow":
            workflow_id = node.get("parameters", {}).get("workflowId")
            if isinstance(workflow_id, dict):
                cached_name = workflow_id.get("cachedResultName")
                if cached_name and cached_name in workflow_ids_by_name:
                    workflow_id["value"] = workflow_ids_by_name[cached_name]
                    workflow_id["mode"] = "list"

    # Verify every credential-bearing node type used live is still bound in desired
    # whenever a desired node of that same type exists.
    live_credential_types = set(type_credentials)
    for node in desired.get("nodes", []):
        if node.get("type") in live_credential_types and not has_compatible_credentials(node):
            raise RuntimeError(
                f"Could not safely determine credentials for node "
                f"'{node.get('name')}' ({node.get('type')}) in {desired.get('name')}."
            )

    return desired


def set_active(workflow_id: str, active: bool) -> None:
    api("POST", f"/workflows/{workflow_id}/{'activate' if active else 'deactivate'}")


def main() -> int:
    global API_KEY
    if not API_KEY:
        API_KEY = getpass.getpass("Paste n8n API key (input hidden): ").strip()
    if not API_KEY:
        print("ERROR: An n8n API key is required.", file=sys.stderr)
        return 2

    print(f"n8n instance: {BASE_URL}")
    print("Checking API access...")
    all_workflows = list_workflows()
    print(f"API access confirmed. Found {len(all_workflows)} workflows.")

    by_name: dict[str, list[dict[str, Any]]] = {}
    for item in all_workflows:
        by_name.setdefault(str(item.get("name", "")), []).append(item)

    live_index: dict[str, dict[str, Any]] = {}
    workflow_ids_by_name: dict[str, str] = {}
    for name, items in by_name.items():
        if len(items) == 1 and items[0].get("id"):
            workflow_ids_by_name[name] = str(items[0]["id"])

    for name, path in TARGETS:
        matches = by_name.get(name, [])
        if len(matches) != 1:
            raise RuntimeError(f"Expected exactly one live workflow named '{name}', found {len(matches)}.")
        workflow_id = str(matches[0]["id"])
        live_index[name] = api("GET", f"/workflows/{workflow_id}")
        if not path.exists():
            raise RuntimeError(f"Missing local workflow file: {path}")

    timestamp = dt.datetime.now().strftime("%Y%m%d-%H%M%S")
    backup_dir = Path.home() / "Desktop" / f"aac-n8n-backup-{timestamp}"
    backup_dir.mkdir(parents=True, mode=0o700)
    print(f"Backing up live workflows to: {backup_dir}")

    manifest: dict[str, Any] = {"created_at": timestamp, "base_url": BASE_URL, "workflows": []}
    for idx, (name, _) in enumerate(TARGETS, start=1):
        live = live_index[name]
        backup_path = backup_dir / f"{idx:02d}-{name.replace('/', '_')}.json"
        backup_path.write_text(json.dumps(live, indent=2) + "\n", encoding="utf-8")
        manifest["workflows"].append(
            {
                "name": name,
                "id": live.get("id"),
                "active": bool(live.get("active")),
                "backup_file": backup_path.name,
            }
        )
    (backup_dir / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")

    prepared: dict[str, dict[str, Any]] = {}
    for name, path in TARGETS:
        desired = json.loads(path.read_text(encoding="utf-8"))
        if desired.get("name") != name:
            raise RuntimeError(f"Local file {path} contains unexpected workflow name {desired.get('name')!r}.")
        prepared[name] = prepare_desired(desired, live_index[name], workflow_ids_by_name)

    print("Preflight passed:")
    for name, _ in TARGETS:
        live = live_index[name]
        desired = prepared[name]
        print(
            f"  - {name}: live id={live.get('id')}, "
            f"active={bool(live.get('active'))}, nodes {len(live.get('nodes', []))} -> {len(desired.get('nodes', []))}"
        )

    originally_active = {name: bool(live_index[name].get("active")) for name, _ in TARGETS}
    updated_names: list[str] = []

    try:
        print("\nTemporarily pausing workflows that are currently active...")
        for name, _ in TARGETS:
            if originally_active[name]:
                workflow_id = str(live_index[name]["id"])
                set_active(workflow_id, False)
                print(f"  paused: {name}")

        print("\nUpdating workflows in place...")
        for name, _ in TARGETS:
            workflow_id = str(live_index[name]["id"])
            payload = workflow_update_payload(prepared[name])
            api("PUT", f"/workflows/{workflow_id}", payload)
            updated_names.append(name)
            check = api("GET", f"/workflows/{workflow_id}")
            if check.get("name") != name:
                raise RuntimeError(f"Post-update verification failed for {name}: name mismatch.")
            if len(check.get("nodes", [])) != len(prepared[name].get("nodes", [])):
                raise RuntimeError(f"Post-update verification failed for {name}: node count mismatch.")
            print(f"  updated: {name}")

        print("\nRestoring original active/inactive states...")
        for name, _ in TARGETS:
            workflow_id = str(live_index[name]["id"])
            check = api("GET", f"/workflows/{workflow_id}")
            active_now = bool(check.get("active"))
            if active_now != originally_active[name]:
                set_active(workflow_id, originally_active[name])
            final = api("GET", f"/workflows/{workflow_id}")
            if bool(final.get("active")) != originally_active[name]:
                raise RuntimeError(f"Could not restore active state for {name}.")
            state = "ACTIVE" if originally_active[name] else "inactive"
            print(f"  {state}: {name}")

    except Exception as exc:
        print(f"\nDEPLOYMENT FAILED: {exc}", file=sys.stderr)
        print("Attempting rollback from live backups...", file=sys.stderr)
        rollback_errors: list[str] = []

        for name in reversed(updated_names):
            try:
                workflow_id = str(live_index[name]["id"])
                current = api("GET", f"/workflows/{workflow_id}")
                if current.get("active"):
                    set_active(workflow_id, False)
                api("PUT", f"/workflows/{workflow_id}", workflow_update_payload(live_index[name]))
                print(f"  rolled back: {name}", file=sys.stderr)
            except Exception as rollback_exc:
                rollback_errors.append(f"{name}: {rollback_exc}")

        for name, _ in TARGETS:
            try:
                workflow_id = str(live_index[name]["id"])
                current = api("GET", f"/workflows/{workflow_id}")
                if bool(current.get("active")) != originally_active[name]:
                    set_active(workflow_id, originally_active[name])
            except Exception as restore_exc:
                rollback_errors.append(f"active-state restore {name}: {restore_exc}")

        if rollback_errors:
            print("\nROLLBACK WARNINGS:", file=sys.stderr)
            for warning in rollback_errors:
                print(f"  - {warning}", file=sys.stderr)

        print(f"Backups are at: {backup_dir}", file=sys.stderr)
        return 1

    print("\nSUCCESS")
    print(f"All {len(TARGETS)} selected AAC workflows were updated in place and their original active states were restored.")
    print(f"Backups are at: {backup_dir}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        print("\nCancelled.", file=sys.stderr)
        raise SystemExit(130)
    except Exception as exc:
        print(f"\nERROR: {exc}", file=sys.stderr)
        raise SystemExit(1)
