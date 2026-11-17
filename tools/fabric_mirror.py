"""Five Launcher's own copy of Fabric (Nov 17 2026, Omar: "make our website do the fabric job").

Some players can't reach fabricmc.net (on Cloudflare) because of a DNS, ISP or antivirus block. GitHub Pages runs on a
different network, so this script copies what the launcher needs from Fabric's own servers into fabric/ on this site:

  fabric/index.json                      what was copied and when
  fabric/v2/loader/<mc>.json             Fabric's loader list for <mc> (same format as meta.fabricmc.net), trimmed
  fabric/v2/loader/<mc>/<loader>.json    the launch profile, every library given its sha1 and size
  fabric/maven/<maven path>(.sha1)       the jars, laid out like Fabric's maven, each with its .sha1

Every jar is checked against the .sha1 Fabric's maven publishes next to it before it is kept. Only stable Minecraft
releases with intermediary and the newest LOADERS loader versions are copied, to keep the site small. Files already here
with the right sha1 are not downloaded again; files no longer needed are removed. Standard library only.

Usage: python tools/fabric_mirror.py [site root]   (default: the folder above tools/)
"""
import hashlib, json, os, sys, time, urllib.request

META = 'https://meta.fabricmc.net/v2'
MAVEN = 'https://maven.fabricmc.net/'
LOADERS = 3
UA = {'User-Agent': 'FiveLauncher-fabric-mirror (+https://fivelauncher.github.io)'}


def get(url, tries=4):
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
                return r.read()
        except Exception:
            if i == tries - 1:
                raise
            time.sleep(2 * (i + 1))


def get_json(url):
    return json.loads(get(url))


def maven_path(name):
    """group:artifact:version[:classifier] -> group/path/artifact/version/artifact-version[-classifier].jar"""
    parts = name.split(':')
    group, art, ver = parts[0], parts[1], parts[2]
    cls = '-' + parts[3] if len(parts) > 3 else ''
    return f"{group.replace('.', '/')}/{art}/{ver}/{art}-{ver}{cls}.jar"


def sha1(data):
    return hashlib.sha1(data).hexdigest()


def write(path, data, keep):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if isinstance(data, str):
        data = data.encode()
    old = open(path, 'rb').read() if os.path.exists(path) else None
    if old != data:
        open(path, 'wb').write(data)
    keep.add(os.path.normpath(path))


def main():
    root = sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    out = os.path.join(root, 'fabric')
    keep = set()
    jars = {}  # maven path -> (sha1, size)

    def mirror_jar(name, base):
        p = maven_path(name)
        if p in jars:
            return jars[p]
        want = get((base or MAVEN) + p + '.sha1').decode().split()[0].strip().lower()
        dest = os.path.join(out, 'maven', *p.split('/'))
        data = open(dest, 'rb').read() if os.path.exists(dest) else None
        if data is None or sha1(data) != want:
            data = get((base or MAVEN) + p)
            if sha1(data) != want:
                raise SystemExit(f'sha1 mismatch for {p}: Fabric says {want}, got {sha1(data)}')
        write(dest, data, keep)
        write(dest + '.sha1', want, keep)
        jars[p] = (want, len(data))
        return jars[p]

    inter = {i['version'] for i in get_json(f'{META}/versions/intermediary')}
    games = [g['version'] for g in get_json(f'{META}/versions/game') if g['stable'] and g['version'] in inter]
    loaders = [l['version'] for l in get_json(f'{META}/versions/loader')][:LOADERS]

    for mc in games:
        lst = [e for e in get_json(f'{META}/versions/loader/{mc}') if e['loader']['version'] in loaders]
        if not lst:
            continue
        write(os.path.join(out, 'v2', 'loader', f'{mc}.json'), json.dumps(lst, separators=(',', ':')), keep)
        for e in lst:
            v = e['loader']['version']
            prof = get_json(f'{META}/versions/loader/{mc}/{v}/profile/json')
            for lib in prof.get('libraries', []):
                s, n = mirror_jar(lib['name'], lib.get('url'))
                if lib.get('sha1') and lib['sha1'].lower() != s:
                    raise SystemExit(f"{lib['name']}: profile sha1 {lib['sha1']} differs from maven {s}")
                lib['sha1'], lib['size'] = s, n
            write(os.path.join(out, 'v2', 'loader', mc, f'{v}.json'), json.dumps(prof, separators=(',', ':')), keep)
        print(mc, len(lst), 'loaders', flush=True)

    index = {'generated': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'source': 'meta.fabricmc.net + maven.fabricmc.net',
             'loaders': loaders, 'games': games, 'files': len(jars)}
    # index.json changes only when the content does (no daily commit for a new timestamp alone)
    ip = os.path.join(out, 'index.json')
    if os.path.exists(ip):
        old = json.load(open(ip))
        if {k: v for k, v in old.items() if k != 'generated'} == {k: v for k, v in index.items() if k != 'generated'}:
            index['generated'] = old['generated']
    write(ip, json.dumps(index, indent=1), keep)

    removed = 0
    for d, _, fs in os.walk(out, topdown=False):
        for f in fs:
            p = os.path.normpath(os.path.join(d, f))
            if p not in keep:
                os.remove(p); removed += 1
        if not os.listdir(d):
            os.rmdir(d)
    total = sum(os.path.getsize(p) for p in keep)
    print(f'done: {len(games)} Minecraft versions, loaders {loaders}, {len(jars)} jars, {total / 1e6:.1f} MB, removed {removed} old files')


if __name__ == '__main__':
    main()
