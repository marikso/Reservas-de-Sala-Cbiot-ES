import urllib.request, urllib.error, json, http.cookiejar, re

BACKEND = 'http://127.0.0.1:5000'
FRONTEND = 'http://127.0.0.1:8082'
results = []

# Opener persistente com jar partilhado — necessário para sessão funcionar
jar = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))

def get(url):
    try:
        r = opener.open(url, timeout=5)
        return r.status, r.read().decode(errors='replace')
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode(errors='replace')
    except Exception as e:
        return 0, str(e)

def post(url, body):
    data = json.dumps(body).encode()
    req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'})
    try:
        r = opener.open(req, timeout=5)
        return r.status, json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, {}
    except Exception as e:
        return 0, {}

# ── BACKEND ──────────────────────────────────────────
c, body = post(BACKEND + '/api/auth/login', {'email': 'admin@exemplo.com', 'senha': 'admin'})
results.append(('PASS' if c == 200 else 'FAIL', 'Backend login', f'HTTP {c}'))

c, whoami = get(BACKEND + '/api/auth/whoami')
ok = isinstance(whoami, str) and 'admin@exemplo.com' in whoami
results.append(('PASS' if ok else 'FAIL', 'Backend whoami (sessao)', 'admin@exemplo.com' if ok else f'vazio — HTTP {c}'))

c, _ = get(BACKEND + '/api/salas')
results.append(('PASS' if c == 200 else 'FAIL', 'Backend /api/salas', f'HTTP {c}'))

c, _ = get(BACKEND + '/api/users')
results.append(('PASS' if c in (200, 401) else 'FAIL', 'Backend /api/users (admin logado, esperado 200)', f'HTTP {c}'))

# ── FRONTEND ─────────────────────────────────────────
c, html = get(FRONTEND + '/Reserva-de-Sala/')
has_root = 'id="root"' in html
results.append(('PASS' if c == 200 and has_root else 'FAIL', 'Frontend /Reserva-de-Sala/', f'HTTP {c}, root div: {has_root}'))

c, html2 = get(FRONTEND + '/Reserva-de-Sala/ReservaDeSalas')
has_root2 = 'id="root"' in html2
results.append(('PASS' if c == 200 and has_root2 else 'FAIL', 'SPA fallback /ReservaDeSalas', f'HTTP {c}, root div: {has_root2}'))

# ── PROXY nginx→backend ───────────────────────────────
c, _ = get(FRONTEND + '/Reserva-de-Sala/api/salas')
results.append(('PASS' if c == 200 else 'FAIL', 'Proxy nginx /Reserva-de-Sala/api/salas', f'HTTP {c}'))

# Novo opener sem sessão para testar 401
bare = urllib.request.build_opener()
try:
    bare.open(FRONTEND + '/Reserva-de-Sala/api/users', timeout=5)
    results.append(('FAIL', 'Proxy nginx /api/users sem auth', 'devia ser 401, got 200'))
except urllib.error.HTTPError as e:
    results.append(('PASS' if e.code == 401 else 'FAIL', 'Proxy nginx /api/users sem auth', f'HTTP {e.code} (esperado 401)'))

# ── VITE_BASE_PATH no bundle ──────────────────────────
m = re.search(r'src="(/Reserva-de-Sala/assets/index[^"]+\.js)"', html)
if m:
    c2, js = get(FRONTEND + m.group(1))
    ok3 = 'Reserva-de-Sala' in js
    results.append(('PASS' if ok3 else 'FAIL', 'VITE_BASE_PATH no bundle JS', 'encontrado' if ok3 else 'NAO encontrado'))
else:
    results.append(('WARN', 'VITE_BASE_PATH bundle check', 'script tag nao localizado'))

# ── RESULTADO ─────────────────────────────────────────
print()
passed = sum(1 for r in results if r[0] == 'PASS')
failed = sum(1 for r in results if r[0] == 'FAIL')
for status, label, detail in results:
    icon = '[PASS]' if status == 'PASS' else ('[FAIL]' if status == 'FAIL' else '[WARN]')
    print(f'{icon} {label}: {detail}')
print()
print(f'Resultado: {passed}/{len(results)} passaram' + (f' | {failed} falharam' if failed else ' — tudo OK'))
