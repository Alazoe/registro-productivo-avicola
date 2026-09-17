#!/usr/bin/env python3
"""
Validador estático de las apps (sin dependencias externas).
Uso:  python3 scripts/validar-apps.py            → valida las apps por defecto
      python3 scripts/validar-apps.py a.html b.html

Revisa por cada archivo:
  1. Sintaxis JS del último bloque <script> (node --check)
  2. <div> abiertos vs cerrados
  3. IDs duplicados
  4. Handlers inline (onclick="fn(") que apuntan a funciones no definidas
  5. getElementById('x') cuyo id="x" no existe en el HTML
  Los <script src> locales (p. ej. shared.js) se cargan para contar sus funciones
  y para comprobar la sintaxis de shared + app juntos (detecta let redeclarados).
Termina con código 1 si hay algún error (así falla el CI).
"""
import re, sys, subprocess, tempfile, os

APPS_DEFAULT = ['src/supabase/index.html', 'src/ventas/index.html', 'dashboard.html']
JS_KEYWORDS  = {'if','for','while','return','switch','try','function','else','do'}

def validar(path):
    errores = []
    try:
        html = open(path, encoding='utf-8').read()
    except FileNotFoundError:
        return [f'archivo no encontrado: {path}']

    # 0) Scripts locales compartidos: <script src="../shared.js?v=1"> (no http)
    compartido = ''
    for src in re.findall(r'<script[^>]*\bsrc="([^"]+)"', html):
        if src.startswith(('http://', 'https://', '//')): continue
        ruta = os.path.normpath(os.path.join(os.path.dirname(path), src.split('?')[0]))
        try:
            compartido += open(ruta, encoding='utf-8').read() + '\n'
        except FileNotFoundError:
            errores.append(f'script compartido no encontrado: {src}')

    # 1) Sintaxis JS: (a) el último <script> inline solo, (b) compartido + inline juntos
    #    (b) detecta variables `let/const` declaradas dos veces entre shared.js y la app.
    bloques = re.findall(r'<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>', html, re.S)
    if bloques:
        for etiqueta, codigo in (('sintaxis JS', bloques[-1]), ('sintaxis JS (shared + app)', compartido + bloques[-1])):
            if etiqueta.endswith('(shared + app)') and not compartido: continue
            with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False, encoding='utf-8') as t:
                t.write(codigo); tmp = t.name
            try:
                r = subprocess.run(['node', '--check', tmp], capture_output=True, text=True)
                if r.returncode != 0:
                    lineas = [l for l in r.stderr.splitlines() if 'Error' in l] or r.stderr.strip().splitlines()[-1:]
                    errores.append(etiqueta + ': ' + lineas[0].strip())
            finally:
                os.unlink(tmp)
    else:
        errores.append('no se encontró bloque <script> inline')

    # 2) <div> balanceados
    abre  = len(re.findall(r'<div\b', html))
    cierra= len(re.findall(r'</div>', html))
    if abre != cierra:
        errores.append(f'<div> desbalanceados: {abre} abren / {cierra} cierran')

    # 3) IDs duplicados
    ids = re.findall(r'\bid="([^"]+)"', html)
    dups = sorted({i for i in ids if ids.count(i) > 1})
    if dups:
        errores.append('IDs duplicados: ' + ', '.join(dups))

    # 4) Handlers inline sin función definida
    handlers = set(re.findall(r'\bon\w+="\s*(\w+)\(', html))
    definidas = set(re.findall(r'\bfunction\s+(\w+)\s*\(', html + compartido))
    definidas |= set(re.findall(r'\b(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|\w+)\s*=>', html))
    faltan = sorted(h for h in handlers if h not in definidas and h not in JS_KEYWORDS)
    if faltan:
        errores.append('handlers sin función: ' + ', '.join(faltan))

    # 5) getElementById de elementos inexistentes
    #    (cuenta también los ids asignados desde JS: elem.id = 'x')
    ids_js = set(re.findall(r"\.id\s*=\s*['\"]([\w-]+)['\"]", html))
    refs = set(re.findall(r"getElementById\(\s*'([\w-]+)'\s*\)", html))
    sin_el = sorted(r for r in refs if r not in set(ids) | ids_js)
    if sin_el:
        errores.append('getElementById sin elemento: ' + ', '.join(sin_el))

    return errores

def main():
    archivos = sys.argv[1:] or APPS_DEFAULT
    total = 0
    for a in archivos:
        errs = validar(a)
        if errs:
            total += len(errs)
            print(f'✗ {a}')
            for e in errs: print(f'    - {e}')
        else:
            print(f'✓ {a}')
    if total:
        print(f'\n{total} problema(s) encontrado(s).'); sys.exit(1)
    print('\nTodo OK.')

if __name__ == '__main__':
    main()
