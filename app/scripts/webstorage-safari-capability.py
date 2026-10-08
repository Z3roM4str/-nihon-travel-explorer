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

root = pathlib.Path(__file__).resolve().parent
out = pathlib.Path('webstorage-safari-capability.json')
result = {'runtime': 'system Safari via safaridriver', 'profileReusable': False,
          'persistentCloseReopenVerified': False, 'iOSVerified': False}
driver = None
session = None
server = None

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
except Exception as error:
    result['status'] = 'unavailable-or-probe-failed'; result['error'] = str(error)
finally:
    if session:
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
    out.write_text(json.dumps(result, indent=2)); print(json.dumps(result, indent=2))
raise SystemExit(0 if result.get('reloadOnlyOK') else 1)
