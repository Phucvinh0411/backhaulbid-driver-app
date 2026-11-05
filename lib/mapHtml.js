import { LEAFLET_JS, LEAFLET_CSS } from './mapVendor';
// Map tiles are always light, so the map document keeps the light palette in dark mode too.
import { lightColors as colors } from '@/constants/theme';

export const MAP_BASE_URL = 'https://backhaulbid.local/tracking-map/';
export function mapHtml({ picker = false, tileTemplate } = {}) {
  // A tile provider is image-only. Arbitrary execution, API calls and navigation are disallowed.
  const configured = tileTemplate || process.env.EXPO_PUBLIC_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  const tile = /^https:\/\/[A-Za-z0-9.-]+(?::\d+)?\/[A-Za-z0-9_{}./?=&%-]+$/.test(configured) ? configured : 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  const host = new URL(tile.replaceAll('{z}', '1').replaceAll('{x}', '1').replaceAll('{y}', '1')).origin;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"><meta name="referrer" content="strict-origin-when-cross-origin"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src ${host} data:; connect-src 'none'; base-uri 'none'; form-action 'none'"><style>${LEAFLET_CSS}
html,body,#map{height:100%;margin:0;background:${colors.canvas};font-family:system-ui,sans-serif}.leaflet-container{font-size:13px}
.marker{display:flex;align-items:center;justify-content:center;width:30px;height:30px;border:3px solid white;border-radius:50%;background:${colors.brand};color:white;font-size:14px;font-weight:800;box-shadow:0 2px 6px rgba(15,30,46,.28)}
.delivery{background:${colors.success}}
@keyframes radarPulse{0%{transform:scale(.6);opacity:.8}50%{opacity:.4}100%{transform:scale(2.1);opacity:0}}
.veh-wrap{position:relative;width:44px;height:44px;display:flex;align-items:center;justify-content:center}
.veh-pulse{position:absolute;inset:0;border-radius:50%;background:${colors.info};opacity:.35;animation:radarPulse 2s cubic-bezier(0,.2,.8,1) infinite}
.veh-body{position:relative;width:32px;height:32px;border-radius:50%;background:${colors.info};border:3px solid white;box-shadow:0 2px 8px rgba(15,30,46,.35);display:flex;align-items:center;justify-content:center;transition:transform .35s ease-out}
.veh-arrow{width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-bottom:12px solid white;transform:translateY(-1px)}
.controls{position:absolute;z-index:1000;bottom:24px;left:10px;display:flex;gap:6px}
button{min-height:40px;border:1px solid ${colors.line};border-radius:999px;background:white;padding:0 14px;color:${colors.ink};font-weight:600;box-shadow:0 1px 4px rgba(15,30,46,.12)}
button.active{background:${colors.brand};color:white;border-color:${colors.brand}}
button:disabled{opacity:.5}
.anchor-label{background:white;border:1px solid ${colors.line};border-radius:8px;padding:4px 8px;color:${colors.ink};font-size:12px;line-height:1.3;max-width:180px;white-space:normal;box-shadow:0 2px 6px rgba(15,30,46,.16)}
.anchor-label b{display:block;font-size:12px}.anchor-label::before{display:none}
.empty{position:absolute;z-index:900;left:12px;right:12px;top:12px;padding:12px;background:white;border:1px solid ${colors.line};border-radius:12px;color:${colors.ink};font-size:13px;line-height:1.4;pointer-events:none;box-shadow:0 4px 16px rgba(15,30,46,.12)}
</style></head><body><div id="map"></div><div class="empty" id="empty">Chưa có tọa độ để hiển thị.</div><div class="controls"><button id="fit">Toàn tuyến</button><button id="vehicle">Bám theo xe</button></div><script>${LEAFLET_JS.replace(/<\/script/gi, '<\\/script')}</script><script>
const PICKER=${picker ? 'true' : 'false'},BRAND=${JSON.stringify(colors.brand)},INFO=${JSON.stringify(colors.info)},SUCCESS=${JSON.stringify(colors.success)},MUTED=${JSON.stringify(colors.inkMuted)};
const map=L.map('map',{zoomControl:true,scrollWheelZoom:false,attributionControl:true,preferCanvas:true});
let layers=L.layerGroup().addTo(map), bounds=[], fitBoundsList=[], latest=null, fittedKey=null, routeShown=false, touched=false, following=false, anchorTooltips=[], vehicleMarker=null, animFrame=null;
['mousedown','touchstart','wheel'].forEach(name=>map.getContainer().addEventListener(name,()=>{touched=true;},{passive:true}));
const tile=L.tileLayer(${JSON.stringify(tile)},{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(map);
function message(value){const raw=JSON.stringify(value);if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(raw);else parent.postMessage(value,'*');}
tile.on('tileerror',()=>message({type:'tileError'})); tile.on('load',()=>message({type:'tilesReady'}));
function label(text){const node=document.createElement('span');node.textContent=String(text||'');return node;}
function marker(point,letter,kind){if(!point)return null;const coordinates=[point.latitude,point.longitude];bounds.push(coordinates);const pin=L.marker(coordinates,{icon:L.divIcon({className:'',html:'<div class="marker '+kind+'">'+letter+'</div>',iconSize:[30,30],iconAnchor:[15,15]})}).bindPopup(label(point.label)).addTo(layers);return pin;}
function fit(){const list=fitBoundsList.length?fitBoundsList:bounds;if(list.length===1)map.setView(list[0],14);else if(list.length)map.fitBounds(L.latLngBounds(list),{padding:[40,48],maxZoom:15});}
function anchorLabel(point){const node=document.createElement('div');const title=document.createElement('b');title.textContent=point.label||'';node.appendChild(title);if(point.address){const line=document.createElement('span');line.textContent=point.address;node.appendChild(line);}return node;}
function anchorMarker(point,letter,kind){if(!point)return;const pin=marker(point,letter,kind);pin.bindTooltip(anchorLabel(point),{permanent:true,direction:'top',offset:[0,-18],className:'anchor-label',opacity:1});anchorTooltips.push(pin.getTooltip());}
function vehicleHtml(heading){const rot=Number.isFinite(Number(heading))?'transform:rotate('+Number(heading)+'deg)':'';return '<div class="veh-wrap"><span class="veh-pulse"></span><span class="veh-body" style="'+rot+'"><span class="veh-arrow"></span></span></div>';}
function updateVehicle(point){
  if(animFrame){cancelAnimationFrame(animFrame);animFrame=null;}
  if(!point){if(vehicleMarker){map.removeLayer(vehicleMarker);vehicleMarker=null;}return;}
  const target=[point.latitude,point.longitude];
  bounds.push(target);
  const icon=L.divIcon({className:'',html:vehicleHtml(point.heading),iconSize:[44,44],iconAnchor:[22,22]});
  if(!vehicleMarker){
    vehicleMarker=L.marker(target,{icon,zIndexOffset:900}).bindPopup(label(point.label||'Vị trí xe trực tiếp')).addTo(map);
  }else{
    vehicleMarker.setIcon(icon);
    const start=vehicleMarker.getLatLng();
    const dLat=target[0]-start.lat, dLng=target[1]-start.lng;
    if(Math.abs(dLat)+Math.abs(dLng)<0.00001 || Math.abs(dLat)+Math.abs(dLng)>0.2){
      vehicleMarker.setLatLng(target);
    }else{
      const t0=performance.now(), dur=800;
      const step=(now)=>{
        const p=Math.min(1,(now-t0)/dur);
        const ease=1-Math.pow(1-p,3);
        vehicleMarker.setLatLng([start.lat+dLat*ease,start.lng+dLng*ease]);
        if(p<1)animFrame=requestAnimationFrame(step);
      };
      animFrame=requestAnimationFrame(step);
    }
  }
  if(following)map.panTo(target,{animate:true,duration:0.7});
}
window.setMapPayload=function(data){anchorTooltips.forEach(tooltip=>map.removeLayer(tooltip));anchorTooltips=[];layers.clearLayers();bounds=[];latest=data.latest;
anchorMarker(data.pickup,'A','');anchorMarker(data.delivery,'B','delivery');
(data.manual||[]).forEach(p=>{bounds.push([p.latitude,p.longitude]);L.circleMarker([p.latitude,p.longitude],{radius:4,color:MUTED,fillOpacity:1}).bindPopup(label('Vị trí ghi thủ công')).addTo(layers);});
const road=(data.route||[]).map(p=>[p[1],p[0]]);
const remaining=(data.routeRemaining?.length>1?data.routeRemaining:(data.route||[])).map(p=>[p[1],p[0]]);
const passed=(data.routePassed||[]).map(p=>[p[1],p[0]]);
if(remaining.length>1){
  L.polyline(remaining,{color:'#fff',weight:8,opacity:.9,interactive:false}).addTo(layers);
  L.polyline(remaining,{color:MUTED,weight:4,opacity:.75,dashArray:'8, 8'}).bindPopup(label('Quãng đường còn lại')).addTo(layers);
}
const hasGpsSegments=(data.segments||[]).some(s=>s.length>1);
if(!hasGpsSegments&&passed.length>1){
  L.polyline(passed,{color:'#fff',weight:9,opacity:.95,interactive:false}).addTo(layers);
  L.polyline(passed,{color:INFO,weight:5,opacity:.95}).bindPopup(label('Đoạn đường đã đi')).addTo(layers);
}
(data.segments||[]).forEach(segment=>{const line=segment.map(p=>[p.latitude,p.longitude]);bounds.push(...line);if(line.length>1){L.polyline(line,{color:'#fff',weight:8,opacity:.9,interactive:false}).addTo(layers);L.polyline(line,{color:INFO,weight:5,opacity:.95}).bindPopup(label('Đoạn đường xe đã đi')).addTo(layers);}else if(line.length)L.circleMarker(line[0],{radius:3,color:INFO,fillOpacity:.8}).addTo(layers);});
updateVehicle(latest);
const anchors=[data.pickup,data.delivery].filter(Boolean).map(p=>[p.latitude,p.longitude]);
fitBoundsList=anchors.length?[...anchors,...road]:[];
const empty=document.getElementById('empty');
if(PICKER){empty.style.display=data.pickup?'none':'block';}
else{const missing=!data.pickup&&!data.delivery?'hai kho':!data.pickup?'kho lấy hàng':!data.delivery?'kho giao hàng':'';const text=missing?'Chưa vẽ được tuyến A → B: '+missing+' chưa được ghim trên bản đồ.':(road.length>1?'':(data.routeNote||''));empty.textContent=text;empty.style.display=text?'block':'none';}
const vehBtn=document.getElementById('vehicle');
vehBtn.disabled=!latest;
vehBtn.className=following?'active':'';
vehBtn.textContent=following?'Đang bám xe':'Bám theo xe';
const key=data.anchorKey||(PICKER?'picker':(anchors.length?JSON.stringify(anchors):null));
if(key&&key!==fittedKey&&(anchors.length||bounds.length)){touched=false;fittedKey=key;routeShown=road.length>1;fit();}
else if(!fittedKey&&bounds.length){fittedKey='gps';fit();}
else if(road.length>1&&!routeShown&&!touched){routeShown=true;fit();}
map.invalidateSize();};
function incoming(event){if(event.source&&event.source!==parent&&event.source!==window)return;try{const msg=typeof event.data==='string'?JSON.parse(event.data):event.data;if(msg?.type==='mapData'&&msg.payload)window.setMapPayload(msg.payload);}catch{}}
window.addEventListener('message',incoming);document.addEventListener('message',incoming);
document.getElementById('fit').onclick=()=>{following=false;const b=document.getElementById('vehicle');b.className='';b.textContent='Bám theo xe';fit();};
document.getElementById('vehicle').onclick=()=>{if(!latest)return;following=!following;const b=document.getElementById('vehicle');b.className=following?'active':'';b.textContent=following?'Đang bám xe':'Bám theo xe';map.setView([latest.latitude,latest.longitude],16);};
${picker ? "map.setView([16.1,107.6],5);document.getElementById('empty').textContent='Chạm đúng vị trí kho để đặt pin.';map.on('click',event=>message({type:'pointSelected',latitude:event.latlng.lat,longitude:event.latlng.lng}));" : ''}
message({type:'ready'});
</script></body></html>`;
}
