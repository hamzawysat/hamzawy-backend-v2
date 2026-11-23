(function(){
'use strict';
const DOWNLOAD_URL='https://www.hamzawy-sat.dynv6.net/download';
const SCHEME='hamzawy';
let fallbackTimer=null;
let leftPage=false;
function isBrowserDashboard(){
 return !window.ReactNativeWebView&&!navigator.standalone&&!(window.matchMedia&&window.matchMedia('(display-mode: standalone)').matches)&&!/;\\s*wv\\)/i.test(navigator.userAgent||'');
}
function showDownloadNotice(kind){
 let box=document.getElementById('fanni-app-action-notice');
 if(!box){
  box=document.createElement('div');box.id='fanni-app-action-notice';
  box.setAttribute('role','status');box.dir='rtl';
  box.style.cssText='position:fixed;z-index:99999;left:12px;right:12px;bottom:18px;max-width:620px;margin:auto;padding:14px;border:1px solid #bfdbfe;border-radius:16px;background:#eff6ff;box-shadow:0 8px 28px rgba(15,23,42,.2);color:#1e3a8a;text-align:center;font-weight:800;font-size:13px;line-height:1.8';
  document.body.appendChild(box);
 }
 const message=kind==='offer'?'حمّل تطبيق حمزاوي عشان تقدر تقدم عرضك على الطلب ده.':'حمّل تطبيق حمزاوي عشان تقدر تبعت طلب شحن المحفظة.';
 box.innerHTML='<div>'+message+'</div><a href="'+DOWNLOAD_URL+'" style="display:inline-flex;margin-top:8px;padding:9px 16px;border-radius:10px;background:#2E7CF6;color:#fff;text-decoration:none;font-weight:900">اضغط هنا لتحميل التطبيق</a><button type="button" aria-label="إغلاق" style="margin-right:12px;color:#475569;font-weight:900" onclick="this.parentNode.remove()">إغلاق</button>';
}
function openInApp(kind,sn){
 if(!isBrowserDashboard())return false;
 if(fallbackTimer)clearTimeout(fallbackTimer);
 leftPage=false;
 const query=kind==='offer'?'action=offer&sn='+encodeURIComponent(String(sn||'')):'action=topup';
 const deepLink=SCHEME+'://technician?'+query;
 const markLeft=()=>{leftPage=true;if(fallbackTimer){clearTimeout(fallbackTimer);fallbackTimer=null;}};
 document.addEventListener('visibilitychange',function onVisibility(){
  if(document.visibilityState==='hidden'){markLeft();document.removeEventListener('visibilitychange',onVisibility);}
 });
 window.addEventListener('pagehide',markLeft,{once:true});
 try{window.location.href=deepLink;}catch(_){}
 fallbackTimer=setTimeout(()=>{if(!leftPage&&document.visibilityState==='visible')showDownloadNotice(kind);},1100);
 return true;
}
const originalOpenOffer=window.openOffer;
if(typeof originalOpenOffer==='function')window.openOffer=function(sn){if(openInApp('offer',sn))return;return originalOpenOffer.apply(this,arguments);};
const originalSubmitOffer=window.submitOffer;
if(typeof originalSubmitOffer==='function')window.submitOffer=function(){if(openInApp('offer',(typeof state!=='undefined'&&state.offerModal?state.offerModal.sn:'')))return;return originalSubmitOffer.apply(this,arguments);};
const originalSubmitWallet=window.submitWallet;
if(typeof originalSubmitWallet==='function')window.submitWallet=function(){if(openInApp('topup'))return;return originalSubmitWallet.apply(this,arguments);};
})();