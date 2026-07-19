/* ============================================================
   WAYFARER — offline-first place collector
   Storage: IndexedDB. No network required to play.
   ============================================================ */

const RANGE_M   = 60;        // metres you must be within to spin
const COOLDOWN  = 20*60*60*1000; // 20h — so a daily habit never gets blocked by clock drift
const SPIN_ARC  = 900;       // degrees of rotation to complete a spin
const BUILDER_PIN = 'lemorne'; // builder mode password — change it here
const APP_VER = 'v23';

/* ---------- Regions you can pre-cache ---------- */
const REGIONS = [
  {id:'mru',  name:'Mauritius',            icon:'⛱',  bbox:[-20.55,57.28,-19.95,57.82], z:[9,10,11,12,13,14]},
  {id:'kruger',name:'Kruger National Park', icon:'🦁', bbox:[-25.55,30.85,-22.30,32.05], z:[8,9,10,11,12]},
  {id:'jhbn', name:'Johannesburg North',   icon:'⛩',  bbox:[-26.13,27.95,-25.94,28.13], z:[10,11,12,13,14]},
  {id:'jhb',  name:'Johannesburg',         icon:'◍',  bbox:[-26.35,27.78,-26.00,28.20], z:[10,11,12,13,14]},
  {id:'east_rand', name:'East Rand',       icon:'✈',  bbox:[-26.40,28.10,-26.05,28.50], z:[10,11,12,13,14]},
  {id:'west_rand', name:'West Rand',       icon:'⛏',  bbox:[-26.25,27.60,-25.95,27.95], z:[10,11,12,13,14]},
  {id:'centurion', name:'Centurion & Pretoria West', icon:'🏏', bbox:[-25.95,28.00,-25.70,28.20], z:[10,11,12,13,14]},
  {id:'pta',  name:'Pretoria East',        icon:'🌳', bbox:[-25.92,28.15,-25.72,28.35], z:[10,11,12,13,14]},
  {id:'cpt',  name:'Cape Town',            icon:'⛰',  bbox:[-34.10,18.30,-33.75,18.75], z:[10,11,12,13,14]},
  {id:'kampen', name:'Kampen & Zwolle (NL)',  icon:'🌷', bbox:[52.40,5.70,52.70,6.20], z:[10,11,12,13,14]},
  {id:'randstad', name:'Randstad (Netherlands)', icon:'🚲', bbox:[51.80,3.90,52.50,5.20], z:[9,10,11,12,13]},
  {id:'fw',   name:'Fort Worth (TX)',       icon:'🤠', bbox:[32.55,-97.75,32.95,-97.15], z:[10,11,12,13,14]},
  {id:'dfw',  name:'Dallas–Fort Worth (TX)', icon:'🐂', bbox:[32.55,-97.55,33.10,-96.45], z:[9,10,11,12,13]},
  {id:'houston', name:'Houston (TX)',      icon:'🚀', bbox:[29.50,-95.75,30.10,-95.00], z:[9,10,11,12,13,14]},
  {id:'austin', name:'Austin (TX)',        icon:'🎸', bbox:[30.10,-98.05,30.55,-97.55], z:[10,11,12,13,14]},
];

/* ---------- Momento vocabulary ---------- */
/* Each place gets a deterministic momento derived from its type + name,
   so the same beach always yields the same stamp. Rares are earned. */
const KINDS = [
  {cat:'Beaches & coast', desc:'Beaches, bays, and lagoons',
   test:/beach|plage|bay|baie|lagoon|coast|island|île|islet|waterfront/i, gl:'🐚', com:'Seashell', rare:'Pearl', line:'Picked from the wrack line.'},
  {cat:'Peaks & koppies', desc:'Mountains, hills, and summits',
   test:/mount|peak|morne|hill|summit|koppie|crater|dune|coloured earths/i, gl:'🪨', com:'Summit Stone', rare:'Mountain Crystal', line:'Chipped from the ridge.'},
  {cat:'Waterfalls', desc:'Falls and cascades',
   test:/water\s?fall|\bfalls?\b|cascade|chute/i, gl:'💧', com:'Waterfall Mist', rare:'Rainbow Droplet', line:'Bottled at the plunge pool.'},
  {cat:'Rivers & lakes', desc:'Rivers, lakes, dams, and gorges',
   test:/lake|river|dam|gorge|spring|bassin|talao/i, gl:'🪶', com:'River Pebble', rare:'Heron Feather', line:'Found on the bank.'},
  {cat:'Wildlife & camps', desc:'Game reserves, safari camps, hides, and zoos',
   test:/game reserve|safari|wildlife|rest camp|lodge|hide|waterhole|zoo|aquarium|picnic site|\bgate\b|sanctuary/i, gl:'🦁', com:'Enamel Mug', rare:'Carved Lion', line:'Kept from the campfire.'},
  {cat:'Malls & squares', desc:'Shopping centres and public squares',
   test:/mall|shopping|centre|square/i, gl:'🪙', com:'Souvenir Coin', rare:'Gold Coin', line:'Struck on the spot.'},
  {cat:'Parks & gardens', desc:'Parks, gardens, forests, and nature reserves',
   test:/garden|park|botanic|reserve|forest/i, gl:'🌿', com:'Pressed Leaf', rare:'Rare Orchid', line:'Flattened between pages.'},
  {cat:'Places of worship', desc:'Churches, temples, mosques, and shrines',
   test:/temple|church|mosque|shrine|kovil|worship|cathedral|synagogue/i, gl:'🕯', com:'Candle', rare:'Brass Bell', line:'Left burning at the step.'},
  {cat:'Forts & ruins', desc:'Castles, forts, ruins, and ancient sites',
   test:/fort|ruin|castle|archaeolog|heritage/i, gl:'🏰', com:'Cannonball', rare:"King's Seal", line:'Dug from the ramparts.'},
  {cat:'Museums & monuments', desc:'Museums, galleries, statues, and memorials',
   test:/museum|gallery|monument|memorial|statue|sculpture|artwork|house|homestead|manor|buildings|ghat|depot/i, gl:'🗝', com:'Iron Key', rare:'Golden Key', line:'Lifted from the archive.'},
  {cat:'Markets', desc:'Markets and bazaars',
   test:/market|bazaar|marché/i, gl:'🧂', com:'Spice Pouch', rare:'Golden Saffron', line:'Traded at the stall.'},
  {cat:'Casinos & theatres', desc:'Casinos, theatres, and cinemas',
   test:/casino|theatre|cinema/i, gl:'🎟', com:'Ticket Stub', rare:'Golden Ticket', line:'Torn at the door.'},
  {cat:'Stadiums & circuits', desc:'Stadiums, arenas, and race tracks',
   test:/stadium|arena|circuit|versfeld/i, gl:'🏁', com:'Match Ticket', rare:'VIP Pass', line:'Kept from the stands.'},
  {cat:'Lighthouses & lookouts', desc:'Lighthouses, viewpoints, and capes',
   test:/light\s?house|point|cape|\bcap\b|headland|viewpoint|lookout/i, gl:'🔭', com:'Spyglass', rare:'Lighthouse Lens', line:'Prised from the tower.'},
  {cat:'Bridges & towers', desc:'Bridges, towers, and observatories',
   test:/bridge|tower|obelisk|observator/i, gl:'🌉', com:'Postcard', rare:'Vintage Postcard', line:'Bought at the kiosk.'},
  {cat:'Everything else', desc:'Anywhere worth standing',
   test:/.*/, gl:'🧭', com:'Compass', rare:'Treasure Map', line:'Marked on the map.'},
];

function kindFor(name, cats){
  // An explicit choice (builder-set) outranks any keyword in the name.
  const fx = (cats||[]).find(c=>String(c).startsWith('cat:'));
  if(fx){ const k = KINDS.find(k=>k.cat===fx.slice(4)); if(k) return k; }
  const hay = (name+' '+(cats||[]).join(' '));
  return KINDS.find(k=>k.test.test(hay)) || KINDS[KINDS.length-1];
}

/* ---------- Seed places ----------
   Bundled so the app is never empty, even if Wikidata is unreachable
   or you forgot to cache before losing signal. Wikidata results merge
   on top of these when a region is cached. */
const SEED = {
mru:[
 ['seed-mru-1','Le Morne Brabant',-20.4581,57.3200,'Basalt monolith on the south-west peninsula, a UNESCO site.'],
 ['seed-mru-2','Chamarel Seven Coloured Earths',-20.4278,57.3736,'Dunes of volcanic clay in seven distinct hues.'],
 ['seed-mru-3','Chamarel Waterfall',-20.4436,57.3775,'A single drop of roughly 100 metres.'],
 ['seed-mru-4','Black River Gorges National Park',-20.4200,57.4400,'The last of the island native forest.'],
 ['seed-mru-5','Grand Baie',-20.0136,57.5800,'Sheltered northern bay, the island social centre.'],
 ['seed-mru-6','Port Louis Central Market',-20.1620,57.5030,'Produce, spice, and textile market in the capital.'],
 ['seed-mru-7','Caudan Waterfront',-20.1610,57.4980,'Harbourfront quarter of Port Louis.'],
 ['seed-mru-8','Sir Seewoosagur Ramgoolam Botanical Garden',-20.1044,57.5806,'Pamplemousses garden, famed for giant water lilies.'],
 ['seed-mru-9','Île aux Cerfs',-20.2683,57.7900,'Island off the east coast, ringed by lagoon.'],
 ['seed-mru-10','Trou aux Cerfs',-20.3211,57.5122,'Dormant volcanic crater above Curepipe.','crater'],
 ['seed-mru-11','Ganga Talao (Grand Bassin)',-20.4183,57.4914,'Crater lake and the island holiest Hindu site.'],
 ['seed-mru-12','Flic en Flac Beach',-20.2747,57.3644,'Long west-coast beach, calm water at dusk.'],
 ['seed-mru-13','Belle Mare Beach',-20.1911,57.7778,'Wide white sand on the east coast.'],
 ['seed-mru-14','Cap Malheureux',-19.9847,57.6142,'Northern cape with the red-roofed chapel.'],
 ['seed-mru-15','Rochester Falls',-20.4711,57.4794,'Falls over square-cut basalt columns near Souillac.'],
 ['seed-mru-16','Blue Bay Marine Park',-20.4444,57.7139,'Protected coral lagoon in the south-east.'],
 ['seed-mru-17','Île aux Aigrettes',-20.4200,57.7333,'Coral islet nature reserve, home to rare endemics.'],
 ['seed-mru-18','Casela Nature Park',-20.2836,57.4128,'Nature and adventure park in the west.'],
 ['seed-mru-19','Fort Adelaide (La Citadelle)',-20.1594,57.5044,'British fort overlooking Port Louis.'],
 ['seed-mru-20','Eureka House',-20.2408,57.5039,'Creole plantation mansion at Moka.'],
 ['seed-mru-21','Tamarin Bay',-20.3264,57.3703,'Surf break and salt pans on the west coast.'],
 ['seed-mru-22','Le Pouce',-20.1997,57.5272,'Thumb-shaped peak above the central plateau.','peak'],
 ['seed-mru-23','Pieter Both',-20.1933,57.5450,'Peak crowned by a balanced boulder.','peak'],
 ['seed-mru-24','Gris Gris',-20.5169,57.5233,'Cliff and unreefed coast at the southern tip.','coast'],
 ['seed-mru-25','Aapravasi Ghat',-20.1586,57.5030,'Immigration depot, a UNESCO World Heritage Site.'],
],
kruger:[
 ['seed-kr-1','Skukuza Rest Camp',-24.9947,31.5900,'The largest camp, on the Sabie River.'],
 ['seed-kr-2','Lower Sabie Rest Camp',-25.1211,31.9167,'Camp overlooking the Sabie River.'],
 ['seed-kr-3','Satara Rest Camp',-24.3936,31.7789,'Central camp, in prime lion country.'],
 ['seed-kr-4','Olifants Rest Camp',-23.9944,31.7444,'Camp on a ridge above the Olifants River.'],
 ['seed-kr-5','Letaba Rest Camp',-23.8511,31.5750,'Camp among fever trees on the Letaba.'],
 ['seed-kr-6','Punda Maria Rest Camp',-22.6939,31.0167,'Northern camp in sandveld country.'],
 ['seed-kr-7','Pretoriuskop Rest Camp',-25.1667,31.2667,'The oldest camp in the park.'],
 ['seed-kr-8','Berg-en-Dal Rest Camp',-25.4211,31.4489,'Camp in the southern hills.'],
 ['seed-kr-9','Sunset Dam',-25.1181,31.9081,'Waterhole beside Lower Sabie, heavy with hippo.'],
 ['seed-kr-10','Sabie River',-25.0500,31.7500,'Perennial river through the southern park.'],
 ['seed-kr-11','Paul Kruger Gate',-24.9836,31.4844,'Western entrance near Skukuza.'],
 ['seed-kr-12','Crocodile Bridge Gate',-25.3583,31.8933,'Southern gate on the Crocodile River.'],
 ['seed-kr-13','Lake Panic Bird Hide',-24.9800,31.5644,'Hide on a quiet dam near Skukuza.'],
 ['seed-kr-14','Tshokwane Picnic Site',-24.7997,31.7803,'Halfway stop on the Skukuza-Satara road.'],
 ['seed-kr-15','Mopani Rest Camp',-23.5222,31.3944,'Camp above the Pioneer Dam.'],
 ['seed-kr-16','Shingwedzi Rest Camp',-23.1097,31.4344,'Northern camp on the Shingwedzi River.'],
 ['seed-kr-17','Nkuhlu Picnic Site',-25.0264,31.7539,'Riverside stop on the Sabie.'],
 ['seed-kr-18','Orpen Gate',-24.4744,31.7772,'Central-western entrance to the park.'],
 ['seed-kr-19','Thulamela Heritage Site',-22.4067,31.1467,'Stone-walled site of a 15th-century kingdom.'],
 ['seed-kr-20','Pafuri Picnic Site',-22.4231,31.2189,'Far north, in riverine forest on the Luvuvhu.'],
],
jhbn:[
 ['seed-jn-1','Montecasino',-26.0242,28.0140,'Tuscan-village casino and theatre complex, the Fourways landmark.'],
 ['seed-jn-2','Fourways Mall',-26.0075,28.0064,'One of the largest malls in the southern hemisphere.'],
 ['seed-jn-3','Kyalami Grand Prix Circuit',-25.9990,28.0690,'The historic home of South African motorsport.'],
 ['seed-jn-4','Riversands Farm Village',-25.9611,28.0117,'Weekend market and farm village north of Steyn City.'],
 ['seed-jn-5','Bryanston Organic Market',-26.0560,28.0330,'Long-running Thursday and Saturday craft market.'],
 ['seed-jn-6','Liliesleaf Farm',-26.0378,28.0570,'Rivonia farmhouse where the ANC high command was arrested in 1963.','museum'],
 ['seed-jn-7','Sandton City & Nelson Mandela Square',-26.1076,28.0567,'Retail heart of the richest square mile in Africa.'],
 ['seed-jn-8','Delta Park',-26.1230,28.0060,'One of the largest urban parks in the city.'],
 ['seed-jn-9','Mall of Africa',-26.0146,28.1070,'Waterfall City anchor mall in Midrand.'],
 ['seed-jn-10','Lonehill Koppie',-26.0315,28.0300,'Granite koppie and nature area at the heart of Lonehill.'],
 ['seed-jn-11','Nizamiye Mosque',-25.9580,28.1270,'Ottoman-style complex, the largest mosque in the southern hemisphere.'],
 ['seed-jn-12','Mushroom Farm Park',-26.0997,28.0553,'Sandton central park beside the Radisson.'],
],
pta:[
 ['seed-pt-1','Faerie Glen Nature Reserve',-25.7795,28.2950,'Bankenveld reserve on the Moreleta Spruit, entrance off January Masilela.'],
 ['seed-pt-2','Menlyn Park Shopping Centre',-25.7827,28.2767,'The retail anchor of Pretoria East.'],
 ['seed-pt-3','Rietvlei Nature Reserve',-25.8760,28.2700,'Highveld reserve with rhino, buffalo, and the Rietvlei Dam.'],
 ['seed-pt-4','Moreleta Kloof Nature Reserve',-25.8250,28.2800,'Small kloof reserve with zebra and springbok among the suburbs.'],
 ['seed-pt-5','Loftus Versfeld',-25.7536,28.2225,'Fortress of the Bulls since 1908.'],
 ['seed-pt-6','Union Buildings',-25.7400,28.2119,'Herbert Baker\u2019s sandstone seat of government, above terraced gardens.'],
 ['seed-pt-7','Pretoria National Botanical Garden',-25.7392,28.2790,'Garden split by a quartzite ridge in Brummeria.'],
 ['seed-pt-8','Austin Roberts Bird Sanctuary',-25.7794,28.2422,'Urban sanctuary named for the author of the bird book.'],
 ['seed-pt-9','Fort Klapperkop',-25.7822,28.2069,'Boer fort of 1898 overlooking the city.'],
 ['seed-pt-10','Groenkloof Nature Reserve',-25.7850,28.1950,'The oldest proclaimed nature reserve in Africa, 1895.'],
 ['seed-pt-11','Voortrekker Monument',-25.7761,28.1758,'Granite monument on its hill south of the city.'],
 ['seed-pt-12','Freedom Park',-25.7594,28.1858,'Memorial and museum on Salvokop, facing the Monument.'],
],
cpt:[
 ['seed-cpt-1','Table Mountain',-33.9628,18.4098,'The flat-topped massif above the city.'],
 ['seed-cpt-2','Cape Point',-34.3568,18.4970,'The rocky headland at the peninsula tip.'],
 ['seed-cpt-3','Kirstenbosch Botanical Garden',-33.9881,18.4325,'Garden on the eastern slope of the mountain.'],
 ['seed-cpt-4','Boulders Beach',-34.1975,18.4508,'Granite boulders and a penguin colony.'],
 ['seed-cpt-5','V&A Waterfront',-33.9036,18.4203,'Working harbour and waterfront quarter.'],
 ['seed-cpt-6','Robben Island',-33.8067,18.3667,'Island prison, now a museum.'],
 ['seed-cpt-7','Lions Head',-33.9356,18.3889,'Peak between Table Mountain and the sea.','peak'],
 ['seed-cpt-8','Chapmans Peak Drive',-34.0797,18.3597,'Coastal road cut into the cliff.'],
 ['seed-cpt-9','Bo-Kaap',-33.9214,18.4147,'Quarter of painted houses on Signal Hill slope.','monument'],
 ['seed-cpt-10','Camps Bay Beach',-33.9508,18.3775,'Beach beneath the Twelve Apostles.'],
 ['seed-cpt-11','Company Gardens',-33.9281,18.4172,'The old VOC vegetable garden in the city.'],
 ['seed-cpt-12','Castle of Good Hope',-33.9256,18.4269,'The oldest surviving colonial building in SA.'],
],
jhb:[
 ['seed-jhb-1','Constitution Hill',-26.1908,28.0428,'Former prison, now the Constitutional Court.'],
 ['seed-jhb-2','Apartheid Museum',-26.2378,28.0086,'Museum on the rise and fall of apartheid.'],
 ['seed-jhb-3','Maboneng Precinct',-26.2044,28.0603,'Regenerated quarter east of the CBD.','square'],
 ['seed-jhb-4','Neighbourgoods Market',-26.1994,28.0322,'Saturday market in Braamfontein.'],
 ['seed-jhb-5','Johannesburg Botanical Garden',-26.1594,27.9928,'Garden and dam at Emmarentia.'],
 ['seed-jhb-6','Wits Art Museum',-26.1922,28.0325,'University collection of African art.'],
 ['seed-jhb-7','Carlton Centre',-26.2053,28.0472,'The tallest building in Africa for fifty years.'],
 ['seed-jhb-8','Soweto (Vilakazi Street)',-26.2378,27.9083,'The only street to have housed two Nobel laureates.','monument'],
 ['seed-jhb-9','Melville Koppies',-26.1725,27.9994,'Ridge of remnant highveld and Iron Age sites.'],
 ['seed-jhb-10','Zoo Lake',-26.1608,28.0242,'Public lake and park in Parkview.'],
]};

function seedFor(r){
  return (SEED[r.id]||[]).map(([id,name,lat,lng,blurb,kw])=>({
    id,name,lat,lng,blurb,region:r.name,cats:kw?[kw]:[]
  }));
}

/* ---------- IndexedDB ---------- */
const DB = {
  db:null,
  async open(){
    if(this.db) return this.db;
    this.db = await new Promise((res,rej)=>{
      const r = indexedDB.open('wayfarer',1);
      r.onupgradeneeded = e=>{
        const d = e.target.result;
        if(!d.objectStoreNames.contains('poi'))    d.createObjectStore('poi',{keyPath:'id'});
        if(!d.objectStoreNames.contains('stamp'))  d.createObjectStore('stamp',{keyPath:'id'});
        if(!d.objectStoreNames.contains('disp'))   d.createObjectStore('disp',{keyPath:'id'});
        if(!d.objectStoreNames.contains('queue'))  d.createObjectStore('queue',{keyPath:'id'});
        if(!d.objectStoreNames.contains('meta'))   d.createObjectStore('meta',{keyPath:'k'});
      };
      r.onsuccess = ()=>res(r.result);
      r.onerror   = ()=>rej(r.error);
    });
    return this.db;
  },
  async all(store){
    const d = await this.open();
    return new Promise(res=>{
      const r = d.transaction(store,'readonly').objectStore(store).getAll();
      r.onsuccess = ()=>res(r.result||[]);
      r.onerror   = ()=>res([]);
    });
  },
  async put(store,val){
    const d = await this.open();
    return new Promise(res=>{
      const t = d.transaction(store,'readwrite');
      t.objectStore(store).put(val);
      t.oncomplete = ()=>res(true);
      t.onerror    = ()=>res(false);
    });
  },
  async putMany(store,vals){
    const d = await this.open();
    return new Promise(res=>{
      const t = d.transaction(store,'readwrite');
      const s = t.objectStore(store);
      vals.forEach(v=>s.put(v));
      t.oncomplete = ()=>res(true);
      t.onerror    = ()=>res(false);
    });
  },
  async del(store,key){
    const d = await this.open();
    return new Promise(res=>{
      const t = d.transaction(store,'readwrite');
      t.objectStore(store).delete(key);
      t.oncomplete = ()=>res(true);
      t.onerror    = ()=>res(false);
    });
  },
  async clear(){
    const d = await this.open();
    return new Promise(res=>{
      const t = d.transaction(['poi','stamp','disp','queue','meta'],'readwrite');
      ['poi','stamp','disp','queue','meta'].forEach(s=>t.objectStore(s).clear());
      t.oncomplete = ()=>res(true);
    });
  }
};

/* ---------- State ---------- */
const S = {
  pois:[], stamps:[], disps:[], queue:[],
  me:null, map:null, meMark:null, marks:{}, cached:{},
  spinning:false, nearOpen:null, hidden:new Set(), cacheQ:[], cacheRunning:false, prog:{}, wish:new Set(),
};

/* ---------- Utils ---------- */
const $  = s=>document.querySelector(s);
const $$ = s=>[...document.querySelectorAll(s)];
const uid = ()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);

/* fetch with a deadline — a hung request must never stall the app. */
function fetchT(url, opts, ms){
  const ctl = new AbortController();
  const t = setTimeout(()=>ctl.abort(), ms||20000);
  return fetch(url, {...(opts||{}), signal:ctl.signal}).finally(()=>clearTimeout(t));
}

function metres(a,b,c,d){
  const R=6371000, p=Math.PI/180;
  const dl=(c-a)*p, dg=(d-b)*p;
  const x=Math.sin(dl/2)**2 + Math.cos(a*p)*Math.cos(c*p)*Math.sin(dg/2)**2;
  return 2*R*Math.asin(Math.sqrt(x));
}
function toast(msg){
  const t=$('#toast'); t.textContent=msg; t.classList.add('up');
  clearTimeout(t._x); t._x=setTimeout(()=>t.classList.remove('up'),2600);
}
function buzz(ms){ if(navigator.vibrate) navigator.vibrate(ms); }
function fmtDate(ts){
  return new Date(ts).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
}

/* ---------- Boot ---------- */
async function boot(){
  await DB.open();
  const meta0 = await DB.all('meta');
  const hid = meta0.find(m=>m.k==='hidden');
  S.hidden = new Set(hid ? hid.v : []);
  S.pois   = (await DB.all('poi')).filter(p=>!S.hidden.has(p.id));

  // Merge bundled seeds: plants everything on first run, and quietly adds
  // any new seed places shipped in an update without touching existing data.
  const have = new Set(S.pois.map(p=>p.id));
  const fresh = REGIONS.flatMap(seedFor).filter(p=>!have.has(p.id) && !S.hidden.has(p.id));
  if(fresh.length){
    await DB.putMany('poi', fresh);
    S.pois = S.pois.concat(fresh);
  }

  S.stamps = await DB.all('stamp');
  S.disps  = await DB.all('disp');

  // Clean up duplicate pairs left by earlier versions: same name, under
  // 150 m apart. Priority: seeds > user > Wikidata > OSM points > outlines.
  {
    const rank = id => id.startsWith('seed-')?0 : id.startsWith('user-')?1 : /^Q/.test(id)?2 : id.startsWith('osm-node')?3 : 4;
    const byName = {};
    S.pois.forEach(p=>{ const k=normName(p.name); (byName[k]=byName[k]||[]).push(p); });
    for(const group of Object.values(byName)){
      if(group.length<2) continue;
      group.sort((x,y)=>rank(x.id)-rank(y.id));
      for(let i=1;i<group.length;i++){
        const keeper = group.slice(0,i).find(kq=> metres(kq.lat,kq.lng,group[i].lat,group[i].lng)<150);
        if(keeper){
          await migrateStamps(group[i].id, keeper.id);
          await DB.del('poi', group[i].id);
          S.pois = S.pois.filter(x=>x.id!==group[i].id);
        }
      }
    }
  }

  S.builderOk = (await DB.all('meta')).some(m=>m.k==='builder' && m.v===true);
  { const wm=(await DB.all('meta')).find(m=>m.k==='wish'); S.wish=new Set(wm?wm.v:[]); }
  worldLoad();
  S.queue  = await DB.all('queue');
  // The sync outbox has no server yet; stop it growing without bound.
  if(S.queue.length > 800){
    const drop = S.queue.slice(0, S.queue.length-400);
    for(const q of drop) await DB.del('queue', q.id);
    S.queue = S.queue.slice(-400);
  }
  const meta = await DB.all('meta');
  meta.filter(m=>m.k.startsWith('rgn:')).forEach(m=>S.cached[m.k.slice(4)]=m.v);

  // The map is the one part that can fail (missing lib, no tiles).
  // It must never take the rest of the app down with it.
  try{ initMap(); }
  catch(e){ S.map=null; toast('Map unavailable — collecting still works'); }

  bindNav();
  const vr=document.getElementById('ver'); if(vr) vr.textContent = 'Wayfarer '+APP_VER;
  updateBuilderRow();
  drawRegions();
  paint();
  netWatch();

  // First run: explain, and use the tap as the gesture that asks for location.
  // iOS is happier granting the prompt off a real interaction.
  const seen = (await DB.all('meta')).some(m=>m.k==='onboarded');
  if(!seen){
    card(`
      <div class="grab"></div>
      <div class="kicker">Field manual</div>
      <h2>Collect the places you have been.</h2>
      <div class="note" style="margin-top:16px">
        <b>1. Get close.</b> Walk within ${RANGE_M} metres of a place.<br><br>
        <b>2. Spin the compass.</b> Drag the brass bezel round until it seats. It presses a momento into your passport.<br><br>
        <b>3. Come back.</b> Return another day, file a dispatch describing what the place looks like right then, and it earns you the rare momento.
      </div>
      <div class="note">
        Wayfarer works with no signal. Cache a region under <b>Sync</b> while you have data, and everything keeps working in the field.
      </div>
      <button class="btn" id="ob">Allow location &amp; begin</button>
    `);
    $('#ob').onclick = async()=>{
      await DB.put('meta',{k:'onboarded',v:Date.now()});
      shut();
      watchMe();
    };
  }else{
    watchMe();
  }

  if('serviceWorker' in navigator){
    navigator.serviceWorker.register('sw.js').catch(()=>{});
  }
}

/* ---------- Map ---------- */
/* ---------- Map style: light, warm, Tripadvisor register ----------
   Custom MapLibre style over OpenFreeMap vector tiles. No sprite needed
   (no icon layers); glyphs from OpenFreeMap's font server. */
const OFM_TILEJSON = 'https://tiles.openfreemap.org/planet';
const OFM_GLYPHS   = 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf';

function mapStyle(){
  const road = (id, classes, minz, w) => ([
    {id:id+'_case', type:'line', source:'ofm','source-layer':'transportation', minzoom:minz,
     filter:['all',['match',['geometry-type'],['LineString','MultiLineString'],true,false],
                   ['match',['get','class'],classes,true,false]],
     layout:{'line-cap':'round','line-join':'round'},
     paint:{'line-color':'#E2DED6','line-width':['interpolate',['exponential',1.2],['zoom'],...w.map((x,i)=>i%2?x*1.5+1:x)]}},
    {id, type:'line', source:'ofm','source-layer':'transportation', minzoom:minz,
     filter:['all',['match',['geometry-type'],['LineString','MultiLineString'],true,false],
                   ['match',['get','class'],classes,true,false]],
     layout:{'line-cap':'round','line-join':'round'},
     paint:{'line-color':'#FFFFFF','line-width':['interpolate',['exponential',1.2],['zoom'],...w]}},
  ]);
  return {
    version:8,
    glyphs:OFM_GLYPHS,
    sources:{ofm:{type:'vector', url:OFM_TILEJSON}},
    layers:[
      {id:'bg', type:'background', paint:{'background-color':'#F7F5F1'}},
      {id:'residential', type:'fill', source:'ofm','source-layer':'landuse',
       filter:['==',['get','class'],'residential'],
       paint:{'fill-color':'#F1EEE8','fill-opacity':.6}},
      {id:'wood', type:'fill', source:'ofm','source-layer':'landcover',
       filter:['==',['get','class'],'wood'],
       paint:{'fill-antialias':false,'fill-color':'#CBE6C0','fill-opacity':.5}},
      {id:'grass', type:'fill', source:'ofm','source-layer':'landcover',
       filter:['==',['get','class'],'grass'],
       paint:{'fill-antialias':false,'fill-color':'#D9EDCB','fill-opacity':.45}},
      {id:'sand', type:'fill', source:'ofm','source-layer':'landcover',
       filter:['==',['get','class'],'sand'],
       paint:{'fill-antialias':false,'fill-color':'#F6EFD3','fill-opacity':.8}},
      {id:'park', type:'fill', source:'ofm','source-layer':'park',
       paint:{'fill-color':'#D6EBC8','fill-opacity':.75}},
      {id:'pitch', type:'fill', source:'ofm','source-layer':'landuse',
       filter:['match',['get','class'],['pitch','track','garden'],true,false],
       paint:{'fill-color':'#DDEDD0'}},
      {id:'cemetery', type:'fill', source:'ofm','source-layer':'landuse',
       filter:['==',['get','class'],'cemetery'],
       paint:{'fill-color':'#E3EBD8'}},
      {id:'water', type:'fill', source:'ofm','source-layer':'water',
       filter:['!=',['get','brunnel'],'tunnel'],
       paint:{'fill-color':'#B9DCEF'}},
      {id:'waterway', type:'line', source:'ofm','source-layer':'waterway',
       layout:{'line-cap':'round'},
       paint:{'line-color':'#B9DCEF','line-width':['interpolate',['exponential',1.3],['zoom'],11,.5,20,5]}},
      {id:'aeroway', type:'fill', source:'ofm','source-layer':'aeroway', minzoom:11,
       filter:['match',['geometry-type'],['Polygon','MultiPolygon'],true,false],
       paint:{'fill-color':'#EDEAE4','fill-opacity':.7}},
      {id:'building', type:'fill', source:'ofm','source-layer':'building', minzoom:14,
       paint:{'fill-color':'#ECE8E1','fill-outline-color':'#E0DBD1'}},
      ...road('rd_path',['path','pedestrian'],14,[14,.8,20,7]),
      ...road('rd_service',['service','track'],14,[15,1,20,7]),
      ...road('rd_minor',['minor'],12,[13,.8,14,2.2,20,15]),
      ...road('rd_sec',['secondary','tertiary'],9,[8,.8,14,3.5,20,16]),
      ...road('rd_pri',['primary','trunk'],7,[7,1,14,4.5,20,20]),
      ...road('rd_mwy',['motorway'],5,[6,.8,14,5,20,22]),
      {id:'rail', type:'line', source:'ofm','source-layer':'transportation', minzoom:13,
       filter:['==',['get','class'],'rail'],
       paint:{'line-color':'#D9D4CB','line-width':['interpolate',['exponential',1.4],['zoom'],14,.5,20,2]}},
      {id:'rdname_major', type:'symbol', source:'ofm','source-layer':'transportation_name', minzoom:13,
       filter:['match',['get','class'],['primary','trunk','secondary','tertiary'],true,false],
       layout:{'symbol-placement':'line','text-field':['coalesce',['get','name_en'],['get','name']],
               'text-font':['Noto Sans Regular'],'text-size':11.5,'text-letter-spacing':.02},
       paint:{'text-color':'#8E97A3','text-halo-color':'#FFFFFF','text-halo-width':1.4}},
      {id:'rdname_minor', type:'symbol', source:'ofm','source-layer':'transportation_name', minzoom:15,
       filter:['match',['get','class'],['minor','service'],true,false],
       layout:{'symbol-placement':'line','text-field':['coalesce',['get','name_en'],['get','name']],
               'text-font':['Noto Sans Regular'],'text-size':11,'text-letter-spacing':.02},
       paint:{'text-color':'#9AA2AD','text-halo-color':'#FFFFFF','text-halo-width':1.4}},
      {id:'suburb', type:'symbol', source:'ofm','source-layer':'place', minzoom:10,
       filter:['match',['get','class'],['suburb','neighbourhood','quarter','hamlet','isolated_dwelling'],true,false],
       layout:{'text-field':['coalesce',['get','name_en'],['get','name']],
               'text-font':['Noto Sans Bold'],'text-transform':'uppercase',
               'text-letter-spacing':.22,'text-size':['interpolate',['linear'],['zoom'],10,10,14,12.5],
               'text-max-width':7},
       paint:{'text-color':'#5E6E80','text-halo-color':'rgba(255,255,255,.9)','text-halo-width':1.6}},
      {id:'village', type:'symbol', source:'ofm','source-layer':'place', minzoom:9,
       filter:['match',['get','class'],['village','town'],true,false],
       layout:{'text-field':['coalesce',['get','name_en'],['get','name']],
               'text-font':['Noto Sans Bold'],'text-transform':'uppercase',
               'text-letter-spacing':.18,'text-size':['interpolate',['linear'],['zoom'],9,11,13,14]},
       paint:{'text-color':'#4A5A6C','text-halo-color':'rgba(255,255,255,.9)','text-halo-width':1.6}},
      {id:'city', type:'symbol', source:'ofm','source-layer':'place', minzoom:5,
       filter:['==',['get','class'],'city'],
       layout:{'text-field':['coalesce',['get','name_en'],['get','name']],
               'text-font':['Noto Sans Bold'],'text-size':['interpolate',['exponential',1.2],['zoom'],5,12,10,17],
               'text-letter-spacing':.04},
       paint:{'text-color':'#37475A','text-halo-color':'rgba(255,255,255,.92)','text-halo-width':1.8}},
    ],
  };
}

function initMap(){
  if(typeof maplibregl === 'undefined') throw new Error('maplibre missing');
  S.map = new maplibregl.Map({
    container:'map',
    style:mapStyle(),
    center:[57.57,-20.28], zoom:11,   // Mauritius default
    attributionControl:{compact:true},
    dragRotate:true, pitchWithRotate:false,
  });
  S.map.touchZoomRotate.enableRotation();
  S.map.addControl(new maplibregl.NavigationControl({showZoom:false, showCompass:true, visualizePitch:false}), 'top-right');
  S.map.on('moveend', paintMap);
  S.map.on('zoomend', paintMap);
  S.map.on('error', ()=>{}); // offline tile misses are expected; stay quiet

}

/* Effective spin range: base range widened by GPS accuracy (capped),
   so a weak fix on a phone in a pocket does not lock people out. */
function effR(){ return RANGE_M + Math.min((S.me && S.me.acc)||0, 40); }

function paintMap(){
  if(!S.map) return;
  const b = S.map.getBounds();
  const padX=(b.getEast()-b.getWest())*.3, padY=(b.getNorth()-b.getSouth())*.3;
  const W=b.getWest()-padX, E=b.getEast()+padX, So=b.getSouth()-padY, N=b.getNorth()+padY;
  const c = S.map.getCenter();
  const zoomed = S.map.getZoom() >= 13.5;

  let vis = S.pois.filter(p=> p.lng>=W && p.lng<=E && p.lat>=So && p.lat<=N);
  if(vis.length>150){
    vis = vis.map(p=>({p, d:metres(c.lat,c.lng,p.lat,p.lng)}))
             .sort((x,y)=>x.d-y.d).slice(0,150).map(x=>x.p);
  }
  const show = new Set(vis.map(p=>p.id));

  S.pois.forEach(p=>{
    if(!show.has(p.id)){
      if(S.marks[p.id]){ S.marks[p.id].remove(); delete S.marks[p.id]; }
      return;
    }
    const got  = S.stamps.some(s=>s.poi===p.id);
    const near = S.me && metres(S.me.lat,S.me.lng,p.lat,p.lng) <= effR();
    const landmark = p.id.startsWith('seed-') || /^Q\d+$/.test(p.id);
    const pinCls = 'poi-pin' + (got?' collected':'') + (near?' in-range':'') + ((!got && S.wish.has(p.id))?' wish':'');
    const wrapCls = 'poi-wrap' + ((zoomed && landmark) ? ' lbl-on' : '');

    if(S.marks[p.id]){
      const w = S.marks[p.id].getElement();
      w.className = wrapCls;
      w.firstChild.className = pinCls;
    }else{
      const w = document.createElement('div');
      w.className = wrapCls;
      w.innerHTML = `<div class="${pinCls}" style="position:relative">${kindFor(p.name,p.cats).gl}</div>`+
                    `<div class="poi-label">${esc(p.name)}</div>`;
      w.addEventListener('click', e=>{ e.stopPropagation(); openPlace(p); });
      S.marks[p.id] = new maplibregl.Marker({element:w}).setLngLat([p.lng,p.lat]).addTo(S.map);
    }
  });
}

function watchMe(){
  if(!navigator.geolocation){ strip('No location support on this device',false); return; }

  navigator.geolocation.watchPosition(
    pos=>{
      const first = !S.me;
      S.me = {lat:pos.coords.latitude, lng:pos.coords.longitude, acc:pos.coords.accuracy};

      if(S.map){
        if(S.meMark) S.meMark.setLngLat([S.me.lng,S.me.lat]);
        else{
          const el=document.createElement('div'); el.className='me-dot';
          S.meMark = new maplibregl.Marker({element:el}).setLngLat([S.me.lng,S.me.lat]).addTo(S.map);
        }
        if(first) S.map.jumpTo({center:[S.me.lng,S.me.lat], zoom:15.5});
      }

      // Haptic tap on the shoulder the moment a place becomes spinnable.
      const nowIn = new Set(
        S.pois.filter(p=> metres(S.me.lat,S.me.lng,p.lat,p.lng)<=effR() && cooldownLeft(p.id)===0)
              .map(p=>p.id));
      if(S._wasIn){
        for(const id of nowIn) if(!S._wasIn.has(id)){ buzz([28,70,28]); break; }
      }
      S._wasIn = nowIn;

      paint();
    },
    err=>{
      if(err && err.code===1) strip('Location blocked — enable it in Settings',false);
      else if(!S.me) strip('Searching for GPS…',false);
    },
    {enableHighAccuracy:true, maximumAge:5000, timeout:20000}
  );
}

function strip(txt, ready){
  const el=$('#strip');
  $('#strip-t').textContent = txt;
  el.classList.toggle('ready', !!ready);
  el.classList.toggle('offline', !navigator.onLine);
}

function nearest(){
  if(!S.me || !S.pois.length) return null;
  let best=null, bd=Infinity;
  S.pois.forEach(p=>{
    const d = metres(S.me.lat,S.me.lng,p.lat,p.lng);
    if(d<bd){ bd=d; best=p; }
  });
  return best ? {poi:best, d:bd} : null;
}

/* ---------- Paint everything ---------- */
function paint(){
  paintMap();

  const places = new Set(S.stamps.map(s=>s.poi)).size;
  $('#k-stamp').textContent = S.stamps.length;
  $('#k-place').textContent = places;
  $('#t-stamp').textContent = S.stamps.length;
  $('#t-rare').textContent  = S.stamps.filter(s=>s.tier==='rare').length;
  $('#t-disp').textContent  = S.disps.length;
  $('#s-poi').textContent   = `${S.pois.length} places cached`;
  $('#s-q').textContent     = `${S.queue.length} entries queued`;

  // status strip
  if(!S.me){ strip('Locating…',false); }
  else if(!S.pois.length){ strip('No places cached — open Sync',false); }
  else{
    const n = nearest();
    if(n && n.d<=effR()){
      const cd = cooldownLeft(n.poi.id);
      if(cd>0) strip(`${n.poi.name} — spins again in ${hrs(cd)}`,false);
      else strip(`In range: ${n.poi.name}`,true);
    }else if(n){
      strip(`${Math.round(n.d)} m to ${n.poi.name}`,false);
    }
  }

  paintNear();
  paintBook();
}

/* Three closest places, always reachable even if the map fails.
   Collapsed to a slim pill by default so the map stays clear;
   auto-expands when a place comes into spin range. */
function paintNear(){
  const el = $('#near');
  if(!S.me || !S.pois.length){ el.innerHTML=''; return; }

  const list = S.pois
    .map(p=>({p, d:metres(S.me.lat,S.me.lng,p.lat,p.lng)}))
    .sort((a,b)=>a.d-b.d)
    .slice(0,3);

  const hot  = list.some(({p,d})=> d<=effR() && cooldownLeft(p.id)===0);
  const open = S.nearOpen===null ? hot : S.nearOpen;

  const n0   = list[0];
  const dist = n0.d<1000 ? `${Math.round(n0.d)} m` : `${(n0.d/1000).toFixed(1)} km`;
  const handle = `<div class="near-handle ${hot?'hot':''}" id="nh">
    <span class="chev">${open?'▼':'▲'}</span>
    ${hot ? `<b>${esc(n0.p.name)}</b>&nbsp;· in range`
          : `<b>${esc(n0.p.name)}</b>&nbsp;· ${dist}`}
  </div>`;

  const rows = !open ? '' : list.map(({p,d})=>{
    const k    = kindFor(p.name,p.cats);
    const got  = S.stamps.some(s=>s.poi===p.id);
    const cd   = cooldownLeft(p.id);
    const live = d<=effR() && cd===0;

    let tag;
    if(live)            tag = 'Spin';
    else if(d<=effR()) tag = hrs(cd);
    else                tag = d<1000 ? `${Math.round(d)} m` : `${(d/1000).toFixed(1)} km`;

    return `<div class="nr ${live?'live':''} ${got?'got':''}" data-p="${p.id}">
      <em>${k.gl}</em>
      <div>
        <b>${esc(p.name)}</b>
        <small>${live?'In range':(got?`Collected · ${d<1000?Math.round(d)+' m':(d/1000).toFixed(1)+' km'}`:'Not collected')}</small>
      </div>
      <span class="go">${tag}</span>
    </div>`;
  }).join('');

  const html = handle + rows;
  if(el._h === html) return;   // unchanged: keep the DOM (and any tap) alive
  el._h = html;
  el.innerHTML = html;

  $('#nh').onclick = ()=>{
    S.nearOpen = !open;      // manual choice overrides auto from here on
    paintNear();
  };
  $$('.nr').forEach(n=>{
    n.onclick = ()=>{
      const p = S.pois.find(x=>x.id===n.dataset.p);
      if(p) openPlace(p);
    };
  });
}

function hrs(ms){
  const t=Math.max(1, Math.ceil(ms/60000)), h=Math.floor(t/60), m=t%60;
  return h>0 ? `${h}h ${m}m` : `${m}m`;
}
function cooldownLeft(poiId){
  const mine = S.stamps.filter(s=>s.poi===poiId);
  if(!mine.length) return 0;
  const last = Math.max(...mine.map(s=>s.ts));
  return Math.max(0, COOLDOWN - (Date.now()-last));
}

/* ---------- Scratch-off world map ----------
   Ink-black world, white borders. A country unlocks when you collect your
   first stamp inside it; rub it with a finger to reveal it in green.
   Tiny island nations render as scratchable dots (Mauritius matters). */
const W = {
  geo:null, byIso:{}, feats:[],
  cvs:null, ctx:null, w:0, h:0, dpr:1,
  latMax:84, latMin:-58,
  scratched:new Set(), unlocked:new Set(),
  active:null, strokes:[], samples:{}, centroid:{}, bboxPx:{},
};

async function worldLoad(){
  if(W.loading) return;
  W.loading = true;
  try{
    const r = await fetchT('vendor/world.json', null, 20000);
    W.geo = await r.json();
    W.feats = W.geo.features.filter(f=>f.id!=='ATA');
    W.feats.forEach(f=> W.byIso[f.id]=f);
  }catch(e){ W.geo = null; }
  W.loading = false;
  const m = (await DB.all('meta')).find(x=>x.k==='scratched');
  W.scratched = new Set(m ? m.v : []);
  worldRender();
}

function worldProj(lat,lng){
  return [ (lng+180)/360*W.w, (W.latMax-Math.min(W.latMax,Math.max(W.latMin,lat)))/(W.latMax-W.latMin)*W.h ];
}

function pipRing(x,y,ring){
  let inside=false;
  for(let i=0,jx=ring.length-1;i<ring.length;jx=i++){
    const [xi,yi]=ring[i], [xj,yj]=ring[jx];
    if(((yi>y)!==(yj>y)) && (x < (xj-xi)*(y-yi)/(yj-yi)+xi)) inside=!inside;
  }
  return inside;
}
function pipFeature(f, lng, lat){
  const g=f.geometry;
  const polys = g.type==='Polygon' ? [g.coordinates] : g.coordinates;
  for(const poly of polys){
    if(pipRing(lng,lat,poly[0])){
      let hole=false;
      for(let i=1;i<poly.length;i++) if(pipRing(lng,lat,poly[i])){ hole=true; break; }
      if(!hole) return true;
    }
  }
  return false;
}
function countryOf(lat,lng){
  if(!W.geo) return null;
  for(const f of W.feats) if(pipFeature(f,lng,lat)) return f.id;
  return null;
}

/* Which countries hold at least one of my stamps? */
function worldUnlocked(){
  const out=new Set();
  for(const s of S.stamps){
    if(s._iso===undefined){
      const p=S.pois.find(x=>x.id===s.poi);
      s._iso = p ? countryOf(p.lat,p.lng) : null;
    }
    if(s._iso) out.add(s._iso);
  }
  return out;
}

function featPath(ctx,f,dot){
  if(dot){
    const [cx,cy]=W.centroid[f.id];
    ctx.beginPath(); ctx.arc(cx,cy,9,0,Math.PI*2);
    return;
  }
  ctx.beginPath();
  const g=f.geometry;
  const polys=g.type==='Polygon'?[g.coordinates]:g.coordinates;
  for(const poly of polys) for(const ring of poly){
    ring.forEach(([lng,lat],i)=>{
      const [x,y]=worldProj(lat,lng);
      i?ctx.lineTo(x,y):ctx.moveTo(x,y);
    });
    ctx.closePath();
  }
}

function worldPrep(f){
  // pixel bbox + centroid + dot decision, cached per feature
  if(W.bboxPx[f.id]) return W.bboxPx[f.id];
  let minX=1e9,minY=1e9,maxX=-1e9,maxY=-1e9;
  const g=f.geometry, polys=g.type==='Polygon'?[g.coordinates]:g.coordinates;
  for(const poly of polys) for(const [lng,lat] of poly[0]){
    const [x,y]=worldProj(lat,lng);
    if(x<minX)minX=x; if(x>maxX)maxX=x; if(y<minY)minY=y; if(y>maxY)maxY=y;
  }
  const diag=Math.hypot(maxX-minX,maxY-minY);
  W.centroid[f.id]=[(minX+maxX)/2,(minY+maxY)/2];
  return W.bboxPx[f.id]={minX,minY,maxX,maxY,diag,dot:diag<16};
}

function worldRender(){
  const cvs=document.getElementById('worldmap');
  if(!cvs) return;
  if(!W.geo){
    const cap=document.getElementById('world-cap');
    if(cap) cap.textContent = W.loading ? 'Loading world map…' : 'World map data missing — check vendor/world.json is uploaded';
    return;
  }
  const cssW = cvs.parentElement.clientWidth-20;
  if(cssW<50) return;
  W.dpr = Math.min(2, window.devicePixelRatio||1);
  W.w = cssW; W.h = Math.round(cssW*0.42);
  cvs.width = W.w*W.dpr; cvs.height = W.h*W.dpr;
  cvs.style.height = W.h+'px';
  W.cvs=cvs; W.ctx=cvs.getContext('2d');
  const x=W.ctx; x.setTransform(W.dpr,0,0,W.dpr,0,0);
  W.bboxPx={}; W.centroid={};

  W.unlocked = worldUnlocked();

  x.fillStyle='#141B18'; x.fillRect(0,0,W.w,W.h);
  for(const f of W.feats){
    const bp=worldPrep(f);
    const done=W.scratched.has(f.id);
    const open=W.unlocked.has(f.id)&&!done;
    featPath(x,f,bp.dot);
    if(done){ x.fillStyle='#00AA6C'; x.fill(); x.strokeStyle='#34E0A1'; x.lineWidth=.8; x.stroke(); }
    else{
      x.fillStyle='#0C110F'; x.fill();
      x.strokeStyle=open?'#34E0A1':'rgba(255,255,255,.55)';
      x.lineWidth=open?1.4:.55; x.stroke();
    }
  }

  const cap=document.getElementById('world-cap');
  if(cap){
    const pend=[...W.unlocked].filter(i=>!W.scratched.has(i));
    cap.innerHTML = pend.length
      ? `Scratch to reveal: <b>${esc(pend.map(i=>W.byIso[i].properties.name).join(', '))}</b>`
      : `Your world · <b>${W.scratched.size}</b> ${W.scratched.size===1?'country':'countries'} revealed`;
  }

  if(!cvs._wired){
    cvs._wired=true;
    cvs.addEventListener('pointerdown', worldDown);
    cvs.addEventListener('pointermove', worldMove);
    cvs.addEventListener('pointerup',   worldUp);
    cvs.addEventListener('pointercancel', worldUp);
  }
}

function worldXY(e){
  const r=W.cvs.getBoundingClientRect();
  return [e.clientX-r.left, e.clientY-r.top];
}
function worldDown(e){
  if(!W.geo) return;
  const [px,py]=worldXY(e);
  // which unlocked, unscratched country is under the finger?
  const lng = px/W.w*360-180;
  const lat = W.latMax - py/W.h*(W.latMax-W.latMin);
  for(const iso of W.unlocked){
    if(W.scratched.has(iso)) continue;
    const f=W.byIso[iso], bp=worldPrep(f);
    const hit = bp.dot
      ? Math.hypot(px-W.centroid[iso][0], py-W.centroid[iso][1])<16
      : pipFeature(f,lng,lat);
    if(hit){
      W.active=iso; W.strokes=[];
      if(!W.samples[iso]) W.samples[iso]=worldSamples(f,bp);
      e.preventDefault();
      try{ W.cvs.setPointerCapture(e.pointerId); }catch(err){ /* capture is a nicety, not a need */ }
      return;
    }
  }
}
function worldSamples(f,bp){
  // interior points to measure scratch coverage
  if(bp.dot) return [W.centroid[f.id]];
  const pts=[];
  for(let t=0;t<400 && pts.length<90;t++){
    const px=bp.minX+Math.random()*(bp.maxX-bp.minX);
    const py=bp.minY+Math.random()*(bp.maxY-bp.minY);
    const lng=px/W.w*360-180, lat=W.latMax-py/W.h*(W.latMax-W.latMin);
    if(pipFeature(f,lng,lat)) pts.push([px,py]);
  }
  return pts.length?pts:[W.centroid[f.id]];
}
function worldMove(e){
  if(!W.active) return;
  e.preventDefault();
  const [px,py]=worldXY(e);
  W.strokes.push([px,py]);
  // paint the rub, clipped to the country
  const f=W.byIso[W.active], bp=worldPrep(f), x=W.ctx;
  x.save();
  featPath(x,f,bp.dot); x.clip();
  x.strokeStyle='#00AA6C'; x.lineCap='round'; x.lineWidth=bp.dot?10:22;
  const n=W.strokes.length;
  if(n>1){
    x.beginPath();
    x.moveTo(...W.strokes[n-2]); x.lineTo(...W.strokes[n-1]); x.stroke();
  }
  x.restore();
  if(n%6===0) buzz(4);
  // coverage check
  const pts=W.samples[W.active];
  const R=bp.dot?14:24;
  let cov=0;
  for(const [sx,sy] of pts){
    for(let i=Math.max(0,n-400);i<n;i++){
      const [kx,ky]=W.strokes[i];
      if((kx-sx)*(kx-sx)+(ky-sy)*(ky-sy) < R*R){ cov++; break; }
    }
  }
  if(cov/pts.length >= .55) worldComplete();
}
async function worldComplete(){
  const iso=W.active; W.active=null;
  W.scratched.add(iso);
  await DB.put('meta',{k:'scratched', v:[...W.scratched]});
  buzz([30,60,30,60,140]);
  toast(`Revealed: ${W.byIso[iso].properties.name}`);
  worldRender();
}
function worldUp(){ W.active=null; }

/* ---------- Passport ---------- */
function paintBook(){
  if(!W.geo && !W.loading) worldLoad();   // retry if the data failed earlier
  worldRender();
  const body=$('#book-body');
  if(!S.stamps.length){
    $('#book-sub').textContent='No entries';
    body.innerHTML = `<div class="blank"><em>❑</em>
      <h3>Nothing collected yet</h3>
      <p>Walk within ${RANGE_M} metres of a place on the map, then spin the compass to press your first stamp.</p></div>`;
    return;
  }

  const places = new Set(S.stamps.map(s=>s.poi)).size;
  $('#book-sub').textContent = `${places} place${places===1?'':'s'} · ${S.stamps.length} stamp${S.stamps.length===1?'':'s'}`;

  // group by region label
  const grp={};
  S.stamps.forEach(s=>{
    const p = S.pois.find(x=>x.id===s.poi);
    const g = (p && p.region) || 'Elsewhere';
    (grp[g] = grp[g] || []).push(s);
  });

  body.innerHTML = Object.entries(grp).map(([g,list])=>{
    // One tile per PLACE: the place is the stamp, the momento is the badge.
    const byPoi={};
    list.forEach(s=>{
      const b = byPoi[s.poi] = byPoi[s.poi] || {poi:s.poi, n:0, rare:false, ts:0, gl:s.gl, fallback:s.name};
      b.n++;
      if(s.tier==='rare') b.rare = true;
      if(s.ts>b.ts) b.ts = s.ts;
    });
    const tiles = Object.values(byPoi).sort((a,b)=>b.ts-a.ts).map(b=>{
      const p   = S.pois.find(x=>x.id===b.poi);
      const img = p ? bestImg(p) : null;
      const nm  = p ? p.name : b.fallback;
      return `<div class="stamp ${b.rare?'rare':''}" data-poi="${b.poi}">
        ${img ? `<img src="${esc(img)}" alt="" loading="lazy" onerror="this.remove()">`
              : `<span class="ph">${b.gl}</span>`}
        <span class="shade"></span>
        ${b.n>1?`<span class="ct">×${b.n}</span>`:''}
        <span class="pnm">${esc(nm)}</span>
        <span class="itm">${b.gl}</span>
      </div>`;
    }).join('');
    return `<div class="grp">${g}</div><div class="stamps">${tiles}</div>`;
  }).join('');

  // Wish list: the places still waiting for you
  const wishes = [...S.wish].map(id=>S.pois.find(p=>p.id===id)).filter(Boolean);
  if(wishes.length){
    body.innerHTML += `<div class="grp">Wish list</div>` + wishes.map(p=>{
      const k=kindFor(p.name,p.cats);
      const got=S.stamps.some(s=>s.poi===p.id);
      return `<div class="sr" data-w="${p.id}" style="background:#fff;border-radius:12px;margin-bottom:8px;box-shadow:var(--shadow)">
        <em>${k.gl}</em>
        <div><b>${esc(p.name)}</b><small>${esc(p.region||'')}${got?' · collected ✓':''}</small></div>
        <span style="color:var(--amber)">♥</span>
      </div>`;
    }).join('');
    $$('#book-body .sr[data-w]').forEach(el=>{
      el.onclick=()=>{ const p=S.pois.find(x=>x.id===el.dataset.w); if(p) flyToPlace(p); };
    });
  }

  $$('.stamp').forEach(el=>{
    el.onclick = ()=>{
      const p = S.pois.find(x=>x.id===el.dataset.poi);
      if(p) openPlace(p);
      else toast('That place is no longer on the map — the stamp is yours to keep');
    };
  });
}

/* ---------- Place sheet ---------- */
function openPlace(p){
  const d    = S.me ? metres(S.me.lat,S.me.lng,p.lat,p.lng) : null;
  const near = d!==null && d<=effR();
  const mine = S.stamps.filter(s=>s.poi===p.id);
  const cd   = cooldownLeft(p.id);
  const logs = S.disps.filter(x=>x.poi===p.id).sort((a,b)=>b.ts-a.ts);
  const k    = kindFor(p.name,p.cats);

  let action;
  if(!near){
    action = `<div class="note">You are ${d===null?'—':Math.round(d)} m away. Get within ${Math.round(effR())} m to spin.</div>
              <button class="btn ghost" onclick="shut()">Close</button>`;
  }else if(cd>0){
    action = `<div class="note">Spun already. The compass resets in <b>${hrs(cd)}</b>.<br><br>
                Come back and file a dispatch, describing what this place looks like right then, to earn the rare momento.</div>
              <button class="btn ghost" onclick="shut()">Close</button>`;
  }else if(mine.length===0){
    action = `<button class="btn" onclick="spinUp('${p.id}',false)">Spin the compass</button>`;
  }else{
    action = `<div class="note">You have been here before. File a dispatch with this spin and it earns the rare <b>${k.rare}</b>.</div>
              <button class="btn seal" onclick="spinUp('${p.id}',true)">Spin &amp; file dispatch</button>
              <button class="btn ghost" onclick="spinUp('${p.id}',false)">Spin only</button>`;
  }

  card(`
    <div class="grab"></div>
    <div class="hero" id="hero">${heroImg(p)}</div>
    <div class="wishrow">
      <div class="kicker">${p.region||'Unmapped'} · ${d===null?'':Math.round(d)+' m away'}</div>
      <button class="wishbtn ${S.wish.has(p.id)?'on':''}" id="wish-${p.id}" onclick="toggleWish('${p.id}')">${S.wish.has(p.id)?'♥ Saved':'♡ Wish list'}</button>
    </div>
    <h2>${esc(p.name)}</h2>
    ${p.blurb?`<p style="font-size:13.5px;line-height:1.6;color:var(--grey);margin:10px 0 6px">${esc(p.blurb)}</p>`:''}
    <div id="about" class="about"></div>
    ${mine.length?`<div class="kicker" style="margin-bottom:10px">Visited ${mine.length}× · ${mine.filter(s=>s.tier==='rare').length} rare</div>`:''}
    ${action}
    ${S.builderOk?`<div style="display:flex;gap:8px;margin-top:4px">
        <button class="btn ghost" style="flex:1" onclick="editPlace('${p.id}')">Edit</button>
        <button class="btn ghost" style="flex:1" onclick="startMove('${p.id}')">Move pin</button>
        <button class="btn ghost" style="flex:1" onclick="${p.id.startsWith('user-')?`removePlace('${p.id}')`:`hidePlace('${p.id}')`}">Delete</button>
      </div>`:''}
    ${logs.length?`<div class="grp" style="margin-top:24px">Dispatches</div>
      ${logs.map(l=>`<div class="disp">
        <time>${fmtDate(l.ts)}</time>
        ${l.text?`<p>${esc(l.text)}</p>`:''}
        ${l.img?`<img src="${l.img}" alt="">`:''}
      </div>`).join('')}`:''}
  `);
  loadAbout(p);
}

/* The best image we currently hold for a place, as an <img> or nothing. */
function bestImg(p){
  return p.img || (p.about && p.about.thumb) || null;
}
function heroImg(p){
  const u = bestImg(p);
  return u ? `<img src="${esc(u)}" alt="" loading="lazy" onerror="this.parentNode.innerHTML=''">` : '';
}
function refreshHero(p){
  const h = document.getElementById('hero');
  if(h) h.innerHTML = heroImg(p);
}

/* Last resort: a Wikimedia Commons photo taken near these coordinates.
   Runs only when nothing else produced an image; the result is stored,
   and the photo itself is cached by the service worker after first view. */
async function commonsNearby(p){
  const u = 'https://commons.wikimedia.org/w/api.php?action=query&generator=geosearch'
    + `&ggscoord=${p.lat}%7C${p.lng}&ggsradius=250&ggslimit=1&ggsnamespace=6`
    + '&prop=imageinfo&iiprop=url&iiurlwidth=640&format=json&origin=*';
  const r = await fetchT(u, null, 12000);
  if(!r.ok) return null;
  const j = await r.json();
  const pages = j.query && j.query.pages ? Object.values(j.query.pages) : [];
  const ii = pages[0] && pages[0].imageinfo && pages[0].imageinfo[0];
  return ii ? (ii.thumburl || ii.url) : null;
}

/* ---------- About: read about the place ----------
   Priority: a stored article (offline-safe) → live Wikipedia lookup,
   persisted into the place record on first success → graceful fallbacks.
   Builder links and official websites render as buttons either way. */
function aboutLinks(p){
  let out='';
  if(p.url) out += `<a class="linkbtn" href="${esc(p.url)}" target="_blank" rel="noopener">${p.id.startsWith('user-')?'Read more':'Official website'} ↗</a>`;
  if(p.about && p.about.url) out += `<a class="linkbtn" href="${esc(p.about.url)}" target="_blank" rel="noopener">Wikipedia ↗</a>`;
  return out ? `<div class="linkrow">${out}</div>` : '';
}
function renderAbout(p){
  const el = document.getElementById('about'); if(!el) return;
  const ab = p.about;
  el.innerHTML =
    (ab && ab.extract ? `<p class="about-txt">${esc(ab.extract)}</p>` : '')
    + aboutLinks(p);
  refreshHero(p);
}
async function loadAbout(p){
  const el = document.getElementById('about'); if(!el) return;
  if(p.about && p.about.extract){ renderAbout(p); return; }
  if(p.id.startsWith('user-')){ renderAbout(p); return; }   // builder places: link only
  if(!navigator.onLine){
    el.innerHTML = catFallback(p) + `<p class="about-txt muted">Connect to look this place up — articles stay readable offline afterwards.</p>` + aboutLinks(p);
    return;
  }
  el.innerHTML = `<p class="about-txt muted">Looking up this place…</p>` + aboutLinks(p);

  // Title candidates: explicit wiki tag first, then the name, then the name
  // stripped of camp/gate suffixes (Kruger's "Skukuza Rest Camp" → "Skukuza").
  const cands = [];
  if(p.wiki) cands.push(p.wiki.replace(/^en:/,''));
  cands.push(p.name);
  const stripped = p.name.replace(/ (Rest Camp|Picnic Site|Gate|Beach|Mall)$/i,'');
  if(stripped !== p.name) cands.push(stripped);

  for(const t of cands){
    try{
      const r = await fetchT('https://en.wikipedia.org/api/rest_v1/page/summary/'+encodeURIComponent(t), null, 12000);
      if(!r.ok) continue;
      const j = await r.json();
      if(!j.extract || (j.type||'').includes('disambiguation')) continue;
      // A guessed title is only trusted if Wikipedia's own coordinates for the
      // article sit near this place. Kills "Balloon"-type generic matches:
      // topic articles have no coordinates and are rejected outright.
      const trusted = p.wiki && t === p.wiki.replace(/^en:/,'');
      if(!trusted){
        const gc = j.coordinates;
        if(!gc) continue;
        if(metres(p.lat, p.lng, gc.lat, gc.lon) > 60000) continue;
      }
      p.about = {
        title: j.title,
        extract: j.extract,
        url: j.content_urls && j.content_urls.desktop ? j.content_urls.desktop.page : undefined,
        thumb: j.thumbnail ? j.thumbnail.source : undefined,
      };
      await DB.put('poi', p);   // readable offline from now on
      renderAbout(p);
      refreshHero(p);
      if(!bestImg(p)) tryCommonsImg(p);
      return;
    }catch(e){ break; }
  }
  el.innerHTML = catFallback(p) + aboutLinks(p);
  if(!bestImg(p)) tryCommonsImg(p);
}

/* The floor of information: what kind of place this is and where. */
function catFallback(p){
  const k = kindFor(p.name, p.cats);
  return `<p class="about-txt muted">${k.gl} ${k.cat} · ${esc(p.region||'Unmapped')}. No article found for this place yet.</p>`;
}

async function tryCommonsImg(p){
  if(!navigator.onLine) return;
  try{
    const u = await commonsNearby(p);
    if(!u) return;
    p.img = u;
    await DB.put('poi', p);
    refreshHero(p);
  }catch(e){}
}
function esc(s){ const d=document.createElement('div'); d.textContent=s; return d.innerHTML; }

/* ---------- The spin ---------- */
function spinUp(poiId, wantRare){
  const p = S.pois.find(x=>x.id===poiId);
  if(!p) return;
  const k = kindFor(p.name,p.cats);

  card(`
    <div class="grab"></div>
    <div class="kicker">${p.region||''}</div>
    <h2>${esc(p.name)}</h2>
    <div class="dial-wrap" id="dial">
      <div class="dial-ring"></div>
      <div class="notches" id="notches"></div>
      <svg class="dial-prog" viewBox="0 0 236 236">
        <circle cx="118" cy="118" r="110" id="arc"
          stroke-dasharray="691" stroke-dashoffset="691"></circle>
      </svg>
      <div class="dial-face">
        <div class="needle" id="needle">🧭</div>
        <div class="lbl" id="dlbl">Drag the bezel<br>round and round</div>
      </div>
    </div>
    <button class="btn ghost" onclick="shut()">Cancel</button>
  `);

  // engrave notches
  const nn = $('#notches');
  for(let i=0;i<36;i++){
    const d=document.createElement('div');
    d.className = 'notch' + (i%9===0?' card-pt':'');
    d.style.transform = `translateX(-50%) rotate(${i*10}deg)`;
    nn.appendChild(d);
  }

  const dial=$('#dial'), arc=$('#arc'), needle=$('#needle'), lbl=$('#dlbl');
  let turned=0, last=null, done=false;
  S.spinning=true;

  const angle = (e)=>{
    const r  = dial.getBoundingClientRect();
    const cx = r.left + r.width/2, cy = r.top + r.height/2;
    const t  = e.touches ? e.touches[0] : e;
    return Math.atan2(t.clientY-cy, t.clientX-cx) * 180/Math.PI;
  };

  const move = (e)=>{
    if(done) return;
    e.preventDefault();
    const a = angle(e);
    if(last!==null){
      let dd = a-last;
      if(dd>180) dd-=360; if(dd<-180) dd+=360;
      turned += Math.abs(dd);

      const pc = Math.min(1, turned/SPIN_ARC);
      arc.style.strokeDashoffset = 691*(1-pc);
      needle.style.transform = `rotate(${turned}deg)`;

      if(turned > 90)  lbl.innerHTML = 'Keep turning';
      if(turned > 450) lbl.innerHTML = 'Almost seated';
      if(pc>=1){
        done=true; S.spinning=false;
        dial.classList.add('done');
        buzz([14,40,90]);
        setTimeout(()=> wantRare ? askDispatch(p,k) : award(p,k,false,null), 380);
      }else if(Math.floor(turned/45) !== Math.floor((turned-Math.abs(dd))/45)){
        buzz(7); // detent click
      }
    }
    last=a;
  };
  const up = ()=>{ last=null; };

  dial.addEventListener('touchstart', e=>{last=angle(e)}, {passive:true});
  dial.addEventListener('touchmove',  move, {passive:false});
  dial.addEventListener('touchend',   up);
  dial.addEventListener('mousedown',  e=>{last=angle(e); dial._drag=true});
  if(S._spinH){
    window.removeEventListener('mousemove', S._spinH.m);
    window.removeEventListener('mouseup',   S._spinH.u);
  }
  S._spinH = { m: e=>{ if(dial._drag) move(e) }, u: ()=>{dial._drag=false; up()} };
  window.addEventListener('mousemove', S._spinH.m);
  window.addEventListener('mouseup',   S._spinH.u);
}

/* ---------- Dispatch (unlocks rare) ---------- */
function askDispatch(p,k){
  card(`
    <div class="grab"></div>
    <div class="kicker">Dispatch · ${fmtDate(Date.now())}</div>
    <h2>What does ${esc(p.name)} look like right now?</h2>
    <div class="note">Describe it as you find it today. The weather, the crowd, the light. Filing this dispatch earns you the <b>${k.rare}</b>.</div>
    <div class="field">
      <label>The scene</label>
      <textarea id="dt" rows="4" placeholder="Low tide, wind off the water, nobody here but two fishermen…"></textarea>
    </div>
    <div class="field">
      <label>Photograph (optional)</label>
      <input type="file" id="df" accept="image/*" capture="environment" hidden>
      <div class="shot" id="dshot" onclick="document.getElementById('df').click()">Tap to add a photo</div>
    </div>
    <button class="btn seal" id="dgo" disabled>File dispatch</button>
    <button class="btn ghost" onclick="award(S._p,S._k,false,null)">Skip, take the common</button>
  `);
  S._p=p; S._k=k;

  let img=null;
  const go=$('#dgo'), txt=$('#dt');
  txt.oninput = ()=>{ go.disabled = txt.value.trim().length<12 && !img; };

  $('#df').onchange = e=>{
    const f=e.target.files[0]; if(!f) return;
    const r=new FileReader();
    r.onload = ()=>{
      // downscale so IndexedDB stays small offline
      const im=new Image();
      im.onload = ()=>{
        const c=document.createElement('canvas');
        const sc=Math.min(1, 1000/Math.max(im.width,im.height));
        c.width=im.width*sc; c.height=im.height*sc;
        c.getContext('2d').drawImage(im,0,0,c.width,c.height);
        img = c.toDataURL('image/jpeg',0.72);
        $('#dshot').innerHTML = `<img src="${img}" alt="">`;
        go.disabled = false;
      };
      im.src = r.result;
    };
    r.readAsDataURL(f);
  };

  go.onclick = ()=>{
    const text = txt.value.trim();
    const rec = {id:uid(), poi:p.id, ts:Date.now(), text, img};
    DB.put('disp',rec);
    DB.put('queue',{id:uid(), kind:'dispatch', body:rec});
    S.disps.push(rec);
    S.queue.push({id:uid(), kind:'dispatch', body:rec});
    award(p,k,true,rec);
  };
}

/* ---------- Award ---------- */
function award(p,k,viaDispatch,disp){
  // Rare only via dispatch on a repeat visit. Otherwise common.
  const repeat = S.stamps.some(s=>s.poi===p.id);
  const rare   = viaDispatch && repeat;

  const st = {
    id:uid(), poi:p.id, ts:Date.now(),
    tier: rare?'rare':'common',
    name: rare?k.rare:k.com,
    gl:   k.gl,
    disp: disp?disp.id:null,
  };
  DB.put('stamp',st);
  DB.put('queue',{id:uid(), kind:'stamp', body:st});
  S.stamps.push(st);
  S.queue.push({id:uid(), kind:'stamp', body:st});

  buzz(rare?[24,60,24,60,120]:[18,50]);

  card(`
    <div class="grab"></div>
    <div class="reveal">
      <div class="wax ${rare?'':'common'}">${k.gl}</div>
      <div class="tier ${rare?'rare':''}">${rare?'Rare momento':'Momento'}</div>
      <h3>${st.name}</h3>
      <p>${k.line}<br><span style="opacity:.7">${esc(p.name)} · ${fmtDate(st.ts)}</span></p>
    </div>
    ${!repeat?`<div class="note" style="margin-top:20px">First visit logged. Return another day and file a dispatch to unlock the <b>${k.rare}</b>.</div>`:''}
    <button class="btn" onclick="shut();go('v-book')">Open passport</button>
    <button class="btn ghost" onclick="shut()">Back to the field</button>
  `);
  paint();
}

/* ---------- Region caching ---------- */
function drawRegions(){
  $('#regions').innerHTML = REGIONS.map(r=>{
    const c  = S.cached[r.id];
    const st = S.prog[r.id];
    const busy = st && ['queued','places','tiles'].includes(st.phase);
    const inR = S.pois.filter(p=> p.lat>=r.bbox[0]&&p.lat<=r.bbox[2]&&p.lng>=r.bbox[1]&&p.lng<=r.bbox[3]).length;
    let sub;
    if(busy) sub = progText(r.id);
    else if(st && st.phase==='done' && st.note) sub = `${inR} places · ${st.note}`;
    else if(c) sub = `${inR} places · cached ${fmtDate(c.ts)} · tap to browse`;
    else sub = inR ? `${inR} places · not cached — tap to browse` : 'Not cached';
    return `<div class="row" data-r="${r.id}" onclick="regionPlaces('${r.id}')" style="cursor:pointer">
      <em>${r.icon}</em>
      <div>
        <b>${r.name}</b>
        <small>${sub}</small>
        ${busy?`<div class="rprog ${st.phase==='places'?'pulse':''}"><i style="width:${st.phase==='places'?38:st.pct}%"></i></div>`:''}
      </div>
      <button class="btn" style="width:auto;margin:0;padding:9px 13px" ${busy?'disabled':''}
        onclick="event.stopPropagation();queueRegion('${r.id}')">${busy?'…':(c?'Refresh':'Cache')}</button>
    </div>`;
  }).join('');
}

/* Browse the POIs inside a region, tap one to fly there. */
function regionPlaces(id){
  const r = REGIONS.find(x=>x.id===id); if(!r) return;
  const inR = S.pois
    .filter(p=> p.lat>=r.bbox[0]&&p.lat<=r.bbox[2]&&p.lng>=r.bbox[1]&&p.lng<=r.bbox[3])
    .sort((a,b)=>a.name.localeCompare(b.name));
  const MAX = 300;
  const rows = inR.slice(0,MAX).map(p=>{
    const k = kindFor(p.name,p.cats);
    const got = S.stamps.some(s=>s.poi===p.id);
    return `<div class="sr" data-p="${p.id}">
      <em>${k.gl}</em>
      <div><b>${esc(p.name)}</b><small>${k.cat}</small></div>
      ${got?'<span class="tick">✓</span>':''}
    </div>`;
  }).join('');
  card(`
    <div class="grab"></div>
    <div class="kicker">${r.icon} ${r.name}</div>
    <h2>${inR.length} place${inR.length===1?'':'s'} here</h2>
    ${inR.length? '' : `<div class="note">Nothing cached for this region yet. Tap Cache on the Sync page to pull its places.</div>`}
    <div style="margin-top:10px">${rows}</div>
    ${inR.length>MAX?`<p class="about-txt muted" style="margin-top:10px">…and ${inR.length-MAX} more. Use the map search to find a specific one.</p>`:''}
    <button class="btn ghost" onclick="shut()">Close</button>
  `);
  $$('#card .sr').forEach(el=>{
    el.onclick = ()=>{ const p=S.pois.find(x=>x.id===el.dataset.p); if(p) flyToPlace(p); };
  });
}

function flyToPlace(p){
  shut();
  go('v-map');
  if(S.map) S.map.easeTo({center:[p.lng,p.lat], zoom:Math.max(S.map.getZoom(),16), duration:600});
  setTimeout(()=>openPlace(p), 650);
}

/* Tap as many regions as you like: they download one after another in tap
   order, each row showing live progress. No babysitting required. */
function queueRegion(id){
  if(!navigator.onLine){ toast('Need a connection to cache'); return; }
  const st = S.prog[id];
  if(st && (st.phase==='queued' || st.phase==='places' || st.phase==='tiles')) return;
  S.cacheQ.push(id);
  S.prog[id] = {phase:'queued', pct:0};
  drawRegions();
  runCacheQ();
}
async function runCacheQ(){
  if(S.cacheRunning) return;
  S.cacheRunning = true;
  while(S.cacheQ.length){
    const id = S.cacheQ.shift();
    try{ await cacheRegion(id, (phase,pct,note)=>{ S.prog[id]={phase,pct,note}; paintProg(id); }); }
    catch(e){ S.prog[id]={phase:'error',pct:0}; }
    drawRegions();
  }
  S.cacheRunning = false;
  if(Object.values(S.prog).some(p=>p.phase==='done')) toast('Downloads finished');
}
function paintProg(id){
  const bar = document.querySelector(`[data-r="${id}"] .rprog`);
  const sm  = document.querySelector(`[data-r="${id}"] small`);
  const st  = S.prog[id];
  if(!bar || !st){ drawRegions(); return; }
  bar.classList.toggle('pulse', st.phase==='places');
  bar.firstElementChild.style.width = (st.phase==='places'?38:st.pct)+'%';
  if(sm) sm.textContent = progText(id);
}
function progText(id){
  const st = S.prog[id];
  if(!st) return '';
  if(st.phase==='queued') return 'Queued…';
  if(st.phase==='places') return 'Fetching places…';
  if(st.phase==='tiles')  return `Downloading map · ${st.pct}%`;
  if(st.phase==='error')  return 'Failed — tap Cache to retry';
  return '';
}

async function cacheRegion(id, onProg){
  const r = REGIONS.find(x=>x.id===id);
  onProg = onProg || (()=>{});
  onProg('places', 0);

  try{
    const [wikiR, osmR] = await Promise.allSettled([fetchWikidata(r), fetchOSM(r)]);
    const wiki = wikiR.status==='fulfilled' ? wikiR.value : [];
    let   osm  = osmR.status==='fulfilled'  ? osmR.value  : [];
    const problems = [];
    if(wikiR.status!=='fulfilled') problems.push('Wikidata busy');
    if(osmR.status!=='fulfilled')  problems.push('OpenStreetMap busy');
    // A named node (statue, gate, artwork) is a better anchor than an area
    // centroid, so nodes go first and win the name-dedupe.
    osm = osm.sort((x,y)=> (x.id.startsWith('osm-node')?0:1) - (y.id.startsWith('osm-node')?0:1));

    let pois = mergePOIs(seedFor(r), wiki, osm).filter(p=>!S.hidden.has(p.id));
    if(!pois.length){ S.prog[id]={phase:'done',pct:100,note:'No places found'}; return; }

    // Never let a Refresh overwrite a place the builder has edited.
    const editedIds = new Set(S.pois.filter(q=>q.edited).map(q=>q.id));
    pois = pois.filter(p=>!editedIds.has(p.id));

    // Cross-run dedupe: this region may overlap one cached earlier. Same
    // name within 150 m of an existing place is the same place — keep the
    // better anchor (a point beats an area outline).
    const kept=[];
    for(const p of pois){
      const dup = S.pois.find(q=> q.id!==p.id
        && normName(q.name)===normName(p.name)
        && metres(p.lat,p.lng,q.lat,q.lng) < 150);
      if(!dup){ kept.push(p); continue; }
      const pIsNode = p.id.startsWith('osm-node'), dupProtected = /^(seed-|user-|Q)/.test(dup.id);
      if(pIsNode && !dupProtected && !dup.id.startsWith('osm-node')){
        await migrateStamps(dup.id, p.id);   // the survivor inherits history
        await DB.del('poi', dup.id);
        S.pois = S.pois.filter(x=>x.id!==dup.id);
        if(S.marks[dup.id]){ S.marks[dup.id].remove(); delete S.marks[dup.id]; }
        kept.push(p);
      } // otherwise the existing one stands; drop the incoming twin
    }
    pois = kept;
    if(!pois.length){ S.prog[id]={phase:'done',pct:100,note:'Nothing new'}; return; }

    await DB.putMany('poi',pois);
    // merge into memory
    pois.forEach(p=>{
      const i = S.pois.findIndex(x=>x.id===p.id);
      if(i>=0) S.pois[i]=p; else S.pois.push(p);
    });

    const meta = {k:'rgn:'+id, v:{n:pois.length, ts:Date.now()}};
    await DB.put('meta',meta);
    S.cached[id] = meta.v;

    // warm the tiles for this bbox so the map draws offline —
    // a tile failure must never mask the places that just saved.
    onProg('tiles', 0);
    let tilesOk = true;
    try{ await cacheTiles(r, pct=>onProg('tiles', pct)); }catch(e){ tilesOk = false; }

    drawRegions();
    paint();
    const calm = document.getElementById('v-map').classList.contains('active')
      && !document.getElementById('scrim').classList.contains('open')
      && !document.body.classList.contains('placing');
    if(S.map && calm && !S.cacheQ.length) S.map.fitBounds([[r.bbox[1],r.bbox[0]],[r.bbox[3],r.bbox[2]]],{padding:40});

    if(!tilesOk) problems.push('map tiles failed');
    S.prog[id] = {phase:'done', pct:100,
      note: problems.length ? `${problems.join(', ')} — Refresh to retry` : null};
  }catch(e){
    S.prog[id] = {phase:'error', pct:0};
  }
}

/* OSM Overpass: the dense layer. Everything mappers have tagged as
   worth visiting — parks, churches, monuments, viewpoints, artworks. */
async function fetchOSM(r){
  const [s,w,n,e] = r.bbox;
  const bb = `(${s},${w},${n},${e})`;
  const q = `[out:json][timeout:90];
(
  nwr["tourism"~"attraction|museum|viewpoint|artwork|gallery|zoo|theme_park|aquarium"]["name"]${bb};
  nwr["historic"]["name"]${bb};
  nwr["leisure"~"^(park|nature_reserve|garden|stadium)$"]["name"]${bb};
  nwr["amenity"~"^(place_of_worship|theatre|marketplace|fountain|arts_centre)$"]["name"]${bb};
  nwr["natural"~"^(peak|waterfall|beach|spring)$"]["name"]${bb};
  nwr["man_made"~"^(lighthouse|obelisk|observatory)$"]["name"]${bb};
);
out center 700;`;

  // The public Overpass server rate-limits; fall back to a mirror.
  const eps = ['https://overpass-api.de/api/interpreter',
               'https://overpass.kumi.systems/api/interpreter'];
  let res = null;
  for(const ep of eps){
    try{
      res = await fetchT(ep,{method:'POST',
        headers:{'Content-Type':'application/x-www-form-urlencoded'},
        body:'data='+encodeURIComponent(q)}, 100000);
      if(res.ok) break;
    }catch(e){ res = null; }
  }
  if(!res || !res.ok) throw new Error('overpass unavailable');
  const j = await res.json();

  return (j.elements||[]).map(el=>{
    const lat = el.lat ?? el.center?.lat;
    const lng = el.lon ?? el.center?.lon;
    const name = el.tags?.name;
    if(lat==null || lng==null || !name) return null;
    const t = el.tags;
    // Quality gate: a generic church/fountain/theatre with no photo, no
    // wiki link, and no description is not a collectible — someone has to
    // have cared about it. Inherently notable tags (tourism, historic) pass.
    const lowSignal = ['place_of_worship','fountain','marketplace','arts_centre','theatre'].includes(t.amenity);
    const hasContext = !!(t.wikipedia || t.wikidata || t.image || t.wikimedia_commons
      || t.description || t['description:en'] || t.heritage);
    if(lowSignal && !hasContext && !t.tourism && !t.historic) return null;
    const cats = [t.tourism,t.historic,t.leisure,t.amenity,t.natural,t.man_made]
      .filter(Boolean);
    return {
      id:'osm-'+el.type+'-'+el.id,
      name, lat, lng,
      blurb: osmBlurb(t),
      region: r.name,
      cats,
      wiki: t.wikipedia || undefined,
      url: t.website || t['contact:website'] || undefined,
      img: (t.image && /^https?:/.test(t.image)) ? t.image
         : t.wikimedia_commons ? 'https://commons.wikimedia.org/wiki/Special:FilePath/'+encodeURIComponent(t.wikimedia_commons.replace(/^File:/,''))+'?width=640'
         : undefined,
    };
  }).filter(Boolean);
}

/* A human-readable one-liner from raw OSM tags, for places with no prose. */
function osmBlurb(t){
  const given = t.description || t['description:en'];
  if(given) return given;
  if(t.amenity==='place_of_worship'){
    const rel = {christian:'church', muslim:'mosque', hindu:'temple',
                 jewish:'synagogue', buddhist:'temple', sikh:'gurdwara'}[t.religion] || 'place of worship';
    const den = t.denomination ? t.denomination.replace(/_/g,' ') : '';
    const s = (den ? den+' ' : '') + rel;
    return s.charAt(0).toUpperCase()+s.slice(1);
  }
  const label = {viewpoint:'Scenic viewpoint', artwork:'Public artwork', museum:'Museum',
    gallery:'Art gallery', attraction:'Local attraction', zoo:'Zoo', theme_park:'Theme park',
    aquarium:'Aquarium', fountain:'Fountain', marketplace:'Market', arts_centre:'Arts centre',
    theatre:'Theatre'};
  if(label[t.tourism]) return label[t.tourism];
  if(label[t.amenity]) return label[t.amenity];
  if(t.historic) return 'Historic '+t.historic.replace(/_/g,' ');
  if(t.leisure==='nature_reserve') return 'Nature reserve';
  if(t.leisure==='park') return 'Public park';
  if(t.leisure==='garden') return 'Garden';
  if(t.leisure==='stadium') return 'Stadium';
  if(t.natural) return t.natural.charAt(0).toUpperCase()+t.natural.slice(1).replace(/_/g,' ');
  if(t.man_made==='lighthouse') return 'Lighthouse';
  if(t.man_made) return t.man_made.charAt(0).toUpperCase()+t.man_made.slice(1).replace(/_/g,' ');
  return '';
}

/* When two records turn out to be the same real place, the survivor
   inherits the deleted twin's stamps and dispatches. */
async function migrateStamps(fromId, toId){
  for(const s of S.stamps.filter(s=>s.poi===fromId)){ s.poi = toId; await DB.put('stamp', s); }
  for(const x of S.disps.filter(x=>x.poi===fromId)){ x.poi = toId; await DB.put('disp',  x); }
}

/* "Monte Casino" and "Montecasino" are the same place: compare names with
   case, spaces, punctuation, and accents stripped. */
function normName(s){
  return String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
}

/* Merge sources: seeds are truth, Wikidata adds notability, OSM adds density.
   Dedupe by name, then thin out anything within 30 m of a kept place so the
   map does not stack five pins on one corner. */
function mergePOIs(seeds, wiki, osm){
  const out=[], names=new Set();
  const keep = p=>{
    const nm = normName(p.name);
    if(names.has(nm)) return;
    for(const q of out){
      if(metres(p.lat,p.lng,q.lat,q.lng) < 30) return;
    }
    names.add(nm); out.push(p);
  };
  seeds.forEach(keep); wiki.forEach(keep); osm.forEach(keep);
  return out;
}

/* Wikidata SPARQL: notable places inside the bbox */
async function fetchWikidata(r){
  const [s,w,n,e] = r.bbox;
  const q = `
SELECT DISTINCT ?item ?itemLabel ?coord ?desc ?article ?website ?img WHERE {
  SERVICE wikibase:box {
    ?item wdt:P625 ?coord .
    bd:serviceParam wikibase:cornerSouthWest "Point(${w} ${s})"^^geo:wktLiteral .
    bd:serviceParam wikibase:cornerNorthEast "Point(${e} ${n})"^^geo:wktLiteral .
  }
  ?item wdt:P31/wdt:P279* ?type .
  VALUES ?type {
    wd:Q570116 wd:Q839954 wd:Q33506 wd:Q22698 wd:Q23442
    wd:Q8502 wd:Q34038 wd:Q4022 wd:Q23397 wd:Q39816
    wd:Q16970 wd:Q44782 wd:Q473972 wd:Q4989906 wd:Q860861
    wd:Q5003624 wd:Q174782 wd:Q57821
  }
  OPTIONAL { ?item schema:description ?desc . FILTER(LANG(?desc)="en") }
  OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> . }
  OPTIONAL { ?item wdt:P856 ?website . }
  OPTIONAL { ?item wdt:P18 ?img . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
}
LIMIT 220`;

  const url = 'https://query.wikidata.org/sparql?format=json&query='+encodeURIComponent(q);
  const res = await fetchT(url,{headers:{'Accept':'application/sparql-results+json'}}, 45000);
  const j   = await res.json();

  return j.results.bindings.map(b=>{
    const m = b.coord.value.match(/Point\(([-\d.]+) ([-\d.]+)\)/);
    if(!m) return null;
    const name = b.itemLabel.value;
    if(/^Q\d+$/.test(name)) return null; // unlabelled
    const wiki = b.article
      ? decodeURIComponent(b.article.value.split('/wiki/')[1]||'').replace(/_/g,' ')
      : null;
    return {
      id: b.item.value.split('/').pop(),
      name,
      lat: parseFloat(m[2]),
      lng: parseFloat(m[1]),
      blurb: b.desc ? b.desc.value : '',
      region: r.name,
      cats: [],
      wiki: wiki || undefined,
      url: b.website ? b.website.value : undefined,
      img: b.img ? b.img.value.replace(/^http:/,'https:')+'?width=640' : undefined,
    };
  }).filter(Boolean);
}

/* Pre-warm vector map tiles + fonts into the SW cache.
   The tile URL template is dated (weekly deployments), so resolve it from
   the TileJSON at cache time and cache the TileJSON too — offline, the SW
   serves that same TileJSON so MapLibre asks for exactly the tiles we hold.
   Tiles stop at z14 and MapLibre over-zooms, so z14 covers every deeper zoom. */
async function cacheTiles(r, onProg){
  const cache = await caches.open('wf-tiles-v2');

  let tjRes = null;
  for(let i=0;i<3 && !(tjRes && tjRes.ok);i++){
    try{ tjRes = await fetchT(OFM_TILEJSON, {cache:'reload'}, 15000); }catch(e){ tjRes = null; }
    if(!(tjRes && tjRes.ok)) await new Promise(r=>setTimeout(r,800));
  }
  if(!tjRes || !tjRes.ok) throw new Error('tilejson unavailable');
  await cache.put(OFM_TILEJSON, tjRes.clone());
  const tj = await tjRes.json();
  const tpl = tj.tiles[0];

  const [s,w,n,e] = r.bbox;
  const urls=[];
  // glyphs first — a large region must never squeeze the fonts out of the cap
  for(const f of ['Noto Sans Regular','Noto Sans Bold','Noto Sans Italic'])
    for(const rg of ['0-255','256-511'])
      urls.push(OFM_GLYPHS.replace('{fontstack}',encodeURIComponent(f)).replace('{range}',rg));
  r.z.forEach(z=>{
    const x1=lon2x(w,z), x2=lon2x(e,z);
    const y1=lat2y(n,z), y2=lat2y(s,z);
    for(let x=x1;x<=x2;x++)
      for(let y=y1;y<=y2;y++)
        urls.push(tpl.replace('{z}',z).replace('{x}',x).replace('{y}',y));
  });
  const cap = urls.slice(0,1800);
  let done=0;
  for(let i=0;i<cap.length;i+=14){
    await Promise.all(cap.slice(i,i+14).map(u=>
      fetchT(u, null, 20000).then(res=>{ if(res.ok) return cache.put(u,res); }).catch(()=>{})
    ));
    done+=14;
    if(onProg) onProg(Math.min(100, Math.round(done/cap.length*100)));
  }
}
const lon2x=(l,z)=>Math.floor((l+180)/360*2**z);
const lat2y=(l,z)=>Math.floor((1-Math.log(Math.tan(l*Math.PI/180)+1/Math.cos(l*Math.PI/180))/Math.PI)/2*2**z);

/* ---------- Network ---------- */
function netWatch(){
  const upd=()=>{
    $('#s-net').textContent = navigator.onLine ? 'Online' : 'Offline — play continues';
    $('#strip').classList.toggle('offline', !navigator.onLine);
    if(navigator.onLine) flush();
  };
  window.addEventListener('online',upd);
  window.addEventListener('offline',upd);
  upd();
}
async function flush(){
  // Stub: no server yet. When one exists, POST S.queue here, then clear.
  // Kept deliberately, so the offline contract is already wired.
}

/* ---------- Legend ---------- */
function showLegend(){
  card(`
    <div class="grab"></div>
    <div class="kicker">Legend</div>
    <h2>What the map icons mean</h2>
    <div style="margin-top:14px">
      ${KINDS.map(k=>`<div class="lg">
        <em>${k.gl}</em>
        <div>
          <b>${k.cat}</b>
          <small>${k.desc}</small>
          <small>Collect a <b>${k.com}</b> · return &amp; dispatch for the <b>★ ${k.rare}</b></small>
        </div>
      </div>`).join('')}
    </div>
    <button class="btn ghost" onclick="shut()">Close</button>
  `);
}

/* ---------- Builder mode: place a POI by hand ---------- */
function startPlacing(){
  if(!S.map){ toast('Map unavailable'); return; }
  S.moveTarget = null;
  document.body.classList.add('placing');
  $('#crosshair').hidden = false;
  $('#placebar').hidden = false;
  $('.placebar-txt').textContent = 'Move the map until the pin sits exactly on the spot';
  if(S.me) S.map.easeTo({center:[S.me.lng,S.me.lat], zoom:Math.max(S.map.getZoom(),17), duration:500});
  $('#placeCancel').onclick = stopPlacing;
  $('#placeHere').onclick = ()=>{
    const c = S.map.getCenter();
    stopPlacing();
    placeForm(c.lat, c.lng);
  };
}
function stopPlacing(){
  document.body.classList.remove('placing');
  $('#crosshair').hidden = true;
  $('#placebar').hidden = true;
}

function placeForm(lat, lng){
  const kindOpts = KINDS.map((k,i)=>`<option value="${i}">${k.gl} ${k.cat}</option>`).join('');
  card(`
    <div class="grab"></div>
    <div class="kicker">New place · ${lat.toFixed(5)}, ${lng.toFixed(5)}</div>
    <h2>Add a place</h2>
    <div class="note">Anchor it on something recognisable: a statue, an entrance, a fountain. The thing you would photograph to say "I was here".</div>
    <div class="field">
      <label>Name</label>
      <input type="text" id="pf-name" placeholder="e.g. Montecasino Piazza Fountain">
    </div>
    <div class="field">
      <label>Type</label>
      <select id="pf-kind" style="width:100%;padding:12px;border:1.5px solid var(--line);border-radius:12px;background:#fff;color:var(--ink);font-family:var(--body);font-size:16px">${kindOpts}</select>
    </div>
    <div class="field">
      <label>One line about it (optional)</label>
      <input type="text" id="pf-blurb" placeholder="Bronze fountain at the heart of the piazza">
    </div>
    <div class="field">
      <label>Link (optional) — article or website to read about it</label>
      <input type="text" id="pf-url" placeholder="https://…">
    </div>
    ${photoField(null)}
    ${S.builderOk ? '' : `<div class="field">
      <label>Builder password</label>
      <input type="text" id="pf-pin" placeholder="Password" autocomplete="off">
    </div>`}
    <button class="btn seal" id="pf-save">Save place</button>
    <button class="btn ghost" onclick="shut()">Cancel</button>
  `);
  const photo = {img:null};
  bindPhotoField(photo);

  $('#pf-save').onclick = async ()=>{
    const name = $('#pf-name').value.trim();
    if(name.length<3){ toast('Give it a name'); return; }
    if(!S.builderOk){
      const pin = ($('#pf-pin')?.value||'').trim();
      if(pin !== BUILDER_PIN){ toast('Wrong builder password'); return; }
      await setBuilder(true);
    }
    const k = KINDS[parseInt($('#pf-kind').value,10)] || KINDS[KINDS.length-1];
    const rgn = REGIONS.find(r=> lat>=r.bbox[0]&&lat<=r.bbox[2]&&lng>=r.bbox[1]&&lng<=r.bbox[3]);
    let link = $('#pf-url').value.trim();
    if(link && !/^https?:\/\//i.test(link)) link = 'https://'+link;
    const p = {
      id:'user-'+uid(), name, lat, lng,
      blurb: $('#pf-blurb').value.trim(),
      region: rgn ? rgn.name : 'My places',
      cats: ['cat:'+k.cat],
      url: link || undefined,
      img: photo.img || undefined,
    };
    await DB.put('poi', p);
    await DB.put('queue', {id:uid(), kind:'poi', body:{...p, img:undefined}});
    S.pois.push(p);
    S.queue.push({id:uid(), kind:'poi', body:p});
    shut(); paint();
    toast('Place added');
  };
}

/* Photo field for builder forms: tap to pick, downscaled for storage. */
function photoField(existing){
  return `<div class="field">
    <label>Photo (optional) — shown as the place's hero image</label>
    <input type="file" id="pp-file" accept="image/*" hidden>
    <div class="shot" id="pp-shot">${existing?`<img src="${esc(existing)}" alt="">`:'Tap to add a photo'}</div>
    ${existing?`<button type="button" class="btn ghost" id="pp-clear" style="margin-top:8px;padding:10px">Remove photo</button>`:''}
  </div>`;
}
function bindPhotoField(state){
  const f = $('#pp-file'), shot = $('#pp-shot'), clr = $('#pp-clear');
  if(shot) shot.onclick = ()=> f.click();
  if(clr) clr.onclick = ()=>{ state.img = null; state.cleared = true; shot.innerHTML = 'Tap to add a photo'; clr.remove(); };
  if(f) f.onchange = e=>{
    const file = e.target.files[0]; if(!file) return;
    const r = new FileReader();
    r.onload = ()=>{
      const im = new Image();
      im.onload = ()=>{
        const c = document.createElement('canvas');
        const sc = Math.min(1, 1000/Math.max(im.width, im.height));
        c.width = im.width*sc; c.height = im.height*sc;
        c.getContext('2d').drawImage(im,0,0,c.width,c.height);
        state.img = c.toDataURL('image/jpeg', .72);
        state.cleared = false;
        shot.innerHTML = `<img src="${state.img}" alt="">`;
      };
      im.src = r.result;
    };
    r.readAsDataURL(file);
  };
}

/* A keyword that reliably routes a place into the chosen category. */
function kindKeyword(k){
  const m = {'Beaches & coast':'beach','Peaks & koppies':'peak','Waterfalls':'waterfall',
    'Rivers & lakes':'river','Wildlife & camps':'safari','Parks & gardens':'park',
    'Places of worship':'temple','Forts & ruins':'fort','Museums & monuments':'monument',
    'Markets':'market','Casinos & theatres':'theatre','Stadiums & circuits':'stadium',
    'Malls & squares':'mall','Lighthouses & lookouts':'lighthouse','Bridges & towers':'bridge',
    'Everything else':''};
  return m[k.cat] ?? '';
}

/* Curation: banish a bad source place from this device. Survives restarts
   and re-caching. Its stamps (if any) stay in the passport history. */
async function hidePlace(id){
  S.hidden.add(id);
  await DB.put('meta', {k:'hidden', v:[...S.hidden]});
  await DB.del('poi', id);
  S.pois = S.pois.filter(p=>p.id!==id);
  if(S.marks[id]){ S.marks[id].remove(); delete S.marks[id]; }
  shut(); paint();
  toast('Place hidden');
}

/* Builder: edit any place's name, type, description, or link. Edits are
   flagged so a region Refresh cannot overwrite them. */
function editPlace(id){
  const p = S.pois.find(x=>x.id===id); if(!p) return;
  const cur = kindFor(p.name, p.cats).cat;
  const kindOpts = KINDS.map((k,i)=>`<option value="${i}" ${k.cat===cur?'selected':''}>${k.gl} ${k.cat}</option>`).join('');
  card(`
    <div class="grab"></div>
    <div class="kicker">Builder edit</div>
    <h2>Edit place</h2>
    <div class="field"><label>Name</label>
      <input type="text" id="ed-name" value="${esc(p.name)}"></div>
    <div class="field"><label>Type</label>
      <select id="ed-kind" style="width:100%;padding:12px;border:1.5px solid var(--line);border-radius:12px;background:#fff;color:var(--ink);font-family:var(--body);font-size:16px">${kindOpts}</select></div>
    <div class="field"><label>One line about it</label>
      <input type="text" id="ed-blurb" value="${esc(p.blurb||'')}"></div>
    <div class="field"><label>Link</label>
      <input type="text" id="ed-url" value="${esc(p.url||'')}" placeholder="https://…"></div>
    ${photoField(bestImg(p))}
    <button class="btn seal" id="ed-save">Save changes</button>
    <button class="btn ghost" onclick="shut()">Cancel</button>
  `);
  const photo = {img:null, cleared:false};
  bindPhotoField(photo);
  const oldName = p.name;
  $('#ed-save').onclick = async ()=>{
    const name = $('#ed-name').value.trim();
    if(name.length<3){ toast('Give it a name'); return; }
    const k = KINDS[parseInt($('#ed-kind').value,10)] || KINDS[KINDS.length-1];
    let url = $('#ed-url').value.trim();
    if(url && !/^https?:\/\//i.test(url)) url = 'https://'+url;
    p.name  = name;
    p.blurb = $('#ed-blurb').value.trim();
    p.url   = url || undefined;
    p.cats  = ['cat:'+k.cat];
    p.edited = true;
    if(photo.img) p.img = photo.img;
    else if(photo.cleared){ delete p.img; if(p.about) delete p.about.thumb; }
    if(name !== oldName) delete p.about;   // article may no longer match a renamed place
    await DB.put('poi', p);
    if(S.marks[p.id]){ S.marks[p.id].remove(); delete S.marks[p.id]; }
    shut(); paint();
    toast('Saved');
  };
}

/* Builder: pick the pin up and put it where it belongs. */
function startMove(id){
  const p = S.pois.find(x=>x.id===id); if(!p || !S.map) return;
  shut();
  S.moveTarget = id;
  document.body.classList.add('placing');
  $('#crosshair').hidden = false;
  $('#placebar').hidden = false;
  $('.placebar-txt').textContent = `Move the map until the pin sits exactly where ${p.name} should be`;
  S.map.easeTo({center:[p.lng,p.lat], zoom:Math.max(S.map.getZoom(),17), duration:500});
  $('#placeCancel').onclick = ()=>{ S.moveTarget=null; stopPlacing(); };
  $('#placeHere').onclick = async ()=>{
    const c = S.map.getCenter();
    const q = S.pois.find(x=>x.id===S.moveTarget);
    S.moveTarget = null;
    stopPlacing();
    if(!q) return;
    q.lat = c.lat; q.lng = c.lng; q.edited = true;
    await DB.put('poi', q);
    if(S.marks[q.id]){ S.marks[q.id].remove(); delete S.marks[q.id]; }
    paint();
    toast('Pin moved');
  };
}

async function removePlace(id){
  await DB.del('poi', id);
  for(const s of S.stamps.filter(s=>s.poi===id)) await DB.del('stamp', s.id);
  for(const x of S.disps.filter(x=>x.poi===id))  await DB.del('disp',  x.id);
  S.pois   = S.pois.filter(p=>p.id!==id);
  S.stamps = S.stamps.filter(s=>s.poi!==id);
  S.disps  = S.disps.filter(x=>x.poi!==id);
  if(S.marks[id]){ S.marks[id].remove(); delete S.marks[id]; }
  shut(); paint();
  toast('Place removed');
}

/* Wish list: places you want to get to. */
async function toggleWish(id){
  if(S.wish.has(id)) S.wish.delete(id); else S.wish.add(id);
  await DB.put('meta',{k:'wish', v:[...S.wish]});
  const b=document.getElementById('wish-'+id);
  if(b){ b.classList.toggle('on', S.wish.has(id)); b.textContent = S.wish.has(id)?'♥ Saved':'♡ Wish list'; }
  paint();
}

/* Builder mode: unlock once, stays unlocked on this device until locked. */
async function setBuilder(on){
  S.builderOk = on;
  if(on) await DB.put('meta',{k:'builder', v:true});
  else   await DB.del('meta','builder');
  updateBuilderRow();
}
function updateBuilderRow(){
  const t = document.getElementById('bmode-t'), b = document.getElementById('bmode-b');
  if(!t || !b) return;
  t.textContent = S.builderOk ? 'Unlocked — edit any place from anywhere' : 'Locked';
  b.textContent = S.builderOk ? 'Lock' : 'Unlock';
}
function toggleBuilder(){
  if(S.builderOk){ setBuilder(false); toast('Builder mode locked'); return; }
  card(`
    <div class="grab"></div>
    <div class="kicker">Builder mode</div>
    <h2>Unlock builder tools</h2>
    <div class="note">Unlocking adds Edit, Move pin, and Delete to every place sheet, from anywhere on the map. Stays unlocked on this device until you lock it.</div>
    <div class="field"><label>Builder password</label>
      <input type="text" id="bm-pin" placeholder="Password" autocomplete="off"></div>
    <button class="btn seal" id="bm-go">Unlock</button>
    <button class="btn ghost" onclick="shut()">Cancel</button>
  `);
  $('#bm-go').onclick = async ()=>{
    if(($('#bm-pin').value||'').trim() !== BUILDER_PIN){ toast('Wrong builder password'); return; }
    await setBuilder(true);
    shut(); toast('Builder mode unlocked');
  };
}

/* ---------- Cohort: share and import hand-placed POIs ----------
   No backend yet: a tester's places travel as a JSON message over
   WhatsApp or email; the builder imports, curates, and periodically the
   keepers get baked into the app's bundled places for everyone. */

async function testerName(){
  const m = (await DB.all('meta')).find(x=>x.k==='tester');
  return m ? m.v : null;
}

async function sharePlaces(){
  const mine = S.pois.filter(p=>p.id.startsWith('user-'));
  if(!mine.length){ toast('No added places yet — use the green ✚ on the map'); return; }

  let from = await testerName();
  if(!from){
    from = (prompt('Your name (so the builder knows whose places these are):')||'').trim();
    if(!from){ return; }
    await DB.put('meta',{k:'tester', v:from});
  }

  const payload = JSON.stringify({
    wayfarer:1, from, ts:Date.now(),
    places: mine.map(p=>({name:p.name, lat:p.lat, lng:p.lng,
      blurb:p.blurb||'', url:p.url||'', cats:p.cats||[]})),
  });

  if(navigator.share){
    try{
      await navigator.share({title:'Wayfarer places from '+from, text:payload});
      toast('Shared');
      return;
    }catch(e){ /* cancelled or unsupported — fall through to copy */ }
  }
  card(`
    <div class="grab"></div>
    <div class="kicker">${mine.length} place${mine.length===1?'':'s'} from ${esc(from)}</div>
    <h2>Copy &amp; send this to the builder</h2>
    <div class="field"><textarea id="shx" rows="6" readonly>${esc(payload)}</textarea></div>
    <button class="btn" onclick="navigator.clipboard.writeText(document.getElementById('shx').value).then(()=>toast('Copied'))">Copy</button>
    <button class="btn ghost" onclick="shut()">Close</button>
  `);
}

function importPlaces(){
  const pinField = S.builderOk ? '' : `
    <div class="field"><label>Builder password</label>
      <input type="text" id="im-pin" placeholder="Password" autocomplete="off"></div>`;
  card(`
    <div class="grab"></div>
    <div class="kicker">Builder import</div>
    <h2>Paste a tester's share</h2>
    <div class="field"><textarea id="im-txt" rows="6" placeholder='{"wayfarer":1,"from":"…"}'></textarea></div>
    ${pinField}
    <button class="btn seal" id="im-go">Import</button>
    <button class="btn ghost" onclick="shut()">Cancel</button>
  `);

  $('#im-go').onclick = async ()=>{
    if(!S.builderOk){
      if((($('#im-pin')||{}).value||'').trim() !== BUILDER_PIN){ toast('Wrong builder password'); return; }
      await setBuilder(true);
    }
    let j;
    try{ j = JSON.parse($('#im-txt').value.trim()); }
    catch(e){ toast('That is not a valid share'); return; }
    if(!j || j.wayfarer!==1 || !Array.isArray(j.places)){ toast('That is not a Wayfarer share'); return; }

    const from = String(j.from||'tester').slice(0,40);
    let added=0, skipped=0;
    for(const raw of j.places.slice(0,200)){
      const name = String(raw.name||'').trim().slice(0,120);
      const lat = Number(raw.lat), lng = Number(raw.lng);
      if(name.length<3 || !isFinite(lat) || !isFinite(lng)
         || Math.abs(lat)>90 || Math.abs(lng)>180){ skipped++; continue; }
      const dup = S.pois.find(q=> normName(q.name)===normName(name)
         && metres(lat,lng,q.lat,q.lng) < 150);
      if(dup){ skipped++; continue; }
      const rgn = REGIONS.find(r=> lat>=r.bbox[0]&&lat<=r.bbox[2]&&lng>=r.bbox[1]&&lng<=r.bbox[3]);
      let url = String(raw.url||'').trim();
      if(url && !/^https?:\/\//i.test(url)) url = '';
      const p = {
        id:'user-'+uid(), name, lat, lng,
        blurb: String(raw.blurb||'').trim().slice(0,300),
        region: rgn ? rgn.name : `From ${from}`,
        cats: Array.isArray(raw.cats) ? raw.cats.slice(0,3).map(c=>String(c).slice(0,30)) : [],
        url: url || undefined,
        addedBy: from,
      };
      await DB.put('poi', p);
      S.pois.push(p);
      added++;
    }
    shut(); paint();
    toast(`Imported ${added} place${added===1?'':'s'}${skipped?` · ${skipped} skipped (duplicates or invalid)`:''}`);
  };
}

/* ---------- Nav / modal ---------- */
function bindNav(){
  $$('[data-go]').forEach(b=> b.onclick = ()=>go(b.dataset.go));

  // Map search: entirely local, so it works offline like everything else.
  const srch = document.getElementById('srch');
  const sres = document.getElementById('sres');
  const runSearch = ()=>{
    const q = normName(srch.value);
    if(q.length<2){ sres.hidden = true; sres.innerHTML=''; return; }
    const hits = S.pois
      .map(p=>({p, i:normName(p.name).indexOf(q)}))
      .filter(x=>x.i>=0)
      .sort((x,y)=> x.i-y.i || x.p.name.length-y.p.name.length)
      .slice(0,8);
    if(!hits.length){ sres.innerHTML = `<div class="sr"><div><b>No matches</b><small>Only cached places are searchable</small></div></div>`; sres.hidden=false; return; }
    sres.innerHTML = hits.map(({p})=>{
      const k = kindFor(p.name,p.cats);
      const got = S.stamps.some(s=>s.poi===p.id);
      return `<div class="sr" data-p="${p.id}">
        <em>${k.gl}</em>
        <div><b>${esc(p.name)}</b><small>${k.cat} · ${esc(p.region||'')}</small></div>
        ${got?'<span class="tick">✓</span>':''}
      </div>`;
    }).join('');
    sres.hidden = false;
    $$('#sres .sr').forEach(el=>{
      el.onpointerdown = e=>{
        e.preventDefault();
        const p = S.pois.find(x=>x.id===el.dataset.p);
        srch.value=''; sres.hidden=true; srch.blur();
        if(p) flyToPlace(p);
      };
    });
  };
  srch.addEventListener('input', runSearch);
  srch.addEventListener('focus', runSearch);
  srch.addEventListener('blur', ()=> setTimeout(()=>{ sres.hidden = true; }, 250));
  srch.addEventListener('keydown', e=>{
    if(e.key==='Enter'){
      const first = sres.querySelector('.sr[data-p]');
      if(first) first.onpointerdown(new Event('pointerdown'));
    }
  });

  // Swipe-down closes sheets, like every other bottom sheet on the phone.
  const cardEl = document.getElementById('card');
  let sy=null, dy=0, dragging=false;
  cardEl.addEventListener('touchstart', e=>{
    if(S.spinning || document.getElementById('ob')) return;
    if(cardEl.scrollTop > 2) return;              // reading mid-sheet: scroll, don't drag
    sy = e.touches[0].clientY; dy = 0; dragging = true;
    cardEl.style.transition = 'none';
  }, {passive:true});
  cardEl.addEventListener('touchmove', e=>{
    if(!dragging || sy===null) return;
    dy = e.touches[0].clientY - sy;
    if(dy > 0){
      cardEl.style.transform = `translateY(${dy}px)`;
      if(dy > 8) e.preventDefault();              // the sheet has the gesture now
    }
  }, {passive:false});
  cardEl.addEventListener('touchend', ()=>{
    if(!dragging) return;
    dragging = false;
    cardEl.style.transition = 'transform .22s cubic-bezier(.16,1,.3,1)';
    if(dy > 110){ shut(); }
    else cardEl.style.transform = '';
    dy = 0; sy = null;
  });

  // Map buttons live here, not in initMap, so they work even if the map died.
  document.getElementById('legendBtn').onclick = showLegend;
  document.getElementById('addPoi').onclick = startPlacing;
  const fab = document.getElementById('locate');
  fab.onclick = ()=>{
    if(!S.map){ toast('Map unavailable'); return; }
    if(!S.me){ toast('Waiting for location'); return; }
    S.map.easeTo({center:[S.me.lng,S.me.lat], zoom:Math.max(S.map.getZoom(),15.5), bearing:0, duration:600});
    fab.classList.add('following');
    setTimeout(()=>fab.classList.remove('following'), 1200);
  };
  $('#scrim').onclick = e=>{ if(e.target.id==='scrim' && !S.spinning && !document.getElementById('ob')) shut(); };
  $('#wipe').onclick = async()=>{
    if(!confirm('Erase every stamp, dispatch, and cached place on this device?')) return;
    await DB.clear();
    try{ for(const k of await caches.keys()) await caches.delete(k); }catch(e){}
    location.reload();
  };
}
function go(id){
  $$('.view').forEach(v=>v.classList.toggle('active', v.id===id));
  $$('.nav button').forEach(b=>b.classList.toggle('on', b.dataset.go===id));
  if(id==='v-map' && S.map) setTimeout(()=>S.map.resize(),60);
  if(id==='v-book') setTimeout(paintBook,40);   // canvas needs the view visible
}
function card(html){
  $('#card').innerHTML = html;
  $('#scrim').classList.add('open');
}
function shut(){
  S.spinning=false;
  $('#scrim').classList.remove('open');
  const c = $('#card');
  c.style.transform = ''; c.style.transition = '';
}

boot();
