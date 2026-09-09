import tempfile, unittest, sqlite3, json, time
from pathlib import Path
from unittest.mock import patch
import vesper_wake_store as store
import vesper_wake_runner as runner

class WakeTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
        self.old=store.PATH;store.PATH=Path(self.temp.name)/'wake.db';self.addCleanup(lambda:setattr(store,'PATH',self.old))
    def test_request_is_idempotent_and_joins_pending(self):
        self.assertEqual(store.request('one'),store.request('one'))
        self.assertEqual(store.request('one'),store.request('two'))
        with store.db() as con:self.assertEqual(con.execute('SELECT count(*) FROM jobs').fetchone()[0],1)
    def test_presence_expires(self):
        store.presence('phone',True)
        with patch.object(runner,'HISTORY',Path(self.temp.name)/'absent'):
            self.assertTrue(runner.front_busy(time.time()))
            self.assertFalse(runner.front_busy(time.time()+91))
    def test_full_runner_saves_before_push_and_deduplicates_tools(self):
        ident=store.request('verify',source='verification');messages={};calls=[];push=[]
        with store.db() as con:job=dict(con.execute('SELECT * FROM jobs').fetchone())
        class Rpc:
            def __init__(self):self.handler=None;self.queue=[]
            def send(self,m):pass
            def close(self):pass
            def call(self,name,args):
                if name=='account/read':return {'account':{'type':'chatgpt'}}
                if name=='thread/start':
                    assert args['approvalPolicy']=='never'
                    assert all(t['name'] in runner.READ_ONLY for t in args['dynamicTools'])
                    return {'thread':{'id':'thread'}}
                if name=='turn/start':
                    for n,tool in enumerate(['desire_status','read_vesper_state']):
                        message={'id':100+n,'method':'item/tool/call','params':{'name':tool,'itemId':str(n),'arguments':{}}}
                        self.queue.extend([message,message])
                    self.queue.extend([{'method':'item/completed','params':{'item':{'id':'answer','type':'agentMessage','text':'A real saved reply'}}},
                        {'method':'turn/completed','params':{'turn':{'status':'completed'}}}])
                    return {'turn':{'id':'turn'}}
                return {}
            def next(self,timeout):return self.queue.pop(0)
        def http(path,body=None,history=False):
            if path=='/api/codex/tools' and body is None:return {'tools':[{'name':n} for n in runner.ALLOWED]}
            if path=='/api/codex/tools':calls.append(body);return {'result':{'style':'quiet'}}
            if path.endswith('/messages'):messages[body['id']]=body;return {}
            if path=='/api/wake':
                assert any(m['role']=='agent' for m in messages.values())
                with store.db() as con:assert con.execute('SELECT status FROM jobs').fetchone()[0]=='saved'
                push.append(body);return {'status':'sent','delivered':1}
            return {}
        with patch.object(runner,'Rpc',Rpc),patch.object(runner,'http',http),patch.object(runner,'context',lambda:''):
            runner.execute(job)
        self.assertEqual(len(calls),2);self.assertEqual(len(push),1)
        self.assertEqual(store.status()['lastJob']['status'],'completed')
        self.assertEqual(sum(m['role']=='agent' for m in messages.values()),1)
    def test_off_does_not_auto_start_and_partial_turn_is_not_replayed(self):
        store.request('interrupted')
        runner.update('interrupted',status='running')
        with patch.object(runner,'http',lambda *a,**kw:{'value':{'careFrequency':'off'}}),patch.object(runner,'front_busy',lambda n:False),patch.object(runner,'execute') as execute:
            runner.tick()
            execute.assert_not_called()
        self.assertEqual(store.status()['lastJob']['status'],'interrupted')
    def test_busy_defers_manual_job(self):
        store.request('wait')
        with patch.object(runner,'http',lambda *a,**kw:{'value':{'careFrequency':'daily'}}),patch.object(runner,'front_busy',lambda n:True),patch.object(runner,'execute') as execute:
            runner.tick();execute.assert_not_called()
        self.assertEqual(store.status()['lastJob']['status'],'queued')
    def test_no_api_key_fallback(self):
        # Execution refuses an API-key account before starting any model turn.
        ident=store.request('no-api')
        with store.db() as con:job=dict(con.execute('SELECT * FROM jobs').fetchone())
        class Rpc:
            def call(self,m,p):return {'account':{'type':'apiKey'}} if m=='account/read' else {}
            def send(self,m):pass
            def close(self):pass
        def http(path,body=None,history=False):return {'tools':[{'name':'desire_status'},{'name':'read_vesper_state'}]}
        with patch.object(runner,'Rpc',Rpc),patch.object(runner,'http',http):
            with self.assertRaisesRegex(RuntimeError,'API-key fallback disabled'):runner.execute(job)

if __name__=='__main__':unittest.main()
