const state={lang:'en',hymns:{en:[],lg:[]},currentIndex:0,currentLang:'en',font:Number(localStorage.getItem('melgc-font')||19)};
const $=s=>document.querySelector(s),$$=s=>document.querySelectorAll(s);
function cleanText(s){return String(s||'').replace(/\r/g,'').replace(/[\u00a0\t]+/g,' ').replace(/\}\s*/g,' ').replace(/\s*\{/g,'').replace(/\s{2,}/g,' ').trim()}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function formatLyrics(lang,h){
  let raw=String(h.lyrics||'').replace(/\r/g,'').trim();
  if(!raw)return '';
  raw=raw.replace(/\}\s*/g,' ').replace(/\s*\{/g,'').replace(/[ \t]+/g,' ');
  const chunks=raw.split(/\n[ \t]*\n+/).map(x=>x.trim()).filter(Boolean);
  const out=[];
  for(const chunk of chunks){
    const lines=chunk.split(/\n+/).map(x=>x.trim()).filter(Boolean);
    if(lines.length===1 && /^(CHORUS|BRIDGE|REFRAIN|VERSE|VAMP)\s*:?[.!]*$/i.test(lines[0])){
      out.push(`<div class="lyric-heading"><strong>${esc(lines[0].replace(/[:.!]+$/,'').toUpperCase())}</strong></div>`);continue;
    }
    if(lang==='en' && h.number<=479){
      // The original hymn book has true paragraph boundaries. Keep them, but never create artificial gaps between every line.
      out.push(`<div class="stanza">${lines.map(esc).join('<br>')}</div>`);continue;
    }
    // For the later English and Luganda books, blank lines are the paragraph boundaries.
    out.push(`<div class="stanza">${lines.map(esc).join('<br>')}</div>`);
  }
  return out.join('');
}
let deferredInstallPrompt=null;
async function load(){
 state.hymns.en=await fetch('hymns-en.json').then(r=>r.json());
 state.hymns.lg=await fetch('hymns-lg.json').then(r=>r.json());
 renderList('en','');renderList('lg','');renderFavorites();renderSermons();
}
function showScreen(id){$$('.screen').forEach(x=>x.classList.toggle('active',x.id===id));$$('.bottom-nav button').forEach(b=>b.classList.toggle('nav-active',b.dataset.screen===id));window.scrollTo(0,0)}
$$('[data-screen]').forEach(b=>b.addEventListener('click',()=>showScreen(b.dataset.screen)));
$$('.back').forEach(b=>b.addEventListener('click',()=>showScreen('home')));
$('#menuBtn').addEventListener('click',()=>showScreen('about'));
$('#themeBtn').addEventListener('click',()=>document.body.classList.toggle('light'));
if(localStorage.getItem('melgc-install-dismissed')!=='1')window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstallPrompt=e;const b=$('#installBanner');if(b)b.hidden=false});
const ib=$('#installBtn');if(ib)ib.addEventListener('click',async()=>{if(!deferredInstallPrompt)return;deferredInstallPrompt.prompt();await deferredInstallPrompt.userChoice;deferredInstallPrompt=null;const b=$('#installBanner');if(b)b.hidden=true});
const db=$('#dismissInstall');if(db)db.addEventListener('click',()=>{localStorage.setItem('melgc-install-dismissed','1');const b=$('#installBanner');if(b)b.hidden=true});
window.addEventListener('appinstalled',()=>{const b=$('#installBanner');if(b)b.hidden=true});
const sb=$('#shareApp');if(sb)sb.addEventListener('click',async()=>{const data={title:'MELGC Songbook',text:'Mulago Eternal Life Gospel Church Songbook',url:location.href};try{if(navigator.share)await navigator.share(data);else if(navigator.clipboard)await navigator.clipboard.writeText(location.href)}catch(e){}});
function renderList(lang,q){const box=lang==='en'?$('#listEn'):$('#listLg');const term=q.trim().toLowerCase();const arr=state.hymns[lang].filter(h=>!term||String(h.number).includes(term)||String(h.title||'').toLowerCase().includes(term));box.innerHTML=arr.map(h=>`<button class="hymn-row" data-lang="${lang}" data-num="${h.number}"><span class="num">${h.number}</span><span class="row-title">${esc(h.title)}</span><span class="row-key">${esc(h.key||'')}</span></button>`).join('')||'<div class="empty">No hymns found.</div>';box.querySelectorAll('.hymn-row').forEach(x=>x.addEventListener('click',()=>openHymn(lang,Number(x.dataset.num))))}
function openHymn(lang,num){const arr=state.hymns[lang],idx=arr.findIndex(h=>h.number===num);if(idx<0)return;state.currentLang=lang;state.currentIndex=idx;const h=arr[idx];$('#readerTitle').textContent=`${h.number}. ${h.title}`;$('#readerKey').textContent=h.key?`Key: ${h.key}`:'';$('#readerBody').innerHTML=formatLyrics(lang,h)||'<div class="stanza">Lyrics not available in the source book.</div>';$('#reader').classList.add('open');$('#reader').setAttribute('aria-hidden','false');updateFavButton();$('#reader').scrollTo(0,0)}
$('#closeReader').addEventListener('click',()=>{$('#reader').classList.remove('open');$('#reader').setAttribute('aria-hidden','true')});
function favKey(){return `${state.currentLang}-${state.hymns[state.currentLang][state.currentIndex].number}`}
function getFavs(){try{return JSON.parse(localStorage.getItem('melgc-favs')||'[]')}catch{return[]}}
function updateFavButton(){const on=getFavs().includes(favKey());$('#favReader').textContent=on?'★':'☆'}
$('#favReader').addEventListener('click',()=>{let f=getFavs(),k=favKey();f=f.includes(k)?f.filter(x=>x!==k):[...f,k];localStorage.setItem('melgc-favs',JSON.stringify(f));updateFavButton();renderFavorites()});
function renderFavorites(){const box=$('#favList'),f=getFavs(),items=[];f.forEach(k=>{const [lang,n]=k.split('-');const h=state.hymns[lang]?.find(x=>x.number===Number(n));if(h)items.push({lang,h})});box.innerHTML=items.length?items.map(x=>`<button class="hymn-row" data-lang="${x.lang}" data-num="${x.h.number}"><span class="num">${x.h.number}</span><span class="row-title">${esc(x.h.title)}</span><span class="row-key">${x.lang==='en'?'EN':'LG'}</span></button>`).join(''):'<div class="empty">No favourites yet. Tap ☆ while reading a hymn.</div>';box.querySelectorAll('.hymn-row').forEach(x=>x.addEventListener('click',()=>openHymn(x.dataset.lang,Number(x.dataset.num))))}
$('#prevHymn').addEventListener('click',()=>move(-1));$('#nextHymn').addEventListener('click',()=>move(1));
function move(d){const arr=state.hymns[state.currentLang];state.currentIndex=(state.currentIndex+d+arr.length)%arr.length;const h=arr[state.currentIndex];$('#readerTitle').textContent=`${h.number}. ${h.title}`;$('#readerKey').textContent=h.key?`Key: ${h.key}`:'';$('#readerBody').innerHTML=formatLyrics(state.currentLang,h)||'<div class="stanza">Lyrics not available in the source book.</div>';updateFavButton();$('#reader').scrollTo(0,0)}
function renderSermons(){const videos=['s1wsCuB_g_U','YsV4oHcb8ds','HXTHGLnlOD0','4UjLbqemQb4','KD9EkPTT0LI','qTYQzZQoNrM','HGpGR3A3izo','aQV0yfnPR8o'];$('#sermonList').innerHTML=videos.map((id,i)=>`<div class="sermon"><div class="sermon-label">Sunday Service ${i+1}</div><div class="sermon-player"><iframe src="https://www.youtube.com/embed/${id}" title="MELGC Sunday Service ${i+1}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div></div>`).join('')}
$('#searchEn').addEventListener('input',e=>renderList('en',e.target.value));$('#searchLg').addEventListener('input',e=>renderList('lg',e.target.value));
function applyFont(){$('#readerBody').style.fontSize=state.font+'px';localStorage.setItem('melgc-font',String(state.font))}
$('#smaller').addEventListener('click',()=>{state.font=Math.max(14,state.font-2);applyFont()});$('#larger').addEventListener('click',()=>{state.font=Math.min(34,state.font+2);applyFont()});$('#resetFont').addEventListener('click',()=>{state.font=19;applyFont()});
load().then(()=>applyFont());
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js'));
