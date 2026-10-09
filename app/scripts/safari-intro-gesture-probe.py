"""Hypothesis probe: why does a Safari WebDriver click not close Nihon's introduction?

Evidence before this probe (2fd30db, run 37793808980): three Element Click calls on «Saltar» returned
success with a stable, actionable target, and the dialog stayed open. Three explanations remain:

  H-driver   the gesture never reaches the page (automation/runner problem, nothing to do with Nihon);
  H-product  the gesture reaches the page but Nihon does not react (an interface defect);
  H-window   the page is not focused/visible, so the page receives nothing.

One gesture per variant, each on a FRESH origin (a new port is a new synthetic profile), no delayed
retry of a rejected gesture. The decisive records are the capture-phase events seen by the document
(`isTrusted`, target) before and after each gesture. A control page without Nihon uses the same
variants: if the control also loses the gesture, the cause is the driver/runner, not the product.

Safari WebDriver sessions are isolated and cannot reopen an ordinary profile, so this probe never
certifies close/reopen persistence; it only records what a new session on the same origin sees.
"""
import base64
import functools
import http.server
import json
import pathlib
import subprocess
import threading
import time
import urllib.error
import urllib.request

root = pathlib.Path(__file__).resolve().parent
dist = root.parent / 'dist'
out = pathlib.Path('safari-intro-gesture-probe.json')
result = {'runtime': 'system Safari via safaridriver', 'variants': [], 'journey': None,
          'persistentCloseReopenVerified': False, 'iOSVerified': False}
driver = None
session = None
servers = []

CONTROL = b"""<!doctype html><meta charset=utf-8><title>control</title>
<button id=b style="position:fixed;left:200px;top:200px;width:160px;height:48px">control</button>
<script>window.__n = 0; document.getElementById('b').addEventListener('click', () => { window.__n += 1; });</script>"""

INSTRUMENT = """
window.__ev = [];
for (const t of ['pointerdown','mousedown','pointerup','mouseup','click','keydown','keyup']) {
  document.addEventListener(t, e => window.__ev.push({t: e.type, trusted: e.isTrusted,
    target: String(e.target.className || e.target.tagName).slice(0, 60), x: e.clientX, y: e.clientY,
    at: Math.round(performance.now())}), true);
}
return true;
"""

STATE = """
return {focus: document.hasFocus(), visibility: document.visibilityState,
  dialogOpen: !!document.querySelector('.onboarding__dialog'),
  seenFlag: localStorage.getItem('nihon.onboarding.seen.v1'),
  clicksOnControl: window.__n ?? null,
  events: window.__ev ?? null,
  active: document.activeElement ? document.activeElement.outerHTML.slice(0, 120) : null,
  viewport: [innerWidth, innerHeight]};
"""

SKIP = "return Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Saltar')"


def call(path, body=None, method=None):
    request = urllib.request.Request('http://127.0.0.1:4444' + path,
                                    data=json.dumps(body).encode() if body is not None else None,
                                    headers={'Content-Type': 'application/json'}, method=method)
    try:
        with urllib.request.urlopen(request, timeout=8) as response:
            return json.load(response)['value']
    except urllib.error.HTTPError as error:
        raise RuntimeError(error.read().decode()) from error


def execute(script):
    return call('/session/' + session + '/execute/sync', {'script': script, 'args': []})


def wait(script, seconds=8):
    deadline = time.monotonic() + seconds
    while True:
        value = execute(script)
        if value:
            return value
        if time.monotonic() >= deadline:
            raise RuntimeError('Readiness condition exceeded ' + str(seconds) + ' s: ' + script[:120])
        time.sleep(.04)


def start_server(directory, control=False):
    class Handler(http.server.SimpleHTTPRequestHandler):
        def do_GET(self):
            if control and self.path.startswith('/control'):
                self.send_response(200); self.send_header('Content-Type', 'text/html'); self.end_headers()
                self.wfile.write(CONTROL)
            else:
                super().do_GET()
        def log_message(self, *args):
            pass
    current = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Handler, directory=str(directory)))
    threading.Thread(target=current.serve_forever, daemon=True).start(); servers.append(current)
    return f'http://127.0.0.1:{current.server_port}'


def element_id(script):
    element = wait(script)
    return element['element-6066-11e4-a52e-4f735466cecf']


def center(script):
    return execute(script.replace('return ', 'const e = ', 1) +
                   "; e.scrollIntoView({block: 'center'}); const r = e.getBoundingClientRect();"
                   " return {x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2)};")


def settle_geometry(script):
    """Same actionability as the previous harness: stable rect and hit target, polled inside 8 s."""
    wait("window.__g = window.__g || {p: null}; const e = (function(){" + script + "})(); if (!e) return false;"
         " e.scrollIntoView({block: 'center'}); const r = e.getBoundingClientRect();"
         " const rect = [r.left, r.top, r.width, r.height]; const hit = document.elementFromPoint(r.left + r.width/2, r.top + r.height/2);"
         " const ok = window.__g.p && rect.every((v, i) => v === window.__g.p[i]) && (hit === e || e.contains(hit));"
         " window.__g.p = rect; return ok;")


def gesture(variant, script):
    """Exactly one gesture of the named kind aimed at the element returned by `script`."""
    settle_geometry(script)
    if variant == 'element-click':
        call('/session/' + session + '/element/' + element_id(script) + '/click', {})
    elif variant == 'actions-pointer':
        point = center(script)
        call('/session/' + session + '/actions', {'actions': [{'type': 'pointer', 'id': 'mouse',
             'parameters': {'pointerType': 'mouse'}, 'actions': [
                 {'type': 'pointerMove', 'duration': 0, 'origin': 'viewport', 'x': point['x'], 'y': point['y']},
                 {'type': 'pointerDown', 'button': 0}, {'type': 'pointerUp', 'button': 0}]}]})
        call('/session/' + session + '/actions', method='DELETE')
    elif variant == 'keyboard-enter':
        eid = element_id(script)
        execute(script.replace('return ', 'const e = ', 1) + '; e.focus(); return document.activeElement === e;')
        call('/session/' + session + '/element/' + eid + '/value', {'text': ''})
    elif variant == 'script-click':
        execute(script.replace('return ', 'const e = ', 1) + '; e.click(); return true;')
    else:
        raise ValueError(variant)


def evidence(name):
    folder = pathlib.Path('safari-intro-gesture-evidence') / name; folder.mkdir(parents=True, exist_ok=True)
    try:
        (folder / 'screenshot.png').write_bytes(base64.b64decode(call('/session/' + session + '/screenshot')))
        (folder / 'interface.html').write_text(execute('return document.documentElement.outerHTML'))
    except Exception as error:
        return str(error)
    return None


def run_variant(subject, variant):
    case = {'subject': subject, 'variant': variant}
    try:
        origin = start_server(dist if subject == 'Nihon' else root, control=subject == 'control')
        case['origin'] = origin
        call('/session/' + session + '/url', {'url': origin + ('/' if subject == 'Nihon' else '/control')})
        if subject == 'Nihon':
            wait("return !!document.querySelector('.onboarding__dialog')")
            target = SKIP
        else:
            wait("return !!document.getElementById('b')")
            target = "return document.getElementById('b')"
        execute(INSTRUMENT)
        case['before'] = execute(STATE)
        case['gestureAt'] = int(time.time() * 1000)
        gesture(variant, target)
        time.sleep(1.0)  # one bounded observation window after the single gesture, never a retry
        case['after'] = execute(STATE)
        case['received'] = any(e['t'] == 'click' for e in (case['after']['events'] or []))
        case['reactedOrClosed'] = (not case['after']['dialogOpen']) if subject == 'Nihon' else case['after']['clicksOnControl'] == 1
    except Exception as error:
        case['error'] = str(error)
    case['evidenceError'] = evidence(f'{subject}-{variant}') if session else None
    result['variants'].append(case)
    return case


def gesture_mode_journey(variant):
    journey = {'gesture': variant, 'steps': [], 'ok': False}
    result['journey'] = journey

    def step(name, fn):
        journey['steps'].append({'step': name})
        value = fn()
        journey['steps'][-1]['value'] = value
        return value

    try:
        origin = start_server(dist); journey['origin'] = origin
        call('/session/' + session + '/url', {'url': origin + '/'})
        step('introduction-visible', lambda: wait("return !!document.querySelector('.onboarding__dialog')") and True)
        gesture(variant, SKIP)
        step('introduction-closed', lambda: wait("return !document.querySelector('.onboarding__dialog')"))
        add = "return Array.from(document.querySelectorAll('button')).find(b => b.getAttribute('aria-label') === 'Quiero ir: Ghibli Museum, Mitaka')"
        remove = "return Array.from(document.querySelectorAll('button')).find(b => b.getAttribute('aria-label') === 'Quitar Ghibli Museum, Mitaka de Quiero ir')"
        gesture(variant, add)
        wait("return document.querySelector('button[aria-label=\"Quitar Ghibli Museum, Mitaka de Quiero ir\"]')?.getAttribute('aria-pressed') === 'true'")
        saved = step('favorite-saved-raw', lambda: wait("const r = localStorage.getItem('nihon.travellers.v1'); return r && JSON.parse(r).interests.some(i => i.placeId === 'JP-044') ? r : null"))
        call('/session/' + session + '/refresh', {})
        step('after-reload-favorite-visible', lambda: wait("return document.querySelector('button[aria-label=\"Quitar Ghibli Museum, Mitaka de Quiero ir\"]')?.getAttribute('aria-pressed') === 'true'"))
        step('after-reload-introduction-absent', lambda: execute("return !document.querySelector('.onboarding__dialog')"))
        journey['rawAfterReloadEqualsSaved'] = execute("return localStorage.getItem('nihon.travellers.v1')") == saved
        # A later change and its recovery (put it back), each confirmed through the API and one reload.
        gesture(variant, remove)
        step('change-removed', lambda: wait("const r = localStorage.getItem('nihon.travellers.v1'); return r && !JSON.parse(r).interests.some(i => i.placeId === 'JP-044')"))
        call('/session/' + session + '/refresh', {})
        step('change-survives-reload', lambda: wait("const r = localStorage.getItem('nihon.travellers.v1'); return r && !JSON.parse(r).interests.some(i => i.placeId === 'JP-044')"))
        gesture(variant, add)
        step('recovered-saved-again', lambda: wait("const r = localStorage.getItem('nihon.travellers.v1'); return r && JSON.parse(r).interests.some(i => i.placeId === 'JP-044')"))
        journey['ok'] = True
        # What a NEW automation session sees on the same origin: records the isolation of WebDriver sessions.
        call('/session/' + session, method='DELETE')
        created = call('/session', {'capabilities': {'alwaysMatch': {'browserName': 'safari'}}})
        globals()['session'] = created['sessionId']
        call('/session/' + session + '/url', {'url': origin + '/'})
        journey['newSessionSameOrigin'] = execute("return {raw: localStorage.getItem('nihon.travellers.v1'), seen: localStorage.getItem('nihon.onboarding.seen.v1')}")
    except Exception as error:
        journey['error'] = str(error)
        if session:
            journey['evidenceError'] = evidence('journey-failure')


try:
    result['platform'] = subprocess.check_output(['sw_vers'], text=True)
    enabled = subprocess.run(['sudo', '-n', '/usr/bin/safaridriver', '--enable'], capture_output=True, text=True)
    result['enable'] = {'returncode': enabled.returncode, 'stderr': enabled.stderr}
    with open('safari-intro-gesture-driver.log', 'w') as log:
        driver = subprocess.Popen(['/usr/bin/safaridriver', '-p', '4444'], stdout=log, stderr=log)
    deadline = time.monotonic() + 8
    while True:
        try:
            call('/status'); break
        except Exception:
            if time.monotonic() >= deadline:
                raise
            time.sleep(.1)
    created = call('/session', {'capabilities': {'alwaysMatch': {'browserName': 'safari'}}})
    session = created['sessionId']; result['capabilities'] = created['capabilities']
    for subject in ['control', 'Nihon']:
        for variant in ['element-click', 'actions-pointer', 'keyboard-enter', 'script-click']:
            run_variant(subject, variant)
    working = [c['variant'] for c in result['variants'] if c['subject'] == 'Nihon' and c.get('reactedOrClosed')]
    result['nihonVariantsThatClosedIntroduction'] = working
    result['controlVariantsDelivered'] = [c['variant'] for c in result['variants'] if c['subject'] == 'control' and c.get('reactedOrClosed')]
    # Prefer a native gesture; a script click is only a (labelled) synthetic gesture.
    chosen = next((v for v in ['element-click', 'actions-pointer', 'keyboard-enter', 'script-click'] if v in working), None)
    if chosen:
        gesture_mode_journey(chosen)
    result['status'] = 'completed'
except Exception as error:
    result['status'] = 'probe-failed'; result['error'] = str(error)
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
    for current in servers:
        current.shutdown(); current.server_close()
    out.write_text(json.dumps(result, indent=2)); print(json.dumps(result, indent=2))
# Exit code reports only that the probe produced a verdict; the verdict itself is in the JSON.
raise SystemExit(0 if result.get('status') == 'completed' else 1)
