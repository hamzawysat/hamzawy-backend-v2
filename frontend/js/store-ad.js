'use strict';

(function(){
  const role=document.documentElement.getAttribute('data-sonaa-theme') || '';
  if(!['client','fanni'].includes(role))return;
  const userAgent=navigator.userAgent||'';
  if(window.ReactNativeWebView||/;\s*wv\)/i.test(userAgent)||navigator.standalone||(window.matchMedia&&window.matchMedia('(display-mode: standalone)').matches))return;

  let products=[];
  let currentIndex=0;
  let currentWidget=null;
  let firstDisplayTimer=null;
  let rotationTimer=null;
  let loading=false;
  let loaded=false;
  let displayStarted=false;

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
  }
  function openStore(){
    try{
      if(role==='client'&&typeof setTab==='function'){setTab('store');return;}
      if(role==='fanni'&&typeof openTechnicianSection==='function'){openTechnicianSection('store');return;}
    }catch(_){}
    location.href=role==='client'?'/client.html?tab=store':'/fanni.html?tab=store';
  }
  function renderAdvertisement(){
    if(!isLoggedIn()||storeIsOpen()||!products.length){removeWidget();return;}
    const product=products[currentIndex%products.length];
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
  }
  async function loadAdvertisements(){
    if(loading||loaded||!isLoggedIn()||storeIsOpen())return;
    loading=true;
    try{
      const response=await fetch('/api/store/products',{cache:'no-store',headers:{'Accept':'application/json'}});
      if(!response.ok)return;
      const data=await response.json();
      const now=Date.now();
      products=(Array.isArray(data.products)?data.products:[]).filter(product=>{
        if(product.isAdvertised!==true)return false;
        if(product.adAudience&&product.adAudience!=='both'&&product.adAudience!==role)return false;
        if(product.adExpiresAt&&new Date(product.adExpiresAt).getTime()<=now)return false;
        if(product.stock!==null&&product.stock!==undefined&&Number(product.stock)<=0)return false;
        return Boolean(String(product.name||'').trim()&&/^https?:\/\//i.test(String(product.imageUrl||'')));
      }).sort((a,b)=>(Number(b.adPriority)||0)-(Number(a.adPriority)||0)||new Date(b.createdAt||0)-new Date(a.createdAt||0));
      loaded=true;
      if(!products.length)return;
      if(!displayStarted){
        displayStarted=true;
        firstDisplayTimer=window.setTimeout(()=>{
          firstDisplayTimer=null;
          if(isLoggedIn()&&!storeIsOpen())renderAdvertisement();
        },9000);
        rotationTimer=window.setInterval(()=>{
          if(!isLoggedIn()||storeIsOpen()){removeWidget();return;}
          if(products.length>1)currentIndex=(currentIndex+1)%products.length;
          renderAdvertisement();
        },5000);
      }
    }catch(_){}finally{loading=false;}
  }
  function init(){
    if(!isLoggedIn()||storeIsOpen()){removeWidget();return;}
    if(loaded){
      if(displayStarted&&!currentWidget&&firstDisplayTimer===null)renderAdvertisement();
      return;
    }
    loadAdvertisements();
  }
  const app=document.getElementById('app');
  if(app){
    const observer=new MutationObserver(init);
    observer.observe(app,{childList:true,subtree:true});
  }
  init();
  window.setInterval(init,3000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)init();});
})();