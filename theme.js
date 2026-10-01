(function(){
'use strict';
// Appearance is device-local, separate from every record and sync payload.
const KEY='julius_zero_room_theme';
let selected='light';
function readTheme(){try{return localStorage.getItem(KEY)==='dark'?'dark':'light'}catch{return'light'}}
function applyTheme(value){
  selected=value==='dark'?'dark':'light';
  document.documentElement.dataset.theme=selected;
  document.getElementById('lightThemeStyle').media=selected==='light'?'all':'not all';
  document.querySelector('meta[name="theme-color"]').content=selected==='light'?'#f2f3ef':'#0b0d10';
  document.querySelectorAll('[data-theme-choice]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.themeChoice===selected)));
}
function chooseTheme(value){applyTheme(value);try{localStorage.setItem(KEY,selected)}catch{/* Still usable for this session if preference storage is unavailable. */}}
// Run in the head before any app content is painted, including offline starts.
applyTheme(readTheme());
document.addEventListener('DOMContentLoaded',()=>{
  applyTheme(selected);
  document.querySelectorAll('[data-theme-choice]').forEach(button=>button.addEventListener('click',()=>chooseTheme(button.dataset.themeChoice)));
});
window.addEventListener('storage',event=>{if(event.key===KEY||event.key===null)applyTheme(readTheme())});
})();
