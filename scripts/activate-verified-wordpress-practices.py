#!/usr/bin/env python3
"""Activate the audited WordPress-only practice mappings through n8n.

Creates or updates a narrowly scoped scheduled workflow, borrows the live
BigQuery credential binding from AAC - 24, runs once, confirms success, and
deactivates the helper. No WordPress or Headless Hostman request is made.
"""

from __future__ import annotations

import copy
import getpass
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

BASE_URL = os.environ.get("N8N_BASE_URL", "https://n8n.apexdentalautomation.com").rstrip("/")
API_KEY = os.environ.get("N8N_API_KEY", "").strip()
HELPER_NAME = "AAC - 26 - Activate Verified WordPress Practices"
DONOR_NAME = "AAC - 24 - Admin Command Router"

ACTIVATION_SQL = r"""
DECLARE v_expected_locations INT64 DEFAULT 58;
DECLARE v_expected_sites INT64 DEFAULT 49;
DECLARE v_credential_name STRING DEFAULT (
  SELECT JSON_VALUE(SAFE.PARSE_JSON(publisher_config_reference), '$.credential_name')
  FROM `apex-marketing-n8n.automated_article_creation.practices`
  WHERE practice_id = 'practice_test_001'
  LIMIT 1
);

CREATE TEMP TABLE candidates AS
SELECT
  practice_id,
  JSON_VALUE(SAFE.PARSE_JSON(publisher_config_reference), '$.location_code') AS location_code,
  JSON_VALUE(SAFE.PARSE_JSON(publisher_config_reference), '$.wordpress_base_url') AS wordpress_base_url
FROM `apex-marketing-n8n.automated_article_creation.practices`
WHERE practice_id != 'practice_test_001'
  AND JSON_VALUE(SAFE.PARSE_JSON(publisher_config_reference), '$.location_code') IS NOT NULL
  AND STARTS_WITH(
    JSON_VALUE(SAFE.PARSE_JSON(publisher_config_reference), '$.wordpress_base_url'),
    'https://apexparent.hostmanpowered.com/'
  );

ASSERT v_credential_name IS NOT NULL AS 'TEST001 does not contain the approved WordPress credential reference.';
ASSERT (SELECT COUNT(*) FROM candidates) = v_expected_locations
  AS 'Expected exactly 58 audited practice locations.';
ASSERT (SELECT COUNT(DISTINCT wordpress_base_url) FROM candidates) = v_expected_sites
  AS 'Expected exactly 49 audited WordPress subsites.';
ASSERT NOT EXISTS (
  SELECT 1 FROM candidates
  WHERE location_code IN ('DFW-24', 'DFW-25') OR wordpress_base_url IS NULL
) AS 'An excluded or incomplete practice mapping was selected.';

UPDATE `apex-marketing-n8n.automated_article_creation.practices` p
SET
  active = TRUE,
  publisher_type = 'WORDPRESS',
  publisher_config_reference = TO_JSON_STRING(JSON_SET(
    COALESCE(SAFE.PARSE_JSON(p.publisher_config_reference), JSON '{}'),
    '$.credential_name', v_credential_name,
    '$.mapping_status', 'VERIFIED',
    '$.verification_scope', 'WORDPRESS_ONLY_NO_STATIC_RELEASE',
    '$.verified_at', FORMAT_TIMESTAMP('%FT%TZ', CURRENT_TIMESTAMP()),
    '$.verification_method', '49_SITE_REST_AUDIT_AND_MULTISITE_SUPER_ADMIN_CREDENTIAL'
  ))
WHERE p.practice_id IN (SELECT practice_id FROM candidates);

INSERT INTO `apex-marketing-n8n.automated_article_creation.workflow_events`
(event_id, entity_type, entity_id, event_type, event_timestamp, source_system, workflow_execution_id, payload)
SELECT
  GENERATE_UUID(),
  'practice',
  practice_id,
  'practice.wordpress_mapping_verified',
  CURRENT_TIMESTAMP(),
  'n8n:wordpress-only-practice-activation',
  NULL,
  TO_JSON(STRUCT(
    location_code,
    wordpress_base_url,
    'WORDPRESS_ONLY_NO_STATIC_RELEASE' AS verification_scope
  ))
FROM candidates c
WHERE NOT EXISTS (
  SELECT 1
  FROM `apex-marketing-n8n.automated_article_creation.workflow_events` e
  WHERE e.entity_type = 'practice'
    AND e.entity_id = c.practice_id
    AND e.event_type = 'practice.wordpress_mapping_verified'
);

SELECT
  COUNT(*) AS activated_practice_locations,
  COUNT(DISTINCT JSON_VALUE(SAFE.PARSE_JSON(p.publisher_config_reference), '$.wordpress_base_url')) AS activated_wordpress_sites,
  COUNTIF(JSON_VALUE(SAFE.PARSE_JSON(p.publisher_config_reference), '$.mapping_status') = 'VERIFIED') AS verified_mappings,
  COUNTIF(JSON_VALUE(SAFE.PARSE_JSON(p.publisher_config_reference), '$.verification_scope') = 'WORDPRESS_ONLY_NO_STATIC_RELEASE') AS wordpress_only_mappings
FROM `apex-marketing-n8n.automated_article_creation.practices` p
WHERE p.practice_id IN (SELECT practice_id FROM candidates)
  AND p.active = TRUE
  AND p.publisher_type = 'WORDPRESS';
""".strip()


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


def list_workflows() -> list[dict[str, Any]]:
    result = api("GET", "/workflows?limit=250")
    return list(result.get("data", []))


def bigquery_credentials(workflow: dict[str, Any]) -> dict[str, Any]:
    matches = []
    for node in workflow.get("nodes", []):
        if node.get("type") == "n8n-nodes-base.googleBigQuery" and node.get("credentials"):
            matches.append(copy.deepcopy(node["credentials"]))
    signatures = {json.dumps(value, sort_keys=True): value for value in matches}
    if len(signatures) != 1:
        raise RuntimeError(f"Expected one unique BigQuery credential binding in {DONOR_NAME}, found {len(signatures)}.")
    return next(iter(signatures.values()))


def desired_workflow(credentials: dict[str, Any]) -> dict[str, Any]:
    authentication = "oAuth2" if "googleBigQueryOAuth2Api" in credentials else "serviceAccount"
    return {
        "name": HELPER_NAME,
        "nodes": [
            {
                "parameters": {"rule": {"interval": [{"field": "minutes", "minutesInterval": 1}]}},
                "id": "aac-verified-practice-activation-schedule",
                "name": "Run WordPress-Only Activation Once",
                "type": "n8n-nodes-base.scheduleTrigger",
                "typeVersion": 1.2,
                "position": [-300, 0],
            },
            {
                "parameters": {
                    "authentication": authentication,
                    "projectId": {"__rl": True, "value": "apex-marketing-n8n", "mode": "id"},
                    "sqlQuery": ACTIVATION_SQL,
                    "options": {"location": "US"},
                },
                "id": "aac-activate-verified-wordpress-practices",
                "name": "Activate Exactly 58 Audited Practice Mappings",
                "type": "n8n-nodes-base.googleBigQuery",
                "typeVersion": 2.1,
                "position": [0, 0],
                "credentials": credentials,
            },
        ],
        "connections": {
            "Run WordPress-Only Activation Once": {
                "main": [[{"node": "Activate Exactly 58 Audited Practice Mappings", "type": "main", "index": 0}]]
            }
        },
        "settings": {"executionOrder": "v1"},
    }


def main() -> int:
    global API_KEY
    if not API_KEY:
        API_KEY = getpass.getpass("Paste n8n API key (input hidden): ").strip()
    if not API_KEY:
        print("ERROR: An n8n API key is required.", file=sys.stderr)
        return 2

    workflows = list_workflows()
    by_name = {str(item.get("name")): item for item in workflows}
    donor_summary = by_name.get(DONOR_NAME)
    if not donor_summary:
        raise RuntimeError(f"Could not find {DONOR_NAME}.")
    donor = api("GET", f"/workflows/{donor_summary['id']}")
    desired = desired_workflow(bigquery_credentials(donor))

    helper_summary = by_name.get(HELPER_NAME)
    if helper_summary:
        helper_id = str(helper_summary["id"])
        if helper_summary.get("active"):
            api("POST", f"/workflows/{helper_id}/deactivate")
        api("PUT", f"/workflows/{helper_id}", desired)
        print(f"Updated activation helper: {helper_id}")
    else:
        created = api("POST", "/workflows", desired)
        helper_id = str(created["id"])
        print(f"Created activation helper: {helper_id}")

    baseline = api("GET", f"/executions?workflowId={urllib.parse.quote(helper_id)}&limit=1")
    baseline_ids = {str(item.get("id")) for item in baseline.get("data", [])}
    api("POST", f"/workflows/{helper_id}/activate")
    print("Activated the one-time helper; waiting for its scheduled execution...")

    try:
        deadline = time.time() + 120
        while time.time() < deadline:
            time.sleep(5)
            executions = api("GET", f"/executions?workflowId={urllib.parse.quote(helper_id)}&limit=5")
            newest = next(
                (item for item in executions.get("data", []) if str(item.get("id")) not in baseline_ids),
                None,
            )
            if not newest or not newest.get("stoppedAt"):
                continue
            status = str(newest.get("status", ""))
            if status != "success":
                raise RuntimeError(f"Activation execution {newest.get('id')} finished with status {status}.")
            print(f"SUCCESS: execution {newest.get('id')} activated 58 WordPress-only practice mappings.")
            return 0
        raise RuntimeError("Timed out waiting for the one-time activation execution.")
    finally:
        try:
            api("POST", f"/workflows/{helper_id}/deactivate")
            print("The activation helper is inactive and will not run again.")
        except Exception as exc:
            print(f"WARNING: Could not deactivate helper {helper_id}: {exc}", file=sys.stderr)


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        print("\nCancelled.", file=sys.stderr)
        raise SystemExit(130)
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise SystemExit(1)
