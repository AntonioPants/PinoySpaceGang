"""Download an explicitly selected authorized HTTPS product with a required checksum.

Use --token-env only for a host authorized to receive that token. Redirects are
disabled to avoid leaking credentials. This utility does not discover scenes,
grant access, perform science processing, or mark a product as ingested.
"""
import argparse
import hashlib
import os
from pathlib import Path
from urllib.parse import urlparse
import requests

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--url',required=True); p.add_argument('--sha256',required=True)
    p.add_argument('--output',required=True,type=Path); p.add_argument('--token-env')
    a=p.parse_args()
    if urlparse(a.url).scheme!='https': p.error('HTTPS required')
    if a.output.exists():
        if hashlib.sha256(a.output.read_bytes()).hexdigest()!=a.sha256: raise ValueError('Existing file checksum mismatch')
        return
    headers={}
    if a.token_env:
        token=os.environ.get(a.token_env)
        if not token: p.error('Configured token environment variable is absent')
        headers['Authorization']='Bearer '+token
    temporary=a.output.with_suffix(a.output.suffix+'.part')
    a.output.parent.mkdir(parents=True,exist_ok=True)
    digest=hashlib.sha256()
    try:
        with requests.get(a.url,headers=headers,stream=True,timeout=(30,120),allow_redirects=False) as response:
            if response.status_code!=200: raise RuntimeError(f'HTTP {response.status_code}; resolve access or redirects explicitly')
            with temporary.open('wb') as target:
                for chunk in response.iter_content(1024*1024): target.write(chunk); digest.update(chunk)
        if digest.hexdigest()!=a.sha256: raise ValueError('Downloaded checksum mismatch')
        temporary.replace(a.output)
    finally: temporary.unlink(missing_ok=True)

if __name__=='__main__': main()
