"""Staged directory publication with a single-writer lock and rollback on rename failure.

Stop development servers during publication. Two directory renames have a brief
availability gap; this is a local build transaction, not a live-server deployer.
"""
from contextlib import contextmanager
import os
from pathlib import Path
import shutil
import tempfile
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
    try:
        with tempfile.TemporaryDirectory(prefix='.catalog-stage-', dir=destination.parent) as folder:
            stage = Path(folder).resolve() / 'public'
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
        lock.unlink(missing_ok=True)
