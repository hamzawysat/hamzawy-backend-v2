'use strict';

(function(){
  const role=document.documentElement.getAttribute('data-sonaa-theme') || '';
  if(!['client','fanni'].includes(role))return;
  const userAgent=navigator.userAgent||'';
  if(window.ReactNativeWebView||/;\s*wv\)/i.test(userAgent)||navigator.standalone||(window.matchMedia&&window.matchMedia('(display-mode: standalone)').matches))return;
  const sessionKey='hamzawy_store_ad_seen_'+role;
  let initialized=false;
  let pendingTimer=null;
  let currentWidget=null;

  function isLoggedIn(){
    try{
      if(typeof state!=='undefined'&&role==='client')return Boolean(state.account&&state.accountToken);
      if(role==='fanni')return typeof getToken==='function'&&Boolean(getToken());
    }catch(_){}
    return false;
  }
  function storeIsOpen(){
    try{
      if(typeof state!=='undefined')return state.tab==='store';
    }catch(_){}
    return false;
  }
  function wasSeen(){
    try{return sessionStorage.getItem(sessionKey)==='1';}catch(_){return false;}
  }
  function markSeen(){
    try{sessionStorage.setItem(sessionKey,'1');}catch(_){}
  }
  function escapeText(value){return String(value??'');}

  function removeWidget(){
    if(currentWidget){currentWidget.remove();currentWidget=null;}
  }

  function openStore(){
    markSeen();
    removeWidget();
    try{
      if(role==='client'&&typeof setTab==='function'){setTab('store');return;}
      if(role==='fanni'&&typeof openTechnicianSection==='function'){openTechnicianSection('store');return;}
    }catch(_){}
    location.href=role==='client'?'/client.html?tab=store':'/fanni.html?tab=store';
  }

  function showAdvertisement(product){
    if(!product||wasSeen()||storeIsOpen())return;
    removeWidget();
    const widget=document.createElement('aside');
    widget.className='store-ad-widget';
    widget.setAttribute('aria-label','إعلان من متجر حمزاوي سات');
    const top=document.createElement('div');top.className='store-ad-top';
    const heading=document.createElement('strong');heading.textContent='جديد في متجر حمزاوي سات';
    const close=document.createElement('button');close.type='button';close.className='store-ad-close';close.setAttribute('aria-label','إغلاق الإعلان');close.textContent='×';
    close.addEventListener('click',()=>{markSeen();removeWidget();});
    top.append(heading,close);

    const body=document.createElement('div');body.className='store-ad-body';
    const image=document.createElement('img');image.className='store-ad-image';image.alt=escapeText(product.name);
    if(/^https?:\/\//i.test(String(product.imageUrl||'')))image.src=product.imageUrl;
    else {image.hidden=true;}
    const copy=document.createElement('div');copy.className='store-ad-copy';
    const name=document.createElement('span');name.className='store-ad-name';name.textContent=escapeText(product.name);
    const price=document.createElement('strong');price.className='store-ad-price';price.textContent=Number(product.price||0).toLocaleString('ar-EG')+' جنيه';
    copy.append(name,price);
    if(product.originalPrice!=null&&Number(product.originalPrice)>Number(product.price)){
      const old=document.createElement('span');old.className='store-ad-old-price';old.textContent=Number(product.originalPrice).toLocaleString('ar-EG')+' جنيه';price.append(old);
    }
    body.append(image,copy);
    const link=document.createElement('button');link.type='button';link.className='store-ad-link';link.textContent='شاهد المنتج في المتجر ←';link.addEventListener('click',openStore);
    widget.append(top,body,link);
    document.body.appendChild(widget);
    currentWidget=widget;
  }

  async function loadAdvertisement(){
    if(!isLoggedIn()||wasSeen()||storeIsOpen()||document.hidden||pendingTimer)return;
    try{
      const response=await fetch('/api/store/products',{cache:'no-store',headers:{'Accept':'application/json'}});
      if(!response.ok)return;
      const data=await response.json();
      const now=Date.now();
      const products=(Array.isArray(data.products)?data.products:[]).filter(product=>{
        if(product.isAdvertised!==true)return false;
        if(product.adAudience&&product.adAudience!=='both'&&product.adAudience!==role)return false;
        if(product.adExpiresAt&&new Date(product.adExpiresAt).getTime()<=now)return false;
        if(product.stock!==null&&product.stock!==undefined&&Number(product.stock)<=0)return false;
        return Boolean(String(product.name||'').trim()&&/^https?:\/\//i.test(String(product.imageUrl||'')));
      }).sort((a,b)=>(Number(b.adPriority)||0)-(Number(a.adPriority)||0)||new Date(b.createdAt||0)-new Date(a.createdAt||0));
      if(!products.length)return;
      const product=products[0];
      pendingTimer=window.setTimeout(()=>{pendingTimer=null;if(isLoggedIn()&&!wasSeen()&&!storeIsOpen())showAdvertisement(product);},9000);
    }catch(_){}
  }

  function init(){
    if(!isLoggedIn()||storeIsOpen()){removeWidget();return;}
    if(!initialized){initialized=true;loadAdvertisement();}
  }
  const app=document.getElementById('app');
  if(app){
    const observer=new MutationObserver(init);
    observer.observe(app,{childList:true,subtree:true});
  }
  init();
  window.setInterval(()=>{
    if(!isLoggedIn()){removeWidget();return;}
    if(!wasSeen()&&!currentWidget)loadAdvertisement();
  },180000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!wasSeen()&&!currentWidget)loadAdvertisement();});
})();