(function(){function Layer(){} Layer.prototype={addTo(){return this},remove(){},on(){return this},bindPopup(f){if(typeof f==='function')f();return this},bindTooltip(){return this}};
const mk=()=>new Layer();
const ll=(p,w)=>{ if(!p||!Array.isArray(p)&&!(p&&isFinite(p.lat))) throw new Error('Invalid LatLng object: ('+JSON.stringify(p)+') in '+w); if(Array.isArray(p)&&(!isFinite(p[0])||!isFinite(p[1]))) throw new Error('Invalid LatLng ('+JSON.stringify(p)+') in '+w); };
const lls=(a,w)=>{ if(!Array.isArray(a)) throw new Error('Invalid LatLngs in '+w); a.forEach(x=>Array.isArray(x)&&Array.isArray(x[0])?lls(x,w):ll(x,w)); };
const one=w=>(p)=>{ll(p,w);return mk()}; const many=w=>(a)=>{lls(a,w);return mk()};
window.L={map(){const m=mk();m.setView=()=>m;m.closePopup=()=>{};m.invalidateSize=()=>{};m.fitBounds=()=>m;m.createPane=()=>({style:{}});m.getPane=()=>({style:{}});m.attributionControl={addAttribution(){}};return m},
latLngBounds:()=>({pad(){return this}}),layerGroup(){const g=mk();g.clearLayers=()=>{};return g},canvas:()=>({}),circle:one('circle'),circleMarker:one('circleMarker'),marker:one('marker'),polyline:many('polyline'),polygon:many('polygon'),divIcon:o=>o};})();
