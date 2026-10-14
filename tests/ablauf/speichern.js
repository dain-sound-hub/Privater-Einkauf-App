(async () => {
const R = {};
const iso = d => new Date(Date.now() - d*864e5).toISOString().slice(0,10);
const mkItem = (n, p) => ({ kind:'item', include:true, name:n, qty:1, price:p, pid:'butter' });
// A1 neu: save scheitert
{
  S = sanitize({}); const m = { id:'q1', status:'gelesen', text:'ROHTEXT', created:Date.now() }; BQ.list.push(m);
  const orig = localStorage.setItem; localStorage.setItem = () => { throw new Error('QuotaExceeded'); };
  const res = bonCommit({ total:1.99, items:[] }, [mkItem('BUTTER',1.99)], 'netto', iso(1), 'q1', { recId: 'b_q1' });
  const ok = await bonFinish(res, 'q1'); localStorage.setItem = orig;
  R.A1fail = { ok, queueStatus: m.status, queueText: m.text, bonInMemory: S.bons.length, hold: m.hold };
  // Wiederholung klappt
  const res2 = bonCommit({ total:1.99, items:[] }, [mkItem('BUTTER',1.99)], 'netto', iso(1), 'q1', { recId: 'b_q1' });
  const ok2 = await bonFinish(res2, 'q1');
  R.A1retry = { ok: ok2, queueStatus: m.status, bons: S.bons.length, gleicheId: S.bons[0].id };
  BQ.list = BQ.list.filter(x => x !== m); SAVE_FAILED = false;
}
// A2: Archiv bekommt den Bon vor dem Kürzen
{
  const bons = []; for (let i=0;i<60;i++) bons.push({ id:'b'+i, date: iso(i % 20), store:'netto', total:1, items:[{n:'X',q:1,p:1}] });
  S = sanitize({ bons }); const put = []; const o = arcPut; arcPut = l => { put.push(l.map(b=>b.id)); return true; };
  const res = bonCommit({ total:2, items:[] }, [mkItem('BUTTER',2)], 'netto', iso(30), null, {});
  R.A2 = { imArchivAufgerufen: put.some(l => l.includes(res.rec.id)), inArbeitsmenge: S.bons.some(b=>b.id===res.rec.id), anzahl: S.bons.length };
  arcPut = o;
}
// A3: 121 Positionen: Rec im Archiv-Aufruf vollständig
{
  S = sanitize({}); const items = []; for (let i=0;i<121;i++) items.push(mkItem('ART'+i, 1)); let got = null; const o = arcPut; arcPut = l => { got = l[0].items.length; return true; };
  bonCommit({ total:121, items:[] }, items, 'netto', iso(1), null, {}); R.A3 = { anArchivUebergeben: got }; arcPut = o;
}
return R;
})()
