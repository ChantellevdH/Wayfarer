/* ============================================================
   WAYFARER — offline-first place collector
   Storage: IndexedDB. No network required to play.
   ============================================================ */

const RANGE_M   = 60;        // metres you must be within to spin
const COOLDOWN  = 20*60*60*1000; // 20h — so a daily habit never gets blocked by clock drift
const SPIN_ARC  = 900;       // degrees of rotation to complete a spin
const BUILDER_PIN = 'lemorne'; // builder mode password — change it here

/* ---------- Regions you can pre-cache ---------- */
const REGIONS = [
  {id:'mru',  name:'Mauritius',            icon:'⛱',  bbox:[-20.55,57.28,-19.95,57.82], z:[9,10,11,12,13,14]},
  {id:'kruger',name:'Kruger National Park', icon:'🦁', bbox:[-25.55,30.85,-22.30,32.05], z:[8,9,10,11,12]},
  {id:'jhbn', name:'Johannesburg North',   icon:'⛩',  bbox:[-26.13,27.95,-25.94,28.13], z:[10,11,12,13,14]},
  {id:'pta',  name:'Pretoria East',        icon:'🌳', bbox:[-25.92,28.15,-25.72,28.35], z:[10,11,12,13,14]},
  {id:'cpt',  name:'Cape Town',            icon:'⛰',  bbox:[-34.10,18.30,-33.75,18.75], z:[10,11,12,13,14]},
  {id:'jhb',  name:'Johannesburg',         icon:'◍',  bbox:[-26.35,27.85,-26.00,28.20], z:[10,11,12,13,14]},
];

/* ---------- Momento vocabulary ---------- */
/* Each place gets a deterministic momento derived from its type + name,
   so the same beach always yields the same stamp. Rares are earned. */
const KINDS = [
  {cat:'Beaches & coast', desc:'Beaches, bays, and lagoons',
   test:/beach|plage|bay|lagoon|coast/i, gl:'🐚', com:'Seashell', rare:'Pearl', line:'Picked from the wrack line.'},
  {cat:'Peaks & koppies', desc:'Mountains, hills, and summits',
   test:/mount|peak|morne|hill|summit|koppie/i, gl:'🪨', com:'Summit Stone', rare:'Mountain Crystal', line:'Chipped from the ridge.'},
  {cat:'Waterfalls', desc:'Falls and cascades',
   test:/water\s?fall|cascade|chute/i, gl:'💧', com:'Waterfall Mist', rare:'Rainbow Droplet', line:'Bottled at the plunge pool.'},
  {cat:'Rivers & lakes', desc:'Rivers, lakes, dams, and gorges',
   test:/lake|river|dam|gorge|spring/i, gl:'🪶', com:'River Pebble', rare:'Heron Feather', line:'Found on the bank.'},
  {cat:'Wildlife & camps', desc:'Game reserves, safari camps, hides, and zoos',
   test:/game reserve|safari|wildlife|rest camp|lodge|hide|waterhole|zoo|aquarium/i, gl:'🦁', com:'Enamel Mug', rare:'Carved Lion', line:'Kept from the campfire.'},
  {cat:'Malls & squares', desc:'Shopping centres and public squares',
   test:/mall|shopping|centre|square/i, gl:'🪙', com:'Souvenir Coin', rare:'Gold Coin', line:'Struck on the spot.'},
  {cat:'Parks & gardens', desc:'Parks, gardens, forests, and nature reserves',
   test:/garden|park|botanic|reserve|forest/i, gl:'🌿', com:'Pressed Leaf', rare:'Rare Orchid', line:'Flattened between pages.'},
  {cat:'Places of worship', desc:'Churches, temples, mosques, and shrines',
   test:/temple|church|mosque|shrine|kovil|worship|cathedral|synagogue/i, gl:'🕯', com:'Candle', rare:'Brass Bell', line:'Left burning at the step.'},
  {cat:'Forts & ruins', desc:'Castles, forts, ruins, and ancient sites',
   test:/fort|ruin|castle|archaeolog|heritage/i, gl:'🏰', com:'Cannonball', rare:"King's Seal", line:'Dug from the ramparts.'},
  {cat:'Museums & monuments', desc:'Museums, galleries, statues, and memorials',
   test:/museum|gallery|monument|memorial|statue|sculpture|artwork/i, gl:'🗝', com:'Iron Key', rare:'Golden Key', line:'Lifted from the archive.'},
  {cat:'Markets', desc:'Markets and bazaars',
   test:/market|bazaar|marché/i, gl:'🧂', com:'Spice Pouch', rare:'Golden Saffron', line:'Traded at the stall.'},
  {cat:'Casinos & theatres', desc:'Casinos, theatres, and cinemas',
   test:/casino|theatre|cinema/i, gl:'🎟', com:'Ticket Stub', rare:'Golden Ticket', line:'Torn at the door.'},
  {cat:'Stadiums & circuits', desc:'Stadiums, arenas, and race tracks',
   test:/stadium|arena|circuit|versfeld/i, gl:'🏁', com:'Match Ticket', rare:'VIP Pass', line:'Kept from the stands.'},
  {cat:'Lighthouses & lookouts', desc:'Lighthouses, viewpoints, and capes',
   test:/light\s?house|point|cape|headland|viewpoint|lookout/i, gl:'🔭', com:'Spyglass', rare:'Lighthouse Lens', line:'Prised from the tower.'},
  {cat:'Bridges & towers', desc:'Bridges, towers, and observatories',
   test:/bridge|tower|obelisk|observator/i, gl:'🌉', com:'Postcard', rare:'Vintage Postcard', line:'Bought at the kiosk.'},
  {cat:'Everything else', desc:'Anywhere worth standing',
   test:/.*/, gl:'🧭', com:'Compass', rare:'Treasure Map', line:'Marked on the map.'},
];

function kindFor(name, cats){
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
 ['seed-mru-10','Trou aux Cerfs',-20.3211,57.5122,'Dormant volcanic crater above Curepipe.'],
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
 ['seed-mru-22','Le Pouce',-20.1997,57.5272,'Thumb-shaped peak above the central plateau.'],
 ['seed-mru-23','Pieter Both',-20.1933,57.5450,'Peak crowned by a balanced boulder.'],
 ['seed-mru-24','Gris Gris',-20.5169,57.5233,'Cliff and unreefed coast at the southern tip.'],
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
 ['seed-jn-6','Liliesleaf Farm',-26.0378,28.0570,'Rivonia farmhouse where the ANC high command was arrested in 1963.'],
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
 ['seed-cpt-7','Lions Head',-33.9356,18.3889,'Peak between Table Mountain and the sea.'],
 ['seed-cpt-8','Chapmans Peak Drive',-34.0797,18.3597,'Coastal road cut into the cliff.'],
 ['seed-cpt-9','Bo-Kaap',-33.9214,18.4147,'Quarter of painted houses on Signal Hill slope.'],
 ['seed-cpt-10','Camps Bay Beach',-33.9508,18.3775,'Beach beneath the Twelve Apostles.'],
 ['seed-cpt-11','Company Gardens',-33.9281,18.4172,'The old VOC vegetable garden in the city.'],
 ['seed-cpt-12','Castle of Good Hope',-33.9256,18.4269,'The oldest surviving colonial building in SA.'],
],
jhb:[
 ['seed-jhb-1','Constitution Hill',-26.1908,28.0428,'Former prison, now the Constitutional Court.'],
 ['seed-jhb-2','Apartheid Museum',-26.2378,28.0086,'Museum on the rise and fall of apartheid.'],
 ['seed-jhb-3','Maboneng Precinct',-26.2044,28.0603,'Regenerated quarter east of the CBD.'],
 ['seed-jhb-4','Neighbourgoods Market',-26.1994,28.0322,'Saturday market in Braamfontein.'],
 ['seed-jhb-5','Johannesburg Botanical Garden',-26.1594,27.9928,'Garden and dam at Emmarentia.'],
 ['seed-jhb-6','Wits Art Museum',-26.1922,28.0325,'University collection of African art.'],
 ['seed-jhb-7','Carlton Centre',-26.2053,28.0472,'The tallest building in Africa for fifty years.'],
 ['seed-jhb-8','Soweto (Vilakazi Street)',-26.2378,27.9083,'The only street to have housed two Nobel laureates.'],
 ['seed-jhb-9','Melville Koppies',-26.1725,27.9994,'Ridge of remnant highveld and Iron Age sites.'],
 ['seed-jhb-10','Zoo Lake',-26.1608,28.0242,'Public lake and park in Parkview.'],
]};

function seedFor(r){
  return (SEED[r.id]||[]).map(([id,name,lat,lng,blurb])=>({
    id,name,lat,lng,blurb,region:r.name,cats:[]
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
  spinning:false, nearOpen:null,
};

/* ---------- Utils ---------- */
const $  = s=>document.querySelector(s);
const $$ = s=>[...document.querySelectorAll(s)];
const uid = ()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);

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
  S.pois   = await DB.all('poi');

  // Merge bundled seeds: plants everything on first run, and quietly adds
  // any new seed places shipped in an update without touching existing data.
  const have = new Set(S.pois.map(p=>p.id));
  const fresh = REGIONS.flatMap(seedFor).filter(p=>!have.has(p.id));
  if(fresh.length){
    await DB.putMany('poi', fresh);
    S.pois = S.pois.concat(fresh);
  }

  S.stamps = await DB.all('stamp');
  S.disps  = await DB.all('disp');
  S.queue  = await DB.all('queue');
  const meta = await DB.all('meta');
  meta.filter(m=>m.k.startsWith('rgn:')).forEach(m=>S.cached[m.k.slice(4)]=m.v);

  // The map is the one part that can fail (missing lib, no tiles).
  // It must never take the rest of the app down with it.
  try{ initMap(); }
  catch(e){ S.map=null; toast('Map unavailable — collecting still works'); }

  bindNav();
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
    const pinCls = 'poi-pin' + (got?' collected':'') + (near?' in-range':'');
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

/* ---------- Passport ---------- */
function paintBook(){
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
    // collapse repeats of same poi+tier into one tile with a count
    const roll={};
    list.forEach(s=>{
      const k = s.poi+'|'+s.tier;
      if(!roll[k]) roll[k]={...s,n:0};
      roll[k].n++;
      if(s.ts>roll[k].ts) roll[k].ts=s.ts;
    });
    const tiles = Object.values(roll).sort((a,b)=>b.ts-a.ts).map(s=>`
      <div class="stamp ${s.tier}" data-poi="${s.poi}">
        ${s.n>1?`<span class="ct">×${s.n}</span>`:''}
        <span class="gl">${s.gl}</span>
        <span class="nm">${s.name}</span>
      </div>`).join('');
    return `<div class="grp">${g}</div><div class="stamps">${tiles}</div>`;
  }).join('');

  $$('.stamp').forEach(el=>{
    el.onclick = ()=>{
      const p = S.pois.find(x=>x.id===el.dataset.poi);
      if(p) openPlace(p);
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
    <div class="kicker">${p.region||'Unmapped'} · ${d===null?'':Math.round(d)+' m away'}</div>
    <h2>${esc(p.name)}</h2>
    ${p.blurb?`<p style="font-size:13.5px;line-height:1.6;color:var(--grey);margin:10px 0 6px">${esc(p.blurb)}</p>`:''}
    <div id="about" class="about"></div>
    ${mine.length?`<div class="kicker" style="margin-bottom:10px">Visited ${mine.length}× · ${mine.filter(s=>s.tier==='rare').length} rare</div>`:''}
    ${action}
    ${(p.id.startsWith('user-') && S.builderOk)?`<button class="btn ghost" onclick="removePlace('${p.id}')">Remove this place (builder)</button>`:''}
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
  return u ? `<img src="${esc(u)}" alt="" loading="lazy">` : '';
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
  const r = await fetch(u);
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
    el.innerHTML = `<p class="about-txt muted">Connect to load the article for this place — it stays readable offline afterwards.</p>` + aboutLinks(p);
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
      const r = await fetch('https://en.wikipedia.org/api/rest_v1/page/summary/'+encodeURIComponent(t));
      if(!r.ok) continue;
      const j = await r.json();
      if(!j.extract || (j.type||'').includes('disambiguation')) continue;
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
  el.innerHTML = `<p class="about-txt muted">No article found for this place.</p>` + aboutLinks(p);
  if(!bestImg(p)) tryCommonsImg(p);
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
    const c = S.cached[r.id];
    return `<div class="row">
      <em>${r.icon}</em>
      <div>
        <b>${r.name}</b>
        <small>${c?`${c.n} places · cached ${fmtDate(c.ts)}`:'Not cached'}</small>
      </div>
      <button class="btn" style="width:auto;margin:0;padding:9px 13px"
        onclick="cacheRegion('${r.id}')">${c?'Refresh':'Cache'}</button>
    </div>`;
  }).join('');
}

async function cacheRegion(id){
  const r = REGIONS.find(x=>x.id===id);
  if(!navigator.onLine){ toast('Need a connection to cache'); return; }
  if(S.caching){ toast('Already caching — one region at a time'); return; }
  S.caching = true;
  toast(`Fetching ${r.name}…`);

  try{
    const [wikiR, osmR] = await Promise.allSettled([fetchWikidata(r), fetchOSM(r)]);
    const wiki = wikiR.status==='fulfilled' ? wikiR.value : [];
    let   osm  = osmR.status==='fulfilled'  ? osmR.value  : [];
    // A named node (statue, gate, artwork) is a better anchor than an area
    // centroid, so nodes go first and win the name-dedupe.
    osm = osm.sort((x,y)=> (x.id.startsWith('osm-node')?0:1) - (y.id.startsWith('osm-node')?0:1));
    if(!wiki.length && !osm.length) toast('Sources unreachable — using built-in places');

    const pois = mergePOIs(seedFor(r), wiki, osm);
    if(!pois.length){ toast('No places found'); return; }

    await DB.putMany('poi',pois);
    // merge into memory
    pois.forEach(p=>{
      const i = S.pois.findIndex(x=>x.id===p.id);
      if(i>=0) S.pois[i]=p; else S.pois.push(p);
    });

    const meta = {k:'rgn:'+id, v:{n:pois.length, ts:Date.now()}};
    await DB.put('meta',meta);
    S.cached[id] = meta.v;

    // warm the tiles for this bbox so the map draws offline
    toast(`${pois.length} places. Caching map…`);
    await cacheTiles(r);

    drawRegions();
    paint();
    if(S.map) S.map.fitBounds([[r.bbox[1],r.bbox[0]],[r.bbox[3],r.bbox[2]]],{padding:40});
    toast(`${r.name} ready offline`);
  }catch(e){
    toast('Fetch failed — try again');
  }finally{
    S.caching = false;
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

  const res = await fetch('https://overpass-api.de/api/interpreter',{
    method:'POST',
    headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body:'data='+encodeURIComponent(q),
  });
  if(!res.ok) throw new Error('overpass '+res.status);
  const j = await res.json();

  return (j.elements||[]).map(el=>{
    const lat = el.lat ?? el.center?.lat;
    const lng = el.lon ?? el.center?.lon;
    const name = el.tags?.name;
    if(lat==null || lng==null || !name) return null;
    const t = el.tags;
    const cats = [t.tourism,t.historic,t.leisure,t.amenity,t.natural,t.man_made]
      .filter(Boolean);
    return {
      id:'osm-'+el.type+'-'+el.id,
      name, lat, lng,
      blurb: t.description || t['description:en'] || '',
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

/* Merge sources: seeds are truth, Wikidata adds notability, OSM adds density.
   Dedupe by name, then thin out anything within 30 m of a kept place so the
   map does not stack five pins on one corner. */
function mergePOIs(seeds, wiki, osm){
  const out=[], names=new Set();
  const keep = p=>{
    const nm = p.name.toLowerCase().trim();
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
  const res = await fetch(url,{headers:{'Accept':'application/sparql-results+json'}});
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
async function cacheTiles(r){
  const cache = await caches.open('wf-tiles');

  const tjRes = await fetch(OFM_TILEJSON, {cache:'reload'});
  if(!tjRes.ok) throw new Error('tilejson '+tjRes.status);
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
      fetch(u).then(res=>{ if(res.ok) return cache.put(u,res); }).catch(()=>{})
    ));
    done+=14;
    if(done%280===0) toast(`Map ${Math.min(100,Math.round(done/cap.length*100))}%`);
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
  document.body.classList.add('placing');
  $('#crosshair').hidden = false;
  $('#placebar').hidden = false;
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
    ${S.builderOk ? '' : `<div class="field">
      <label>Builder password</label>
      <input type="text" id="pf-pin" placeholder="Password" autocomplete="off">
    </div>`}
    <button class="btn seal" id="pf-save">Save place</button>
    <button class="btn ghost" onclick="shut()">Cancel</button>
  `);

  $('#pf-save').onclick = async ()=>{
    const name = $('#pf-name').value.trim();
    if(name.length<3){ toast('Give it a name'); return; }
    if(!S.builderOk){
      const pin = ($('#pf-pin')?.value||'').trim();
      if(pin !== BUILDER_PIN){ toast('Wrong builder password'); return; }
      S.builderOk = true;   // remembered for this session
    }
    const k = KINDS[parseInt($('#pf-kind').value,10)] || KINDS[KINDS.length-1];
    // Force the chosen category by prefixing a keyword its matcher recognises —
    // the name shown everywhere stays clean via the cats array instead.
    const rgn = REGIONS.find(r=> lat>=r.bbox[0]&&lat<=r.bbox[2]&&lng>=r.bbox[1]&&lng<=r.bbox[3]);
    let link = $('#pf-url').value.trim();
    if(link && !/^https?:\/\//i.test(link)) link = 'https://'+link;
    const p = {
      id:'user-'+uid(), name, lat, lng,
      blurb: $('#pf-blurb').value.trim(),
      region: rgn ? rgn.name : 'My places',
      cats: [kindKeyword(k)],
      url: link || undefined,
    };
    await DB.put('poi', p);
    await DB.put('queue', {id:uid(), kind:'poi', body:p});
    S.pois.push(p);
    S.queue.push({id:uid(), kind:'poi', body:p});
    shut(); paint();
    toast('Place added');
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

/* ---------- Nav / modal ---------- */
function bindNav(){
  $$('[data-go]').forEach(b=> b.onclick = ()=>go(b.dataset.go));

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
    location.reload();
  };
}
function go(id){
  $$('.view').forEach(v=>v.classList.toggle('active', v.id===id));
  $$('.nav button').forEach(b=>b.classList.toggle('on', b.dataset.go===id));
  if(id==='v-map' && S.map) setTimeout(()=>S.map.resize(),60);
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
