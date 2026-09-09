"""Durable wake queue. Separate SQLite file; never rewrites chat history."""
import json, os, sqlite3, time, uuid
from pathlib import Path

PATH = Path(os.environ.get('VESPER_WAKE_DB', str(Path.home()/'.vesper/wake.sqlite3')))
CONVERSATION = 'vesper-autonomous-wake'

def db():
    PATH.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(PATH, timeout=15)
    os.chmod(PATH, 0o600)
    con.row_factory = sqlite3.Row
    con.executescript('''CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY, source TEXT NOT NULL, due REAL NOT NULL, status TEXT NOT NULL,
      created REAL NOT NULL, started REAL, finished REAL, thread_id TEXT, turn_id TEXT,
      error TEXT, push_json TEXT, tools INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS runtime (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS calls (job_id TEXT, item_id TEXT, status TEXT NOT NULL,
        result TEXT, PRIMARY KEY(job_id,item_id));''')
    if 'notification' not in {row[1] for row in con.execute('PRAGMA table_info(jobs)')}:
        con.execute('ALTER TABLE jobs ADD COLUMN notification TEXT')
    return con

def get(con, key, default=None):
    row = con.execute('SELECT value FROM runtime WHERE key=?',(key,)).fetchone()
    return json.loads(row[0]) if row else default

def put(con,key,value):
    con.execute('INSERT INTO runtime VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',(key,json.dumps(value)))

def request(request_id=None, source='manual', delay=0):
    now=time.time(); ident=request_id or str(uuid.uuid4())
    if not isinstance(ident,str) or len(ident)>128: raise ValueError('Invalid request ID')
    with db() as con:
        con.execute('BEGIN IMMEDIATE')
        old=con.execute('SELECT id FROM jobs WHERE id=?',(ident,)).fetchone()
        if old:return old[0]
        # Repeated taps/devices join the pending work, rather than spawning it twice.
        old=con.execute("SELECT id FROM jobs WHERE status IN ('queued','running') ORDER BY created LIMIT 1").fetchone()
        if old:return old[0]
        con.execute('INSERT INTO jobs(id,source,due,status,created) VALUES(?,?,?,?,?)',(ident,source,now+delay,'queued',now))
    return ident

def presence(device,busy):
    with db() as con:
        devices=get(con,'presence',{})
        devices={k:v for k,v in devices.items() if v['at']>time.time()-90}
        devices[str(device)[:100]]={'at':time.time(),'busy':bool(busy)}
        put(con,'presence',devices)

def status():
    with db() as con:
        row=con.execute('SELECT * FROM jobs ORDER BY created DESC LIMIT 1').fetchone()
        job=dict(row) if row else None
        # Never return model/tool content or credentials through runtime status.
        if job:job={k:job[k] for k in ['id','source','status','created','started','finished','tools','push_json','error']}
        return {'enabled':True,'executor':'vps','conversationId':CONVERSATION,
                'heartbeat':get(con,'heartbeat',0),'nextAt':get(con,'next_at'),
                'frequency':get(con,'frequency'),'lastJob':job,'schedulerError':get(con,'error')}
