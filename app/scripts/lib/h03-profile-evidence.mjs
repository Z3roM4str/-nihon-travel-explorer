import { cpSync, mkdirSync, readdirSync, readFileSync, readlinkSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

// Only disposable synthetic profiles. Copy files before inspecting them: SQLite is opened read-only on the copy.
// These operations happen after the strict gate verdict and never seed or write browser storage.
export function snapshotProfile(profile, destination) {
  const startedAt = Date.now(), identity = statSync(profile);
  mkdirSync(destination, { recursive: true });
  cpSync(profile, destination, { recursive: true });
  const python = `
import pathlib,sqlite3,json,hashlib,sys
root=pathlib.Path(sys.argv[1]).resolve(); databases=[]; errors=[]; files=[]
def text(v):
 if isinstance(v,bytes):
  try:return v.decode('utf-16-le' if b'\\x00' in v else 'utf-8')
  except UnicodeError:return None
 return v
for p in sorted(root.rglob('*')):
 if not p.is_file():continue
 try:
  with p.open('rb') as f:header=f.read(16)
  if header!=b'SQLite format 3\\x00':continue
  for q in [p,pathlib.Path(str(p)+'-wal'),pathlib.Path(str(p)+'-shm')]:
   if q.exists():files.append({'path':str(q.relative_to(root)),'bytes':q.stat().st_size,'sha256':hashlib.sha256(q.read_bytes()).hexdigest()})
  db={'path':str(p.relative_to(root)),'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'records':[]}
  c=sqlite3.connect(p.as_uri()+'?mode=ro',uri=True);c.execute('PRAGMA query_only=ON')
  tables=c.execute("SELECT name,sql FROM sqlite_master WHERE type='table'").fetchall();db['schema']=tables
  if any(name=='ItemTable' for name,sql in tables):
   for key,value in c.execute('SELECT key,value FROM ItemTable'):
    db['records'].append({'key':text(key),'value':text(value),'keyHex':key.hex() if isinstance(key,bytes) else None,'valueHex':value.hex() if isinstance(value,bytes) else None})
  c.close();databases.append(db)
 except Exception as e:errors.append({'path':str(p.relative_to(root)),'error':str(e)})
print(json.dumps({'databases':databases,'errors':errors,'files':files}))
`;
  return { directory: destination, profile, identity: { device: identity.dev, inode: identity.ino }, startedAt,
    ...JSON.parse(execFileSync('python3', ['-c', python, destination], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 })),
    finishedAt: Date.now(), atomic: false };
}

export function storageValues(snapshot, key = 'nihon.travellers.v1') {
  return snapshot.databases.flatMap(db => db.records.filter(row => row.key === key).map(row => ({ database: db.path, value: row.value, valueHex: row.valueHex })));
}

const networkProcesses = () => readdirSync('/proc').filter(pid => /^\d+$/.test(pid)).flatMap(pid => {
  try {
    if (!/NetworkProcess$/.test(readlinkSync(`/proc/${pid}/exe`))) return [];
    return [{ pid: Number(pid), ppid: Number(readFileSync(`/proc/${pid}/status`, 'utf8').match(/^PPid:\s+(\d+)/m)?.[1]) }];
  } catch { return []; }
});

export async function readProfileInNewProcess({ browserType, profile, url }) {
  const before = networkProcesses();
  const context = await browserType.launchPersistentContext(profile, { viewport: { width: 390, height: 900 } });
  try {
    const page = await context.newPage();
    page.setDefaultTimeout(8000);
    // The endpoint is a native HTML page, without scripts, init scripts, Nihon, or storageState.
    await page.goto(url);
    const raw = await page.evaluate(() => localStorage.getItem('nihon.travellers.v1'));
    return { raw, before, after: networkProcesses(), initScripts: false, reseeded: false };
  } finally { await context.close(); }
}
