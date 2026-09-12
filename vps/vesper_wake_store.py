"""Durable wake queue. Separate SQLite file; never rewrites chat history."""
import json, os, sqlite3, time, uuid
from pathlib import Path

PATH = Path(os.environ.get('VESPER_WAKE_DB', str(Path.home()/'.vesper/wake.sqlite3')))
CONVERSATION = 'vesper-autonomous-wake'

class Connection(sqlite3.Connection):
    def __exit__(self,*args):
        try:return super().__exit__(*args)
        finally:self.close()


def db():
    PATH.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(PATH, timeout=15, factory=Connection)
    os.chmod(PATH, 0o600)
    con.row_factory = sqlite3.Row
    con.executescript('''CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY, source TEXT NOT NULL, due REAL NOT NULL, status TEXT NOT NULL,
      created REAL NOT NULL, started REAL, finished REAL, thread_id TEXT, turn_id TEXT,
      error TEXT, push_json TEXT, tools INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS runtime (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS calls (job_id TEXT, item_id TEXT, status TEXT NOT NULL,
        result TEXT, PRIMARY KEY(job_id,item_id));''')
    for table,fields in {'jobs':{'notification':'TEXT','conversation_id':'TEXT','user_message_id':'TEXT','user_turn_id':'TEXT','scheduled_at':'REAL','decision':'TEXT','tokens':'INTEGER DEFAULT 0','budget_tokens':'INTEGER'},'calls':{'name':'TEXT'}}.items():
        existing={row[1] for row in con.execute('PRAGMA table_info('+table+')')}
        for name,kind in fields.items():
            if name not in existing:con.execute('ALTER TABLE '+table+' ADD COLUMN '+name+' '+kind)
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

def configure(body):
    enabled = body.get('enabled')
    minutes = body.get('intervalMinutes')
    if not isinstance(enabled, bool) or (minutes is not None and
            (type(minutes) is not int or minutes < 30 or minutes > 1440)):
        raise ValueError('Choose an interval from 30 to 1440 minutes')
    now = time.time()
    with db() as con:
        con.execute('BEGIN IMMEDIATE')
        put(con, 'config', {'enabled': enabled, 'intervalMinutes': minutes})
        if not enabled:
            con.execute("UPDATE jobs SET status='cancelled',finished=?,decision='disabled' WHERE status='queued' AND source='automation'", (now,))
        if minutes is not None:
            put(con, 'next_at', now + minutes * 60)
            put(con, 'schedule', {'version': 2, 'drawnAt': now, 'seconds': minutes * 60, 'mode': 'fixed'})
        else:
            put(con, 'schedule', {})
            put(con, 'next_at', None)
    return status()


def status():
    with db() as con:
        fields = ['id','source','status','created','started','finished','tools','conversation_id','decision','tokens']
        rows = con.execute('SELECT * FROM jobs ORDER BY created DESC LIMIT 50').fetchall()
        jobs = [{k: row[k] for k in fields} for row in rows]
        for job in jobs:
            job['calls'] = [dict(row) for row in con.execute(
                'SELECT name,status FROM calls WHERE job_id=? ORDER BY rowid', (job['id'],))]
        config = get(con, 'config', {'enabled': get(con, 'frequency', 'daily') != 'off', 'intervalMinutes': None})
        return {'configVersion': 1, 'config': config, 'enabled': config['enabled'],
                'executor': 'vps', 'conversationId': jobs[0]['conversation_id'] if jobs else None,
                'heartbeat': get(con, 'heartbeat', 0), 'nextAt': get(con, 'next_at'),
                'schedule': get(con, 'schedule'), 'frequency': get(con, 'frequency'),
                'lastJob': jobs[0] if jobs else None, 'jobs': jobs, 'schedulerError': get(con, 'error')}
