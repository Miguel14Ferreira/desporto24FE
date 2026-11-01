#!/usr/bin/env python3
"""Archive SHA-pinned, obsolete audit branches before deletion; fail closed."""
import datetime
import json
import os
import urllib.error
import urllib.parse
import urllib.request

OWNER = "Miguel14Ferreira"
REPO = "desporto24FE"
EXPECTED = {
    "audit/admin-dashboard-statistics-20261018": "ae1e6da7dfa7581e59975858dcd307895c0fbb6f",
    "audit/admin-venue-coverage-desktop-20261018": "25100b629b0757379c91d581b0eee29994e8a985",
    "audit/desktop-community-discovery-20261018": "6c8fa0fab16491e46269557824f4ab380a0d416a",
    "audit/desktop-excel-import-final-plan-20261018": "cbda36ddbc1cb899175ef47aa03778484d558ccf",
    "audit/desktop-excel-import-preview-race-20261018": "6ff7770cce727cd4fbbf1c1428f07fd2d0ba8eb9",
    "audit/desktop-excel-mapping-revision-20261018": "114b0643a3447c9149a46b1c41c1d9f72a2dc164",
    "audit/desktop-member-management-20261018": "001afed44aff5bf2c4c6acdcb4012619304cdad8",
    "audit/desktop-ranking-admin-stats-20261018": "272a389f09d5ebb2f6048824597a2de2a3517bcc",
    "audit/desktop-season-import-consistency-20261018": "07c1569cb0e024d5c616d97c7f9711da4715905f",
    "audit/desktop-season-round-confirmation-20261018": "5127f52d2a27591af1c41e09122703c1fd40ca31",
    "audit/desktop-team-roster-safety-20261018": "ec8a050286a7ef7c4845a223f45e459e125c8a1f",
    "audit/desktop-tournament-removal-confirmation-20261018": "135682a53cf9bdcd071b789de6346292fb87e84e",
    "audit/full-app-screen-ux-20261018": "2fce51cd1e79da78918f84372c9452f11ed0aec6",
    "audit/full-app-ux-round1": "78ff409af03587c30a147d909ac74798dcf1a750",
    "audit/integrated-ux-20261018": "370cf2205f69f1b2421d9f3a78690502bac583fb",
    "audit/mobile-navbar-ux-20261018": "b1b40e911de43d09db1f8c86646e6fc58f7c8464",
    "audit/venue-autocomplete-legacy-fallback-20261018": "ee64bc5f070dc2e082bcb093bf7e609809d40ec7",
}
EXPECTED.update({
    "chore/archive-stale-audits-fe-20261101": "62e340a1e9a6e6720393082c1c17b33362c2f9f1",
    "chore/cleanup-fe-verified-batch-20261030": "2e08aee2a41305b30d25b01cfb7fcdeb5d00cf3a",
    "chore/expand-fe-exact-cleanup-20261030": "58a7c218a7f49e78bbc796bc696772e339d0f99a",
    "chore/extend-fe-merged-list-20261030": "e4e626761af0248afd3a3c313ee1e08ff22aa4cf",
    "chore/next-verified-cleanup-fe-20261030": "b5a3128e22e9bb8fc61920b7b3815b87d42b9fbe",
})
CHORE_ARCHIVE_PREFIX = "archive/cleanup-scaffolding-20261101/"
ARCHIVE_PREFIX = "archive/stale-audit-20261101/"
MIN_AGE_DAYS = 7

def api(method, path, token, body=None):
    req = urllib.request.Request(
        "https://api.github.com/repos/%s/%s/%s" % (OWNER, REPO, path),
        data=json.dumps(body).encode("utf-8") if body is not None else None,
        headers={"Authorization": "Bearer " + token,
                 "Accept": "application/vnd.github+json",
                 "X-GitHub-Api-Version": "2022-11-28"}, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            raw = response.read()
            return response.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as error:
        if error.code == 404:
            return 404, None
        raise

def ensure_branch_safe(name, sha, token):
    if not name.startswith(("audit/", "analysis/", "chore/")):
        raise RuntimeError("Not an approved obsolete-audit namespace: " + name)
    if name.startswith("chore/") and name not in EXPECTED:
        raise RuntimeError("Unpinned chore branch: " + name)
    if len(sha) != 40 or any(c not in "0123456789abcdef" for c in sha):
        raise RuntimeError("Invalid pinned SHA: " + name)
    ref = "git/ref/heads/" + urllib.parse.quote(name, safe="/")
    status, current = api("GET", ref, token)
    if status == 404:
        print("MISSING", name)
        return None
    if status != 200 or current["object"]["sha"] != sha:
        raise RuntimeError("Branch SHA mismatch; refuse deletion: " + name)
    pr_status, prs = api("GET", "pulls?state=open&head=" + urllib.parse.quote(OWNER + ":" + name, safe="") + "&per_page=100", token)
    if pr_status != 200 or not isinstance(prs, list):
        raise RuntimeError("Cannot verify open PRs: " + name)
    if prs:
        print("SKIP_OPEN_PR", name)
        return None
    status, commit = api("GET", "commits/" + sha, token)
    if status != 200:
        raise RuntimeError("Cannot verify commit date: " + name)
    stamp = datetime.datetime.fromisoformat(commit["commit"]["committer"]["date"].replace("Z", "+00:00"))
    if datetime.datetime.now(datetime.timezone.utc) - stamp < datetime.timedelta(days=0 if name.startswith("chore/") else MIN_AGE_DAYS):
        print("SKIP_RECENT", name)
        return None
    return ref

def archive_and_delete(name, sha, token):
    tag_path = (CHORE_ARCHIVE_PREFIX if name.startswith("chore/") else ARCHIVE_PREFIX) + name
    tag_ref = "git/ref/tags/" + urllib.parse.quote(tag_path, safe="/")
    status, existing = api("GET", tag_ref, token)
    if status == 404:
        status, _ = api("POST", "git/refs", token, {"ref": "refs/tags/" + tag_path, "sha": sha})
        if status != 201:
            raise RuntimeError("Could not create recovery tag: " + name)
    elif status != 200 or existing["object"]["sha"] != sha:
        raise RuntimeError("Recovery tag collision: " + name)
    status, verified = api("GET", tag_ref, token)
    if status != 200 or verified["object"]["sha"] != sha:
        raise RuntimeError("Recovery tag verification failed: " + name)
    if ensure_branch_safe(name, sha, token) is None:
        print("SKIP_CHANGED_AFTER_ARCHIVE", name)
        return
    status, _ = api("DELETE", "git/refs/heads/" + urllib.parse.quote(name, safe="/"), token)
    if status != 204:
        raise RuntimeError("GitHub refused deletion: " + name)
    print("DELETED", name, sha, "RECOVERY_TAG", tag_path)

def main():
    token = os.environ.get("GH_TOKEN")
    if not token:
        raise RuntimeError("GH_TOKEN required")
    delete = os.environ.get("CONFIRM_DELETE") == "ARCHIVE_AND_DELETE_EXACT_AUDITS"
    for name, sha in EXPECTED.items():
        if ensure_branch_safe(name, sha, token) is None:
            continue
        if delete:
            archive_and_delete(name, sha, token)
        else:
            print("DRY_RUN", name, sha)

if __name__ == "__main__":
    main()
