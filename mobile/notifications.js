/* MatchMind device notifications. These are foreground-triggered notifications; remote Web Push needs a server sender and VAPID configuration. */
(() => {
  "use strict";
  const KEY = "matchmind-notification-preferences-v1";
  const SEEN = "matchmind-notification-dedupe-v1";
  const defaults = { enabled:false, kickoff:true, goals:true, cards:true, halftime:true, fulltime:true, tickets:true };
  const read = () => { try { return { ...defaults, ...(JSON.parse(localStorage.getItem(KEY)||"{}")||{}) }; } catch { return { ...defaults }; } };
  const write = value => { try { localStorage.setItem(KEY,JSON.stringify(value)); } catch {} };
  async function enable() {
    if (!("Notification" in window)) return { ok:false, reason:"Questo browser non supporta le notifiche." };
    const permission = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
    if (permission !== "granted") return { ok:false, reason:permission === "denied" ? "Permesso notifiche negato nelle impostazioni del browser." : "Permesso notifiche non concesso." };
    const prefs=read();prefs.enabled=true;write(prefs);
    return { ok:true, reason:"Notifiche del dispositivo attivate." };
  }
  function setCategory(name,value) { const prefs=read(); if(name in defaults && name!=="enabled"){prefs[name]=Boolean(value);write(prefs);} }
  function status() { return { supported:"Notification" in window, permission:"Notification" in window?Notification.permission:"unsupported", preferences:read() }; }
  async function notify(kind,title,body,tag,url) {
    const prefs=read();
    if(!prefs.enabled || !prefs[kind] || !("Notification" in window) || Notification.permission!=="granted") return false;
    const options={body,tag:tag||"matchmind-"+kind,icon:"./icon.svg",badge:"./icon.svg",renotify:false,data:{url:url||"./live.html"}};
    try {
      if ("serviceWorker" in navigator) {
        const registration=await navigator.serviceWorker.ready;
        await registration.showNotification(title,options);
      } else new Notification(title,options);
      return true;
    } catch { return false; }
  }
  async function notifyOnce(key,kind,title,body,tag,url) {
    let seen={};try{seen=JSON.parse(localStorage.getItem(SEEN)||"{}")||{};}catch{}
    if(seen[key])return false;
    seen[key]=Date.now();
    const entries=Object.entries(seen).filter(([,time])=>Date.now()-time<14*86400000).slice(-300);
    try{localStorage.setItem(SEEN,JSON.stringify(Object.fromEntries(entries)));}catch{}
    return notify(kind,title,body,tag,url);
  }
  window.MMNotifications={enable,setCategory,status,notify,notifyOnce};
  document.addEventListener("DOMContentLoaded",()=>{
    const button=document.getElementById("enableAppNotifications");
    const statusNode=document.getElementById("notificationPermissionStatus");
    const prefs=read();
    document.querySelectorAll("[data-notification-category]").forEach(input=>{
      input.checked=Boolean(prefs[input.dataset.notificationCategory]);
      input.addEventListener("change",()=>setCategory(input.dataset.notificationCategory,input.checked));
    });
    const update=()=>{
      const current=status();
      if(statusNode)statusNode.textContent=current.permission==="granted"&&current.preferences.enabled?"Notifiche attive su questo dispositivo. Gli avvisi vengono generati mentre la pagina Live o Schedina è aperta e attiva.":current.permission==="denied"?"Permesso negato: abilitalo dalle impostazioni del browser.":"Notifiche disattivate.";
      if(button)button.textContent=current.preferences.enabled?"Notifiche attive":"Attiva notifiche";
    };
    button?.addEventListener("click",async()=>{
      button.disabled=true;
      const result=await enable();
      if(statusNode)statusNode.textContent=result.reason;
      button.disabled=false;update();
    });
    update();
  });
})();