"""Regression against LoopRD SQLite migration and reflected model contracts.

The 0.3.153 migration used INTEGER NOT NULL DEFAULT 0 for a model field with
required=False; the deployed LoopRD loader rejected it. Test real SQLite
reflection (as Storage does), historical account preservation and the on-first-
read Companion initialization. No live database or service is accessed.
"""
import copy
import hashlib
import json
import sys
import unittest
from pathlib import Path

import sqlalchemy as sa
import yaml

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tools'))
sys.path.insert(0, str(ROOT / 'server'))
from looprd_sqlite_migration_preflight import validate_sqlite_migration_columns
from looprd_handler import companion_get

NEW_FIELDS = ('companionSnapshot', 'companionRevision', 'companionEpoch')
SQL_TYPES = {'string': lambda d: sa.String(d['maxLength']), 'integer': lambda d: sa.Integer(),
             'boolean': lambda d: sa.Boolean(), 'json': lambda d: sa.JSON(),
             'float': lambda d: sa.Float(), 'datetime': lambda d: sa.DateTime()}


class MigrationNullabilityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.spec = yaml.safe_load((ROOT / 'looprd.yaml').read_text())
        cls.migration = next(item for item in cls.spec['database']['migrations'] if item['version'] == 13)

    def test_schema_12_to_13_preserves_account_and_matches_all_reflected_types(self):
        fields = self.spec['models']['SocialAccount']['fields']
        engine = sa.create_engine('sqlite+pysqlite:///:memory:')
        try:
            metadata = sa.MetaData()
            old_fields = {name: field for name, field in fields.items() if name not in NEW_FIELDS}
            old_table = sa.Table('SocialAccount', metadata, *[
                sa.Column(name, SQL_TYPES[field['type']](field),
                          primary_key=field.get('primaryKey', False),
                          nullable=not (field.get('required', False) or field.get('primaryKey', False)),
                          unique=field.get('unique', False)) for name, field in old_fields.items()])
            with engine.begin() as conn:
                metadata.create_all(conn)
                conn.execute(old_table.insert().values(handle='old-user', passwordHash='hash', created=42,
                    failedAttempts=0, lockedUntil=0, developerEnabled=False, ecosystemAdmin=False,
                    recoveryFailures=0, recoveryLockedUntil=0))
                account_id = conn.exec_driver_sql('SELECT id FROM "SocialAccount" WHERE handle=?', ('old-user',)).scalar_one()
                for statement in self.migration['statements']:
                    conn.exec_driver_sql(statement)
                reflected = {item['name']: item for item in sa.inspect(conn).get_columns('SocialAccount')}
                self.assertEqual(set(reflected), set(fields))
                for name, field in fields.items():
                    with self.subTest(name=name):
                        declared_type = SQL_TYPES[field['type']](field)
                        self.assertIs(reflected[name]['type']._type_affinity, declared_type._type_affinity)
                        if field['type'] == 'string':
                            self.assertEqual(reflected[name]['type'].length, field['maxLength'])
                        if not field.get('primaryKey', False):
                            self.assertEqual(reflected[name]['nullable'],
                                not field.get('required', False))
                self.assertEqual(conn.exec_driver_sql('SELECT "handle" FROM "SocialAccount" WHERE id=?',
                    (account_id,)).scalar_one(), 'old-user')
                state = conn.exec_driver_sql('''SELECT "companionSnapshot", "companionRevision", "companionEpoch"
                    FROM "SocialAccount" WHERE id=?''', (account_id,)).one()
                self.assertEqual(tuple(state), (None, 0, None))
                # An optional revision must genuinely accept NULL, then initialize on read.
                conn.exec_driver_sql('UPDATE "SocialAccount" SET "companionRevision"=NULL WHERE id=?', (account_id,))
                payload = companion_get(conn, f'acct_{account_id}')
                self.assertTrue(payload['ok'])
                self.assertEqual(payload['revision'], 0)
                self.assertIsNone(payload['snapshot'])
                self.assertGreaterEqual(len(payload['epoch']), 16)
                self.assertEqual(conn.exec_driver_sql('SELECT COUNT(*) FROM "SocialAccount"').scalar_one(), 1)
        finally:
            engine.dispose()

    def test_current_spec_passes_full_add_column_preflight(self):
        self.assertIsNone(validate_sqlite_migration_columns(self.spec))
        self.assertEqual(self.spec['release'], '0.3.125')
        self.assertEqual(self.spec['database']['schemaVersion'], 13)
        self.assertEqual(json.loads((ROOT/'server/looprd-release.json').read_text())['release'], '0.3.125')
        link = json.loads((ROOT/'ziprunner.looprd.json').read_text())
        self.assertEqual(link['specification_sha256'], hashlib.sha256((ROOT/'looprd.yaml').read_bytes()).hexdigest())

    def test_original_not_null_revision_is_rejected(self):
        bad = copy.deepcopy(self.spec)
        item = next(m for m in bad['database']['migrations'] if m['version'] == 13)
        item['statements'][1] = item['statements'][1].replace('INTEGER DEFAULT 0', 'INTEGER NOT NULL DEFAULT 0')
        with self.assertRaisesRegex(ValueError, 'SocialAccount.companionRevision nullable=False'):
            validate_sqlite_migration_columns(bad)

    def test_missing_required_not_null_is_rejected(self):
        bad = copy.deepcopy(self.spec)
        item = next(m for m in bad['database']['migrations'] if m['version'] == 12)
        item['statements'][0] = item['statements'][0].replace('INTEGER NOT NULL DEFAULT 0', 'INTEGER DEFAULT 0')
        with self.assertRaisesRegex(ValueError, 'SocialConversationRead.deliveredId nullable=True'):
            validate_sqlite_migration_columns(bad)

    def test_wrong_integer_type_is_rejected(self):
        bad = copy.deepcopy(self.spec)
        item = next(m for m in bad['database']['migrations'] if m['version'] == 13)
        item['statements'][1] = item['statements'][1].replace('INTEGER DEFAULT 0', 'TEXT DEFAULT 0')
        with self.assertRaisesRegex(ValueError, 'SocialAccount.companionRevision must use INTEGER'):
            validate_sqlite_migration_columns(bad)


if __name__ == '__main__':
    unittest.main()
