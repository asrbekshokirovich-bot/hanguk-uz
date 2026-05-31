import paramiko, pathlib, sys

key = paramiko.Ed25519Key.from_private_key_file(str(pathlib.Path.home() / '.ssh' / 'hanguk_hetzner'))
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('178.105.96.155', username='root', pkey=key, timeout=30)

def run(cmd, timeout=120):
    _, out, err = ssh.exec_command(cmd, timeout=timeout)
    rc = out.channel.recv_exit_status()
    return rc, out.read().decode(errors='replace'), err.read().decode(errors='replace')

# Verify imports
rc, out, err = run(
    'cd /opt/hanguk-uni-db/uni_db && '
    '.venv/bin/python -c '
    '"import sys; sys.path.insert(0,chr(39)src chr(39)); '
    'from uni_db.discovery.adapters.configs import ADAPTER_REGISTRY; '
    'print(list(ADAPTER_REGISTRY.keys()))"'
)
print(f'Import rc={rc} out={out.strip()} err={err[:200]}')

# Dry-run SNU discovery (365 days back to get all posts)
cmd = (
    'cd /opt/hanguk-uni-db/uni_db && '
    'UNI_DB_LIVE_CRAWL=true '
    '.venv/bin/python scripts/run_discovery_once.py '
    '--source-url https://admission.snu.ac.kr/international/notice '
    '--since 365 --dry-run'
)
rc2, out2, err2 = run(cmd, timeout=90)
print(f'\nDry-run rc={rc2}')
print(out2)
if err2:
    print('STDERR:', err2[:500])

ssh.close()
