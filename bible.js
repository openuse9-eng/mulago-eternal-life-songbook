const bibleState={
  data:{en:null,lg:null},
  lang:null,
  bookIndex:0,
  chapterIndex:0,
  search:'',
  mode:'languages'
};
const bible$=s=>document.querySelector(s);
const bibleEsc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function bibleSafeText(s){return bibleEsc(s).replace(/&lt;(\/?)em&gt;/gi,'<$1em>').replace(/&lt;(\/?)i&gt;/gi,'<$1i>');}
async function loadBibleData(lang){
  if(bibleState.data[lang])return bibleState.data[lang];
  const file=lang==='en'?'bible-en.json':'bible-lg.json';
  const data=await fetch(file).then(r=>{if(!r.ok)throw new Error('Bible file not found');return r.json()});
  bibleState.data[lang]=data;
  return data;
}
function bibleShow(id){
  document.querySelectorAll('.bible-view').forEach(x=>x.classList.toggle('active',x.id===id));
}
function bibleHome(){
  bibleState.mode='languages';bibleState.lang=null;bibleShow('bibleLanguages');
  const s=bible$('bibleSearch');if(s)s.value='';
}
function bibleLanguage(lang){
  bibleState.lang=lang;bibleState.mode='books';bibleState.search='';
  const d=bibleState.data[lang];
  const name=lang==='en'?'English Bible':'Luganda Bible';
  bible$('bibleBooksTitle').textContent=name;
  bible$('bibleBooksSub').textContent=lang==='en'?(d.translation||'NKJV'):'Luganda Bible';
  bibleShow('bibleBooks');
  bibleRenderBooks();
}
function bibleRenderBooks(){
  const d=bibleState.data[bibleState.lang];if(!d)return;
  const q=bibleState.search.trim().toLowerCase();
  const box=bible$('bibleBookList');
  const groups=[['Old Testament',d.books.slice(0,39)],['New Testament',d.books.slice(39)]];
  box.innerHTML=groups.map(([label,books])=>{
    const filtered=books.map((b,i)=>({b,i:i+(label==='New Testament'?39:0)})).filter(x=>!q||x.b.name.toLowerCase().includes(q));
    if(!filtered.length)return '';
    return `<div class="bible-testament"><h3>${label}</h3>${filtered.map(x=>`<button class="bible-book-row" data-index="${x.i}"><span class="bible-book-icon">📖</span><span><b>${bibleEsc(x.b.name)}</b><small>${x.b.chapters.length} chapters</small></span><span>›</span></button>`).join('')}</div>`;
  }).join('')||'<div class="empty">No Bible books found.</div>';
  box.querySelectorAll('.bible-book-row').forEach(b=>b.addEventListener('click',()=>bibleOpenBook(Number(b.dataset.index))));
}
function bibleOpenBook(index){
  bibleState.bookIndex=index;bibleState.mode='chapters';
  const d=bibleState.data[bibleState.lang],b=d.books[index];
  bible$('bibleChaptersTitle').textContent=b.name;
  bible$('bibleChaptersSub').textContent=`${b.chapters.length} chapters`;
  const box=bible$('bibleChapterList');
  box.innerHTML=b.chapters.map((c,i)=>`<button class="bible-chapter" data-index="${i}">${c.chapter}</button>`).join('');
  bibleShow('bibleChapters');
  box.querySelectorAll('.bible-chapter').forEach(x=>x.addEventListener('click',()=>bibleOpenChapter(Number(x.dataset.index))));
}
function bibleOpenChapter(index){
  bibleState.chapterIndex=index;bibleState.mode='reader';
  const d=bibleState.data[bibleState.lang],b=d.books[bibleState.bookIndex],c=b.chapters[index];
  bible$('bibleReaderTitle').textContent=`${b.name} ${c.chapter}`;
  bible$('bibleReaderBody').innerHTML=c.verses.map(v=>`<div class="bible-verse"><sup>${v.verse}</sup><span>${bibleSafeText(v.text)}</span></div>`).join('');
  bible$('bibleReader').classList.add('open');bible$('bibleReader').setAttribute('aria-hidden','false');
  bible$('bibleReader').scrollTo(0,0);
}
function bibleMove(delta){
  const b=bibleState.data[bibleState.lang].books[bibleState.bookIndex];
  const next=bibleState.chapterIndex+delta;
  if(next>=0&&next<b.chapters.length){bibleOpenChapter(next);return;}
  const books=bibleState.data[bibleState.lang].books;
  const bi=bibleState.bookIndex+delta;
  if(bi>=0&&bi<books.length){bibleState.bookIndex=bi;bibleOpenChapter(delta>0?0:books[bi].chapters.length-1);}
}
function bibleCloseReader(){bible$('bibleReader').classList.remove('open');bible$('bibleReader').setAttribute('aria-hidden','true')}
function bibleSearch(){
  const q=bibleState.search.trim().toLowerCase();
  if(!q){bibleRenderBooks();return;}
  const d=bibleState.data[bibleState.lang];
  const hits=[];
  d.books.forEach((b,bi)=>b.chapters.forEach((c,ci)=>c.verses.forEach(v=>{if(String(v.text||'').toLowerCase().includes(q))hits.push({b,bi,c,ci,v})})));
  const box=bible$('bibleBookList');
  const bookHits=d.books.map((b,i)=>({b,i})).filter(x=>x.b.name.toLowerCase().includes(q));
  let html=bookHits.length?`<div class="bible-testament"><h3>Books</h3>${bookHits.map(x=>`<button class="bible-book-row" data-index="${x.i}"><span class="bible-book-icon">📖</span><span><b>${bibleEsc(x.b.name)}</b><small>${x.b.chapters.length} chapters</small></span><span>›</span></button>`).join('')}</div>`:'';
  if(hits.length){html+=`<div class="bible-testament"><h3>Verse results (${hits.length})</h3>${hits.slice(0,100).map(h=>`<button class="bible-search-result" data-bi="${h.bi}" data-ci="${h.ci}"><b>${bibleEsc(h.b.name)} ${h.c.chapter}:${h.v.verse}</b><span>${bibleSafeText(h.v.text)}</span></button>`).join('')}</div>`}
  box.innerHTML=html||'<div class="empty">No Bible results found.</div>';
  box.querySelectorAll('.bible-book-row').forEach(x=>x.addEventListener('click',()=>bibleOpenBook(Number(x.dataset.index))));
  box.querySelectorAll('.bible-search-result').forEach(x=>x.addEventListener('click',()=>{bibleState.bookIndex=Number(x.dataset.bi);bibleOpenChapter(Number(x.dataset.ci))}));
}
(async function initBible(){
  const card=bible$('.home-card[data-screen="bible"]');
  if(card)card.addEventListener('click',async()=>{bibleShow('bibleLanguages');});
  const back=bible$('#bibleBack');if(back)back.addEventListener('click',()=>{showScreen('home');bibleHome()});
  const en=bible$('#bibleEnglish');if(en)en.addEventListener('click',async()=>{try{await loadBibleData('en');bibleLanguage('en')}catch(e){alert('English Bible could not be loaded. Please make sure bible-en.json is installed.')}});
  const lg=bible$('#bibleLuganda');if(lg)lg.addEventListener('click',async()=>{try{await loadBibleData('lg');bibleLanguage('lg')}catch(e){alert('Luganda Bible could not be loaded. Please make sure bible-lg.json is installed.')}});
  const booksBack=bible$('#bibleBooksBack');if(booksBack)booksBack.addEventListener('click',bibleHome);
  const chaptersBack=bible$('#bibleChaptersBack');if(chaptersBack)chaptersBack.addEventListener('click',()=>{bibleState.mode='books';bibleShow('bibleBooks')});
  const search=bible$('#bibleSearch');if(search)search.addEventListener('input',e=>{bibleState.search=e.target.value;bibleSearch()});
  const close=bible$('#closeBibleReader');if(close)close.addEventListener('click',bibleCloseReader);
  const prev=bible$('#prevBibleChapter');if(prev)prev.addEventListener('click',()=>bibleMove(-1));
  const next=bible$('#nextBibleChapter');if(next)next.addEventListener('click',()=>bibleMove(1));
  try{await Promise.all([loadBibleData('en'),loadBibleData('lg')]);
    const e=bible$('#bibleEnglishCount');if(e)e.textContent='English · NKJV';
    const l=bible$('#bibleLugandaCount');if(l)l.textContent='Luganda Bible';
  }catch(e){/* Data files may be added after the code; language buttons retry loading. */}
})();
