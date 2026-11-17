'use strict';

(function(){
  const role=document.documentElement.getAttribute('data-sonaa-theme') || '';
  if(!['client','fanni'].includes(role))return;
  const userAgent=navigator.userAgent||'';
  if(window.ReactNativeWebView||/;\\s*wv\\)/i.test(userAgent)||navigator.standalone||(window.matchMedia&&window.matchMedia('(display-mode: standalone)').matches))return;

  let currentWidget=null;
  let refreshTimer=null;
  let boundaryTimer=null;
  let loading=false;
  let lastProductId='';

  function isLoggedIn(){
    try{
      if(typeof state!=='undefined'&&role==='client')return Boolean(state.account&&state.accountToken);
      if(role==='fanni')return typeof getToken==='function'&&Boolean(getToken());
    }catch(_){}
    return false;
  }
  function storeIsOpen(){
    try{if(typeof state!=='undefined')return state.tab==='store';}catch(_){}
    return false;
  }
  function removeWidget(){
    if(currentWidget){currentWidget.remove();currentWidget=null;}
    lastProductId='';
  }
  function openStore(){
    try{
      if(role==='client'&&typeof setTab==='function'){setTab('store');return;}
      if(role==='fanni'&&typeof openTechnicianSection==='function'){openTechnicianSection('store');return;}
    }catch(_){}
    location.href=role==='client'?'/client.html?tab=store':'/fanni.html?tab=store';
  }
  function renderAdvertisement(product){
    if(!product||!isLoggedIn()||storeIsOpen()){removeWidget();return;}
    const id=String(product._id||'');
    if(currentWidget&&lastProductId===id)return;
    removeWidget();
    const banner=document.createElement('aside');
    banner.className='store-ad-slot';
    banner.setAttribute('aria-label','إعلانات متجر حمزاوي سات');
    banner.setAttribute('aria-live','polite');
    const image=document.createElement('img');
    image.className='store-ad-slot-image';
    image.alt='';
    image.loading='eager';
    image.src=product.imageUrl;
    const copy=document.createElement('div');
    copy.className='store-ad-slot-copy';
    const eyebrow=document.createElement('span');
    eyebrow.className='store-ad-slot-eyebrow';
    eyebrow.textContent='من متجر حمزاوي سات';
    const name=document.createElement('strong');
    name.className='store-ad-slot-name';
    name.textContent=String(product.name||'');
    const price=document.createElement('span');
    price.className='store-ad-slot-price';
    price.textContent=Number(product.price||0).toLocaleString('ar-EG')+' جنيه';
    copy.append(eyebrow,name,price);
    const link=document.createElement('button');
    link.type='button';
    link.className='store-ad-slot-link';
    link.textContent='شاهد المنتج';
    link.addEventListener('click',openStore);
    banner.append(image,copy,link);
    document.body.appendChild(banner);
    currentWidget=banner;
    lastProductId=id;
  }
  async function syncAdvertisement(){
    if(loading)return;
    if(!isLoggedIn()||storeIsOpen()){removeWidget();return;}
    loading=true;
    try{
      const response=await fetch('/api/store/advertisement/current?audience='+encodeURIComponent(role),{cache:'no-store',headers:{'Accept':'application/json'}});
      if(!response.ok)return;
      const data=await response.json();
      renderAdvertisement(data.currentAdvertisement);
      if(boundaryTimer)window.clearTimeout(boundaryTimer);
      const delay=Math.max(250,Number(data.nextChangeAt)-Number(data.serverTime)+100);
      boundaryTimer=window.setTimeout(syncAdvertisement,delay);
    }catch(_){}
    finally{loading=false;}
  }
  function init(){
    if(!isLoggedIn()||storeIsOpen()){removeWidget();return;}
    if(!refreshTimer)refreshTimer=window.setInterval(syncAdvertisement,10000);
    syncAdvertisement();
  }
  const app=document.getElementById('app');
  if(app){const observer=new MutationObserver(init);observer.observe(app,{childList:true,subtree:true});}
  init();
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)syncAdvertisement();});
})();