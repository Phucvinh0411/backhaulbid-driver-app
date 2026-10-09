import { LEAFLET_JS, LEAFLET_CSS } from './mapVendor';
import { colors } from '@/constants/theme';

export const MAP_BASE_URL = 'https://backhaulbid.local/tracking-map/';
export function mapHtml({ picker = false, tileTemplate } = {}) {
  // A tile provider is image-only. Arbitrary execution, API calls and navigation are disallowed.
  const configured = tileTemplate || process.env.EXPO_PUBLIC_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  const tile = /^https:\/\/[A-Za-z0-9.-]+(?::\d+)?\/[A-Za-z0-9_{}./?=&%-]+$/.test(configured) ? configured : 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  const host = new URL(tile.replaceAll('{z}', '1').replaceAll('{x}', '1').replaceAll('{y}', '1')).origin;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"><meta name="referrer" content="strict-origin-when-cross-origin"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src ${host} data:; connect-src 'none'; base-uri 'none'; form-action 'none'"><style>${LEAFLET_CSS}\nhtml,body,#map{height:100%;margin:0;background:${colors.canvas};font-family:system-ui,sans-serif}.leaflet-container{font-size:13px}.marker{display:flex;align-items:center;justify-content:center;width:30px;height:30px;border:3px solid white;border-radius:50%;background:${colors.brand};color:white;font-size:14px;font-weight:800;box-shadow:0 2px 6px rgba(15,30,46,.28)}.delivery{background:${colors.success}}.vehicle{background:${colors.info};border-radius:9px}.stop{width:20px;height:20px;background:${colors.inkMuted};font-size:11px}.controls{position:absolute;z-index:1000;bottom:24px;left:10px;display:flex;gap:6px}button{min-height:44px;border:1px solid ${colors.line};border-radius:999px;background:white;padding:0 14px;color:${colors.ink};font-weight:600;box-shadow:0 1px 4px rgba(15,30,46,.12)}button:disabled{opacity:.5}.anchor-label{background:white;border:1px solid ${colors.line};border-radius:8px;padding:4px 8px;color:${colors.ink};font-size:12px;line-height:1.3;max-width:180px;white-space:normal;box-shadow:0 2px 6px rgba(15,30,46,.16)}.anchor-label b{display:block;font-size:12px}.anchor-label::before{display:none}.empty{position:absolute;z-index:900;left:12px;right:12px;top:12px;padding:12px;background:white;border:1px solid ${colors.line};border-radius:12px;color:${colors.ink};font-size:13px;line-height:1.4;pointer-events:none;box-shadow:0 4px 16px rgba(15,30,46,.12)}</style></head><body><div id="map"></div><div class="empty" id="empty">Chưa có tọa độ để hiển thị.</div><div class="controls"><button id="fit">Toàn tuyến</button><button id="vehicle">Vị trí xe</button></div><script>${LEAFLET_JS.replace(/<\/script/gi, '<\\/script')}</script><script>
const PICKER=${picker ? 'true' : 'false'},BRAND=${JSON.stringify(colors.brand)},INFO=${JSON.stringify(colors.info)},SUCCESS=${JSON.stringify(colors.success)},MUTED=${JSON.stringify(colors.inkMuted)};
const map=L.map('map',{zoomControl:true,scrollWheelZoom:false,attributionControl:true,preferCanvas:true});
let layers=L.layerGroup().addTo(map), bounds=[], fitBoundsList=[], latest=null, fittedKey=null, routeShown=false, touched=false, anchorTooltips=[];
['mousedown','touchstart','wheel'].forEach(name=>map.getContainer().addEventListener(name,()=>{touched=true;},{passive:true}));
const tile=L.tileLayer(${JSON.stringify(tile)},{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(map);
function message(value){const raw=JSON.stringify(value);if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(raw);else parent.postMessage(value,'*');}
tile.on('tileerror',()=>message({type:'tileError'})); tile.on('load',()=>message({type:'tilesReady'}));
function label(text){const node=document.createElement('span');node.textContent=String(text||'');return node;}
function marker(point,letter,kind){if(!point)return null;const coordinates=[point.latitude,point.longitude];bounds.push(coordinates);const pin=L.marker(coordinates,{icon:L.divIcon({className:'',html:'<div class="marker '+kind+'">'+letter+'</div>',iconSize:[30,30],iconAnchor:[15,15]})}).bindPopup(label(point.label)).addTo(layers);return pin;}
function fit(){const list=fitBoundsList.length?fitBoundsList:bounds;if(list.length===1)map.setView(list[0],14);else if(list.length)map.fitBounds(L.latLngBounds(list),{padding:[40,48],maxZoom:15});}
function anchorLabel(point){const node=document.createElement('div');const title=document.createElement('b');title.textContent=point.label||'';node.appendChild(title);if(point.address){const line=document.createElement('span');line.textContent=point.address;node.appendChild(line);}return node;}
function anchorMarker(point,letter,kind){if(!point)return;const pin=marker(point,letter,kind);pin.bindTooltip(anchorLabel(point),{permanent:true,direction:'top',offset:[0,-18],className:'anchor-label',opacity:1});anchorTooltips.push(pin.getTooltip());}
// Fits when the warehouse pair first appears or changes, and once more when the road route arrives
// unless the user already moved the map. GPS refreshes never refit. No straight A-B line is drawn.
window.setMapPayload=function(data){anchorTooltips.forEach(tooltip=>map.removeLayer(tooltip));anchorTooltips=[];layers.clearLayers();bounds=[];latest=data.latest;
anchorMarker(data.pickup,'A','');anchorMarker(data.delivery,'B','delivery');
(data.milestones||[]).forEach((p,i)=>marker(p,String(i+1),'stop'));
(data.manual||[]).forEach(p=>{bounds.push([p.latitude,p.longitude]);L.circleMarker([p.latitude,p.longitude],{radius:4,color:p.source==='CHECK_IN'?SUCCESS:MUTED,fillOpacity:1}).bindPopup(label(p.source==='CHECK_IN'?'Vị trí check-in':'Vị trí ghi thủ công')).addTo(layers);});
(data.segments||[]).forEach(segment=>{const line=segment.map(p=>[p.latitude,p.longitude]);bounds.push(...line);if(line.length>1)L.polyline(line,{color:INFO,weight:5,opacity:.9}).addTo(layers);else if(line.length)L.circleMarker(line[0],{radius:3,color:INFO,fillOpacity:.8}).addTo(layers);});
const road=(data.route||[]).map(p=>[p[1],p[0]]);
if(road.length>1){L.polyline(road,{color:'#fff',weight:9,opacity:.95,interactive:false}).addTo(layers);L.polyline(road,{color:BRAND,weight:5,opacity:.9}).bindPopup(label('Tuyến đường bộ dự kiến A → B')).addTo(layers);}
marker(latest,'●','vehicle');
const anchors=[data.pickup,data.delivery].filter(Boolean).map(p=>[p.latitude,p.longitude]);
fitBoundsList=anchors.length?[...anchors,...road]:[];
const empty=document.getElementById('empty');
if(PICKER){empty.style.display=data.pickup?'none':'block';}
else{const missing=!data.pickup&&!data.delivery?'hai kho':!data.pickup?'kho lấy hàng':!data.delivery?'kho giao hàng':'';const text=missing?'Chưa vẽ được tuyến A → B: '+missing+' chưa được ghim trên bản đồ.':(road.length>1?'':(data.routeNote||''));empty.textContent=text;empty.style.display=text?'block':'none';}
document.getElementById('vehicle').disabled=!latest;
const key=data.anchorKey||(PICKER?'picker':(anchors.length?JSON.stringify(anchors):null));
if(key&&key!==fittedKey&&(anchors.length||bounds.length)){touched=false;fittedKey=key;routeShown=road.length>1;fit();}
else if(!fittedKey&&bounds.length){fittedKey='gps';fit();}
else if(road.length>1&&!routeShown&&!touched){routeShown=true;fit();}
map.invalidateSize();};
function incoming(event){if(event.source&&event.source!==parent&&event.source!==window)return;try{const msg=typeof event.data==='string'?JSON.parse(event.data):event.data;if(msg?.type==='mapData'&&msg.payload)window.setMapPayload(msg.payload);}catch{}}
window.addEventListener('message',incoming);document.addEventListener('message',incoming);
document.getElementById('fit').onclick=fit;document.getElementById('vehicle').onclick=()=>latest&&map.setView([latest.latitude,latest.longitude],16);
${picker ? "map.setView([16.1,107.6],5);document.getElementById('empty').textContent='Chạm đúng vị trí kho để đặt pin.';map.on('click',event=>message({type:'pointSelected',latitude:event.latlng.lat,longitude:event.latlng.lng}));" : ''}
message({type:'ready'});
</script></body></html>`;
}
