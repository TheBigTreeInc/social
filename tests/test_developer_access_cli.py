"""Operator-only Social permissions: local DB edits without a public privilege-grant API."""
import importlib.util
from pathlib import Path
import sqlite3
from contextlib import closing
import sys
import tempfile
import unittest
from unittest.mock import patch

SCRIPT=Path(__file__).resolve().parents[1]/'tools/social-developer-access.py'
spec=importlib.util.spec_from_file_location('social_developer_access',SCRIPT)
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class DeveloperOperatorToolTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.db=Path(self.tmp.name)/'looprd-social.sqlite3'
        with closing(sqlite3.connect(self.db)) as conn:
            conn.execute('CREATE TABLE _looprd_schema (id INTEGER PRIMARY KEY, version INTEGER NOT NULL)')
            conn.execute('INSERT INTO _looprd_schema (id,version) VALUES (1,3)')
            conn.execute('CREATE TABLE SocialAccount (id INTEGER PRIMARY KEY, handle TEXT, developerEnabled BOOLEAN NOT NULL DEFAULT 0)')
            conn.execute('INSERT INTO SocialAccount(id,handle,developerEnabled) VALUES (1,\'alice\',0)')
            conn.commit()
    def tearDown(self): self.tmp.cleanup()
    def test_flag_can_only_change_via_authorized_local_db_tool(self):
        self.assertEqual(module.set_access(self.db,'alice',None),('alice',False))
        self.assertEqual(module.set_access(self.db,'ALICE',True),('alice',True))
        self.assertEqual(module.set_access(self.db,'alice',None),('alice',True))
        self.assertEqual(module.set_access(self.db,'alice',False),('alice',False))
    def test_missing_db_or_account_never_created(self):
        with self.assertRaises(FileNotFoundError):module.set_access(self.db.parent/'missing.sqlite3','alice',True)
        with self.assertRaises(ValueError):module.set_access(self.db,'bob',True)
        with closing(sqlite3.connect(self.db)) as conn:
            self.assertEqual(conn.execute('SELECT COUNT(*) FROM SocialAccount').fetchone()[0],1)
    def test_old_schema_does_not_get_mutated(self):
        with closing(sqlite3.connect(self.db)) as conn:
            conn.execute('UPDATE _looprd_schema SET version=2')
            conn.commit()
        with self.assertRaises(ValueError):module.set_access(self.db,'alice',True)
        with closing(sqlite3.connect(self.db)) as conn:
            self.assertEqual(conn.execute('SELECT developerEnabled FROM SocialAccount').fetchone()[0],0)


if __name__=='__main__':unittest.main()
