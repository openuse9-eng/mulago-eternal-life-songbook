/* MELGC Bible Search Assistant - offline smart scripture search */
(() => {
  const state = { en: null, lg: null, loaded: false, loading: null };
  const el = s => document.querySelector(s);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const verseText = v => typeof v === 'string' ? v : (v?.text ?? v?.verse ?? v?.content ?? v?.value ?? '');
  const verseNumber = (v,i) => typeof v === 'object' && v ? (v.verse ?? v.number ?? v.id ?? i+1) : i+1;
  const normal = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^\p{L}\p{N}: ]/gu,' ').replace(/\s+/g,' ').trim();
  function getVerses(data){
    const out=[];
    (data?.books||[]).forEach(book=>(book.chapters||[]).forEach(ch=>(ch.verses||[]).forEach((v,i)=>{
      const text=verseText(v); if(text) out.push({book:book.name,chapter:ch.chapter,verse:verseNumber(v,i),text});
    })));
    return out;
  }
  async function load(lang){
    if(state[lang]) return state[lang];
    const r=await fetch(lang==='en'?'bible-en.json':'bible-lg.json',{cache:'no-cache'});
    if(!r.ok) throw Error('Could not load the Bible.');
    const data=await r.json();
    if(!Array.isArray(data.books)) throw Error('Bible data is invalid.');
    state[lang]=getVerses(data); return state[lang];
  }
  async function loadBoth(){
    if(state.loaded) return;
    if(state.loading) return state.loading;
    state.loading=Promise.all([load('en'),load('lg')]).then(()=>{state.loaded=true;});
    return state.loading;
  }
  const conceptMap=[
    ['faith',['faith','believe','believed','believing','trust','confidence','faithful'],['okukkiriza','kkiriza','kwesiga','obwesigwa']],
    ['healing',['heal','healed','healing','health','sick','sickness'],['kuwona','kuwonya','obulamu','obulwadde','mulwadde']],
    ['love',['love','loved','loving','charity'],['kwagala','okwagala']],
    ['salvation',['save','saved','salvation','saviour','redeem','redemption'],['obulokozi','okulokoka','lokoka']],
    ['forgiveness',['forgive','forgiven','forgiveness','sin','sins'],['okusonyiwa','sonyiwa','ekibi','ebibi']],
    ['peace',['peace','rest','comfort'],['emirembe','mirembe','okuwummula']],
    ['strength',['strength','strong','courage','weak'],['amaanyi','ggumira','obuvumu']],
    ['prayer',['pray','prayer','praying','ask','petition'],['okusaba','saba']],
    ['protection',['protect','protection','refuge','shield','deliver'],['obukuumi','kuuma','kiddukiro','okununula']],
    ['hope',['hope','hopeful'],['essubi','suubi']]
  ];
  function expandTerms(q,lang){
    const n=normal(q), terms=new Set(n.split(' ').filter(x=>x.length>2));
    conceptMap.forEach(([_,en,lg])=>{
      if([...terms].some(t=>en.includes(t)||lg.includes(t))){
        (lang==='lg'?lg:en).forEach(x=>terms.add(normal(x)));
        if(lang==='both')[...en,...lg].forEach(x=>terms.add(normal(x)));
      }
    });
    return [...terms].filter(Boolean);
  }
  function score(item,q,lang){
    const text=normal(item.text), ref=normal(`${item.book} ${item.chapter}:${item.verse}`), query=normal(q);
    let s=0;
    if(ref.includes(query)) s+=100;
    query.split(' ').filter(x=>x.length>2).forEach(t=>{
      if(normal(item.book).includes(t)) s+=30;
      if(text.includes(t)) s+=8;
    });
    expandTerms(q,lang).forEach(t=>{if(t.length>2&&text.includes(t))s+=3;});
    return s;
  }
  function renderResults(results,lang){
    const box=el('#bibleAssistantResults'); if(!box)return;
    if(!results.length){box.innerHTML='<div class="bible-assistant-empty"><b>No matching scripture found.</b><br>Try <b>John 3:16</b>, or a topic such as <b>faith</b>, <b>healing</b>, <b>love</b> or <b>salvation</b>.</div>';return;}
    box.innerHTML=results.slice(0,20).map(r=>{
      const label=lang==='both'?`${r.lang==='en'?'English':'Luganda'} · `:'';
      return `<button class="bible-assistant-result" data-lang="${r.lang}" data-book="${esc(r.book)}" data-chapter="${r.chapter}" data-verse="${r.verse}"><b>${label}${esc(r.book)} ${r.chapter}:${r.verse}</b><span>${esc(r.text)}</span></button>`;
    }).join('');
    box.querySelectorAll('.bible-assistant-result').forEach(btn=>btn.addEventListener('click',()=>openResult(btn.dataset.lang,btn.dataset.book,btn.dataset.chapter,btn.dataset.verse)));
  }
  function openResult(lang,book,chapter,verse){
    const item=state[lang]?.find(x=>x.book===book&&String(x.chapter)===String(chapter)&&String(x.verse)===String(verse)); if(!item)return;
    const reader=el('#bibleReader'),title=el('#bibleReaderTitle'),body=el('#bibleReaderBody'); if(!reader||!body)return;
    if(title)title.textContent=`${book} ${chapter}`;
    body.innerHTML=`<div class="bible-verse"><sup>${verse}</sup><span>${esc(item.text)}</span></div>`;
    reader.classList.add('open'); reader.setAttribute('aria-hidden','false');
  }
  async function search(){
    const input=el('#bibleAssistantInput'),lang=el('#bibleAssistantLang')?.value||'both',query=input?.value.trim()||'',status=el('#bibleAssistantStatus');
    if(!query){if(status)status.textContent='Type a scripture, reference or topic.';return;}
    if(status)status.textContent='Searching the Bible…';
    try{
      await loadBoth();
      const pools=lang==='both'?[['en',state.en],['lg',state.lg]]:[[lang,state[lang]]],all=[];
      pools.forEach(([l,pool])=>pool.forEach(item=>{const s=score(item,query,lang);if(s>0)all.push({...item,lang:l,score:s});}));
      all.sort((a,b)=>b.score-a.score); renderResults(all,lang);
      if(status)status.textContent=`${all.length?Math.min(all.length,20):0} matching result${all.length===1?'':'s'}.`;
    }catch(e){console.error('[Bible Assistant]',e);if(status)status.textContent='Bible search could not be loaded. Open the Bible once with internet, then try again.';}
  }

  function injectStyles(){
    if(document.getElementById('bibleAssistantStyles')) return;
    const style=document.createElement('style');
    style.id='bibleAssistantStyles';
    style.textContent=`.bible-assistant{margin:16px 0;padding:15px;border:1px solid #4a4439;border-radius:18px;background:linear-gradient(145deg,#171614,#0e0e0d)}.bible-assistant-head{display:flex;gap:12px;align-items:center;margin-bottom:12px}.bible-assistant-head>span{font-size:30px}.bible-assistant-head b{font-size:18px}.bible-assistant-head p{margin:3px 0 0;color:#aaa;font-size:13px}.bible-assistant-controls{display:grid;grid-template-columns:145px 1fr 88px;gap:7px}.bible-assistant-controls select,.bible-assistant-controls input,.bible-assistant-controls button{min-width:0;border:1px solid #4a4439;border-radius:10px;padding:11px;background:#121211;color:#f4f1e8}.bible-assistant-controls button{font-weight:800}.bible-assistant-status{font-size:12px;color:#aaa;margin:9px 2px}.bible-assistant-result{display:flex;flex-direction:column;gap:5px;width:100%;margin:7px 0;padding:11px;border:1px solid #302e2a;border-radius:12px;background:#121211;color:inherit;text-align:left}.bible-assistant-result b{color:#e5c86b}.bible-assistant-result span{line-height:1.45}.bible-assistant-empty{padding:12px;border-radius:12px;background:#121211;color:#aaa;line-height:1.5}.light .bible-assistant{background:#fff;border-color:#ddd}.light .bible-assistant-controls select,.light .bible-assistant-controls input,.light .bible-assistant-controls button,.light .bible-assistant-result,.light .bible-assistant-empty{background:#fff;color:#222;border-color:#ddd}@media(max-width:480px){.bible-assistant-controls{grid-template-columns:1fr}.bible-assistant-controls button{width:100%}}`;
    document.head.appendChild(style);
  }
  function installUI(){
    injectStyles();
    const host=el('#bibleLanguages'); if(!host||el('#bibleAssistant'))return;
    const wrap=document.createElement('div'); wrap.id='bibleAssistant'; wrap.className='bible-assistant';
    wrap.innerHTML=`<div class="bible-assistant-head"><span>🤖</span><div><b>Ask Bible</b><p>Find a scripture in English, Luganda, or both.</p></div></div>
      <div class="bible-assistant-controls"><select id="bibleAssistantLang" aria-label="Bible language"><option value="both">English + Luganda</option><option value="en">English</option><option value="lg">Luganda</option></select><input id="bibleAssistantInput" placeholder="Ask: scriptures about faith…" autocomplete="off"><button id="bibleAssistantSearch">🔎 Search</button></div>
      <div id="bibleAssistantStatus" class="bible-assistant-status">Works with the Bible stored in the app.</div><div id="bibleAssistantResults"></div>`;
    host.insertBefore(wrap,host.querySelector('.bible-language-grid'));
    el('#bibleAssistantSearch').addEventListener('click',search);
    el('#bibleAssistantInput').addEventListener('keydown',e=>{if(e.key==='Enter')search();});
  }
  document.addEventListener('DOMContentLoaded',installUI); if(document.readyState!=='loading')installUI();
})();