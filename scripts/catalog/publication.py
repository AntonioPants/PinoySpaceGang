"""Staged directory publication with a single-writer lock and rollback on rename failure.

Stop development servers during publication. Two directory renames have a brief
availability gap; this is a local build transaction, not a live-server deployer.
"""
from contextlib import contextmanager
import os
from pathlib import Path
import shutil
import uuid


@contextmanager
def publication(destination, seed=None):
    destination = Path(destination).resolve()
    destination.parent.mkdir(parents=True, exist_ok=True)
    lock = destination.parent / f'.{destination.name}.publish.lock'
    # A stale lock after an interrupted process must be inspected, never bypassed.
    with lock.open('x', encoding='utf-8') as handle:
        handle.write(str(os.getpid()))
    backup = destination.parent / f'.{destination.name}.previous-{uuid.uuid4().hex}'
    # mkdir inherits the workspace ACL on Windows. tempfile.mkdtemp uses a private
    # owner-only ACL on recent Python, which would lock out other workspace users
    # when renamed into production.
    folder = destination.parent / f'.catalog-stage-{uuid.uuid4().hex}'
    try:
        folder.mkdir()
        try:
            stage = folder / 'public'
            source = Path(seed).resolve() if seed else destination
            if source.exists():
                shutil.copytree(source, stage)
            else:
                stage.mkdir()
            yield stage
            moved = destination.exists()
            if moved:
                os.replace(destination, backup)
            try:
                os.replace(stage, destination)
            except BaseException:
                if moved:
                    os.replace(backup, destination)
                raise
            if moved:
                # This generated sibling is the only recursively removed path.
                assert backup.resolve().parent == destination.parent
                assert backup.name.startswith(f'.{destination.name}.previous-')
                shutil.rmtree(backup)
        finally:
            assert folder.resolve().parent == destination.parent
            assert folder.name.startswith('.catalog-stage-')
            shutil.rmtree(folder)
    finally:
        lock.unlink(missing_ok=True)
