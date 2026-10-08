"""Ordinary system Safari on an EMPTY CI macOS runner, never a user's profile.
No WebDriver, TCC bypass, force kill, storage reseeding or assertion retries.
Apple Events access is a measured capability, not assumed available.
"""
import functools
import http.server
import json
import os
import pathlib
import shutil
import subprocess
import threading
import time
import uuid

root = pathlib.Path(__file__).resolve().parent
out = pathlib.Path('webstorage-safari-ordinary'); out.mkdir(exist_ok=True)
result = {'sha': subprocess.check_output(['git', 'rev-parse', 'HEAD'], text=True).strip(),
          'runtime': 'ordinary system Safari via Apple Events', 'cases': [],
          'iOSVerified': False, 'forceTermination': False}
servers = []

def command(args):
    try:
        p = subprocess.run(args, capture_output=True, text=True, timeout=8)
        return {'returncode': p.returncode, 'stdout': p.stdout, 'stderr': p.stderr}
    except subprocess.TimeoutExpired as error:
        return {'returncode': -1, 'stdout': str(error.stdout or ''), 'stderr': str(error), 'timeoutSeconds': 8}

def apple(lines):
    r = command(['osascript', '-e', '\n'.join(lines)])
    result.setdefault('appleEvents', []).append(r)
    if r['returncode']:
        raise RuntimeError(r['stderr'])
    return r['stdout'].strip()

def execute(js):
    return apple(['tell application "Safari"', 'do JavaScript '+json.dumps(js)+' in front document', 'end tell'])

def ready(js):
    deadline = time.monotonic()+8
    while True:
        value=execute(js)
        if value == 'true': return
        if time.monotonic() >= deadline: raise RuntimeError('Readiness condition exceeded 8 s: '+js)
        time.sleep(.04)

def read():
    return json.loads(execute("JSON.stringify({at:Date.now(),documentId:window.__ordinaryDoc ||= crypto.randomUUID(),url:location.href,raw:localStorage.getItem('nihon.travellers.v1'),pending:sessionStorage.getItem('nihon.pending.v1.nihon.travellers.v1')})"))

def open_url(url):
    apple(['tell application "Safari"', 'activate', 'make new document with properties {URL:'+json.dumps(url)+'}', 'end tell'])
    ready('document.readyState === "complete"')

def preserve(case,phase):
    # Only browser website storage in the empty hosted runner. Copies precede
    # normal quit/reopen and every failure; no cleanup of original profiles.
    dest=out/case['id']/phase;dest.mkdir(parents=True,exist_ok=True)
    roots=[pathlib.Path.home()/'Library/Containers/com.apple.Safari/Data/Library/WebKit',
           pathlib.Path.home()/'Library/WebKit/com.apple.Safari',
           pathlib.Path.home()/'Library/Safari/LocalStorage']
    entries=[]
    for i,source in enumerate(roots):
        if source.exists():
            target=dest/str(i)
            try:
                shutil.copytree(source,target,symlinks=True,dirs_exist_ok=True)
                entries.append({'source':str(source),'copy':str(target)})
            except Exception as error: entries.append({'source':str(source),'error':str(error)})
    case.setdefault('profiles',[]).append({'phase':phase,'at':time.time_ns()//1000000,'entries':entries})

def start_server():
    class Handler(http.server.SimpleHTTPRequestHandler):
        def do_GET(self):
            if self.path == '/native':
                data=(root/'webstorage-durability-repro.html').read_bytes()
                self.send_response(200);self.send_header('Content-Type','text/html');self.end_headers();self.wfile.write(data)
            else: super().do_GET()
    srv=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(root.parent/'dist')))
    threading.Thread(target=srv.serve_forever,daemon=True).start();servers.append(srv)
    return f'http://127.0.0.1:{srv.server_port}'

try:
    if os.environ.get('GITHUB_ACTIONS') != 'true':
        raise RuntimeError('Refuses ordinary Safari profile outside an empty hosted CI runner')
    result['platform']=command(['sw_vers'])
    result['safariVersion']=command(['/usr/bin/safaridriver','--version'])
    result['simulatorInventory']=command(['xcrun','simctl','list','devices','booted','--json'])
    # Preference in this empty runner only. Never alter TCC or grant Apple
    # Events access through a permissions database: failures are preserved.
    result['javascriptPreference']=command(['defaults','write','com.apple.Safari','AllowJavaScriptFromAppleEvents','-bool','true'])
    for native in [True,False]:
        for i in range(3):
            case={'id':('native' if native else 'nihon')+'-'+str(i),'pass':False,'step':'open'}
            result['cases'].append(case)
            try:
                base=start_server();url=base+('/native' if native else '/')
                open_url(url)
                if native:
                    case['A']=json.loads(execute('JSON.stringify(write(false))'))
                    time.sleep(1.7)
                    case['step']='write-B';case['B']=json.loads(execute('JSON.stringify(write(true))'))
                else:
                    case['step']='intro'
                    ready("!!Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='Saltar')")
                    execute("Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='Saltar').click()")
                    ready("!Array.from(document.querySelectorAll('button')).some(b=>b.textContent.trim()==='Saltar')")
                    case['step']='save'
                    ready("!!Array.from(document.querySelectorAll('button')).find(b=>b.getAttribute('aria-label')?.includes('Ghibli') && b.getAttribute('aria-pressed')!==null)")
                    execute("Array.from(document.querySelectorAll('button')).find(b=>b.getAttribute('aria-label')?.includes('Ghibli') && b.getAttribute('aria-pressed')!==null).click()")
                    ready("Array.from(document.querySelectorAll('button')).some(b=>b.getAttribute('aria-label')?.includes('Ghibli')&&b.getAttribute('aria-pressed')==='true')")
                    case['interaction']='DOM click invokes normal product handler; not trusted pointer input'
                ready("!!localStorage.getItem('nihon.travellers.v1') && JSON.parse(localStorage.getItem('nihon.travellers.v1')).interests.some(x=>x.placeId==='JP-044')")
                case['confirmed']=read();preserve(case,'before-reload')
                case['step']='reload';execute('location.reload(); "requested"')
                ready('document.readyState === "complete" && (window.__ordinaryDoc ||= crypto.randomUUID()) !== '+json.dumps(case['confirmed']['documentId']));case['reload']=read()
                if case['reload']['documentId']==case['confirmed']['documentId']:
                    raise RuntimeError('Reload did not produce a new document')
                preserve(case,'before-quit');case['step']='normal-quit'
                apple(['tell application "Safari" to quit'])
                result.setdefault('processesAfterQuit',[]).append(command(['pgrep','-x','Safari']))
                preserve(case,'after-quit');case['step']='reopen-same-profile';open_url(url)
                case['reopened']=read();preserve(case,'after-reopen')
                expected=case['confirmed']['raw']
                interests=json.loads(expected)['interests']
                case['pass']=any(x['placeId']=='JP-044' for x in interests) and case['reload']['raw']==expected and case['reopened']['raw']==expected
            except Exception as error:
                case['error']=str(error)
                preserve(case,'failure-before-any-cleanup')
                try: case['failureState']=read()
                except Exception as err: case['stateError']=str(err)
                # An inaccessible ordinary session cannot yield a storage
                # result. Stop on the measured capability failure, no retries.
                if not case.get('confirmed'): raise
            finally:
                (out/'results.json').write_text(json.dumps(result,indent=2))
except Exception as error:
    result['error']=str(error)
finally:
    for srv in servers:srv.shutdown()
    (out/'results.json').write_text(json.dumps(result,indent=2))
if result.get('error') or len(result['cases'])!=6 or any(not c['pass'] for c in result['cases']):raise SystemExit(1)
