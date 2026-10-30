#!/usr/bin/env python3
"""One-off, fail-closed removal of an exact allowlist of merged branches."""
import os
import sys
import json
import urllib.request
import urllib.error

OWNER = "Miguel14Ferreira"
REPO = "desporto24FE"
ALLOWLIST = [
    "fix/calls-camera-recovery-teams-ui-20261029",
    "feat/chat-realtime-notice-media-preview-20261028",
    "feat/community-session-creation-policy-20261028",
    "feat/community-venue-inline-map-preview-20261028",
    "feat/group-chat-live-toast-20261028",
    "feat/guest-private-meeting-point-ui-20261028",
    "feat/guest-receipt-session-chat-20261029",
    "feat/guest-rejoin-after-cancellation-20261028",
    "feat/guest-self-cancel-fullwidth-20261028",
    "feat/home-venue-cards-open-details-20261028",
    "feat/invite-inline-google-mfa-20261029",
    "feat/invite-single-confirm-rsvp-20261029",
    "feat/meeting-point-notification-deeplink-20261028",
    "feat/notification-unread-browser-tab-title-20261028",
    "feat/participant-chips-guest-roster-20261028",
    "feat/per-conversation-mute-controls-20261028",
    "feat/premium-global-selects-profile-20261028",
    "feat/session-meeting-point-edit-ui-20261028",
    "feat/session-meeting-point-notification-ui-20261028",
    "feat/session-minimum-and-organizer-roster-20261029",
    "feat/session-private-meeting-point-ui-20261028",
    "feat/session-roster-avatar-premium-20261028",
    "feat/session-roster-cancel-autosync-20261028",
    "feat/session-venue-details-and-calendar-gps-20261028",
    "feat/signed-invite-confirmed-players-20261028",
    "feat/unified-session-create-communities-20261027",
    "feat/venue-directions-safe-modes-20261028",
    "feat/venue-sports-badges-premium-20261028",
    "feat/private-group-photo-live-safe-20261028",
    "feat/public-session-invite-chat-compact-venue-20261029",
    "feat/my-sessions-organized-tabs-20261029",
    "feat/modern-player-comparison-select-clear-20261028",
]
PROTECTED = {"develop", "master", "main", "preview/render-fullstack", "feature/desporto24-preview-deploy"}

def github(method, path, token, body=None):
    request = urllib.request.Request(
        "https://api.github.com/repos/%s/%s/%s" % (OWNER, REPO, path),
        data=json.dumps(body).encode() if body is not None else None,
        headers={"Authorization": "Bearer " + token,
                 "Accept": "application/vnd.github+json",
                 "X-GitHub-Api-Version": "2022-11-28"},
        method=method,
    )
    with urllib.request.urlopen(request, timeout=20) as response:
        data = response.read()
        return response.status, json.loads(data) if data else None

def main():
    token = os.getenv("GH_TOKEN", "")
    confirmation = os.getenv("CONFIRM_DELETE", "")
    if not token:
        raise RuntimeError("GH_TOKEN required")
    if any(x in PROTECTED or x.startswith(("backup/", "release/")) for x in ALLOWLIST):
        raise RuntimeError("Protected branch in allowlist")
    if len(ALLOWLIST) != len(set(ALLOWLIST)):
        raise RuntimeError("Duplicate allowlist entry")
    base_status, base = github("GET", "git/ref/heads/develop", token)
    if base_status != 200:
        raise RuntimeError("Cannot read develop")
    for branch in ALLOWLIST:
        refpath = "git/ref/heads/" + branch
        try:
            _, before = github("GET", refpath, token)
        except urllib.error.HTTPError as error:
            if error.code == 404:
                print("MISSING", branch)
                continue
            raise
        sha = before["object"]["sha"]
        # Native compare uses the commit DAG, so 'behind' or 'identical' means
        # the exact branch tip is an ancestor of the inspected develop.
        _, comparison = github("GET", "compare/" + base["object"]["sha"] + "..." + sha, token)
        if comparison["ahead_by"] != 0 or comparison["status"] not in ("behind", "identical"):
            raise RuntimeError("Branch not an ancestor of develop: " + branch)
        # Reject active PR heads regardless of their base.
        _, prs = github("GET", "pulls?state=open&head=" + OWNER + ":" + branch.replace("/", "%2F") + "&per_page=100", token)
        if prs:
            raise RuntimeError("Open PR references branch: " + branch)
        _, current = github("GET", refpath, token)
        if current["object"]["sha"] != sha:
            raise RuntimeError("Branch tip changed: " + branch)
        if confirmation != "DELETE_EXACT_ALLOWLIST":
            print("DRY_RUN", branch, sha)
            continue
        # Archive exact historical tip before destructive action; fail closed if tag exists.
        recovery = "git/refs"
        tag = "refs/tags/archive/allowlisted-merged-20261030/" + branch
        try:
            archived_status, _ = github("POST", recovery, token, {"ref": tag, "sha": sha})
            if archived_status != 201:
                raise RuntimeError("Recovery ref was not created: " + branch)
        except urllib.error.HTTPError as error:
            if error.code != 422:
                raise
            _, archived = github("GET", "git/ref/tags/archive/allowlisted-merged-20261030/" + branch, token)
            if archived["object"]["sha"] != sha:
                raise RuntimeError("Recovery tag exists with different SHA: " + branch)
        # Check the tip once more after the archive write.
        _, final_ref = github("GET", refpath, token)
        if final_ref["object"]["sha"] != sha:
            raise RuntimeError("Branch moved after recovery tag: " + branch)
        # GitHub branch protections remain enforced; never force the deletion.
        try:
            status, _ = github("DELETE", "git/refs/heads/" + branch, token)
            if status != 204:
                raise RuntimeError("Unexpected delete status %s for %s" % (status, branch))
            print("DELETED", branch, sha)
        except urllib.error.HTTPError:
            print("DELETE_REJECTED", branch)
            raise

if __name__ == "__main__":
    main()
