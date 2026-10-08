"""Bounded capability probe of actual macOS Safari, NOT persistent-profile certification.

Safari WebDriver's isolated automation session does not expose reusable profile
selection. Never infer close/reopen or iOS guarantees from this reload probe.
"""
import functools
import http.server
import json
import pathlib
import subprocess
import threading
import time
import urllib.request
import urllib.error
import base64

root = pathlib.Path(__file__).resolve().parent
out = pathlib.Path('webstorage-safari-capability.json')
result = {'runtime': 'system Safari via safaridriver', 'profileReusable': False,
          'persistentCloseReopenVerified': False, 'iOSVerified': False}
driver = None
session = None
server = None
servers = []
result['cases'] = []

def wait(script):
    deadline = time.monotonic() + 8
    while True:
        value = execute(script)
        if value:
            return value
        if time.monotonic() >= deadline:
            raise RuntimeError('Readiness condition exceeded existing 8 s: ' + script)
        time.sleep(.04)

def click(script):
    element = wait(script)
    element_id = element['element-6066-11e4-a52e-4f735466cecf']
    call('/session/' + session + '/element/' + element_id + '/click', {})

def evidence(case):
    folder = pathlib.Path('webstorage-safari-evidence') / case['id']; folder.mkdir(parents=True, exist_ok=True)
    try:
        (folder / 'interface.html').write_text(execute('return document.documentElement.outerHTML'))
        (folder / 'screenshot.png').write_bytes(base64.b64decode(call('/session/' + session + '/screenshot')))
        case['observedState'] = execute("return {documentId: window.__safariDoc ||= crypto.randomUUID(), origin: location.origin, raw: localStorage.getItem('nihon.travellers.v1'), pending: sessionStorage.getItem('nihon.pending.v1.nihon.travellers.v1')}")
    except Exception as error:
        case['evidenceError'] = str(error)
    (folder / 'result.json').write_text(json.dumps(case, indent=2))

def start_server(directory):
    native = (root / 'webstorage-durability-repro.html').read_bytes()
    class Handler(http.server.SimpleHTTPRequestHandler):
        def do_GET(self):
            if self.path == '/native':
                self.send_response(200); self.send_header('Content-Type', 'text/html'); self.end_headers(); self.wfile.write(native)
            else:
                super().do_GET()
    current = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Handler, directory=str(directory)))
    threading.Thread(target=current.serve_forever, daemon=True).start(); servers.append(current)
    return f'http://127.0.0.1:{current.server_port}'

def call(path, body=None, method=None):
    request = urllib.request.Request('http://127.0.0.1:4444' + path,
                                    data=json.dumps(body).encode() if body is not None else None,
                                    headers={'Content-Type': 'application/json'}, method=method)
    try:
        with urllib.request.urlopen(request, timeout=8) as response:
            value = json.load(response)['value']
    except urllib.error.HTTPError as error:
        raise RuntimeError(error.read().decode()) from error
    return value

def execute(script):
    return call('/session/' + session + '/execute/sync', {'script': script, 'args': []})

try:
    result['platform'] = subprocess.check_output(['sw_vers'], text=True)
    result['safaridriverVersion'] = subprocess.check_output(['/usr/bin/safaridriver', '--version'], text=True)
    enabled = subprocess.run(['sudo', '-n', '/usr/bin/safaridriver', '--enable'], capture_output=True, text=True)
    result['enable'] = {'returncode': enabled.returncode, 'stdout': enabled.stdout, 'stderr': enabled.stderr}
    with open('webstorage-safaridriver.log', 'w') as log:
        driver = subprocess.Popen(['/usr/bin/safaridriver', '-p', '4444'], stdout=log, stderr=log)
    # Bounded readiness polling only; never rerun a failed storage assertion.
    deadline = time.monotonic() + 8
    while True:
        try:
            call('/status')
            break
        except Exception:
            if time.monotonic() >= deadline:
                raise
            time.sleep(.1)
    created = call('/session', {'capabilities': {'alwaysMatch': {'browserName': 'safari'}}})
    session = created['sessionId']; result['capabilities'] = created['capabilities']
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(root)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    call('/session/' + session + '/url', {'url': f'http://127.0.0.1:{server.server_port}/webstorage-durability-repro.html'})
    result['A'] = execute('return write(false)')
    time.sleep(1.7)  # Same A-to-B separation as the preserved case.
    result['B'] = execute('return write(true)')
    before = execute('return read()'); result['before'] = before
    call('/session/' + session + '/refresh', {})
    after = execute('return read()'); result['afterReload'] = after
    result['status'] = 'available'
    result['reloadOnlyOK'] = (before['raw'] == result['B']['raw'] == after['raw']
                              and before['documentId'] != after['documentId'])
    result['cases'].append({'id': 'native-1', 'subject': 'native', 'before': before, 'afterReload': after, 'expected': result['B']['raw'], 'ok': result['reloadOnlyOK']})
    # New isolated origins, never clear or overwrite a prior case's data.
    for iteration in [2, 3]:
        case = {'id': f'native-{iteration}', 'subject': 'native', 'ok': False}
        try:
            origin = start_server(root); case['origin'] = origin
            call('/session/' + session + '/url', {'url': origin + '/native'})
            case['A'] = execute('return write(false)'); time.sleep(1.7)
            case['B'] = execute('return write(true)'); case['expected'] = case['B']['raw']
            case['before'] = execute('return read()'); call('/session/' + session + '/refresh', {})
            case['afterReload'] = execute('return read()')
            case['ok'] = (case['before']['raw'] == case['afterReload']['raw'] == case['expected']
                          and case['before']['documentId'] != case['afterReload']['documentId'])
        except Exception as error:
            case['error'] = str(error)
        finally:
            evidence(case); result['cases'].append(case)
    if (root.parent / 'dist' / 'index.html').exists():
        for iteration in [1, 2, 3]:
            case = {'id': f'Nihon-{iteration}', 'subject': 'Nihon', 'ok': False, 'fixturesSeeded': False}
            try:
                origin = start_server(root.parent / 'dist'); case['origin'] = origin
                call('/session/' + session + '/url', {'url': origin + '/'})
                click("return Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Saltar')")
                click("return Array.from(document.querySelectorAll('button')).find(b => b.getAttribute('aria-label') === 'Quiero ir: Ghibli Museum, Mitaka')")
                case['UIConfirmedAt'] = int(time.time() * 1000)
                wait("return document.querySelector('button[aria-label=\"Quitar Ghibli Museum, Mitaka de Quiero ir\"]')?.getAttribute('aria-pressed') === 'true'")
                case['expected'] = wait("const r = localStorage.getItem('nihon.travellers.v1'); return r && JSON.parse(r).interests.some(i => i.placeId === 'JP-044') ? r : null")
                case['APIConfirmedAt'] = int(time.time() * 1000)
                case['beforeDoc'] = execute('return window.__safariDoc ||= crypto.randomUUID()')
                # No forensic delay before the ordinary offered browser reload.
                call('/session/' + session + '/refresh', {})
                case['afterDoc'] = execute('return window.__safariDoc ||= crypto.randomUUID()')
                case['rawAfterReload'] = execute("return localStorage.getItem('nihon.travellers.v1')")
                wait("return document.querySelector('button[aria-label=\"Quitar Ghibli Museum, Mitaka de Quiero ir\"]')?.getAttribute('aria-pressed') === 'true'")
                case['ok'] = case['rawAfterReload'] == case['expected'] and case['beforeDoc'] != case['afterDoc']
            except Exception as error:
                case['error'] = str(error)
            finally:
                evidence(case); result['cases'].append(case)
    result['repeatedReloadOK'] = all(case['ok'] for case in result['cases'])
except Exception as error:
    result['status'] = 'unavailable-or-probe-failed'; result['error'] = str(error)
finally:
    if session:
        # Export API/UI observations before disposal of the isolated automation
        # session. This cannot preserve an ordinary persistent Safari profile.
        result['beforeSessionDisposal'] = {'at': int(time.time() * 1000), 'isolatedSession': session}
        try:
            call('/session/' + session, method='DELETE')
        except Exception as error:
            result['sessionCloseError'] = str(error)
    if driver:
        driver.terminate()
        try:
            driver.wait(timeout=8)
        except subprocess.TimeoutExpired:
            driver.kill(); driver.wait(); result['driverForcedTermination'] = True
    if server:
        server.shutdown(); server.server_close()
    for current in servers:
        current.shutdown(); current.server_close()
    out.write_text(json.dumps(result, indent=2)); print(json.dumps(result, indent=2))
raise SystemExit(0 if result.get('repeatedReloadOK') else 1)
