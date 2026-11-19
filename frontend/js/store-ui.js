'use strict';
function storeEsc(v){return String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
function storeHeaders(role){const token=role==='client'?state.accountToken:getToken();return token?{Authorization:'Bearer '+token,'Content-Type':'application/json'}:{'Content-Type':'application/json'};}
async function loadStoreForRole(role){try{const r=await fetch('/api/store/products',{cache:'no-store'});const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.message||'تعذر تحميل المتجر');state.storeProducts=Array.isArray(d.products)?d.products:[];state.storeCategories=Array.isArray(d.categories)?d.categories:[];}catch(e){state.storeProducts=[];if(role==='client')showToast(e.message,'error');else toast(e.message,'error');}try{const r=await fetch('/api/store/'+role+'/orders',{headers:storeHeaders(role),cache:'no-store'});const d=await r.json().catch(()=>({}));if(r.ok)state.myStoreOrders=Array.isArray(d.orders)?d.orders:[];}catch(_){}render();}
function renderStoreProductCard(p,role){
  const productId=String(p._id||'');
  const expanded=Boolean(state.storeExpandedProductDetailsByRole?.[role]?.[productId]);
  const detailsKey='store-details-'+role+'-'+productId.replace(/[^a-zA-Z0-9_-]/g,'');
  return '<article class="panel p-3 flex gap-3 items-start"><div class="w-24 h-24 rounded-xl bg-slate-100 overflow-hidden shrink-0">'+(p.imageUrl?'<img src="'+storeEsc(p.imageUrl)+'" loading="lazy" class="w-full h-full object-cover" alt="'+storeEsc(p.name)+'">':'<div class="h-full flex items-center justify-center text-3xl">📦</div>')+'</div><div class="min-w-0 flex-1"><b class="block text-[13px]">'+storeEsc(p.name)+'</b><p class="text-[12px] font-black text-blue-700 mt-2">'+Number(p.price||0).toLocaleString('ar-EG')+' جنيه</p><div class="mt-3 flex items-center justify-between gap-2" dir="ltr"><button type="button" data-role="'+storeEsc(role)+'" data-product-id="'+storeEsc(productId)+'" aria-controls="'+detailsKey+'" aria-expanded="'+(expanded?'true':'false')+'" onclick="toggleStoreProductDetails(this.dataset.role,this.dataset.productId)" class="text-[11px] font-extrabold text-teal-700 whitespace-nowrap">تفاصيل المنتج <span aria-hidden="true">'+(expanded?'⌃':'⌄')+'</span></button><button type="button" data-role="'+storeEsc(role)+'" data-product-id="'+storeEsc(productId)+'" onclick="addStoreProductToCart(this.dataset.role,this.dataset.productId)" class="primary-btn rounded-lg px-4 py-2 text-[11px] font-black">أضف للسلة</button></div>'+(expanded?'<div id="'+detailsKey+'" class="mt-3 rounded-xl bg-slate-50 border border-slate-100 p-3 text-right space-y-2"><p class="text-[11px] text-slate-600">النوع: '+(p.type==='subscription'?'اشتراك / تجديد اشتراك':'منتج وبضاعة')+(p.subscriptionDuration?' • '+storeEsc(p.subscriptionDuration):'')+'</p><p class="text-[11px] text-slate-600">الوصف: '+storeEsc(String(p.description||'').trim()||'لا يوجد وصف')+'</p>'+(String(p.details||'').trim()?'<p class="text-[11px] text-slate-600">المواصفات: '+storeEsc(p.details)+'</p>':'')+(p.originalPrice!=null&&Number(p.originalPrice)>Number(p.price)?'<p class="text-[11px] text-slate-500 line-through">السعر السابق: '+Number(p.originalPrice).toLocaleString('ar-EG')+' جنيه</p>':'')+(p.offerText?'<p class="text-[11px] text-emerald-700 font-bold">'+storeEsc(p.offerText)+'</p>':'')+'</div>':'')+'</div></article>';
}
function persistStoreCart(){
  try{
    if(window.IS_EDITOR_PREVIEW)return true;
    localStorage.setItem('sonaa_store_cart_v1',JSON.stringify(state.storeCartByRole||{}));
    return true;
  }catch(error){
    console.warn('تعذر حفظ سلة المتجر:',error);
    return false;
  }
}
function getStoreCart(role){const carts=state.storeCartByRole&&typeof state.storeCartByRole==='object'?state.storeCartByRole:{};return Array.isArray(carts[role])?carts[role]:[];}
function changeStoreCartQuantity(role,id,delta){
  const cart=getStoreCart(role);
  const item=cart.find(entry=>String(entry.productId)===String(id));
  if(!item)return;
  const next=Math.max(0,Math.min(1000,Number(item.quantity||1)+Number(delta||0)));
  const updatedCart=next===0?cart.filter(entry=>String(entry.productId)!==String(id)):cart.map(entry=>String(entry.productId)===String(id)?{...entry,quantity:next}:entry);
  state.storeCartByRole={...(state.storeCartByRole||{}),[role]:updatedCart};
  persistStoreCart();
  if(next===0){const message='تم حذف المنتج من السلة.';if(role==='client')showToast(message);else toast(message);}
  render();
}
function clearStoreCart(role){
  const cart=getStoreCart(role);
  if(!cart.length)return;
  const confirmed=confirm('هل تريد تفريغ سلة المشتريات بالكامل؟');
  if(!confirmed)return;
  state.storeCartByRole={...(state.storeCartByRole||{}),[role]:[]};
  persistStoreCart();
  const message='تم تفريغ سلة المشتريات.';
  if(role==='client')showToast(message);else toast(message);
  render();
}
function addStoreProductToCart(role,id){
  const product=(state.storeProducts||[]).find(item=>String(item._id)===String(id));
  if(!product){const message='المنتج غير متاح حاليًا، حدّث قائمة المنتجات وحاول مرة أخرى.';if(role==='client')showToast(message,'error');else toast(message,'error');return;}
  const cart=getStoreCart(role);
  if(cart.some(item=>String(item.productId)===String(id))){const message='المنتج موجود بالفعل في السلة.';if(role==='client')showToast(message);else toast(message);return;}
  state.storeCartByRole={...(state.storeCartByRole||{}),[role]:[...cart,{productId:String(product._id),name:String(product.name||''),price:Number(product.price||0),type:String(product.type||'product'),quantity:1}]};
  persistStoreCart();
  const message='تمت إضافة '+String(product.name||'المنتج')+' إلى السلة.';
  if(role==='client')showToast(message);else toast(message);
  render();
}
function renderStoreCart(role){
  const cart=getStoreCart(role);
  if(!cart.length)return '<div class="panel p-3 text-center text-[12px] text-slate-500"><b class="text-slate-700">سلة المشتريات (0)</b><p class="mt-1">أضف المنتجات التي تريد شراءها من الأقسام.</p></div>';
  const itemCount=cart.reduce((sum,item)=>sum+Number(item.quantity||1),0);
  const total=cart.reduce((sum,item)=>sum+Number(item.price||0)*Number(item.quantity||1),0);
  return '<div class="panel p-3 space-y-2"><div class="flex items-center justify-between gap-2"><b class="text-[13px]">سلة المشتريات</b><div class="flex items-center gap-2"><span class="rounded-full bg-teal-50 px-3 py-1 text-[11px] font-black text-teal-800" aria-live="polite">'+itemCount+' قطعة</span><button type="button" data-role="'+storeEsc(role)+'" onclick="clearStoreCart(this.dataset.role)" class="rounded-lg border border-red-200 px-2 py-1 text-[10px] font-bold text-red-700">تفريغ السلة</button></div></div>'+cart.map(item=>'<div class="flex items-center justify-between gap-2 border-t border-slate-100 pt-2"><div class="min-w-0"><span class="block text-[12px] font-bold">'+storeEsc(item.name)+'</span><span class="text-[10px] text-slate-500">'+Number(item.price||0).toLocaleString('ar-EG')+' جنيه للقطعة</span></div><div class="flex shrink-0 items-center gap-2"><button type="button" data-role="'+storeEsc(role)+'" data-product-id="'+storeEsc(item.productId)+'" onclick="changeStoreCartQuantity(this.dataset.role,this.dataset.productId,-1)" aria-label="تقليل الكمية" class="rounded-lg border px-3 py-1 font-black">−</button><span class="min-w-5 text-center text-[12px] font-black">'+Number(item.quantity||1)+'</span><button type="button" data-role="'+storeEsc(role)+'" data-product-id="'+storeEsc(item.productId)+'" onclick="changeStoreCartQuantity(this.dataset.role,this.dataset.productId,1)" aria-label="زيادة الكمية" class="rounded-lg border px-3 py-1 font-black">+</button></div></div>').join('')+'<div class="flex items-center justify-between border-t border-slate-200 pt-2"><b class="text-[12px]">الإجمالي الحالي</b><b class="text-[13px] text-teal-700">'+total.toLocaleString('ar-EG')+' جنيه</b></div><p class="text-[10px] text-slate-500">إضافة المنتجات للسلة لا ترسل الطلب ولا تخصم أي مبلغ.</p></div>';
}
function toggleStoreProductDetails(role,id){
  const byRole=state.storeExpandedProductDetailsByRole&&typeof state.storeExpandedProductDetailsByRole==='object'?state.storeExpandedProductDetailsByRole:{};
  const expandedForRole=byRole[role]&&typeof byRole[role]==='object'?byRole[role]:{};
  state.storeExpandedProductDetailsByRole={...byRole,[role]:{...expandedForRole,[String(id)]:!expandedForRole[String(id)]}};
  render();
}
function setStoreCategory(role,category){
  const current=state.storeSelectedCategoryByRole&&typeof state.storeSelectedCategoryByRole==='object'?state.storeSelectedCategoryByRole:{};
  state.storeSelectedCategoryByRole={...current,[role]:String(category||'')};
  render();
}
function renderStoreCatalog(role){
  const products=Array.isArray(state.storeProducts)?state.storeProducts:[];
  const orders=Array.isArray(state.myStoreOrders)?state.myStoreOrders:[];
  const groups=new Map();
  products.forEach(product=>{
    const category=String(product.category||'عام').trim()||'عام';
    if(!groups.has(category))groups.set(category,[]);
    groups.get(category).push(product);
  });
  const selectedCategory=String(state.storeSelectedCategoryByRole?.[role]||'');
  const selectedItems=selectedCategory?groups.get(selectedCategory):null;
  let h='<section class="mt-4 space-y-3"><div class="panel p-4"><h3 class="font-black text-[15px]">متجر حمزاوي سات</h3><p class="text-[11px] text-slate-500 mt-1">اختار القسم اللي محتاجه، وبعدها هتظهر لك المنتجات الموجودة بداخله.</p></div><details class="panel p-4"><summary class="flex cursor-pointer list-none items-center justify-between gap-3 font-extrabold text-[13px]"><span>طلبات المتجر السابقة</span><span class="text-slate-500 transition-transform" aria-hidden="true">⌄</span></summary><div class="mt-3">';
  if(!orders.length)h+='<p class="text-[11px] text-slate-500">لسه مفيش طلبات شراء.</p>';
  orders.forEach(o=>{
    h+='<div class="border-t mt-3 pt-3"><p class="text-[12px] font-bold">'+storeEsc(o.productName)+'</p><p class="text-[11px] text-slate-500">الكمية: '+o.quantity+' • '+o.total+' جنيه • الحالة: '+storeEsc(o.status)+'</p></div>';
  });
  h+='</div></details>';
  h+=renderStoreCart(role);
  if(!products.length){
    h+='<div class="panel p-5 text-center text-sm">لا توجد منتجات متاحة حاليًا.</div>';
  }else if(selectedItems){
    h+='<div class="flex items-center justify-between gap-2"><button type="button" onclick="setStoreCategory(\''+storeEsc(role)+'\',\'\')" class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-black text-teal-700">← كل الأقسام</button><div class="text-right"><b class="text-[13px]">'+storeEsc(selectedCategory)+'</b><p class="text-[10px] text-slate-500">'+selectedItems.length+' منتج</p></div></div>';
    selectedItems.forEach(product=>{h+=renderStoreProductCard(product,role);});
  }else{
    h+='<div class="grid grid-cols-2 sm:grid-cols-3 gap-3">';
    groups.forEach((items,category)=>{
      const cover=items.find(p=>String(p.imageUrl||'').trim())||items[0];
      const categoryInfo=(Array.isArray(state.storeCategories)?state.storeCategories:[]).find(item=>String(item.name||'')===category);
      const categoryImage=String(categoryInfo?.imageUrl||cover?.imageUrl||'').trim();
      const image=categoryImage?'<img src="'+storeEsc(categoryImage)+'" loading="lazy" alt="'+storeEsc(category)+'" class="w-full h-full object-cover">':'<div class="w-full h-full flex items-center justify-center text-4xl">📦</div>';
      h+='<button type="button" data-store-role="'+storeEsc(role)+'" data-store-category="'+storeEsc(category)+'" onclick="setStoreCategory(this.dataset.storeRole,this.dataset.storeCategory)" class="panel overflow-hidden rounded-2xl border border-slate-100 bg-white text-right shadow-sm"><div class="h-28 bg-slate-100 overflow-hidden">'+image+'</div><div class="p-3"><b class="block text-[12px] font-black text-slate-800">'+storeEsc(category)+'</b><span class="mt-1 block text-[10px] text-slate-500">'+items.length+' منتج</span><span class="mt-2 block text-[10px] font-bold text-teal-700">عرض المنتجات ←</span></div></button>';
    });
    h+='</div>';
  }
  return h+'</section>';
}
function storeRequestKey(){return (window.crypto&&typeof window.crypto.randomUUID==='function')?window.crypto.randomUUID():'store-'+Date.now()+'-'+Math.random().toString(36).slice(2)+'-'+Math.random().toString(36).slice(2);}
function closeStorePurchaseModal(){const modal=document.getElementById('storePurchaseModal');if(modal)modal.remove();}
function submitStorePurchase(role,id){
  const product=(state.storeProducts||[]).find(item=>String(item._id)===String(id));
  if(!product){const message='المنتج غير متاح حاليًا، حدّث قائمة المنتجات وحاول مرة أخرى.';if(role==='client')showToast(message,'error');else toast(message,'error');return;}
  closeStorePurchaseModal();
  const isSubscription=product.type==='subscription';
  const balance=role==='client'?Number(state.walletBalance||0):Number(getUser()?.walletBalance||getUser()?.balance||0);
  const modal=document.createElement('div');
  modal.id='storePurchaseModal';
  modal.setAttribute('role','dialog');
  modal.setAttribute('aria-modal','true');
  modal.setAttribute('aria-labelledby','storePurchaseTitle');
  modal.style.cssText='position:fixed;inset:0;z-index:9999;display:flex;align-items:flex-end;justify-content:center;background:rgba(15,23,42,.58);padding:12px;';
  modal.innerHTML='<form id="storePurchaseForm" dir="rtl" style="width:100%;max-width:520px;max-height:88vh;overflow:auto;background:#fff;border-radius:22px;padding:20px;box-shadow:0 20px 60px rgba(0,0,0,.25);padding-bottom:calc(20px + env(safe-area-inset-bottom,0px))">'
    +'<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px"><h2 id="storePurchaseTitle" style="font-weight:900;font-size:17px;color:#172554">'+storeEsc(product.name||'طلب المنتج')+'</h2><button type="button" id="storePurchaseClose" aria-label="إغلاق" style="font-size:25px;line-height:1;color:#64748b;padding:4px 8px">×</button></div>'
    +'<p style="font-size:13px;color:#475569;margin-bottom:14px">السعر: <b style="color:#1d4ed8">'+Number(product.price||0).toLocaleString('ar-EG')+' جنيه</b></p>'
    +'<label for="storePurchaseQuantity" style="display:block;font-size:12px;font-weight:800;margin:12px 0 6px;color:#334155">الكمية</label><input id="storePurchaseQuantity" name="quantity" type="number" inputmode="numeric" min="1" max="1000" step="1" value="1" required style="width:100%;border:1px solid #cbd5e1;border-radius:12px;padding:12px;font-size:16px;outline-color:#0f9f9a">'
    +'<label for="storePurchaseNote" style="display:block;font-size:12px;font-weight:800;margin:12px 0 6px;color:#334155">ملاحظات للطلب (اختياري)</label><textarea id="storePurchaseNote" name="note" rows="3" maxlength="500" style="width:100%;border:1px solid #cbd5e1;border-radius:12px;padding:12px;font-size:16px;resize:vertical;outline-color:#0f9f9a"></textarea>'
    +(isSubscription?'<p style="font-size:12px;color:#475569;margin-top:12px">طلب الاشتراك لا يخصم أي مبلغ الآن؛ يتم تأكيده وفق إجراءات المتجر.</p>':'<fieldset style="margin-top:14px"><legend style="font-size:12px;font-weight:800;color:#334155;margin-bottom:8px">طريقة الدفع</legend><label style="display:flex;align-items:center;gap:8px;padding:10px;border:1px solid #dbeafe;border-radius:10px;margin-bottom:7px"><input type="radio" name="paymentMethod" value="wallet" checked><span style="font-size:13px">من المحفظة (الرصيد: '+balance.toLocaleString('ar-EG')+' جنيه)</span></label><label style="display:flex;align-items:center;gap:8px;padding:10px;border:1px solid #e2e8f0;border-radius:10px"><input type="radio" name="paymentMethod" value="cash_on_delivery"><span style="font-size:13px">الدفع عند الاستلام</span></label></fieldset>')
    +'<p id="storePurchaseError" role="alert" style="display:none;color:#b91c1c;font-size:12px;margin-top:10px"></p>'
    +'<button id="storePurchaseSubmit" type="submit" style="width:100%;margin-top:16px;background:#087f9c;color:#fff;border:0;border-radius:12px;padding:13px;font-weight:900;font-size:14px">تأكيد طلب الشراء</button>'
    +'<button type="button" id="storePurchaseCancel" style="width:100%;margin-top:8px;background:#f1f5f9;color:#334155;border:0;border-radius:12px;padding:12px;font-weight:800">إلغاء</button></form>';
  document.body.appendChild(modal);
  const form=modal.querySelector('#storePurchaseForm');
  const quantityInput=modal.querySelector('#storePurchaseQuantity');
  const noteInput=modal.querySelector('#storePurchaseNote');
  const submitButton=modal.querySelector('#storePurchaseSubmit');
  const errorBox=modal.querySelector('#storePurchaseError');
  const close=()=>{const active=document.activeElement;if(active&&typeof active.blur==='function')active.blur();closeStorePurchaseModal();};
  modal.querySelector('#storePurchaseClose').addEventListener('click',close);
  modal.querySelector('#storePurchaseCancel').addEventListener('click',close);
  modal.addEventListener('click',event=>{if(event.target===modal)close();});
  quantityInput.focus();
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    const active=document.activeElement;if(active&&typeof active.blur==='function')active.blur();
    const quantity=Number(quantityInput.value);
    if(!Number.isInteger(quantity)||quantity<1||quantity>1000){errorBox.textContent='اكتب كمية صحيحة من 1 إلى 1000.';errorBox.style.display='block';quantityInput.focus();return;}
    const paymentMethod=isSubscription?undefined:(form.querySelector('input[name="paymentMethod"]:checked')?.value||'wallet');
    const note=String(noteInput.value||'').trim().slice(0,500);
    const idempotencyKey=storeRequestKey();
    async function send(method){
      const r=await fetch('/api/store/'+role+'/orders',{method:'POST',headers:storeHeaders(role),body:JSON.stringify({productId:id,quantity,note,...(!isSubscription?{paymentMethod:method}:{}),idempotencyKey})});
      const d=await r.json().catch(()=>({}));
      return {r,d};
    }
    submitButton.disabled=true;submitButton.textContent='جاري إرسال الطلب...';submitButton.style.opacity='.65';errorBox.style.display='none';
    try{
      let result=await send(paymentMethod);
      if(!result.r.ok&&paymentMethod==='wallet'&&result.r.status===409&&result.d.canUseCashOnDelivery===true){
        const useCod=confirm((result.d.message||'رصيد المحفظة غير كافٍ.')+'\n\nهل تريد إكمال الطلب والدفع عند الاستلام؟');
        if(!useCod){submitButton.disabled=false;submitButton.textContent='تأكيد طلب الشراء';submitButton.style.opacity='1';return;}
        result=await send('cash_on_delivery');
      }
      if(!result.r.ok)throw Error(result.d.message||'تعذر إرسال الطلب');
      closeStorePurchaseModal();
      if(role==='client'){
        if(result.d.balance!==undefined)state.walletBalance=Number(result.d.balance);
        showToast(result.d.message||'تم إرسال طلب الشراء');
      }else{
        if(result.d.balance!==undefined){state.walletBalance=Number(result.d.balance);if(typeof setAuth==='function')setAuth(getToken(),{...(getUser()||{}),walletBalance:Number(result.d.balance)});}
        toast(result.d.message||'تم إرسال طلب الشراء');
      }
      await loadStoreForRole(role);
      if(role==='client'&&typeof loadClientWallet==='function')await loadClientWallet();
    }catch(e){
      errorBox.textContent=e.message||'تعذر إرسال الطلب، حاول مرة أخرى.';
      errorBox.style.display='block';
      submitButton.disabled=false;submitButton.textContent='تأكيد طلب الشراء';submitButton.style.opacity='1';
    }
  });
}
