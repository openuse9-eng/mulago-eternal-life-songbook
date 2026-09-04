const state={lang:'en',hymns:{en:[],lg:[]},currentIndex:0,currentLang:'en',font:19};
const $=s=>document.querySelector(s), $$=s=>document.querySelectorAll(s);
async function load(){
  state.hymns.en=await fetch('hymns-en.json').then(r=>r.json());
  state.hymns.lg=await fetch('hymns-lg.json').then(r=>r.json());
  renderList('en',''); renderList('lg',''); renderFavorites(); renderSermons();
}
function showScreen(id){$$('.screen').forEach(x=>x.classList.toggle('active',x.id===id)); $$('.bottom-nav button').forEach(b=>b.classList.toggle('nav-active',b.dataset.screen===id)); window.scrollTo(0,0)}
$$('[data-screen]').forEach(b=>b.addEventListener('click',()=>showScreen(b.dataset.screen)));
$$('.back').forEach(b=>b.addEventListener('click',()=>showScreen('home')));
$('#menuBtn').addEventListener('click',()=>showScreen('about'));
$('#themeBtn').addEventListener('click',()=>document.body.classList.toggle('light'));
function renderList(lang,q){const box=lang==='en'?$('#listEn'):$('#listLg'); const term=q.trim().toLowerCase(); const arr=state.hymns[lang].filter(h=>!term||String(h.number).includes(term)||h.title.toLowerCase().includes(term)); box.innerHTML=arr.map(h=>`<button class="hymn-row" data-lang="${lang}" data-num="${h.number}"><span class="num">${h.number}</span><span class="row-title">${esc(h.title)}</span><span class="row-key">${esc(h.key||'')}</span></button>`).join('')||'<div class="empty">No hymns found.</div>'; box.querySelectorAll('.hymn-row').forEach(x=>x.addEventListener('click',()=>openHymn(lang,Number(x.dataset.num))));}
function openHymn(lang,num){const arr=state.hymns[lang], idx=arr.findIndex(h=>h.number===num); if(idx<0)return; state.currentLang=lang;state.currentIndex=idx; const h=arr[idx]; $('#readerTitle').textContent=`${h.number}. ${h.title}`;$('#readerKey').textContent=h.key?`Key: ${h.key}`:'';$('#readerBody').textContent=h.lyrics||'Lyrics not available in the source book.';$('#reader').classList.add('open');$('#reader').setAttribute('aria-hidden','false');updateFavButton();}
$('#closeReader').addEventListener('click',()=>{$('#reader').classList.remove('open');$('#reader').setAttribute('aria-hidden','true')});
function favKey(){return `${state.currentLang}-${state.hymns[state.currentLang][state.currentIndex].number}`}
function getFavs(){try{return JSON.parse(localStorage.getItem('melgc-favs')||'[]')}catch{return[]}}
function updateFavButton(){const on=getFavs().includes(favKey());$('#favReader').textContent=on?'★':'☆'}
$('#favReader').addEventListener('click',()=>{let f=getFavs(),k=favKey();f=f.includes(k)?f.filter(x=>x!==k):[...f,k];localStorage.setItem('melgc-favs',JSON.stringify(f));updateFavButton();renderFavorites()});
function renderFavorites(){const box=$('#favList'),f=getFavs(), items=[]; f.forEach(k=>{const [lang,n]=k.split('-');const h=state.hymns[lang]?.find(x=>x.number===Number(n));if(h)items.push({lang,h})});box.innerHTML=items.length?items.map(x=>`<button class="hymn-row" data-lang="${x.lang}" data-num="${x.h.number}"><span class="num">${x.h.number}</span><span class="row-title">${esc(x.h.title)}</span><span class="row-key">${x.lang==='en'?'EN':'LG'}</span></button>`).join(''):'<div class="empty">No favourites yet. Tap ☆ while reading a hymn.</div>';box.querySelectorAll('.hymn-row').forEach(x=>x.addEventListener('click',()=>openHymn(x.dataset.lang,Number(x.dataset.num))))}
$('#prevHymn').addEventListener('click',()=>move(-1));$('#nextHymn').addEventListener('click',()=>move(1));
function move(d){const arr=state.hymns[state.currentLang];state.currentIndex=(state.currentIndex+d+arr.length)%arr.length;const h=arr[state.currentIndex];$('#readerTitle').textContent=`${h.number}. ${h.title}`;$('#readerKey').textContent=h.key?`Key: ${h.key}`:'';$('#readerBody').textContent=h.lyrics||'Lyrics not available in the source book.';updateFavButton();$('#reader').scrollTo(0,0)}
function renderSermons(){
 const channel='https://www.youtube.com/@eternallifegospelchurch7708';
 const videos=channel+'/videos';
 const sermons=[
  {title:'Eternal Life Gospel Church — YouTube',desc:'Open the church’s official YouTube channel.',url:channel},
  {title:'Church Sermons & Videos',desc:'View the latest sermons and uploaded church videos.',url:videos}
 ];
 $('#sermonList').innerHTML=sermons.map(s=>`<div class="sermon"><b>${esc(s.title)}</b><span>${esc(s.desc)}</span><a href="${s.url}" target="_blank" rel="noopener noreferrer">Watch online →</a></div>`).join('')+`<div class="notice"><b>Online sermons:</b> An internet connection is required to watch YouTube videos. The hymns remain available offline.</div>`;
}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
$('#searchEn').addEventListener('input',e=>renderList('en',e.target.value));$('#searchLg').addEventListener('input',e=>renderList('lg',e.target.value));
$('#smaller').addEventListener('click',()=>{state.font=Math.max(14,state.font-2);$('#readerBody').style.fontSize=state.font+'px'});$('#larger').addEventListener('click',()=>{state.font=Math.min(34,state.font+2);$('#readerBody').style.fontSize=state.font+'px'});$('#resetFont').addEventListener('click',()=>{state.font=19;$('#readerBody').style.fontSize='19px'});
load();
if('serviceWorker' in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js'));
