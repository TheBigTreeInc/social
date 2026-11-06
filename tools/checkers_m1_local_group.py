"""Local-only exact-source-ZIP Checkers M1 group QA across Social and Atrium.

Calls each component's OWN packaged test runner, from its exact archive bytes.
This deliberately does not deploy a game, authenticate live Social users, open
public routes, authorize a release, or claim live Tavi-to-browser acceptance.

Usage: python tools/checkers_m1_local_group.py --social-zip PATH --atrium-zip PATH
No Git, GitHub, outbound network, Docker, external Python packages or operator secrets.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
from uuid import uuid4
from zipfile import BadZipFile, ZipFile

ROOT = Path(__file__).resolve().parents[1]
SPECS = {
    'looprd-social': {
        'runner': 'tools/checkers_social_group_qa.py',
        'mandatory': ('package.json', 'tools/checkers_social_group_qa.py',
                      'server/atrium_challenge_lookup.py',
                      'server/atrium_contact_lookup.py',
                      'tests/test_checkers_m1_social_contract.py', 'looprd.yaml',
                      'client/src/main.js'),
        'schema': 'dgn.checkers-m1.component-qa/v1',
        'prefix': 'looprd-social-',
        'version_min': (0, 3, 120),
    },
    'atrium': {
        'runner': 'tools/checkers_group_qa.py',
        'mandatory': ('package.json', 'tools/checkers_group_qa.py',
                      'src/checkers.py', 'src/checkers_adapter.py',
                      'src/checkers_match_authority.py',
                      'src/checkers_trusted_host.py', 'src/checkers_trusted_routes.py',
                      'tests/test_checkers_group_qa.py', 'looprd.yaml'),
        'schema': 'atrium.checkers-group-test/v1',
        'prefix': 'atrium-',
        'version_min': (0, 5, 56),
    },
}


class GroupQAError(ValueError):
    """Input, component or evidence failed closed."""


def _sha256(path):
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()


def _version_tuple(version):
    if type(version) is not str or not re.fullmatch(r'\d+\.\d+\.\d+', version):
        raise GroupQAError('invalid_package_version')
    return tuple(int(part) for part in version.split('.'))


def inspect_zip(filename: Path, component: str):
    """Read-only ZIP preflight: bounded, safe member paths and exact version."""
    spec = SPECS[component]
    filename = Path(filename).resolve()
    if not filename.is_file() or not 100 <= filename.stat().st_size <= 32_000_000:
        raise GroupQAError(f'{component}: package_missing_or_size_invalid')
    try:
        with ZipFile(filename) as zf:
            items = zf.infolist()
            if not 1 <= len(items) <= 1200:
                raise GroupQAError(f'{component}: invalid_archive_entry_count')
            names = set()
            size_total = 0
            for item in items:
                name = item.filename
                kind = (item.external_attr >> 16) & 0o170000
                if (item.is_dir() or name.startswith('/') or '\\' in name or
                        re.match(r'^[a-zA-Z]:', name) or not name or
                        any(part in ('', '.', '..') for part in name.split('/')) or
                        kind == 0o120000 or name in names or
                        item.file_size > 8_000_000):
                    raise GroupQAError(f'{component}: unsafe_archive_member')
                names.add(name)
                size_total += item.file_size
                if size_total > 48_000_000:
                    raise GroupQAError(f'{component}: uncompressed_archive_oversized')
            if not set(spec['mandatory']).issubset(names):
                raise GroupQAError(f'{component}: missing_required_source_or_runner')
            if zf.testzip() is not None:
                raise GroupQAError(f'{component}: archive_crc_failure')
            package = json.loads(zf.read('package.json'))
            version = package.get('version')
            if _version_tuple(version) < spec['version_min']:
                raise GroupQAError(f'{component}: unsupported_source_contract_version')
            prefix = re.escape(spec['prefix'] + version + '-')
            if component == 'atrium':
                valid = re.fullmatch(prefix + r'ziprunner(?:-[a-f0-9]{16})?\.zip', filename.name)
            else:
                valid = re.fullmatch(prefix + r'(?:[A-Za-z0-9_.-]+-)?ziprunner(?:-[a-f0-9]{16})?\.zip', filename.name)
            if not valid:
                raise GroupQAError(f'{component}: filename_version_mismatch')
            if package.get('name') != component:
                raise GroupQAError(f'{component}: package_name_mismatch')
            # This is a static boundary assertion, not gameplay acceptance.
            if component == 'looprd-social':
                if b'CheckersEngine' in zf.read('client/src/main.js'):
                    raise GroupQAError('social_client_has_checkers_authority')
                if b'def legal_moves(' in zf.read('looprd.yaml'):
                    raise GroupQAError('social_root_has_checkers_rules')
            if component == 'atrium' and b'def legal_moves(' in zf.read('looprd.yaml'):
                raise GroupQAError('atrium_generic_root_has_game_rules')
            runner_sha = hashlib.sha256(zf.read(spec['runner'])).hexdigest()
    except (BadZipFile, OSError, KeyError, json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise GroupQAError(f'{component}: unreadable_source_archive') from exc
    return {
        'project': component, 'version': version, 'file': filename.name,
        'sha256': _sha256(filename), 'runner_sha256': runner_sha,
        'entry_count': len(items),
        'bytes_uncompressed': size_total,
        'source_boundaries_checked': True,
    }


def _environment():
    """Only host OS/Python runtime context; never forward service credentials."""
    allowed = ('PATH', 'SystemRoot', 'WINDIR', 'TEMP', 'TMP', 'TMPDIR',
               'COMSPEC', 'HOME', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA',
               'LANG', 'LC_ALL', 'TZ')
    env = {k: os.environ[k] for k in allowed if k in os.environ}
    env['PYTHONDONTWRITEBYTECODE'] = '1'
    env['PYTHONNOUSERSITE'] = '1'
    return env


def run_component(filename: Path, metadata: dict, evidence_file: Path, scratch: Path):
    """Execute the runner FROM its source ZIP; it then tests that exact ZIP."""
    component = metadata['project']
    runner = SPECS[component]['runner']
    base = scratch / component
    (base / 'tools').mkdir(parents=True, exist_ok=True)
    with ZipFile(filename) as archive:
        (base / runner).write_bytes(archive.read(runner))
    package_arg = Path(filename).resolve()
    # Atrium's packaged runner expects the exact canonical release basename.
    # ZipRunner's content-addressed latest-zips rename is only a filename
    # decoration; copy the SAME bytes into scratch and verify SHA unchanged.
    if component == 'atrium' and package_arg.name != f"atrium-{metadata['version']}-ziprunner.zip":
        package_arg = base / f"atrium-{metadata['version']}-ziprunner.zip"
        shutil.copyfile(filename, package_arg)
        if _sha256(package_arg) != metadata['sha256']:
            raise GroupQAError('atrium: normalized_copy_digest_mismatch')
    command = [sys.executable, str(base / runner), '--package', str(package_arg),
               '--report', str(evidence_file.resolve())]
    try:
        process = subprocess.run(command, cwd=base, env=_environment(),
                                 text=True, capture_output=True, timeout=180)
    except subprocess.TimeoutExpired as exc:
        raise GroupQAError(f'{component}: exact_package_test_timed_out') from exc
    if process.returncode != 0:
        raise GroupQAError(f'{component}: exact_package_test_failed_exit_{process.returncode}')
    if not evidence_file.is_file() or evidence_file.stat().st_size > 128_000:
        raise GroupQAError(f'{component}: expected_evidence_missing_or_oversize')
    try:
        evidence = json.loads(evidence_file.read_text(encoding='utf-8'))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise GroupQAError(f'{component}: invalid_evidence_json') from exc
    assertions = evidence.get('assertions')
    if (evidence.get('schema') != SPECS[component]['schema'] or
            evidence.get('project') != component or
            evidence.get('version') != metadata['version'] or
            evidence.get('scope') != 'EXACT_PACKAGE_EXTRACTED' or
            evidence.get('input_zip_sha256') != metadata['sha256'] or
            evidence.get('passed') is not True or
            evidence.get('production_activated') is not False or
            evidence.get('operator_accepted') is not False or
            type(evidence.get('executed')) is not int or evidence['executed'] < 6 or
            type(assertions) is not list or len(assertions) != evidence['executed'] or
            any(item.get('status') != 'passed' for item in assertions)):
        raise GroupQAError(f'{component}: evidence_not_exact_passed_or_unverified_boundary')
    if component == 'atrium' and evidence.get('network') != 'disposable_loopback_http':
        raise GroupQAError('atrium: required_disposable_network_evidence_missing')
    return {
        **metadata, 'scope': 'EXACT_PACKAGE_EXTRACTED',
        'passed': True, 'assertions_passed': evidence['executed'],
        'evidence_sha256': _sha256(evidence_file),
        'network': evidence.get('network'),
    }


def write_report(path: Path, data: dict):
    path = Path(path).resolve()
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name('.' + path.name + '.' + uuid4().hex[:8] + '.tmp')
    try:
        with temporary.open('x', encoding='utf-8') as f:
            json.dump(data, f, sort_keys=True, indent=2)
            f.write('\n')
        temporary.replace(path)
    finally:
        temporary.unlink(missing_ok=True)


def execute(social_zip: Path, atrium_zip: Path, report: Path):
    """Produce one bounded group summary plus two component assertion reports."""
    report = Path(report).resolve()
    result = {
        'schema': 'dgn.checkers-m1.local-group-qa/v1',
        'ticket': 'DGN-CHECKERS-M1-AUTOMATED-QA-001',
        'checked_at_utc': datetime.now(timezone.utc).isoformat(timespec='seconds'),
        'status': 'blocked', 'passed': False, 'operator_accepted': False,
        'production_activated': False, 'real_tavi_browser_match_proven': False,
        'public_release_authorized': False, 'github_used': False,
        'scope': 'EXACT_TWO_SOURCE_ZIPS',
        'components': [], 'error': None,
    }
    try:
        for component, filename in [('looprd-social', social_zip), ('atrium', atrium_zip)]:
            result['components'].append(inspect_zip(filename, component))
        with tempfile.TemporaryDirectory(prefix='checkers-m1-local-') as temp:
            scratch = Path(temp)
            for item, filename in zip(result['components'], (social_zip, atrium_zip)):
                path = report.with_name(report.stem + '-' + item['project'] + '.json')
                checked = run_component(filename, item, path, scratch)
                item.update(checked)
                item['evidence_file'] = path.name
        result['passed'] = True
        result['status'] = 'component_source_checks_passed_live_acceptance_pending'
    except (GroupQAError, OSError) as exc:
        result['error'] = str(exc)[:220]
    write_report(report, result)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--social-zip', required=True, type=Path,
                        help='exact original looprd-social source ZIP (not a Git checkout)')
    parser.add_argument('--atrium-zip', required=True, type=Path,
                        help='exact original Atrium source ZIP (0.5.56 or newer)')
    parser.add_argument('--report', type=Path,
                        help='summary JSON; default: protected state/qa/checkers-group')
    args = parser.parse_args()
    stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    report = args.report or (ROOT/'state'/'qa'/'checkers-group'/f'{stamp}-{uuid4().hex[:8]}.json')
    summary = execute(args.social_zip, args.atrium_zip, report)
    print(json.dumps({'passed': summary['passed'], 'status': summary['status'],
                      'report': str(Path(report).resolve()), 'error': summary['error']},
                     sort_keys=True))
    if not summary['passed']:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
