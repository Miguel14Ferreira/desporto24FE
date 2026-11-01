import importlib.util
import os
import pathlib
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('archive', pathlib.Path(__file__).with_name('archive_stale_audit_branches.py'))
archive = importlib.util.module_from_spec(spec)
spec.loader.exec_module(archive)
SHA = 'a' * 40
NAME = 'audit/old-20261018'

class SafetyTests(unittest.TestCase):
    def test_rejects_unapproved_namespace(self):
        with self.assertRaisesRegex(RuntimeError, 'namespace'):
            archive.ensure_branch_safe('feature/production', SHA, 'token')

    def test_rejects_unpinned_chore_branch(self):
        with self.assertRaisesRegex(RuntimeError, 'Unpinned chore branch'):
            archive.ensure_branch_safe('chore/unlisted', SHA, 'token')

    def test_rejects_invalid_sha(self):
        with self.assertRaisesRegex(RuntimeError, 'SHA'):
            archive.ensure_branch_safe(NAME, 'oops', 'token')

    def test_rejects_changed_head(self):
        with patch.object(archive, 'api', return_value=(200, {'object': {'sha': 'b'*40}})):
            with self.assertRaisesRegex(RuntimeError, 'mismatch'):
                archive.ensure_branch_safe(NAME, SHA, 'token')

    def test_skips_open_pr(self):
        with patch.object(archive, 'api', side_effect=[(200, {'object': {'sha': SHA}}), (200, [{'number': 10}])]):
            self.assertIsNone(archive.ensure_branch_safe(NAME, SHA, 'token'))

    def test_rejects_unavailable_pr_lookup(self):
        with patch.object(archive, 'api', side_effect=[(200, {'object': {'sha': SHA}}), (404, None)]):
            with self.assertRaisesRegex(RuntimeError, 'Cannot verify open PRs'):
                archive.ensure_branch_safe(NAME, SHA, 'token')

    def test_never_deletes_without_verified_tag(self):
        with patch.object(archive, 'api', side_effect=[(404, None), (201, {}), (404, None)]) as req:
            with self.assertRaisesRegex(RuntimeError, 'verification failed'):
                archive.archive_and_delete(NAME, SHA, 'token')
            self.assertFalse(any(c.args[0] == 'DELETE' for c in req.call_args_list))

    def test_dry_run_does_not_mutate(self):
        with patch.dict(os.environ, {'GH_TOKEN': 'token', 'CONFIRM_DELETE': 'DRY_RUN'}), \
             patch.object(archive, 'EXPECTED', {NAME: SHA}), \
             patch.object(archive, 'ensure_branch_safe', return_value='git/ref/heads/'+NAME), \
             patch.object(archive, 'archive_and_delete') as delete:
            archive.main()
            delete.assert_not_called()

    def test_rejects_unpinned_feature_branch(self):
        with self.assertRaisesRegex(RuntimeError, 'Unpinned merged feature branch'):
            archive.ensure_branch_safe('feat/unlisted', SHA, 'token')

    def test_rejects_feature_without_exact_merged_pr(self):
        name = 'feat/account-identity-navbar-20261029'
        sha = archive.EXPECTED[name]
        old_commit = {'commit': {'committer': {'date': '2026-10-29T00:00:00Z'}}}
        replies = [(200, {'object': {'sha': sha}}), (200, []), (200, old_commit), (200, [])]
        with patch.object(archive, 'api', side_effect=replies):
            with self.assertRaisesRegex(RuntimeError, 'No merged PR with exact feature head SHA'):
                archive.ensure_branch_safe(name, sha, 'token')

    def test_accepts_merged_feature_ancestor(self):
        name = 'feat/account-identity-navbar-20261029'
        sha = archive.EXPECTED[name]
        old_commit = {'commit': {'committer': {'date': '2026-10-29T00:00:00Z'}}}
        merged_pr = {'merged_at': '2026-10-29T12:00:00Z', 'head': {'sha': sha}, 'merge_commit_sha': 'b'*40}
        replies = [(200, {'object': {'sha': sha}}), (200, []), (200, old_commit),
                   (200, [merged_pr]), (200, {'ahead_by': 0, 'status': 'behind'})]
        with patch.object(archive, 'api', side_effect=replies):
            self.assertEqual(archive.ensure_branch_safe(name, sha, 'token'), 'git/ref/heads/' + name)


    def test_new_feature_batch_rejects_mismatched_merged_head(self):
        name = 'feat/global-floating-incoming-call-popup-20261029'
        sha = archive.EXPECTED[name]
        commit = {'commit': {'committer': {'date': '2026-10-29T00:00:00Z'}}}
        merged_pr = {'merged_at': '2026-10-29T12:00:00Z', 'head': {'sha': 'c'*40}, 'merge_commit_sha': 'b'*40}
        replies = [(200, {'object': {'sha': sha}}), (200, []), (200, commit), (200, [merged_pr])]
        with patch.object(archive, 'api', side_effect=replies):
            with self.assertRaisesRegex(RuntimeError, 'No merged PR with exact feature head SHA'):
                archive.ensure_branch_safe(name, sha, 'token')

    def test_new_feature_batch_rejects_merge_outside_develop(self):
        name = 'feat/communities-neon-glass-layout-20261030'
        sha = archive.EXPECTED[name]
        commit = {'commit': {'committer': {'date': '2026-10-30T00:00:00Z'}}}
        merged_pr = {'merged_at': '2026-10-30T12:00:00Z', 'head': {'sha': sha}, 'merge_commit_sha': 'b'*40}
        replies = [(200, {'object': {'sha': sha}}), (200, []), (200, commit),
                   (200, [merged_pr]), (200, {'ahead_by': 1, 'status': 'diverged'})]
        with patch.object(archive, 'api', side_effect=replies):
            with self.assertRaisesRegex(RuntimeError, 'not an ancestor'):
                archive.ensure_branch_safe(name, sha, 'token')

if __name__ == '__main__':
    unittest.main()
