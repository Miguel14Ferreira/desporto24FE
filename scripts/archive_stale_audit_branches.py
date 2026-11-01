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
EXPECTED.update({
    "chore/allowlisted-branch-removal-20261030": "de742e7e9dfb135514a595d36e33f7049321bf99",
    "chore/consolidated-cleanup-audit-20261030": "a216dd088586c257c73f0db5e9236bcd1b6160da",
    "chore/content-equivalence-audit-20261030": "8a0b6b8c830dc4a75ea5d88101ac08b3fe882606",
    "chore/rebase-content-equivalence-audit-20261030": "621991125b326222e40f0214f9ba65cb709cf46d",
    "chore/recoverable-manual-branch-cleanup-20261030": "f979787ffe5ce653b805ec1880c2c9dcb06e8044",
})
EXPECTED.update({
    "design/community-detail-polish-20261030": "1ee1c59d2a0010597d423dbc8c635d9ab04104ca",
    "design/community-directory-aligned-search-v3-20261030": "69457f80b792c1e5a3566733e89acb962885be04",
    "design/community-detail-hero-refresh-20261030": "230e8062f69169114448816b9e73f4cf453509e1",
    "design/community-ranking-invites-responsive-20261030": "4416a468838be0229c6ba07710bbbc9eebd293f7",
    "feat/account-identity-navbar-20261029": "7b7e124ea36621b692d16b9f9ae578c84aa1f006",
    "feat/admin-gps-evora-official-map-link-ui-20261027": "53a875226bf2ad881e5eb5c0c75dab7bacc7535e",
    "feat/admin-gps-braga-rodovia-context-ui-20261027": "61015bd28f0e22c549b0d40eb0d2efca806e8582",
    "feat/admin-gps-facility-context-ui-20261027": "d779d6e03512951dc5798e6d597dc6d11493922f",
    "feat/admin-gps-rodovia-290-294-ui-20261027": "d24571dd5215d6fdb27b512365bd07b2d8f976c1",
    "feat/admin-gps-rodovia-map-crosscheck-ui-20261027": "4a20e873c41e6474d811ff6c5897e140f921ba01",
    "feat/admin-gps-rodovia-numbered-sign-ui-20261027": "0e682fcf35ec82575e0a0ab764276535e97d6c94",
    "feat/admin-gps-rodovia-tree-coordinate-ui-20261027": "bc22f493ddf48546ef8df1c79a6c4cec541137fb",
    "feat/chat-inline-private-images-20261030": "366e322f669527f971c306f6daab81a4fa377e3e",
})
EXPECTED.update({
    "feat/communities-neon-glass-layout-20261030": "392a4460e3b5a21b8af3497389145e268a3301ba",
    "feat/community-default-venue-autofill-20261028": "6834e0949cbf16c0e75ba3547d8570107d3470f3",
    "feat/community-session-quick-results-rebased-20261027": "2a6ac8e83cd5357b812b353ba4fa8ddc82c2d3fe",
    "feat/community-venue-picker-onboarding-20261028": "4ab9c0ce8c032568eb1a76dab92fd83e27d3f2b1",
    "feat/create-session-neon-refinement-20261030": "4845b14244a62d695bea70051801f4be45af7d4c",
    "feat/create-session-premium-selects-20261029": "1784f8d19782c18646caa1ceb9b043632b5fce7c",
    "feat/create-session-sport-venue-premium-20261029": "38b98e9d3d893ad1907fb2f4726d955cb081f716",
    "feat/explore-unified-premium-20261029": "b3b9f4694a82a3e35c615a6a21a81455c7f0c0b2",
    "feat/feed-full-20261030": "a0cc3d881f06dc1ec64bf1b2916f02d64f4e3ac7",
    "feat/global-floating-incoming-call-popup-20261029": "54d3781c6aa53266b85379345f43e1fcc91702cb",
    "feat/global-native-select-green-premium-20261029": "70137aafae4041533aa2c75e7aa9b0fa8dcc3523",
    "feat/global-premium-green-form-controls-20261029": "789e341470ce1672760217a05fc373fe6ae69ad8",
    "feat/global-profile-quickview-20261027": "cdb9b003cf91055af4f1d4e0b9c8a1a03ca1c93e",
    "feat/global-topnav-activities-neon-glass-20261030": "85abc398c365af50189e52a652855936e13bb07c",
    "feat/guest-session-invites-20261027": "7731f3571a1757688056e9023a7d175b3b3b17f1",
})
MERGED_ARCHIVE_PREFIX = "archive/verified-merged-20261101/"

EXPECTED.update({
    "chore/archive-13-merged-design-features-fe-20261101": "0f698c3ba781f6e146dcd70d33cce3777f8abe91",
    "chore/archive-15-verified-merged-features-fe-20261101": "2aece93c8952b0675d91ecd37b04e9e52c4fc61c",
    "chore/archive-cleanup-scaffolding-fe-20261101": "d641185887c53e9b6612bf41dd65bcadc2ff0432",
    "chore/archive-workflow-confirmation-choice-fe-20261101": "602324b89d8842baa3fd498fe46a336ec5c35864",
    "chore/pin-archive-workflow-sha-fe-20261101": "155e940fff37e510f5858462dd9930060d7ba97e",
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
    if not name.startswith(("audit/", "analysis/", "chore/", "design/", "feat/")):
        raise RuntimeError("Not an approved obsolete-audit namespace: " + name)
    if name.startswith("chore/") and name not in EXPECTED:
        raise RuntimeError("Unpinned chore branch: " + name)
    if name.startswith(("design/", "feat/")) and name not in EXPECTED:
        raise RuntimeError("Unpinned merged feature branch: " + name)
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
    if datetime.datetime.now(datetime.timezone.utc) - stamp < datetime.timedelta(days=0 if name.startswith(("chore/", "design/", "feat/")) else MIN_AGE_DAYS):
        print("SKIP_RECENT", name)
        return None
    if name.startswith(("design/", "feat/")):
        closed_status, closed_prs = api("GET", "pulls?state=closed&head=" + urllib.parse.quote(OWNER + ":" + name, safe="") + "&per_page=100", token)
        if closed_status != 200 or not isinstance(closed_prs, list):
            raise RuntimeError("Cannot verify merged feature PR: " + name)
        matching = [p for p in closed_prs if p.get("merged_at") and p.get("head", {}).get("sha") == sha and p.get("merge_commit_sha")]
        if not matching:
            raise RuntimeError("No merged PR with exact feature head SHA: " + name)
        merged_into_develop = False
        for pr in matching:
            cmp_status, cmp = api("GET", "compare/develop..." + pr["merge_commit_sha"], token)
            if cmp_status == 200 and cmp.get("ahead_by") == 0 and cmp.get("status") in ("behind", "identical"):
                merged_into_develop = True
                break
        if not merged_into_develop:
            raise RuntimeError("Feature PR merge commit is not an ancestor of develop: " + name)
    return ref

def archive_and_delete(name, sha, token):
    tag_path = (MERGED_ARCHIVE_PREFIX if name.startswith(("design/", "feat/")) else CHORE_ARCHIVE_PREFIX if name.startswith("chore/") else ARCHIVE_PREFIX) + name
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
