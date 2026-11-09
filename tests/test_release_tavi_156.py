import importlib.util
import json
from pathlib import Path
from unittest.mock import patch
import pytest

SPEC = importlib.util.spec_from_file_location('one_shot', Path(__file__).parents[1] / 'tools/release-tavi.py')
mod = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(mod)


def test_reject_invalid_commit(tmp_path):
    with pytest.raises(mod.publisher.PublicationBlocked):
        mod.publish_local(tmp_path, {'GH_REPO': 'TheBigTreeInc/social', 'CANDIDATE_SHA': 'not-a-sha'})


def test_reject_checkout_mismatch(tmp_path):
    with patch.object(mod.subprocess, 'check_output', return_value='0'*40):
        with pytest.raises(mod.publisher.PublicationBlocked, match='Checkout differs'):
            mod.publish_local(tmp_path, {'GH_REPO': 'TheBigTreeInc/social', 'CANDIDATE_SHA': '1'*40})


def test_workflow_is_manually_triggered():
    yaml = (Path(__file__).parents[1] / '.github/workflows/release-tavi.yml').read_text()
    assert 'workflow_dispatch:' in yaml
    assert 'environment: tavi-public-release' in yaml
    assert 'release-gate.py' in yaml
    assert 'release-tavi.py --publish' in yaml
    assert 'actions/download-artifact@v4' in yaml
    assert 'candidate_sha:' not in yaml
