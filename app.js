const state={lang:'en',hymns:{en:[],lg:[]},currentIndex:0,currentLang:'en',font:Number(localStorage.getItem('melgc-font')||19)};
const $=s=>document.querySelector(s),$$=s=>document.querySelectorAll(s);

function cleanText(s){
  return String(s||'')
    .replace(/\r/g,'')
    .replace(/[\u00a0\t]+/g,' ')
    .replace(/\}\s*/g,' ')
    .replace(/\s*\{/g,'')
    .replace(/\s{2,}/g,' ')
    .trim();
}

function esc(s){
  return String(s??'').replace(/[&<>"']/g,c=>({
    '&':'&amp;',
    '<':'&lt;',
    '>':'&gt;',
    '"':'&quot;',
    "'":'&#39;'
  }[c]));
}

/* =========================
   HYMN LYRIC FORMATTER
   ========================= */
function formatLyrics(lang,h){
  let raw=String(h.lyrics||'').replace(/\r/g,'').trim();

  if(!raw)return '';

  /*
    Remove the old source-book braces without
    destroying the actual hymn lines.
  */
  raw=raw
    .replace(/\}\s*/g,' ')
    .replace(/\s*\{/g,'')
    .replace(/[ \t]+/g,' ');

  let lines=raw.split('\n').map(x=>x.trim());

  while(lines.length && !lines[0])lines.shift();
  while(lines.length && !lines[lines.length-1])lines.pop();

  /*
    Remove Key information if it accidentally appears
    inside the lyrics.
  */
  const keyLine=/^(?:key|song\s*key|key\s*signature)\s*[:\-]?\s*[A-G](?:#|b)?(?:m|maj|min|major|minor|sus|dim|aug)?\s*$/i;

  lines=lines.filter(line=>!keyLine.test(line));

  /*
    Recognise hymn section headings.
  */
  const heading=/^(CHORUS|BRIDGE|REFRAIN|VERSE|VAMP|TAG|INTRO|CODA|PRE[- ]?CHORUS)\s*:?[.!]*$/i;

  const out=[];
  let current=[];

  function flush(){
    if(!current.length)return;

    const clean=current.map(x=>x.trim()).filter(Boolean);

    if(clean.length){
      out.push(
        `<div class="stanza">${clean.map(esc).join('<br>')}</div>`
      );
    }

    current=[];
  }

  for(const line of lines){

    if(!line){
      flush();
      continue;
    }

    const match=line.match(heading);

    if(match){
      flush();

      let name=match[1].toUpperCase();

      if(/^PRE[- ]?CHORUS$/i.test(match[1])){
        name='PRE-CHORUS';
      }

      out.push(
        `<div class="lyric-heading">${esc(name)}</div>`
      );

    }else{
      current.push(line);
    }
  }

  flush();

  return out.join('');
}

/* =========================
   LOAD HYMNS
   ========================= */
let deferredInstallPrompt=null;

async function load(){
  try{
    state.hymns.en=await fetch('hymns-en.json').then(r=>{
      if(!r.ok)throw new Error('Could not load hymns-en.json');
      return r.json();
    });

    state.hymns.lg=await fetch('hymns-lg.json').then(r=>{
      if(!r.ok)throw new Error('Could not load hymns-lg.json');
      return r.json();
    });

    renderList('en','');
    renderList('lg','');
    renderFavorites();
    renderSermons();

  }catch(e){
    console.error('Songbook load error:',e);
  }
}

/* =========================
   NAVIGATION
   ========================= */
function showScreen(id){
  $$('.screen').forEach(x=>
    x.classList.toggle('active',x.id===id)
  );

  $$('.bottom-nav button').forEach(b=>
    b.classList.toggle('nav-active',b.dataset.screen===id)
  );

  window.scrollTo(0,0);
}

$$('[data-screen]').forEach(b=>
  b.addEventListener('click',()=>showScreen(b.dataset.screen))
);

$$('.back').forEach(b=>
  b.addEventListener('click',()=>showScreen('home'))
);

/* =========================
   MENU / THEME
   ========================= */
const menuBtn=$('#menuBtn');

if(menuBtn){
  menuBtn.addEventListener('click',()=>showScreen('about'));
}

const themeBtn=$('#themeBtn');

if(themeBtn){
  themeBtn.addEventListener('click',()=>{
    document.body.classList.toggle('light');
  });
}

/* =========================
   INSTALL APP
   ========================= */
if(localStorage.getItem('melgc-install-dismissed')!=='1'){
  window.addEventListener('beforeinstallprompt',e=>{
    e.preventDefault();

    deferredInstallPrompt=e;

    const b=$('#installBanner');

    if(b)b.hidden=false;
  });
}

const ib=$('#installBtn');

if(ib){
  ib.addEventListener('click',async()=>{
    if(!deferredInstallPrompt)return;

    deferredInstallPrompt.prompt();

    await deferredInstallPrompt.userChoice;

    deferredInstallPrompt=null;

    const b=$('#installBanner');

    if(b)b.hidden=true;
  });
}

const db=$('#dismissInstall');

if(db){
  db.addEventListener('click',()=>{
    localStorage.setItem('melgc-install-dismissed','1');

    const b=$('#installBanner');

    if(b)b.hidden=true;
  });
}

window.addEventListener('appinstalled',()=>{
  const b=$('#installBanner');

  if(b)b.hidden=true;
});

/* =========================
   SHARE APP
   ========================= */
const sb=$('#shareApp');

if(sb){
  sb.addEventListener('click',async()=>{
    const data={
      title:'MELGC Songbook',
      text:'Mulago Eternal Life Gospel Church Songbook',
      url:location.href
    };

    try{
      if(navigator.share){
        await navigator.share(data);
      }else if(navigator.clipboard){
        await navigator.clipboard.writeText(location.href);
      }
    }catch(e){}
  });
}

/* =========================
   HYMN LIST
   ========================= */
function renderList(lang,q){
  const box=lang==='en'?$('#listEn'):$('#listLg');

  if(!box)return;

  const term=q.trim().toLowerCase();

  const arr=state.hymns[lang].filter(h=>
    !term ||
    String(h.number).includes(term) ||
    String(h.title||'').toLowerCase().includes(term)
  );

  box.innerHTML=arr.map(h=>{

    const first=String(h.lyrics||'')
      .split(/\n+/)
      .map(x=>x.trim())
      .find(x=>
        x &&
        !/^(?:key|song\s*key|key\s*signature)\s*[:\-]?/i.test(x)
      )||'';

    return `
      <button
        class="hymn-row ${lang==='en'?'english-row':''}"
        data-lang="${lang}"
        data-num="${h.number}"
      >
        <span class="num">${h.number}</span>

        <span class="row-main">
          <span class="row-title">${esc(h.title)}</span>

          ${
            lang==='en'
            ?`<span class="row-preview">${esc(first)}</span>`
            :''
          }
        </span>

        ${
          lang==='en'
          ?'<span class="row-fav">☆</span>'
          :`<span class="row-key">${esc(h.key||'')}</span>`
        }
      </button>
    `;

  }).join('')||'<div class="empty">No hymns found.</div>';

  box.querySelectorAll('.hymn-row').forEach(x=>
    x.addEventListener('click',()=>
      openHymn(lang,Number(x.dataset.num))
    )
  );
}

/* =========================
   OPEN HYMN
   ========================= */
function openHymn(lang,num){

  const arr=state.hymns[lang];

  const idx=arr.findIndex(h=>h.number===num);

  if(idx<0)return;

  state.currentLang=lang;
  state.currentIndex=idx;

  const h=arr[idx];

  const title=$('#readerTitle');
  const key=$('#readerKey');
  const body=$('#readerBody');
  const reader=$('#reader');

  if(title){
    title.textContent=h.title;
  }

  if(key){
    key.textContent=h.key?`Key: ${h.key}`:'';
  }

  if(body){
    body.innerHTML=
      formatLyrics(lang,h)||
      '<div class="stanza">Lyrics not available in the source book.</div>';
  }

  if(reader){
    reader.classList.add('open');
    reader.setAttribute('aria-hidden','false');
    reader.scrollTo(0,0);
  }

  updateFavButton();
}

/* =========================
   CLOSE READER
   ========================= */
const closeReader=$('#closeReader');

if(closeReader){
  closeReader.addEventListener('click',()=>{

    const reader=$('#reader');

    if(reader){
      reader.classList.remove('open');
      reader.setAttribute('aria-hidden','true');
    }

  });
}

/* =========================
   FAVOURITES
   ========================= */
function favKey(){

  const h=state.hymns[
    state.currentLang
  ][state.currentIndex];

  return `${state.currentLang}-${h.number}`;
}

function getFavs(){

  try{
    return JSON.parse(
      localStorage.getItem('melgc-favs')||'[]'
    );
  }catch{
    return[];
  }
}

function updateFavButton(){

  const btn=$('#favReader');

  if(btn){
    btn.textContent=
      getFavs().includes(favKey())?'★':'☆';
  }
}

const favReader=$('#favReader');

if(favReader){

  favReader.addEventListener('click',()=>{

    let f=getFavs();
    const k=favKey();

    f=f.includes(k)
      ?f.filter(x=>x!==k)
      :[...f,k];

    localStorage.setItem(
      'melgc-favs',
      JSON.stringify(f)
    );

    updateFavButton();
    renderFavorites();

  });
}

function renderFavorites(){

  const box=$('#favList');

  if(!box)return;

  const f=getFavs();
  const items=[];

  f.forEach(k=>{

    const parts=k.split('-');

    const lang=parts.shift();

    const n=Number(parts.join('-'));

    const h=state.hymns[lang]?.find(
      x=>x.number===n
    );

    if(h)items.push({lang,h});
  });

  box.innerHTML=items.length

    ?items.map(x=>`

      <button
        class="hymn-row"
        data-lang="${x.lang}"
        data-num="${x.h.number}"
      >
        <span class="num">${x.h.number}</span>

        <span class="row-title">
          ${esc(x.h.title)}
        </span>

        <span class="row-key">
          ${x.lang==='en'?'EN':'LG'}
        </span>
      </button>

    `).join('')

    :'<div class="empty">No favourites yet. Tap ☆ while reading a hymn.</div>';

  box.querySelectorAll('.hymn-row').forEach(x=>
    x.addEventListener('click',()=>
      openHymn(
        x.dataset.lang,
        Number(x.dataset.num)
      )
    )
  );
}

/* =========================
   PREVIOUS / NEXT HYMN
   ========================= */
const prevHymn=$('#prevHymn');

if(prevHymn){
  prevHymn.addEventListener('click',()=>move(-1));
}

const nextHymn=$('#nextHymn');

if(nextHymn){
  nextHymn.addEventListener('click',()=>move(1));
}

function move(d){

  const arr=state.hymns[state.currentLang];

  if(!arr.length)return;

  state.currentIndex=
    (state.currentIndex+d+arr.length)%arr.length;

  const h=arr[state.currentIndex];

  const title=$('#readerTitle');
  const key=$('#readerKey');
  const body=$('#readerBody');
  const reader=$('#reader');

  if(title){
    title.textContent=h.title;
  }

  if(key){
    key.textContent=h.key?`Key: ${h.key}`:'';
  }

  if(body){
    body.innerHTML=
      formatLyrics(state.currentLang,h)||
      '<div class="stanza">Lyrics not available in the source book.</div>';
  }

  updateFavButton();

  if(reader){
    reader.scrollTo(0,0);
  }
}

/* =========================
   SERMONS
   ========================= */
function renderSermons(){

  const box=$('#sermonList');

  if(!box)return;

  const videos=[
    's1wsCuB_g_U',
    'YsV4oHcb8ds',
    'HXTHGLnlOD0',
    '4UjLbqemQb4',
    'KD9EkPTT0LI',
    'qTYQzZQoNrM',
    'HGpGR3A3izo',
    'aQV0yfnPR8o',
    'jSpPtPN-liQ',
    'XsRw9Xpov5g'
  ];

  box.innerHTML=videos
    .slice()
    .reverse()
    .map((id,i)=>`

      <div class="sermon">

        <div class="sermon-label">
          Sunday Service ${i+1}
        </div>

        <div class="sermon-player">

          <iframe
            src="https://www.youtube.com/embed/${id}"
            title="MELGC Sunday Service ${i+1}"
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowfullscreen>
          </iframe>

        </div>

      </div>

    `).join('');
}

/* =========================
   SEARCH
   ========================= */
const searchEn=$('#searchEn');

if(searchEn){
  searchEn.addEventListener(
    'input',
    e=>renderList('en',e.target.value)
  );
}

const searchLg=$('#searchLg');

if(searchLg){
  searchLg.addEventListener(
    'input',
    e=>renderList('lg',e.target.value)
  );
}

/* =========================
   FONT SIZE
   ========================= */
function applyFont(){

  const body=$('#readerBody');

  if(body){
    body.style.fontSize=state.font+'px';
  }

  localStorage.setItem(
    'melgc-font',
    String(state.font)
  );
}

const smaller=$('#smaller');

if(smaller){
  smaller.addEventListener('click',()=>{

    state.font=Math.max(
      14,
      state.font-2
    );

    applyFont();
  });
}

const larger=$('#larger');

if(larger){
  larger.addEventListener('click',()=>{

    state.font=Math.min(
      34,
      state.font+2
    );

    applyFont();
  });
}

const resetFont=$('#resetFont');

if(resetFont){
  resetFont.addEventListener('click',()=>{

    state.font=19;

    applyFont();
  });
}

/* =========================
   START APP
   ========================= */
load().then(()=>applyFont());

/* =========================
   SERVICE WORKER
   ========================= */
if('serviceWorker' in navigator){

  window.addEventListener(
    'load',
    ()=>navigator.serviceWorker.register('sw.js')
  );
                                                     }
