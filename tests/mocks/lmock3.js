(function(){function Layer(){} Layer.prototype={addTo(){return this},remove(){},on(){return this},bindPopup(f){if(typeof f==='function')f();return this},bindTooltip(){return this}};
const mk=()=>new Layer();
window.L={map(){const m=mk();m.setView=()=>m;m.closePopup=()=>{};m.invalidateSize=()=>{};m.fitBounds=()=>m;m.createPane=()=>({style:{}});m.getPane=()=>({style:{}});m.attributionControl={addAttribution(){}};return m},
latLngBounds:()=>({pad(){return this}}),layerGroup(){const g=mk();g.clearLayers=()=>{};return g},canvas:()=>({}),circle:mk,circleMarker:mk,marker:mk,polyline:mk,polygon:mk,divIcon:o=>o};})();
