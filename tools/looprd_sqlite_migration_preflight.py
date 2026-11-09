"""Fail-closed LoopRD SQLite ALTER ADD COLUMN model compatibility preflight.

The deployed LoopRD Storage._initialize_transaction checks every reflected
column's type affinity, string maxLength and nullability after migrations. A
SQL statement can succeed but leave a new component generation un-loadable.
Check generated ADD COLUMN DDL against declared models before Git/ZipRunner
builds. This does not substitute for validating the installed LoopRD runtime.
"""
import re
import sys
from pathlib import Path

import yaml

IDENT = r'(?:(?:"[A-Za-z][A-Za-z0-9_]*")|(?:[A-Za-z][A-Za-z0-9_]*))'
ADD_COLUMN = re.compile(
    rf'^\s*ALTER\s+TABLE\s+(?P<table>{IDENT})\s+ADD\s+COLUMN\s+'
    rf'(?P<column>{IDENT})\s+(?P<type>[A-Za-z]+)'
    rf'(?:\s*\(\s*(?P<length>[0-9]+)\s*\))?'
    rf'(?P<constraints>.*?)\s*;?\s*$', re.I | re.S)
ADD_PREFIX = re.compile(r'^\s*ALTER\s+TABLE\b', re.I)
SQL_TYPE = {'string': 'VARCHAR', 'integer': 'INTEGER', 'boolean': 'BOOLEAN',
            'float': 'FLOAT', 'datetime': 'DATETIME', 'json': 'JSON'}


def validate_sqlite_migration_columns(spec):
    """Match added-column type, length and nullable/required properties."""
    database = spec.get('database') or {}
    if database.get('backend', 'sqlite') != 'sqlite':
        return
    models = spec.get('models') or {}
    for migration in database.get('migrations', []):
        for index, statement in enumerate(migration.get('statements', [])):
            if not ADD_PREFIX.match(statement):
                continue
            match = ADD_COLUMN.fullmatch(statement)
            if match is None:
                raise ValueError(f'database.migrations version {migration.get("version")} statement {index}: '
                                 'cannot safely parse ALTER TABLE ADD COLUMN')
            table, column = (match.group(name).strip('"') for name in ('table', 'column'))
            field = models.get(table, {}).get('fields', {}).get(column)
            if field is None:
                raise ValueError(f'database.migrations version {migration.get("version")} statement {index}: '
                                 f'{table}.{column} is not a declared model field')
            wanted = SQL_TYPE[field['type']]
            kind = match.group('type').upper()
            length = int(match.group('length')) if match.group('length') else None
            actual_type = f'{kind}({length})' if length is not None else kind
            expected_type = f'VARCHAR({field["maxLength"]})' if wanted == 'VARCHAR' else wanted
            if kind != wanted or (wanted == 'VARCHAR' and length != field['maxLength']) or (wanted != 'VARCHAR' and length is not None):
                raise ValueError(f'database.migrations version {migration.get("version")} statement {index}: '
                                 f'{table}.{column} must use {expected_type}; found {actual_type}')
            nullable = not bool(re.search(r'\bNOT\s+NULL\b', match.group('constraints'), re.I))
            expected_nullable = not (field.get('required', False) or field.get('primaryKey', False))
            if nullable != expected_nullable:
                raise ValueError(f'database.migrations version {migration.get("version")} statement {index}: '
                                 f'{table}.{column} nullable={nullable} contradicts '
                                 f'model required={not expected_nullable}')


# Retain the old preflight function for existing tests and callsites.
def validate_sqlite_migration_strings(spec):
    return validate_sqlite_migration_columns(spec)


def main(argv=None):
    args = sys.argv[1:] if argv is None else argv
    root = Path(__file__).resolve().parents[1]
    path = Path(args[0]) if args else root / 'looprd.yaml'
    try:
        spec = yaml.safe_load(path.read_text(encoding='utf-8'))
        if not isinstance(spec, dict):
            raise ValueError('LoopRD specification must be a mapping')
        validate_sqlite_migration_columns(spec)
    except (ValueError, KeyError, OSError, yaml.YAMLError) as exc:
        print(f'LoopRD SQLite migration preflight FAILED: {exc}', file=sys.stderr)
        return 1
    print('LoopRD SQLite ADD COLUMN type, length and nullability: PASS')
    return 0


if __name__ == '__main__':
    sys.exit(main())
