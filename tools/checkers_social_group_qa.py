"""Bounded source/exact-package Checkers M1 Social QA for ZipRunner group evidence.

This is *Social's* component assertion set only: it does not claim a Checkers
engine, Atrium match authority, live Tavi clients, or deployment acceptance.
"""
from __future__ import annotations
import argparse
from datetime import datetime, timezone
import hashlib
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from uuid import uuid4
from zipfile import ZipFile

ROOT=Path(__file__).resolve().parents[1]
FILES=(
    'server/atrium_challenge_lookup.py', 'server/atrium_contact_lookup.py',
    'server/looprd_handler.py', 'tests/test_checkers_m1_social_contract.py',
    'tools/generate-looprd.py', 'looprd.yaml',
)

class Records(unittest.TextTestResult):
    def __init__(self,*args,**kwargs):
        super().__init__(*args,**kwargs)
        self.records=[]

    def addSuccess(self,test):
        super().addSuccess(test)
        self.records.append({'id':test.id(),'status':'passed'})

    def addFailure(self,test,err):
        super().addFailure(test,err)
        self.records.append({'id':test.id(),'status':'failed',
                             'detail':self._exc_info_to_string(err,test)[-1000:]})

    def addError(self,test,err):
        super().addError(test,err)
        self.records.append({'id':test.id(),'status':'error',
                             'detail':self._exc_info_to_string(err,test)[-1000:]})

    def addSkip(self,test,reason):
        super().addSkip(test,reason)
        self.records.append({'id':test.id(),'status':'skipped','detail':str(reason)[:200]})


def digest_files(root):
    h=hashlib.sha256()
    for name in FILES:
        data=(root/name).read_bytes()
        h.update(name.encode('utf-8')+b'\0'+hashlib.sha256(data).digest())
    return h.hexdigest()


def default_report():
    name=datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')+'-'+uuid4().hex[:8]+'.json'
    return ROOT/'state'/'qa'/'checkers-social'/name


def save_report(path, data):
    path.parent.mkdir(parents=True,exist_ok=True)
    tmp=path.with_name('.'+path.name+'.tmp-'+uuid4().hex[:8])
    try:
        with tmp.open('x',encoding='utf-8') as output:
            json.dump(data,output,indent=2,sort_keys=True)
            output.write('\n')
        tmp.replace(path)
    finally:
        if tmp.exists():tmp.unlink()


def run_source(report,package_sha=None):
    if str(ROOT/'tests') not in sys.path:sys.path.insert(0,str(ROOT/'tests'))
    suite=unittest.defaultTestLoader.discover(str(ROOT/'tests'),pattern='test_checkers_m1_social_contract.py',top_level_dir=str(ROOT/'tests'))
    runner=unittest.TextTestRunner(resultclass=Records,stream=io.StringIO(),verbosity=2)
    result=runner.run(suite)
    good=(result.wasSuccessful() and result.testsRun==6
          and len(result.records)==6 and all(row['status']=='passed' for row in result.records))
    version=json.loads((ROOT/'package.json').read_text())['version']
    data={
        'schema':'dgn.checkers-m1.component-qa/v1',
        'project':'looprd-social',
        'workstream':'DGN-CHECKERS-M1-AUTOMATED-QA-001',
        'responsibility':'Social user identity, friendship and challenge evidence; NOT checkers game authority',
        'version':version,
        'scope':'EXACT_PACKAGE_EXTRACTED' if package_sha else 'SOURCE_TREE',
        'input_zip_sha256':package_sha,
        'tested_source_sha256':digest_files(ROOT),
        'identity':'disposable_local_social_accounts_no_live_principal',
        'network':'none; in-memory SQL fixture, NOT two remote clients',
        'production_activated':False,
        'operator_accepted':False,
        'passed':good,
        'executed':result.testsRun,
        'assertions':result.records,
    }
    save_report(report,data)
    print(json.dumps({'project':data['project'],'scope':data['scope'],'passed':good,
                      'executed':result.testsRun,'report':str(report),'input_zip_sha256':package_sha},sort_keys=True))
    if not good:raise SystemExit(1)


def run_exact(package,report):
    if not package.is_file() or package.stat().st_size>32_000_000:
        raise ValueError('package missing or too large')
    sha=hashlib.sha256(package.read_bytes()).hexdigest()
    with tempfile.TemporaryDirectory(prefix='dgn-checkers-social-') as folder:
        extracted=Path(folder)
        with ZipFile(package) as archive:
            infos=archive.infolist()
            if not 1<=len(infos)<=1000 or archive.testzip() is not None:
                raise ValueError('invalid source ZIP')
            total=0
            for info in infos:
                name=info.filename
                parts=Path(name).parts
                if (name.startswith('/') or '\\' in name or '..' in parts or not parts
                        or info.is_dir() or info.file_size>8_000_000
                        or ((info.external_attr >> 16)&0o170000)==0o120000):
                    raise ValueError('unsafe ZIP entry')
                total+=info.file_size
                if total>48_000_000:raise ValueError('oversize archive')
            names={info.filename for info in infos}
            if not set(FILES+('package.json','tools/checkers_social_group_qa.py')).issubset(names):
                raise ValueError('ZIP missing its own Social QA or service source')
            archive.extractall(extracted)
        version=json.loads((extracted/'package.json').read_text())['version']
        if not package.name.startswith('looprd-social-'+version+'-'):
            raise ValueError('ZIP filename/version mismatch')
        env=dict(os.environ,PYTHONDONTWRITEBYTECODE='1')
        cmd=[sys.executable,str(extracted/'tools/checkers_social_group_qa.py'),
             '--report',str(report),'--extracted-sha',sha]
        p=subprocess.run(cmd,cwd=extracted,env=env,capture_output=True,text=True,timeout=90)
        print(p.stdout[-2500:],end='')
        if p.stderr:print(p.stderr[-2500:],file=sys.stderr,end='')
        if p.returncode:raise SystemExit(p.returncode)


def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--package',type=Path,help='original exact source ZIP')
    ap.add_argument('--report',type=Path,help='JSON evidence (default protected state/qa)')
    ap.add_argument('--extracted-sha',help=argparse.SUPPRESS)
    args=ap.parse_args()
    report=(args.report or default_report()).resolve()
    if args.package:
        if args.extracted_sha:ap.error('nested exact-package run forbidden')
        run_exact(args.package.resolve(),report)
    else:
        run_source(report,args.extracted_sha)

if __name__=='__main__':main()
