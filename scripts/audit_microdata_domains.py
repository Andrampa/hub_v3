"""Audit household microdata coded-value domains before the Hub offers labels.

Read-only against ArcGIS Online. Run from ArcGIS Pro's Python environment while
signed in to the DIEM portal with an account that can read every microdata
master and grant view:

    "C:\\Program Files\\ArcGIS\\Pro\\bin\\Python\\envs\\arcgispro-py3\\python.exe" ^
        scripts/audit_microdata_domains.py --report audit_report.json

Checks, per export source:

- V1/V2 masters against their official codebook workbooks (one sheet per
  variable with ``code`` and ``label`` columns, plus a ``derived_fields`` sheet
  of 0=No / 1=Yes variables): a codebook variable without a domain, different
  codes, different labels, or a domain the codebook does not define.
- V3 mandatory and optional tables, which have no published codebook: a field
  present in both tables with different domains.
- Every source: labels a spreadsheet could evaluate as formulas (``=``, ``+``,
  ``-``, ``@`` that do not read as numbers), and codes repeated with conflicting
  labels.
- Every grant view against its master's domains.

With ``--write``, components without blocking findings are recorded in
``src/data/auditedDomains.json`` as a per-field domain digest. The Hub offers
labels only while the live schema still matches those digests, so re-run the
audit and commit the file after any intended domain change.

The digest is SHA-256 of the domain as compact JSON ``[[code, label], ...]``
sorted by code then label, with codes as JavaScript ``String(code)`` would print
them. ``src/services/microdataLabels.ts`` computes the same value; the pinned
test vector in ``microdataLabels.test.ts`` keeps the two in step.
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import re
import sys
import urllib.request
from datetime import datetime as DateTime, timezone as TimeZone
from pathlib import Path
from typing import Any

import pandas as pd
from arcgis.features import FeatureLayerCollection
from arcgis.gis import GIS

REPO = Path(__file__).resolve().parents[1]
AUDIT_FILE = REPO / "src" / "data" / "auditedDomains.json"

# Mirrors MICRODATA_RESOURCES in src/services/protectedData.ts.
MASTERS = [
    {"generation": "v1", "component": "household", "item_id": "f1d017ac889f44ceae76d07977eb5bc1"},
    {"generation": "v2", "component": "household", "item_id": "2d15e5b7768949b4905e452fcc5e0440"},
    {"generation": "v3", "component": "mandatory", "item_id": "fd3f8386f8dd40abaa6fdbc033580b65"},
    {"generation": "v3", "component": "optional", "item_id": "877fb415ef4e4ef28967fa4b49670ee5"},
]

# Mirrors the microdata codebooks in DOCUMENTATION_RESOURCES.
CODEBOOKS = {
    "v1": "e59d08ded7c1440587493bf65236cf44",
    "v2": "41fa55934d2f462f86cd381ee8dc1fda",
}
CODEBOOK_URL = "https://hqfao.maps.arcgis.com/sharing/rest/content/items/{}/data"
DERIVED_FIELDS_SHEET = "derived_fields"

# Mirrors src/services/microdataGrants.ts.
ACCESS_TAG = "DIEM restricted microdata"
GRANT_COMPONENTS = {"legacy": "household", "core": "mandatory", "optional": "optional"}

SYSTEM_FIELD = re.compile(r"^shape__|^objectid$|^globalid$", re.IGNORECASE)
FORMULA_PREFIX = re.compile(r"^[=+\-@\t\r]")

BLOCKING = "blocking"
WARNING = "warning"


def js_string(value: Any) -> str:
    """The text JavaScript's String(value) prints for a domain code."""
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value)


def normalize_code(value: Any) -> str | None:
    """Codebook comparison key, matching diem-microdata-labelling."""
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    text = str(value).strip()
    if not text:
        return None
    try:
        number = float(text)
        return str(int(number)) if number.is_integer() else str(number)
    except ValueError:
        return text


def is_formula_like(text: str) -> bool:
    if not FORMULA_PREFIX.match(text):
        return False
    try:
        float(text)
        return False
    except ValueError:
        return True


def canonical_domain(field: dict[str, Any]) -> list[list[str]] | None:
    domain = field.get("domain") or {}
    if domain.get("type") not in (None, "codedValue") or not domain.get("codedValues"):
        return None
    entries = [[js_string(entry.get("code")), str(entry.get("name") or "")] for entry in domain["codedValues"]]
    return sorted(entries, key=lambda entry: (entry[0], entry[1]))


def domain_digest(entries: list[list[str]]) -> str:
    payload = json.dumps(entries, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def usable_fields(layer: dict[str, Any]) -> list[dict[str, Any]]:
    return [field for field in layer.get("fields", []) if not SYSTEM_FIELD.search(field["name"])]


def read_layer(gis: GIS, item_id: str) -> tuple[Any, dict[str, Any]]:
    item = gis.content.get(item_id)
    if item is None:
        raise RuntimeError(f"Item {item_id} is not readable by {gis.users.me.username}")
    collection = FeatureLayerCollection.fromitem(item)
    layers = list(collection.layers or []) + list(collection.tables or [])
    if not layers:
        raise RuntimeError(f"Item {item_id} has no layer or table")
    # The Hub reads layers[0], else tables[0]; FeatureLayerCollection keeps that order.
    return item, json.loads(json.dumps(dict(layers[0].properties)))


def load_codebook(generation: str, path: str | None) -> dict[str, dict[str, str]]:
    if path:
        data = Path(path).read_bytes()
    else:
        with urllib.request.urlopen(CODEBOOK_URL.format(CODEBOOKS[generation]), timeout=120) as response:
            data = response.read()
    sheets = pd.read_excel(io.BytesIO(data), sheet_name=None)
    codebook: dict[str, dict[str, str]] = {}
    for name, frame in sheets.items():
        sheet = str(name).strip()
        if sheet == DERIVED_FIELDS_SHEET:
            if frame.shape[1] >= 2:
                for field in frame.iloc[:, 1].dropna().astype(str).map(str.strip):
                    if field:
                        codebook.setdefault(field, {"0": "No", "1": "Yes"})
            continue
        columns = {str(column).strip().lower(): column for column in frame.columns}
        if "code" not in columns or "label" not in columns:
            continue
        mapping: dict[str, str] = {}
        for code, label in zip(frame[columns["code"]], frame[columns["label"]]):
            key = normalize_code(code)
            if key is not None:
                mapping[key] = "" if pd.isna(label) else str(label).strip()
        codebook[sheet] = mapping
    return codebook


def finding(level: str, kind: str, field: str | None, detail: str) -> dict[str, Any]:
    return {"level": level, "kind": kind, "field": field, "detail": detail}


def domain_findings(fields: list[dict[str, Any]]) -> list[dict[str, Any]]:
    found = []
    for field in fields:
        entries = canonical_domain(field)
        if not entries:
            continue
        unsafe = sorted({label for _, label in entries if is_formula_like(label)})
        if unsafe:
            found.append(finding(BLOCKING, "unsafe_label", field["name"], f"labels read as formulas: {unsafe[:5]}"))
        labels: dict[str, str] = {}
        for code, label in entries:
            if code in labels and labels[code] != label:
                found.append(finding(WARNING, "ambiguous_domain", field["name"],
                                     f"code {code!r} has labels {labels[code]!r} and {label!r}; the Hub leaves it coded"))
                break
            labels[code] = label
    return found


def codebook_findings(fields: list[dict[str, Any]], codebook: dict[str, dict[str, str]],
                      accepted: set[str]) -> list[dict[str, Any]]:
    found = []
    by_name = {field["name"]: field for field in fields}
    by_lower = {name.lower(): name for name in by_name}
    matched: set[str] = set()
    for variable, expected in sorted(codebook.items()):
        name = variable if variable in by_name else by_lower.get(variable.lower())
        if not name:
            found.append(finding(WARNING, "codebook_field_absent", variable, "codebook variable is not on the layer"))
            continue
        matched.add(name)
        entries = canonical_domain(by_name[name])
        if not entries:
            found.append(finding(BLOCKING, "missing_domain", name, "codebook defines labels but the layer has no coded-value domain"))
            continue
        actual = {normalize_code(code): label.strip() for code, label in entries}
        missing = sorted(set(expected) - set(actual), key=str)
        extra = sorted(set(actual) - set(expected), key=str)
        if missing or extra:
            found.append(finding(BLOCKING, "code_mismatch", name, f"missing from domain: {missing[:10]}; not in codebook: {extra[:10]}"))
        differing = [code for code in expected if code in actual and actual[code] != expected[code]]
        if differing:
            code = differing[0]
            found.append(finding(BLOCKING, "label_mismatch", name,
                                 f"{len(differing)} label(s) differ, e.g. {code}: domain {actual[code]!r} vs codebook {expected[code]!r}"))
    for field in fields:
        if field["name"] not in matched and canonical_domain(field):
            level = WARNING if field["name"] in accepted else BLOCKING
            found.append(finding(level, "domain_not_in_codebook", field["name"],
                                 "accepted with --accept-uncodebooked" if level == WARNING
                                 else "domain labels are not in the codebook; fix, or accept with --accept-uncodebooked"))
    return found


def digests(fields: list[dict[str, Any]]) -> dict[str, str]:
    return {field["name"]: domain_digest(entries) for field in fields if (entries := canonical_domain(field))}


def grant_views(gis: GIS) -> list[Any]:
    items = gis.content.search(f'tags:"{ACCESS_TAG}"', item_type="Feature Service", max_items=1000, outside_org=False)
    return [item for item in items if any(tag.strip().lower() == ACCESS_TAG.lower() for tag in item.tags or [])]


def grant_key(item: Any) -> tuple[str, str, bool] | None:
    """(generation, master component, whether the component had to be inferred)."""
    properties = (item.properties or {}).get("diemRestrictedMicrodata") or {}
    tags = [tag.strip().lower() for tag in item.tags or []]
    component = str(properties.get("component") or next(
        (tag[len("diem-microdata-component-"):] for tag in tags if tag.startswith("diem-microdata-component-")), "")).lower()
    version = str(properties.get("questionnaireVersion") or next(
        (tag[5:] for tag in tags if re.fullmatch(r"diem v[123]", tag)), "")).lower()
    if version not in ("v1", "v2", "v3"):
        return None
    # V1/V2 grants can only be the legacy component. The Hub itself still
    # ignores a view without component metadata; the report says so.
    if not component and version in ("v1", "v2"):
        return version, "household", True
    if component not in GRANT_COMPONENTS:
        return None
    return version, GRANT_COMPONENTS[component], False


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--codebook-v1", help="local V1 codebook workbook instead of downloading it")
    parser.add_argument("--codebook-v2", help="local V2 codebook workbook instead of downloading it")
    parser.add_argument("--accept-uncodebooked", default="",
                        help="comma-separated field names whose domains may be absent from the codebook")
    parser.add_argument("--domains-authoritative", action="store_true",
                        help="treat ArcGIS domains as the approved labels: codebook differences are reported as warnings, "
                             "while unsafe labels and cross-table mismatches still block")
    parser.add_argument("--skip-grants", action="store_true", help="do not check grant views")
    parser.add_argument("--report", help="write the full findings as JSON to this path")
    parser.add_argument("--write", action="store_true", help=f"record passing components in {AUDIT_FILE.relative_to(REPO)}")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    accepted = {name.strip() for name in args.accept_uncodebooked.split(",") if name.strip()}
    # Aliased: importing arcgis under ArcGIS Pro rebinds `datetime` in __main__.
    now = DateTime.now(TimeZone.utc).replace(microsecond=0).isoformat()
    gis = GIS("home")
    if not gis.users.me:
        raise RuntimeError("GIS('home') did not return an authenticated ArcGIS user")

    results = []
    schemas: dict[tuple[str, str], list[dict[str, Any]]] = {}
    for master in MASTERS:
        item, layer = read_layer(gis, master["item_id"])
        fields = usable_fields(layer)
        schemas[(master["generation"], master["component"])] = fields
        found = domain_findings(fields)
        codebook_id = CODEBOOKS.get(master["generation"])
        basis = "consistency_only"
        if codebook_id:
            path = getattr(args, f"codebook_{master['generation']}")
            compared = codebook_findings(fields, load_codebook(master["generation"], path), accepted)
            if args.domains_authoritative:
                # Differences stay in the report; the domain is the approved source.
                compared = [{**entry, "level": WARNING} for entry in compared]
                basis = "domains_authoritative"
            else:
                basis = "codebook_matched"
            found += compared
        results.append({**master, "title": item.title, "layer_id": layer["id"], "codebook_item_id": codebook_id,
                        "basis": basis,
                        "coded_fields": len(digests(fields)), "fields": fields, "findings": found})

    mandatory, optional = schemas.get(("v3", "mandatory"), []), schemas.get(("v3", "optional"), [])
    shared = digests(mandatory).keys() & digests(optional).keys()
    mismatched = sorted(name for name in shared if digests(mandatory)[name] != digests(optional)[name])
    for result in results:
        if result["generation"] == "v3":
            result["findings"] += [finding(BLOCKING, "cross_table_mismatch", name,
                                           "mandatory and optional tables define this domain differently")
                                   for name in mismatched]
    for result in results:
        if not result["coded_fields"]:
            # Labels would equal codes; recording it would advertise a labelled file that adds nothing.
            result["findings"].append(finding(BLOCKING, "no_domains", None, "the table has no coded-value domains to label from"))

    grants = []
    if not args.skip_grants:
        for item in grant_views(gis):
            key = grant_key(item)
            if not key:
                grants.append({"item_id": item.id, "title": item.title, "status": "unrecognized"})
                continue
            generation, component, inferred = key
            _, layer = read_layer(gis, item.id)
            master = digests(schemas.get((generation, component), []))
            view_fields = usable_fields(layer)
            view = digests(view_fields)
            # A field the view omits is fine; a field it exposes must keep its master's domain exactly.
            differing = sorted({name for name, digest in view.items() if master.get(name) != digest}
                               | {field["name"] for field in view_fields if field["name"] in master and field["name"] not in view})
            grants.append({"item_id": item.id, "title": item.title, "generation": generation, "component": component,
                           "status": "view_differs" if differing else "matches_master", "fields": differing,
                           **({"note": "no component metadata; the Hub does not list this view"} if inferred else {})})

    passing = [result for result in results if not any(entry["level"] == BLOCKING for entry in result["findings"])]
    for result in results:
        blocking = [entry for entry in result["findings"] if entry["level"] == BLOCKING]
        warnings = [entry for entry in result["findings"] if entry["level"] == WARNING]
        status = "PASS" if result in passing else "BLOCKED"
        print(f"\n[{status}] {result['generation']} {result['component']} {result['item_id']} "
              f"({result['coded_fields']} coded fields, {result['basis']})")
        for entry in blocking + warnings:
            print(f"  {entry['level']:8} {entry['kind']:24} {entry['field'] or '':32} {entry['detail']}")
    for grant in grants:
        print(f"\n[GRANT] {grant['item_id']} {grant.get('generation', '?')} {grant.get('component', '?')}: {grant['status']}"
              + (f" {grant['fields'][:10]}" if grant.get("fields") else "")
              + (f" ({grant['note']})" if grant.get("note") else ""))

    if args.report:
        Path(args.report).write_text(json.dumps({
            "generated": now, "account": gis.users.me.username,
            "components": [{key: value for key, value in result.items() if key != "fields"} for result in results],
            "grants": grants,
        }, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print(f"\nReport written to {args.report}")

    if args.write:
        AUDIT_FILE.write_text(json.dumps({
            "schema_version": 1, "generated": now,
            "components": [{
                "generation": result["generation"], "component": result["component"],
                "item_id": result["item_id"], "layer_id": result["layer_id"], "audited_at": now,
                "basis": result["basis"], "codebook_item_id": result["codebook_item_id"],
                "fields": dict(sorted(digests(result["fields"]).items())),
            } for result in passing],
        }, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print(f"\n{len(passing)} of {len(results)} components recorded in {AUDIT_FILE.relative_to(REPO)}")
    return 0 if len(passing) == len(results) else 1


if __name__ == "__main__":
    sys.exit(main())
