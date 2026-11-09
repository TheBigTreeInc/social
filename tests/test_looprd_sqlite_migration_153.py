"""Regression: LoopRD SQLAlchemy rejects TEXT vs declared string maxLength 8192.

Reproduce the existing schema-12 -> schema-13 SocialAccount upgrade with
representative preexisting account data, using SQLite SQLAlchemy reflection
and the same string length comparison as pac-labs/dapi's Storage.
"""
import copy
import subprocess
import sys
import unittest
from pathlib import Path

import sqlalchemy as sa
import yaml

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tools'))
from looprd_sqlite_migration_preflight import validate_sqlite_migration_strings
SNAPSHOT_FIELDS=('companionSnapshot','companionRevision','companionEpoch')

class MigrationContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.spec=yaml.safe_load((ROOT/'looprd.yaml').read_text())
        cls.migration=next(m for m in cls.spec['database']['migrations'] if m['version']==13)

    def test_sqlite_12_to_13_preserves_account_and_matches_model_lengths(self):
        engine=sa.create_engine('sqlite+pysqlite:///:memory:')
        try:
            account=self.spec['models']['SocialAccount']['fields']
            metadata=sa.MetaData()
            cols=[]
            for name,field in account.items():
                if name in SNAPSHOT_FIELDS: continue
                types={'string':sa.String(field.get('maxLength',128)),
                       'integer':sa.Integer(), 'boolean':sa.Boolean()}
                cols.append(sa.Column(name,types[field['type']],primary_key=field.get('primaryKey',False),
                    nullable=not (field.get('required',False) or field.get('primaryKey',False)),
                    unique=field.get('unique',False)))
            table=sa.Table('SocialAccount',metadata,*cols)
            with engine.begin() as c:
                metadata.create_all(c)
                c.execute(table.insert().values(handle='existing', passwordHash='hash', created=1,
                        failedAttempts=0,lockedUntil=0,developerEnabled=False,
                        ecosystemAdmin=False,recoveryFailures=0,recoveryLockedUntil=0))
                for stmt in self.migration['statements']:
                    c.exec_driver_sql(stmt)
                actual={x['name']:x for x in sa.inspect(c).get_columns('SocialAccount')}
                for name in SNAPSHOT_FIELDS:
                    self.assertEqual(actual[name]['nullable'],
                        not account[name].get('required', False), name)
                    kind=account[name]['type']
                    if kind=='string':
                        self.assertEqual(actual[name]['type']._type_affinity,sa.String()._type_affinity)
                        self.assertEqual(actual[name]['type'].length,account[name]['maxLength'],name)
                    else:
                        self.assertEqual(actual[name]['type']._type_affinity,sa.Integer()._type_affinity)
                row=c.exec_driver_sql('SELECT handle, companionSnapshot, companionRevision, companionEpoch '
                                      'FROM "SocialAccount" WHERE handle = ?',('existing',)).one()
                self.assertEqual(tuple(row),('existing',None,0,None))
                self.assertEqual(c.exec_driver_sql('SELECT COUNT(*) FROM "SocialAccount"').scalar(),1)
        finally: engine.dispose()

    def test_current_descriptor_passes_preflight(self):
        self.assertIsNone(validate_sqlite_migration_strings(self.spec))

    def test_original_text_declaration_is_rejected(self):
        bad=copy.deepcopy(self.spec)
        m=next(m for m in bad['database']['migrations'] if m['version']==13)
        m['statements'][0]=m['statements'][0].replace('VARCHAR(8192)','TEXT')
        with self.assertRaisesRegex(ValueError,r'SocialAccount\.companionSnapshot.*VARCHAR\(8192\)'):
            validate_sqlite_migration_strings(bad)

    def test_wrong_varchar_length_is_rejected(self):
        bad=copy.deepcopy(self.spec)
        m=next(m for m in bad['database']['migrations'] if m['version']==13)
        m['statements'][0]=m['statements'][0].replace('VARCHAR(8192)','VARCHAR(4096)')
        with self.assertRaisesRegex(ValueError,r'SocialAccount\.companionSnapshot.*VARCHAR\(8192\)'):
            validate_sqlite_migration_strings(bad)

    def test_generator_and_preflight(self):
        for command in [['tools/generate-looprd.py','--check'],['tools/looprd_sqlite_migration_preflight.py']]:
            result=subprocess.run([sys.executable,*command],cwd=ROOT,text=True,capture_output=True)
            self.assertEqual(result.returncode,0,result.stdout+'\n'+result.stderr)
        self.assertEqual(self.spec['database']['schemaVersion'],13)
        self.assertEqual(self.spec['release'],'0.3.125')

if __name__=='__main__': unittest.main()
