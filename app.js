const state={
  lang:'en',
  hymns:{en:[],lg:[]},
  currentIndex:0,
  currentLang:'en',
  font:Number(localStorage.getItem('melgc-font')||19)
};

const $=s=>document.querySelector(s);
const $$=s=>document.querySelectorAll(s);

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

function formatLyrics(lang,h){
  let raw=String(h.lyrics||'').replace(/\r/g,'').trim();

  if(!raw)return '';

  raw=raw
    .replace(/\}\s*/g,' ')
    .replace(/\s*\{/g,'')
    .replace(/[ \t]+/g,' ');

  raw=raw.replace(
    /(^|\n)\s*(CHORUS|BRIDGE|REFRAIN|VERSE|VAMP|TAG|INTRO)\s*:?\s*(?=\n|$)/gim,
    '$1\n$2\n'
  );

  raw=raw.replace(
    /([.!?;,])\s+(CHORUS|BRIDGE|REFRAIN|VERSE|VAMP|TAG|INTRO)\s*:?\s*/gi,
    '$1\n\n$2\n\n'
  );

  const chunks=raw
    .split(/\n[ \t]*\n+/)
    .map(x=>x.trim())
    .filter(Boolean);

  const out=[];

  for(let i=0;i<chunks.length;i++){
    const lines=chunks[i]
      .split(/\n+/)
      .map(x=>x.trim())
      .filter(Boolean);

    if(!lines.length)continue;

    const headingMatch=lines[0].match(
      /^(CHORUS|BRIDGE|REFRAIN|VERSE|VAMP|TAG|INTRO)\s*:?[.!]*$/i
    );

    if(headingMatch){
      const heading=headingMatch[1].toUpperCase();
      let lyrics=lines.slice(1);

      if(!lyrics.length&&chunks[i+1]){
        lyrics=chunks[++i]
          .split(/\n+/)
          .map(x=>x.trim())
          .filter(Boolean);
      }

      if(lyrics.length){
        out.push(
          `<div class="lyric-section ${heading.toLowerCase()}">`+
          `<div class="lyric-heading">${esc(heading)}</div>`+
          `<div class="stanza">${lyrics.map(esc).join('<br>')}</div>`+
          `</div>`
        );
      }

      continue;
    }

    out.push(
      `<div class="stanza">${lines.map(esc).join('<br>')}</div>`
    );
  }

  return out.join('');
}


/* =========================================================
   PERSISTENT REMINDER STATE
   IndexedDB is the primary store.
   localStorage is kept as a fallback.
   ========================================================= */

const REMINDER_DB='melgc-reminders';
const REMINDER_STORE='reminders';

function openReminderDB(){
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open(REMINDER_DB,1);

    request.onupgradeneeded=()=>{
      const db=request.result;

      if(!db.objectStoreNames.contains(REMINDER_STORE)){
        db.createObjectStore(REMINDER_STORE);
      }
    };

    request.onsuccess=()=>{
      resolve(request.result);
    };

    request.onerror=()=>{
      reject(request.error);
    };
  });
}

async function saveReminderState(key){
  const db=await openReminderDB();

  return new Promise((resolve,reject)=>{
    const tx=db.transaction(REMINDER_STORE,'readwrite');

    tx.objectStore(REMINDER_STORE).put('1',key);

    tx.oncomplete=()=>{
      db.close();
      resolve();
    };

    tx.onerror=()=>{
      db.close();
      reject(tx.error);
    };
  });
}

async function removeReminderState(key){
  const db=await openReminderDB();

  return new Promise((resolve,reject)=>{
    const tx=db.transaction(REMINDER_STORE,'readwrite');

    tx.objectStore(REMINDER_STORE).delete(key);

    tx.oncomplete=()=>{
      db.close();
      resolve();
    };

    tx.onerror=()=>{
      db.close();
      reject(tx.error);
    };
  });
}

async function hasReminderState(key){
  const db=await openReminderDB();

  return new Promise((resolve,reject)=>{
    const tx=db.transaction(REMINDER_STORE,'readonly');

    const request=tx
      .objectStore(REMINDER_STORE)
      .get(key);

    request.onsuccess=()=>{
      db.close();
      resolve(!!request.result);
    };

    request.onerror=()=>{
      db.close();
      reject(request.error);
    };
  });
}


/* =========================================================
   RESTORE REMINDER BUTTONS
   ========================================================= */

async function restoreReminderButtons(){

  const buttons=document.querySelectorAll('.reminder-btn');

  for(const btn of buttons){

    const key=btn.dataset.reminderKey;

    if(!key)continue;

    let enabled=localStorage.getItem(key)==='1';

    try{

      if(await hasReminderState(key)){
        enabled=true;
      }

    }catch(e){}


    /*
       IMPORTANT:
       Check localStorage again after IndexedDB finishes.

       This prevents an old restore operation from changing
       a button back to "Reminder enabled" after the user
       has already disabled it.
    */

    enabled=localStorage.getItem(key)==='1';


    if(enabled){

      btn.textContent='✓ Reminder enabled';
      btn.classList.add('enabled');

    }else{

      btn.textContent='🔔 Remind me';
      btn.classList.remove('enabled');

    }
  }
}


/* =========================================================
   SEND NATIVE ANDROID REMINDER COMMAND
   ========================================================= */

function sendNativeReminder(url){

  const frame=document.createElement('iframe');

  frame.style.display='none';
  frame.src=url;

  document.body.appendChild(frame);

  setTimeout(()=>{
    frame.remove();
  },2000);
}


/* =========================================================
   REMINDER TOGGLE
   Enable / Disable
   ========================================================= */

async function toggleReminder(btn){

  const day=btn.dataset.day;
  const time=btn.dataset.time;
  const event=btn.dataset.event||'';
  const key=btn.dataset.reminderKey;

  if(!day||!time||!key)return;


  /* =======================================================
     DISABLE REMINDER
     ======================================================= */

  /*
     Check BOTH the button class and localStorage.

     This makes disabling reliable even if the button state
     was restored from saved data.
  */

  if(
    btn.classList.contains('enabled') ||
    localStorage.getItem(key)==='1'
  ){

    /*
       Immediately update the button.

       This makes the UI respond instantly.
    */

    btn.textContent='🔔 Remind me';
    btn.classList.remove('enabled');


    /*
       Remove persistent browser state.
    */

    localStorage.removeItem(key);

    try{

      await removeReminderState(key);

    }catch(e){}


    /*
       Tell the native Android application to cancel
       the scheduled alarm.
    */

    const nativeUrl=
      'melgc://remind?action=cancel'+
      '&day='+encodeURIComponent(day)+
      '&time='+encodeURIComponent(time)+
      '&event='+encodeURIComponent(event);

    sendNativeReminder(nativeUrl);

    return;
  }


  /* =======================================================
     ENABLE REMINDER
     ======================================================= */

  if('Notification' in window){

    try{

      let permission=Notification.permission;

      if(permission==='default'){

        permission=
          await Notification.requestPermission();

      }

      if(permission==='denied'){

        alert(
          'Notifications are blocked. Please allow notifications for MELGC Songbook in Android settings.'
        );

      }

    }catch(e){}
  }


  /* =======================================================
     SAVE PERSISTENT STATE
     ======================================================= */

  localStorage.setItem(key,'1');

  try{

    await saveReminderState(key);

  }catch(e){}


  /* =======================================================
     UPDATE BUTTON
     ======================================================= */

  btn.textContent='✓ Reminder enabled';
  btn.classList.add('enabled');


  /* =======================================================
     SEND NATIVE ANDROID SCHEDULE COMMAND
     ======================================================= */

  const nativeUrl=
    'melgc://remind?action=schedule'+
    '&day='+encodeURIComponent(day)+
    '&time='+encodeURIComponent(time)+
    '&event='+encodeURIComponent(event);

  sendNativeReminder(nativeUrl);
}


/* =========================================================
   APP LOADING
   ========================================================= */

let deferredInstallPrompt=null;

async function load(){

  state.hymns.en=
    await fetch('hymns-en.json').then(r=>r.json());

  state.hymns.lg=
    await fetch('hymns-lg.json').then(r=>r.json());

  renderList('en','');
  renderList('lg','');
  renderFavorites();
  renderSermons();
  renderProgramme();
}


/* =========================================================
   NAVIGATION
   ========================================================= */

function showScreen(id){

  $$('.screen').forEach(x=>
    x.classList.toggle('active',x.id===id)
  );

  $$('.bottom-nav button').forEach(b=>
    b.classList.toggle(
      'nav-active',
      b.dataset.screen===id
    )
  );

  window.scrollTo(0,0);
}

$$('[data-screen]').forEach(b=>
  b.addEventListener(
    'click',
    ()=>showScreen(b.dataset.screen)
  )
);

$$('.back').forEach(b=>
  b.addEventListener(
    'click',
    ()=>showScreen('home')
  )
);

$('#menuBtn').addEventListener(
  'click',
  ()=>showScreen('about')
);

$('#themeBtn').addEventListener(
  'click',
  ()=>{
    document.body.classList.toggle('light');
  }
);


/* =========================================================
   INSTALL APP
   ========================================================= */

if(localStorage.getItem('melgc-install-dismissed')!=='1'){

  window.addEventListener(
    'beforeinstallprompt',
    e=>{
      e.preventDefault();

      deferredInstallPrompt=e;

      const b=$('#installBanner');

      if(b)b.hidden=false;
    }
  );
}

const ib=$('#installBtn');

if(ib){

  ib.addEventListener(
    'click',
    async()=>{

      if(!deferredInstallPrompt)return;

      deferredInstallPrompt.prompt();

      await deferredInstallPrompt.userChoice;

      deferredInstallPrompt=null;

      const b=$('#installBanner');

      if(b)b.hidden=true;
    }
  );
}

const db=$('#dismissInstall');

if(db){

  db.addEventListener(
    'click',
    ()=>{

      localStorage.setItem(
        'melgc-install-dismissed',
        '1'
      );

      const b=$('#installBanner');

      if(b)b.hidden=true;
    }
  );
}

window.addEventListener(
  'appinstalled',
  ()=>{

    const b=$('#installBanner');

    if(b)b.hidden=true;

  }
);


/* =========================================================
   SHARE APP
   ========================================================= */

const sb=$('#shareApp');

if(sb){

  sb.addEventListener(
    'click',
    async()=>{

      const data={
        title:'MELGC Songbook',
        text:'Mulago Eternal Life Gospel Church Songbook',
        url:location.href
      };

      try{

        if(navigator.share){

          await navigator.share(data);

        }else if(navigator.clipboard){

          await navigator.clipboard.writeText(
            location.href
          );

        }

      }catch(e){}
    }
  );
}


/* =========================================================
   HYMNS
   ========================================================= */

function renderList(lang,q){

  const box=
    lang==='en'
      ?$('#listEn')
      :$('#listLg');

  const term=q.trim().toLowerCase();

  const arr=state.hymns[lang].filter(h=>
    !term||
    String(h.number).includes(term)||
    String(h.title||'')
      .toLowerCase()
      .includes(term)
  );

  box.innerHTML=
    arr.map(h=>{

      const first=String(h.lyrics||'')
        .split(/\n+/)
        .map(x=>x.trim())
        .find(Boolean)||'';

      return `
        <button
          class="hymn-row ${lang==='en'?'english-row':''}"
          data-lang="${lang}"
          data-num="${h.number}">

          <span class="num">${h.number}</span>

          <span class="row-main">

            <span class="row-title">
              ${esc(h.title)}
            </span>

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

    }).join('')||
    '<div class="empty">No hymns found.</div>';

  box.querySelectorAll('.hymn-row').forEach(x=>
    x.addEventListener(
      'click',
      ()=>openHymn(
        lang,
        Number(x.dataset.num)
      )
    )
  );
}

function normalizeHymn(h){

  if(!h||!h.key)return h;

  const keyText=String(h.key).trim();

  const match=keyText.match(
    /^([A-G](?:#|b)?)(?:\s+(.+))?$/
  );

  if(!match)return h;

  const cleanKey=match[1];
  const extra=match[2]||'';

  return extra
    ?{
        ...h,
        key:cleanKey,
        lyrics:
          extra+
          (h.lyrics?'\n'+h.lyrics:'')
      }
    :{
        ...h,
        key:cleanKey
      };
}

function openHymn(lang,num){

  const arr=state.hymns[lang];

  const idx=arr.findIndex(
    h=>h.number===num
  );

  if(idx<0)return;

  state.currentLang=lang;
  state.currentIndex=idx;

  const h=normalizeHymn(arr[idx]);

  $('#readerTitle').textContent=h.title;

  $('#readerKey').textContent=
    h.key
      ?`Key: ${h.key}`
      :'';

  $('#readerBody').innerHTML=
    formatLyrics(lang,h)||
    '<div class="stanza">Lyrics not available in the source book.</div>';

  $('#reader').classList.add('open');

  $('#reader').setAttribute(
    'aria-hidden',
    'false'
  );

  updateFavButton();

  $('#reader').scrollTo(0,0);
}

$('#closeReader').addEventListener(
  'click',
  ()=>{

    $('#reader').classList.remove('open');

    $('#reader').setAttribute(
      'aria-hidden',
      'true'
    );

  }
);


/* =========================================================
   FAVOURITES
   ========================================================= */

function favKey(){

  return `${state.currentLang}-${
    state.hymns[state.currentLang][state.currentIndex].number
  }`;
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

  const on=getFavs().includes(
    favKey()
  );

  $('#favReader').textContent=
    on?'★':'☆';
}

$('#favReader').addEventListener(
  'click',
  ()=>{

    let f=getFavs();
    let k=favKey();

    f=f.includes(k)
      ?f.filter(x=>x!==k)
      :[...f,k];

    localStorage.setItem(
      'melgc-favs',
      JSON.stringify(f)
    );

    updateFavButton();
    renderFavorites();

  }
);

function renderFavorites(){

  const box=$('#favList');

  const f=getFavs();

  const items=[];

  f.forEach(k=>{

    const [lang,n]=k.split('-');

    const h=
      state.hymns[lang]?.find(
        x=>x.number===Number(n)
      );

    if(h)items.push({lang,h});

  });

  box.innerHTML=
    items.length

      ?items.map(x=>`

        <button
          class="hymn-row"
          data-lang="${x.lang}"
          data-num="${x.h.number}">

          <span class="num">
            ${x.h.number}
          </span>

          <span class="row-main">

            <span class="row-title">
              ${esc(x.h.title)}
            </span>

          </span>

          <span class="row-key">
            ${x.lang==='en'?'EN':'LG'}
          </span>

        </button>

      `).join('')

      :'<div class="empty">No favourites yet. Tap ☆ while reading a hymn.</div>';

  box.querySelectorAll('.hymn-row').forEach(x=>
    x.addEventListener(
      'click',
      ()=>openHymn(
        x.dataset.lang,
        Number(x.dataset.num)
      )
    )
  );
}


/* =========================================================
   NEXT / PREVIOUS HYMN
   ========================================================= */

$('#prevHymn').addEventListener(
  'click',
  ()=>move(-1)
);

$('#nextHymn').addEventListener(
  'click',
  ()=>move(1)
);

function move(d){

  const arr=
    state.hymns[state.currentLang];

  state.currentIndex=
    (
      state.currentIndex+
      d+
      arr.length
    )%arr.length;

  const h=
    normalizeHymn(
      arr[state.currentIndex]
    );

  $('#readerTitle').textContent=
    h.title;

  $('#readerKey').textContent=
    h.key
      ?`Key: ${h.key}`
      :'';

  $('#readerBody').innerHTML=
    formatLyrics(
      state.currentLang,
      h
    )||
    '<div class="stanza">Lyrics not available in the source book.</div>';

  updateFavButton();

  $('#reader').scrollTo(0,0);
}


/* =========================================================
   SUNDAY SERVICES
   Newest video is displayed as Sunday Service 1.
   ========================================================= */

function renderSermons(){

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

  $('#sermonList').innerHTML=
    videos
      .slice()
      .reverse()
      .map(
        (id,i)=>`

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

        `
      ).join('');
}


/* =========================================================
   WEEKLY SERVICE PROGRAMME
   ========================================================= */

const programme=[

  {
    day:'Monday',
    events:[
      ['12:00 PM','1:00 PM','Lunch Hour'],
      ['5:00 PM','7:00 PM','Bible Study']
    ]
  },

  {
    day:'Tuesday',
    events:[
      ['12:00 PM','1:00 PM','Lunch Hour'],
      ['5:00 PM','7:00 PM','Bible Study']
    ]
  },

  {
    day:'Wednesday',
    events:[
      ['12:00 PM','1:00 PM','Lunch Hour (only)']
    ]
  },

  {
    day:'Thursday',
    events:[
      ['12:00 PM','1:00 PM','Lunch Hour'],
      ['5:00 PM','7:00 PM','Bible Study']
    ]
  },

  {
    day:'Friday',
    events:[
      ['12:00 PM','1:00 PM','Lunch Hour'],
      ['5:00 PM','7:00 PM','Bible Study'],
      ['8:00 PM','11:00 PM','Night Prayer']
    ]
  }

];

function reminderKey(day,time){

  return `melgc-reminder-${day}-${time}`;

}


/* =========================================================
   DISPLAY PROGRAMME
   ========================================================= */

function renderProgramme(){

  const box=$('#programmeList');

  if(!box)return;

  box.innerHTML=
    programme.map(d=>`

      <div class="programme-day">

        <h3>${d.day}</h3>

        ${d.events.map(e=>{

          const key=
            reminderKey(
              d.day,
              e[0]
            );

          const enabled=
            localStorage.getItem(key)==='1';

          return `

            <div class="programme-event">

              <div class="programme-time">
                ${e[0]} – ${e[1]}
              </div>

              <div class="programme-name">
                ${esc(e[2])}
              </div>

              <button
                class="reminder-btn${enabled?' enabled':''}"
                type="button"
                data-reminder-key="${key}"
                data-day="${d.day}"
                data-time="${e[0]}"
                data-event="${esc(e[2])}">

                ${
                  enabled
                    ?'✓ Reminder enabled'
                    :'🔔 Remind me'
                }

              </button>

            </div>

          `;

        }).join('')}

      </div>

    `).join('');


  /* Connect every reminder button to the
     enable/disable toggle */

  box.querySelectorAll('.reminder-btn').forEach(b=>
    b.addEventListener(
      'click',
      ()=>toggleReminder(b)
    )
  );


  /* Restore persistent state */

  restoreReminderButtons();

}


/* =========================================================
   SEARCH
   ========================================================= */

$('#searchEn').addEventListener(
  'input',
  e=>renderList(
    'en',
    e.target.value
  )
);

$('#searchLg').addEventListener(
  'input',
  e=>renderList(
    'lg',
    e.target.value
  )
);


/* =========================================================
   FONT SIZE
   ========================================================= */

function applyFont(){

  $('#readerBody').style.fontSize=
    state.font+'px';

  localStorage.setItem(
    'melgc-font',
    String(state.font)
  );

}

$('#smaller').addEventListener(
  'click',
  ()=>{

    state.font=
      Math.max(
        14,
        state.font-2
      );

    applyFont();

  }
);

$('#larger').addEventListener(
  'click',
  ()=>{

    state.font=
      Math.min(
        34,
        state.font+2
      );

    applyFont();

  }
);

$('#resetFont').addEventListener(
  'click',
  ()=>{

    state.font=19;
    applyFont();

  }
);


/* =========================================================
   START APP
   ========================================================= */

load().then(()=>{

  applyFont();

});


if('serviceWorker' in navigator){

  window.addEventListener(
    'load',
    ()=>{

      navigator.serviceWorker.register('sw.js');

    }
  );

    }
