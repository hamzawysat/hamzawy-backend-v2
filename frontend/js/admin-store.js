'use strict';

let storeCsvImportState={open:false,fileName:'',headers:[],rows:[],mapping:{},prepared:{valid:[],errors:[]},busy:false,result:null};
const STORE_CSV_IMPORT_FIELDS=[
  {key:'name',label:'اسم المنتج *',aliases:['name','productname','title','اسم المنتج','اسم','المنتج','الاسم']},
  {key:'price',label:'السعر *',aliases:['price','currentprice','sellingprice','السعر','السعر الحالي','سعر البيع']},
  {key:'category',label:'القسم',aliases:['category','section','group','القسم','الفئة','التصنيف']},
  {key:'description',label:'الوصف',aliases:['description','shortdescription','الوصف','وصف']},
  {key:'details',label:'التفاصيل والمواصفات',aliases:['details','specifications','المواصفات','التفاصيل']},
  {key:'originalPrice',label:'السعر قبل العرض',aliases:['originalprice','oldprice','السعر الأصلي','السعر قبل الخصم','السعر قبل العرض']},
  {key:'offerText',label:'تفاصيل العرض',aliases:['offer','offertext','العرض','تفاصيل العرض']},
  {key:'type',label:'نوع المنتج',aliases:['type','producttype','نوع المنتج','النوع']},
  {key:'subscriptionDuration',label:'مدة الاشتراك',aliases:['duration','subscriptionduration','مدة الاشتراك']},
  {key:'imageUrl',label:'رابط الصورة',aliases:['image','imageurl','image_url','رابط الصورة','رابط صورة المنتج','صورة المنتج']},
  {key:'stock',label:'الكمية / المخزون',aliases:['stock','quantity','qty','الكمية','المخزون','عدد']},
  {key:'isActive',label:'حالة المنتج',aliases:['active','isactive','enabled','نشط','مفعل','حالة المنتج']}
];
function normalizeStoreCsvHeader(value){
  return String(value||'').replace(/^\uFEFF/,'').normalize('NFKC').toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g,'').replace(/[\s_\-./\\()[\]{}:،؛]+/g,'');
}
function parseStoreCsvText(sourceText){
  const source=String(sourceText||'').replace(/^\uFEFF/,'');
  const firstLine=source.split(/\r?\n/).find(line=>line.trim())||'';
  const candidates=[',',';','\t'];
  const counts=candidates.map(delimiter=>{
    let count=0,quoted=false;
    for(let i=0;i<firstLine.length;i++){
      const ch=firstLine[i];
      if(ch==='"'&&quoted&&firstLine[i+1]==='"'){i++;continue;}
      if(ch==='"'){quoted=!quoted;continue;}
      if(!quoted&&ch===delimiter)count++;
    }
    return count;
  });
  const delimiter=candidates[counts.indexOf(Math.max(...counts))]||',';
  const matrix=[];let row=[],cell='',quoted=false;
  for(let i=0;i<source.length;i++){
    const ch=source[i];
    if(quoted){
      if(ch==='"'&&source[i+1]==='"'){cell+='"';i++;}
      else if(ch==='"')quoted=false;
      else cell+=ch;
    }else if(ch==='"'&&cell===''){quoted=true;}
    else if(ch===delimiter){row.push(cell);cell='';}
    else if(ch==='\n'){row.push(cell.replace(/\r$/,''));matrix.push(row);row=[];cell='';}
    else cell+=ch;
  }
  if(cell.length||row.length){row.push(cell.replace(/\r$/,''));matrix.push(row);}
  const nonEmpty=matrix.filter(cells=>cells.some(value=>String(value||'').trim()!==''));
  const headers=(nonEmpty.shift()||[]).map(value=>String(value||'').trim());
  const rows=nonEmpty.map(cells=>headers.map((_,index)=>String(cells[index]??'').trim()));
  return {headers,rows,delimiter};
}
function autoMapStoreCsvHeaders(headers){
  const mapping={};
  for(const field of STORE_CSV_IMPORT_FIELDS){
    const aliases=field.aliases.map(normalizeStoreCsvHeader);
    const index=headers.findIndex(header=>aliases.includes(normalizeStoreCsvHeader(header)));
    mapping[field.key]=index>=0?String(index):'';
  }
  return mapping;
}
function parseStoreCsvNumber(value){
  const digits=String(value??'').replace(/[٠-٩]/g,digit=>'٠١٢٣٤٥٦٧٨٩'.indexOf(digit)).replace(/[۰-۹]/g,digit=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(digit));
  const cleaned=digits.replace(/[٬,\s]/g,'').replace(/٫/g,'.').replace(/[^0-9.\-]/g,'');
  if(!cleaned||cleaned==='-'||cleaned==='.')return null;
  const number=Number(cleaned);
  return Number.isFinite(number)?number:null;
}
function prepareStoreCsvImportRows(){
  const valid=[],errors=[];
  const mapping=storeCsvImportState.mapping||{};
  const column=(row,key)=>{const index=Number(mapping[key]);return mapping[key]!==''&&Number.isInteger(index)&&index>=0?String(row[index]??'').trim():'';};
  storeCsvImportState.rows.forEach((row,index)=>{
    const rowNumber=index+2;
    const name=column(row,'name');
    const rawPrice=column(row,'price');
    const price=parseStoreCsvNumber(rawPrice);
    const rowErrors=[];
    if(!name||name.length<2||name.length>120)rowErrors.push('اسم المنتج مطلوب (من حرفين إلى 120 حرفًا).');
    if(rawPrice===''||price===null||price<0||price>100000000)rowErrors.push('السعر مطلوب ويجب أن يكون رقمًا صحيحًا من صفر فأكثر.');
    const originalRaw=column(row,'originalPrice');
    const originalPrice=originalRaw===''?null:parseStoreCsvNumber(originalRaw);
    if(originalRaw!==''&&(originalPrice===null||originalPrice<0||originalPrice>100000000))rowErrors.push('السعر قبل العرض غير صالح.');
    const stockRaw=column(row,'stock');
    const stock=stockRaw===''?null:parseStoreCsvNumber(stockRaw);
    if(stockRaw!==''&&(stock===null||!Number.isInteger(stock)||stock<0))rowErrors.push('الكمية يجب أن تكون عددًا صحيحًا غير سالب.');
    const imageUrl=column(row,'imageUrl');
    if(imageUrl){let parsed;try{parsed=new URL(imageUrl);}catch(_){parsed=null;}if(!parsed||!['http:','https:'].includes(parsed.protocol)||imageUrl.length>1000)rowErrors.push('رابط الصورة يجب أن يبدأ بـ https:// أو http://.');}
    const category=(column(row,'category')||'عام').slice(0,80);
    const typeRaw=column(row,'type').toLowerCase();
    const type=(typeRaw.includes('اشتراك')||typeRaw.includes('subscription'))?'subscription':'product';
    const activeRaw=column(row,'isActive').toLowerCase();
    const isActive=activeRaw===''?true:!['0','false','no','inactive','غير مفعل','مخفي','لا'].includes(activeRaw);
    const product={
      name,category,price:price??0,originalPrice,offerText:column(row,'offerText').slice(0,200),
      type,subscriptionDuration:column(row,'subscriptionDuration').slice(0,60),
      description:column(row,'description').slice(0,2000),details:column(row,'details').slice(0,5000),
      imageUrl,imageFileId:null,isActive,isAdvertised:false,adAudience:'both',adPriority:0,adExpiresAt:null,stock
    };
    if(rowErrors.length)errors.push({rowNumber,name,message:rowErrors.join('؛ ')});
    else valid.push({rowNumber,product});
  });
  storeCsvImportState.prepared={valid,errors};
  return storeCsvImportState.prepared;
}
function renderStoreCsvImportPanel(){
  const s=storeCsvImportState;
  const toggle='<div class="premium-panel p-3 flex items-center justify-between gap-3"><div><b class="block text-sm">استيراد منتجات دفعة واحدة</b><p class="text-[10px] text-slate-500 mt-1">ارفع ملف CSV لإضافة منتجات كثيرة مرة واحدة.</p></div><button type="button" onclick="toggleStoreCsvImporter()" class="primary-btn rounded-xl px-4 py-2 text-xs">'+(s.open?'إغلاق':'استيراد CSV')+'</button></div>';
  if(!s.open)return toggle;
  const mapping=s.headers.length?'<div class="grid grid-cols-1 sm:grid-cols-2 gap-2">'+STORE_CSV_IMPORT_FIELDS.map(field=>'<label class="block text-[11px] font-bold text-slate-600">'+escHtml(field.label)+'<select data-store-csv-map="'+field.key+'" onchange="updateStoreCsvMapping(this)" class="field mt-1"><option value="">— بدون ربط —</option>'+s.headers.map((header,index)=>'<option value="'+index+'" '+(String(s.mapping[field.key]??'')===String(index)?'selected':'')+'>'+escHtml(header||('عمود '+(index+1)))+'</option>').join('')+'</select></label>').join('')+'</div>':'';
  const prepared=s.headers.length?prepareStoreCsvImportRows():{valid:[],errors:[]};
  const preview=s.rows.slice(0,8).map((row,index)=>{
    const rowNumber=index+2;
    const item=prepared.valid.find(entry=>entry.rowNumber===rowNumber);
    const issue=prepared.errors.find(entry=>entry.rowNumber===rowNumber);
    const name=item?.product.name||issue?.name||'—';
    const price=item?Number(item.product.price).toLocaleString('en-US'):'—';
    const category=item?.product.category||'—';
    return '<tr class="border-t"><td class="p-2 text-[10px]">'+rowNumber+'</td><td class="p-2 text-[10px]">'+escHtml(name)+'</td><td class="p-2 text-[10px]">'+price+'</td><td class="p-2 text-[10px]">'+escHtml(category)+'</td><td class="p-2 text-[10px] '+(issue?'text-rose-700':'text-emerald-700')+'">'+(issue?escHtml(issue.message):item?'جاهز':'—')+'</td></tr>';
  }).join('');
  const summary=s.headers.length?'<div class="rounded-xl bg-slate-50 p-3 text-xs flex flex-wrap gap-x-4 gap-y-1"><span>إجمالي الصفوف: <b>'+s.rows.length+'</b></span><span class="text-emerald-700">جاهز: <b>'+prepared.valid.length+'</b></span><span class="text-rose-700">به أخطاء: <b>'+prepared.errors.length+'</b></span></div>':'';
  const result=s.result?'<div class="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">تمت الإضافة: <b>'+Number(s.result.importedCount||0)+'</b> • المكرر والمتخطى: <b>'+Number(s.result.duplicateCount||0)+'</b> • صفوف بها أخطاء: <b>'+Number(s.result.errorCount||0)+'</b></div>':'';
  const resultDetails=s.result?[...(s.result.duplicates||[]),...(s.result.errors||[])].slice(0,12).map(item=>'<li class="text-[10px] text-slate-600">الصف '+Number(item.rowNumber||0)+': '+escHtml(item.name||'')+' — '+escHtml(item.message||'تم تخطي الصف')+'</li>').join(''):'';
  const table=prepared.valid.length||prepared.errors.length?'<div class="overflow-x-auto rounded-xl border"><table class="w-full text-right"><thead><tr class="bg-slate-50"><th class="p-2 text-[10px]">صف</th><th class="p-2 text-[10px]">المنتج</th><th class="p-2 text-[10px]">السعر</th><th class="p-2 text-[10px]">القسم</th><th class="p-2 text-[10px]">المراجعة</th></tr></thead><tbody>'+preview+'</tbody></table><p class="text-[10px] text-slate-500 p-2">المعاينة تعرض أول 8 صفوف فقط. سيتم فحص جميع الصفوف عند الاستيراد.</p></div>':'';
  return toggle+'<section class="premium-panel p-4 space-y-3"><div><b class="block text-sm">رفع ملف المنتجات CSV</b><p class="text-[10px] text-slate-500 mt-1">يمكن ربط الأعمدة تلقائيًا أو اختيار العمود يدويًا. اسم المنتج والسعر إلزاميان. المنتجات المكررة بنفس الاسم والقسم سيتم تخطيها، ولن يتم تعديل المنتجات الموجودة.</p></div><input type="file" accept=".csv,text/csv" class="field w-full" onchange="handleStoreCsvFile(this.files&&this.files[0])"><p class="text-[10px] text-slate-500">'+(s.fileName?'الملف: '+escHtml(s.fileName):'يدعم CSV بفواصل أو فاصلة منقوطة أو Tab، مع دعم النصوص العربية.')+'</p>'+mapping+summary+table+result+(resultDetails?'<ul class="rounded-xl bg-slate-50 p-3 space-y-1">'+resultDetails+'</ul>':'')+'<div class="flex gap-2"><button type="button" onclick="importStoreCsvProducts()" '+(!prepared.valid.length||s.busy?'disabled':'')+' class="primary-btn rounded-xl px-4 py-3 flex-1 disabled:opacity-40">'+(s.busy?'جاري الاستيراد...':'استيراد '+prepared.valid.length+' منتج')+'</button><button type="button" onclick="resetStoreCsvImporter()" class="rounded-xl border px-4 py-3 text-xs font-bold">مسح الملف</button></div></section>';
}
function toggleStoreCsvImporter(){storeCsvImportState.open=!storeCsvImportState.open;render();}
function resetStoreCsvImporter(){storeCsvImportState={open:true,fileName:'',headers:[],rows:[],mapping:{},prepared:{valid:[],errors:[]},busy:false,result:null};render();}
async function handleStoreCsvFile(file){
  if(!file)return;
  if(file.size>900*1024)return showToast('حجم ملف CSV كبير. قلل الملف إلى أقل من 900 كيلوبايت أو قسّمه إلى ملفين.','error');
  try{
    const buffer=await file.arrayBuffer();
    let csvText;
    try{csvText=new TextDecoder('utf-8',{fatal:true}).decode(buffer);}catch(_){csvText=new TextDecoder('windows-1256').decode(buffer);}
    const parsed=parseStoreCsvText(csvText);
    if(parsed.headers.length<2||!parsed.rows.length)throw new Error('الملف فارغ أو لا يحتوي على صف عناوين وصفوف منتجات.');
    if(parsed.rows.length>500)throw new Error('الحد الأقصى للاستيراد هو 500 منتج في المرة الواحدة.');
    storeCsvImportState.fileName=file.name||'products.csv';
    storeCsvImportState.headers=parsed.headers;
    storeCsvImportState.rows=parsed.rows;
    storeCsvImportState.mapping=autoMapStoreCsvHeaders(parsed.headers);
    storeCsvImportState.result=null;
    prepareStoreCsvImportRows();
    render();
    showToast('تمت قراءة الملف. راجع المعاينة وربط الأعمدة قبل الاستيراد.');
  }catch(error){showToast(error.message||'تعذرت قراءة ملف CSV.','error');}
}
function updateStoreCsvMapping(select){
  const key=String(select?.dataset?.storeCsvMap||'');
  if(!STORE_CSV_IMPORT_FIELDS.some(field=>field.key===key))return;
  storeCsvImportState.mapping[key]=String(select.value??'');
  storeCsvImportState.result=null;
  prepareStoreCsvImportRows();
  render();
}
async function importStoreCsvProducts(){
  if(storeCsvImportState.busy)return;
  if(storeCsvImportState.mapping.name===''||storeCsvImportState.mapping.price==='')return showToast('اربط عمود اسم المنتج وعمود السعر أولًا.','error');
  const prepared=prepareStoreCsvImportRows();
  if(!prepared.valid.length)return showToast('لا توجد صفوف سليمة للاستيراد. راجع الأخطاء الظاهرة.','error');
  if(!confirm('سيتم إضافة '+prepared.valid.length+' منتج إلى المتجر. المنتجات الموجودة أو المكررة سيتم تخطيها دون تعديلها. هل تريد المتابعة؟'))return;
  storeCsvImportState.busy=true;render();
  try{
    const result=await tryApi(['/api/admin/store/products/import'],{method:'POST',body:JSON.stringify({products:prepared.valid})});
    storeCsvImportState.result=result;
    showToast('تم استيراد '+Number(result.importedCount||0)+' منتج بنجاح.');
    if(Number(result.importedCount||0)>0)await loadStoreProducts();
  }catch(error){showToast(error.message||'تعذر استيراد المنتجات.','error');}
  finally{storeCsvImportState.busy=false;render();}
}

const STORE_PRODUCT_EDIT_SESSION_KEY='hamzawy-admin-store-edit-product';
const STORE_PRODUCT_EDIT_FIELDS=['store-name','store-category','store-category-new','store-price','store-original-price','store-offer','store-type','store-duration','store-description','store-details','store-image-url','store-stock','store-ad-enabled','store-ad-audience','store-ad-priority','store-ad-days'];
function persistStoreProductEditSession(productId){
  try{
    if(!productId){sessionStorage.removeItem(STORE_PRODUCT_EDIT_SESSION_KEY);return;}
    let saved=null;
    try{saved=JSON.parse(sessionStorage.getItem(STORE_PRODUCT_EDIT_SESSION_KEY)||'null');}catch(_){}
    if(!saved||String(saved.productId)!==String(productId))saved={productId:String(productId),values:{}};
    sessionStorage.setItem(STORE_PRODUCT_EDIT_SESSION_KEY,JSON.stringify(saved));
  }catch(_){}
}
function saveStoreProductEditDraft(){
  if(!state.storeProductEditingId)return;
  try{
    const saved={productId:String(state.storeProductEditingId),values:{}};
    STORE_PRODUCT_EDIT_FIELDS.forEach(id=>{
      const element=document.getElementById(id);
      if(element)saved.values[id]=element.type==='checkbox'?element.checked:element.value;
    });
    sessionStorage.setItem(STORE_PRODUCT_EDIT_SESSION_KEY,JSON.stringify(saved));
  }catch(_){}
}
function restoreStoreProductEditSession(){
  if(window.__hamzawyStoreEditRestored||state.tab!=='store')return;
  let saved=null;
  try{
    const raw=sessionStorage.getItem(STORE_PRODUCT_EDIT_SESSION_KEY)||'';
    if(raw){try{saved=JSON.parse(raw);}catch(_){saved={productId:raw,values:{}};}}
  }catch(_){}
  const productId=String(saved?.productId||'');
  if(!productId)return;
  const product=(state.storeProducts||[]).find(item=>String(item._id)===productId);
  if(!product){persistStoreProductEditSession(null);return;}
  window.__hamzawyStoreEditRestored=true;
  editStoreProduct(productId);
  Object.entries(saved.values||{}).forEach(([id,value])=>{
    if(!STORE_PRODUCT_EDIT_FIELDS.includes(id))return;
    const element=document.getElementById(id);
    if(element){if(element.type==='checkbox')element.checked=!!value;else element.value=String(value??'');}
  });
}
if(!window.__hamzawyStoreEditDraftListener){
  document.addEventListener('input',saveStoreProductEditDraft,true);
  document.addEventListener('change',saveStoreProductEditDraft,true);
  window.__hamzawyStoreEditDraftListener=true;
}
let storeProductsLoadSequence=0;
async function loadStoreProducts(){
  const requestId=++storeProductsLoadSequence;
  state.storeProductsLoading=true;
  state.storeAdSettingsLoading=true;
  state.storeAdSettingsLoadError='';
  if(state.tab==='store')render();
  try{
    const data=await tryApi(['/api/admin/store/products'],{cache:'no-store'});
    const products=Array.isArray(data?.products)?data.products:(Array.isArray(data)?data:null);
    if(!products)throw new Error('استجابة قائمة المنتجات غير صالحة.');
    if(requestId!==storeProductsLoadSequence)return;
    state.storeProducts=products;
    state.storeProductsLoaded=true;
    state.storeCategories=Array.isArray(data?.categories)?data.categories:[];
    state.storeProductsLoadError='';
  }catch(error){
    if(requestId===storeProductsLoadSequence){
      state.storeProductsLoadError=error.message||'تعذر تحميل المنتجات';
      showToast('تعذر تحميل المنتجات؛ لم نغيّر البيانات المحفوظة.','error');
    }
  }
  try{
    const settings=await tryApi(['/api/admin/store/ad-settings'],{cache:'no-store'});
    if(requestId===storeProductsLoadSequence){
      const seconds=Number(settings?.rotationSeconds);
      if([5,10,15,20,30,45,60].includes(seconds)){
        state.storeAdRotationSeconds=seconds;
        state.storeAdSettingsLoaded=true;
        state.storeAdSettingsLoadError='';
      }else{
        state.storeAdSettingsLoadError='استجابة إعداد مدة عرض الإعلان غير صالحة.';
      }
    }
  }catch(error){
    if(requestId===storeProductsLoadSequence){
      state.storeAdSettingsLoadError=error.message||'تعذر تحميل إعداد مدة عرض الإعلان';
    }
  }finally{
    if(requestId===storeProductsLoadSequence){
      state.storeProductsLoading=false;
      state.storeAdSettingsLoading=false;
      if(state.tab==='store'){
        render();
        restoreStoreProductEditSession();
      }
    }
  }
}
async function loadStoreOrders(){state.storeOrdersLoading=true;if(state.tab==='storeOrders')render();try{const d=await tryApi(['/api/admin/store/orders']);state.storeOrders=extractList(d,['orders']);state.storeOrdersPendingCount=state.storeOrders.filter(o=>o.status==='جديد').length;}catch(e){state.storeOrders=[];showToast(e.message||'تعذر تحميل المعاملات','error');}finally{state.storeOrdersLoading=false;if(state.tab==='storeOrders')render();}}
async function loadStoreOrderCount(silent=false){try{const d=await tryApi(['/api/admin/store/orders/count']);const next=Math.max(0,Number(d.pendingCount)||0);const previous=Number(state.storeOrdersPendingCount||0);state.storeOrdersPendingCount=next;if(next>previous&&previous>=0&&state.storeOrderCountInitialized){showToast('وصلك طلب جديد في متجر حمزاوي سات','warning');}state.storeOrderCountInitialized=true;if(!silent&&state.pageMode==='home')render();}catch(_){}}
async function pollStoreAdminNotifications(){try{const data=await tryApi(['/api/notifications/admin'],{method:'GET'});const items=extractList(data,['notifications']);const fresh=items.filter(item=>item.type==='admin_store_order'&&!item.read);const seen=new Set(state.seenStoreOrderNotificationIds||[]);if(state.storeAdminNotificationsInitialized){fresh.filter(item=>!seen.has(String(item.id))).slice(0,3).forEach(item=>showToast((item.title||'طلب متجر جديد')+' — '+(item.message||''),'warning'));}state.seenStoreOrderNotificationIds=items.map(item=>String(item.id)).slice(0,100);state.storeAdminNotificationsInitialized=true;}catch(_){}}
function startStoreOrderCountPolling(){if(window.__sonaaStoreOrderCountTimer||!getToken())return;loadStoreOrderCount(true);pollStoreAdminNotifications();window.__sonaaStoreOrderCountTimer=setInterval(()=>{if(!document.hidden&&getToken()){loadStoreOrderCount(true);pollStoreAdminNotifications();}},15000);document.addEventListener('visibilitychange',()=>{if(!document.hidden&&getToken()){loadStoreOrderCount(true);pollStoreAdminNotifications();}});}
(function attachStoreOrdersCount(){const item=(typeof ADMIN_SECTIONS!=='undefined'?ADMIN_SECTIONS:[]).flatMap(section=>section.tabs||[]).find(tab=>tab.id==='storeOrders');if(item)item.count=()=>Math.max(0,Number(state.storeOrdersPendingCount)||0);})();
async function saveStoreAdRotationSeconds(){const seconds=Number(document.getElementById('store-ad-rotation-seconds')?.value);if(![5,10,15,20,30,45,60].includes(seconds))return showToast('اختار مدة صحيحة لعرض الصورة','error');try{const result=await tryApi(['/api/admin/store/ad-settings'],{method:'PUT',body:JSON.stringify({rotationSeconds:seconds})});state.storeAdRotationSeconds=Number(result.rotationSeconds)||seconds;state.storeAdSettingsLoaded=true;state.storeAdSettingsLoadError='';showToast('تم حفظ مدة عرض صور الإعلان');render();}catch(error){showToast(error.message||'تعذر حفظ مدة الإعلان','error');}}
function toggleStoreProductForm(){persistStoreProductEditSession(null);state.storeProductEditingId=null;state.storeProductFormOpen=state.storeProductFormOpen!==true;render();}
function cancelStoreProductEdit(){persistStoreProductEditSession(null);state.storeProductEditingId=null;state.storeProductFormOpen=false;state.storeNewProductAsAdvertisement=false;render();}
function setStoreOrderStatusTab(status){if(!['جديد','تم التواصل','قيد التجهيز','مرفوض','ملغي','مكتمل'].includes(status))return;state.storeOrderStatusTab=status;render();}

function toggleStoreCategoryManager(){state.storeCategoryManagerOpen=state.storeCategoryManagerOpen!==true;render();}
function toggleStoreAdRotationSettings(){state.storeAdRotationSettingsOpen=state.storeAdRotationSettingsOpen!==true;render();}
function renderStoreCategoryManager(products){
  if(typeof state.storeCategoryManagerOpen!=='boolean')state.storeCategoryManagerOpen=false;
  const categories=Array.isArray(state.storeCategories)&&state.storeCategories.length?state.storeCategories:Array.from(new Set((products||[]).map(product=>String(product.category||'عام').trim()||'عام'))).sort((a,b)=>a.localeCompare(b,'ar')).map(name=>{const items=(products||[]).filter(product=>(String(product.category||'عام').trim()||'عام')===name);const cover=items.find(product=>String(product.imageUrl||'').trim())||items[0];return {name,productCount:items.length,imageUrl:cover?.imageUrl||'',fallbackImageUrl:cover?.imageUrl||'',customImageUrl:'',imageFileId:null,hasCustomImage:false};});
  const rows=categories.map(category=>{
    const preview=category.imageUrl||category.fallbackImageUrl||'';
    return '<article data-store-category-row data-original-name="'+escHtml(category.name)+'" data-custom-image-url="'+escHtml(category.customImageUrl||'')+'" data-image-file-id="'+escHtml(category.imageFileId||'')+'" class="rounded-2xl border border-slate-200 bg-white p-3 space-y-2">'+
      '<div class="flex items-center gap-3"><div class="w-16 h-16 rounded-xl overflow-hidden bg-slate-100 shrink-0">'+(preview?'<img src="'+escHtml(preview)+'" alt="'+escHtml(category.name)+'" class="w-full h-full object-contain">':'<div class="w-full h-full flex items-center justify-center text-2xl">📦</div>')+'</div><div class="min-w-0 flex-1"><b class="block text-sm">'+escHtml(category.name)+'</b><span class="text-[10px] text-slate-500">'+Number(category.productCount||0)+' منتج • '+(category.hasCustomImage?'صورة مخصصة':'صورة تلقائية من المنتجات')+'</span></div></div>'+
      '<label class="block text-[11px] font-bold text-slate-600">اسم القسم<input data-category-name maxlength="80" class="field mt-1" value="'+escHtml(category.name)+'"></label>'+
      '<label class="block text-[11px] font-bold text-slate-600">رابط صورة مخصصة (اختياري)<input data-category-image-url type="url" inputmode="url" maxlength="1000" class="field mt-1" value="'+escHtml(category.customImageUrl||'')+'" placeholder="اتركه فارغًا لاستخدام صورة من المنتجات"></label>'+
      '<label class="block text-[11px] font-bold text-slate-600">أو اختر صورة من الجهاز<input data-category-image-file type="file" accept="image/jpeg,image/png,image/webp" class="field mt-1"></label>'+
      '<p class="text-[10px] text-slate-500">لو رفعت صورة هنا هتكون هي صورة القسم عند العميل والفني. ولو مسحت الصورة المخصصة هيرجع للصورة التلقائية.</p>'+
      '<div class="flex gap-2"><button type="button" onclick="saveStoreCategoryFromButton(this)" class="primary-btn rounded-xl px-4 py-2 flex-1 text-xs">حفظ القسم</button><button type="button" onclick="deleteStoreCategoryFromButton(this)" '+(category.name==='عام'?'disabled title="القسم الافتراضي لا يمكن حذفه"':'')+' class="rounded-xl border border-rose-200 px-4 py-2 text-xs font-bold text-rose-700 disabled:opacity-40">حذف</button></div>'+
    '</article>';
  }).join('');
  const isOpen=state.storeCategoryManagerOpen===true;
  return '<section class="premium-panel overflow-hidden"><button type="button" onclick="toggleStoreCategoryManager()" aria-expanded="'+(isOpen?'true':'false')+'" class="w-full p-4 flex items-center justify-between gap-3 text-right"><span><b class="block text-sm">إدارة أقسام المتجر</b><span class="block mt-1 text-[10px] text-slate-500">اضغط لفتح أو إغلاق إعدادات الأقسام والصور</span></span><span class="text-xl font-black transition-transform '+(isOpen?'rotate-180':'')+'" aria-hidden="true">⌄</span></button>'+(isOpen?'<div class="border-t border-slate-100 p-4 space-y-3">'+(rows||'<p class="text-xs text-slate-500">أضف أول منتج بقسم جديد علشان يظهر هنا.</p>')+'</div>':'')+'</section>';
}
async function uploadStoreCategoryImage(file){
  if(!file)return null;
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>20*1024*1024)throw new Error('اختار صورة JPG أو PNG أو WebP لا تتجاوز 20 ميجابايت.');
  const optimized=await optimizeStoreProductImage(file);
  if(optimized.size>5*1024*1024)throw new Error('حجم الصورة بعد الضغط ما زال أكبر من 5 ميجابايت. اختار صورة أصغر.');
  const response=await fetch('/api/admin/store/media?purpose=category',{method:'POST',headers:{Authorization:'Bearer '+getToken(),'Content-Type':optimized.type},body:optimized});
  const result=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(result.message||'تعذر رفع صورة القسم.');
  return result;
}
async function saveStoreCategoryFromButton(button){
  const row=button?.closest('[data-store-category-row]');
  if(!row)return;
  const oldName=String(row.dataset.originalName||'');
  const name=String(row.querySelector('[data-category-name]')?.value||'').trim();
  let imageUrl=String(row.querySelector('[data-category-image-url]')?.value||'').trim();
  let imageFileId=null;
  const imageFile=row.querySelector('[data-category-image-file]')?.files?.[0]||null;
  if(name.length<2||name.length>80)return showToast('اسم القسم لازم يكون من حرفين إلى 80 حرفًا.','error');
  try{
    if(imageFile){
      const uploaded=await uploadStoreCategoryImage(imageFile);
      imageUrl=uploaded.imageUrl;
      imageFileId=uploaded.imageFileId;
    }else if(imageUrl){
      if(imageUrl===String(row.dataset.customImageUrl||'')&&row.dataset.imageFileId)imageFileId=row.dataset.imageFileId;
      else{
        let parsed;try{parsed=new URL(imageUrl);}catch(_){return showToast('اكتب رابط صورة يبدأ بـ https:// أو http:// أو ارفع صورة من الجهاز.','error');}
        if(!['http:','https:'].includes(parsed.protocol))return showToast('رابط صورة القسم غير صالح.','error');
      }
    }
    await tryApi(['/api/admin/store/categories/'+encodeURIComponent(oldName)],{method:'PUT',body:JSON.stringify({name,imageUrl,imageFileId})});
    showToast('تم حفظ القسم وصورته.');
    await loadStoreProducts();
  }catch(error){showToast(error.message||'تعذر حفظ القسم.','error');}
}
async function deleteStoreCategoryFromButton(button){
  const row=button?.closest('[data-store-category-row]');
  if(!row)return;
  const name=String(row.dataset.originalName||'');
  if(name==='عام')return showToast('لا يمكن حذف قسم عام الافتراضي.','error');
  if(!confirm('حذف قسم "'+name+'"؟ المنتجات الموجودة فيه هتتنقل إلى قسم عام، ومش هتتمسح المنتجات نفسها.'))return;
  try{
    const result=await tryApi(['/api/admin/store/categories/'+encodeURIComponent(name)],{method:'DELETE'});
    showToast(result.message||'تم حذف القسم.');
    await loadStoreProducts();
  }catch(error){showToast(error.message||'تعذر حذف القسم.','error');}
}

function renderStore(){
  if(typeof state.storeProductFormOpen!=='boolean')state.storeProductFormOpen=false;
  if(typeof state.storeNewProductAsAdvertisement!=='boolean')state.storeNewProductAsAdvertisement=false;
  const products=state.storeProducts||[];
  const categoryOptions=Array.from(new Set(['عام',...products.map(p=>String(p.category||'عام').trim()).filter(Boolean),...(Array.isArray(state.storeCategories)?state.storeCategories.map(category=>String(category.name||'').trim()).filter(Boolean):[])])).filter(Boolean).sort((a,b)=>a.localeCompare(b,'ar')).map(category=>'<option value="'+escHtml(category)+'">'+escHtml(category)+'</option>').join('');
  const hasRotationSettings=state.storeAdSettingsLoaded&&[5,10,15,20,30,45,60].includes(Number(state.storeAdRotationSeconds));
  const rotationOptions=[5,10,15,20,30,45,60].map(seconds=>'<option value="'+seconds+'" '+(Number(state.storeAdRotationSeconds)===seconds?'selected':'')+'>'+seconds+(seconds===5||seconds===10||seconds===20||seconds===30||seconds===45||seconds===60?' ثوانٍ':' ثانية')+'</option>').join('');
  if(typeof state.storeAdRotationSettingsOpen!=='boolean')state.storeAdRotationSettingsOpen=false;
  const rotationOpen=state.storeAdRotationSettingsOpen===true;
  const rotationBody=hasRotationSettings
    ? '<div class="p-4 space-y-2"><p class="text-[11px] text-slate-500">حدد عدد الثواني التي تظهر فيها كل صورة قبل الانتقال للصورة التالية، ويُطبق الإعداد على العميل والفني.</p><div class="flex items-center gap-2"><select id="store-ad-rotation-seconds" class="field flex-1">'+rotationOptions+'</select><button type="button" onclick="saveStoreAdRotationSeconds()" class="primary-btn rounded-xl px-4 py-3">حفظ المدة</button></div></div>'
    : '<div class="p-4 space-y-2"><p class="text-[11px] text-slate-500">'+(state.storeAdSettingsLoading||(!state.storeAdSettingsLoaded&&!state.storeAdSettingsLoadError)?'جاري تحميل المدة المحفوظة من الخادم...':'تعذر تحميل المدة المحفوظة؛ لم نعرض قيمة افتراضية بدلًا منها.')+'</p><button type="button" onclick="loadStoreProducts()" class="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold">إعادة تحميل إعدادات المتجر</button></div>';
  const rotationSettings='<section class="premium-panel overflow-hidden"><button type="button" onclick="toggleStoreAdRotationSettings()" aria-expanded="'+(rotationOpen?'true':'false')+'" class="w-full p-4 flex items-center justify-between gap-3 text-right"><span><b class="block text-sm">مدة عرض صورة الإعلان</b><span class="block mt-1 text-[10px] text-slate-500">اضغط لفتح أو إغلاق إعداد مدة ظهور كل صورة</span></span><span class="text-xl font-black transition-transform '+(rotationOpen?'rotate-180':'')+'" aria-hidden="true">⌄</span></button>'+(rotationOpen?'<div class="border-t border-slate-100">'+rotationBody+'</div>':'')+'</section>';
  const form='<div class="premium-panel overflow-hidden"><button type="button" onclick="toggleStoreProductForm()" aria-expanded="'+(state.storeProductFormOpen?'true':'false')+'" class="w-full p-4 flex items-center justify-between gap-3 text-right"><span><b class="block text-sm">إضافة منتج جديد</b><span class="block mt-1 text-[11px] text-slate-500">افتح النموذج لإدخال بيانات المنتج</span></span><span class="text-xl font-black transition-transform '+(state.storeProductFormOpen?'rotate-180':'')+'" aria-hidden="true">⌄</span></button>'+
    (state.storeProductFormOpen?'<div class="border-t border-slate-100 p-4 grid gap-2"><input id="store-name" class="field" placeholder="اسم المنتج"><div class="grid grid-cols-2 gap-2"><label class="block min-w-0"><span class="block text-[10px] font-bold text-slate-600 mb-1">اختار قسمًا موجودًا</span><select id="store-category" class="field w-full"><option value="">اختار قسمًا</option>'+categoryOptions+'</select></label><label class="block min-w-0"><span class="block text-[10px] font-bold text-slate-600 mb-1">أو اكتب قسمًا جديدًا</span><input id="store-category-new" class="field w-full" maxlength="80" placeholder="اسم القسم الجديد"></label></div><input id="store-price" type="number" min="0" class="field" placeholder="السعر الحالي بالجنيه"><input id="store-original-price" type="number" min="0" class="field" placeholder="السعر قبل العرض (اختياري)"><input id="store-offer" class="field" maxlength="200" placeholder="تفاصيل العرض (اختياري)"><select id="store-type" class="field"><option value="product">بضاعة ومنتج</option><option value="subscription">اشتراك أو تجديد اشتراك</option></select><input id="store-duration" class="field" maxlength="60" placeholder="مدة الاشتراك (مثال: شهر أو سنة)"><textarea id="store-description" class="field" placeholder="الوصف المختصر"></textarea><textarea id="store-details" class="field" placeholder="التفاصيل والمواصفات"></textarea><label class="block text-xs font-bold text-slate-700">رابط صورة المنتج (اختياري)<input id="store-image-url" type="url" inputmode="url" maxlength="1000" class="field mt-1" placeholder="https://example.com/product-image.jpg"><span class="mt-1 block text-[10px] font-normal text-slate-500">ضع رابط الصورة هنا، أو اتركه فارغًا واستخدم الرفع من جهازك.</span></label><label class="field block">رفع صورة من الجهاز (اختياري)<input id="store-image-file" type="file" accept="image/jpeg,image/png,image/webp" class="block w-full mt-2 text-xs"></label><input id="store-stock" type="number" min="0" class="field" placeholder="الكمية (اتركها فارغة بدون تحديد)"><label class="flex items-center gap-2 rounded-xl border p-3 text-xs font-bold"><input id="store-ad-enabled" type="checkbox" '+(state.storeNewProductAsAdvertisement?'checked':'')+'> نشر المنتج كشريط إعلاني أسفل الصفحة</label><select id="store-ad-audience" class="field"><option value="both">الإعلان للعميل والفني</option><option value="client">للعميل فقط</option><option value="fanni">للفني فقط</option></select><select id="store-ad-days" class="field"><option value="1">مدة الإعلان: يوم واحد</option><option value="3">3 أيام</option><option value="7" selected>أسبوع</option><option value="14">أسبوعان</option><option value="30">شهر</option><option value="60">شهران</option><option value="90">3 شهور</option><option value="180">6 شهور</option><option value="365">سنة</option></select><select id="store-ad-priority" class="field"><option value="0">الأولوية: عادية</option><option value="10">منخفضة</option><option value="20">20</option><option value="30">30</option><option value="40">40</option><option value="50">متوسطة</option><option value="60">60</option><option value="70">70</option><option value="80">مرتفعة</option><option value="90">90</option><option value="100">الأولوية القصوى</option></select><button type="button" onclick="createStoreProduct()" class="primary-btn rounded-xl py-3">إضافة المنتج</button></div>':'')+'</div>';
  const csvImporter=renderStoreCsvImportPanel();
    const cards=products.map(p=>'<article class="premium-card p-3 flex gap-3"><div class="w-16 h-16 bg-slate-100 rounded-xl overflow-hidden shrink-0">'+(p.imageUrl?'<img class="w-full h-full object-contain" src="'+escHtml(p.imageUrl)+'" alt="'+escHtml(p.name)+'">':'📦')+'</div><div class="min-w-0 flex-1"><b>'+escHtml(p.name)+'</b><p class="text-[10px] font-bold text-blue-700">القسم: '+escHtml(p.category||'عام')+'</p><p class="text-[11px]">'+escHtml(p.description||'')+'</p><p class="text-[10px] text-teal-700">'+(p.type==='subscription'?'اشتراك / تجديد':'منتج')+(p.offerText?' • '+escHtml(p.offerText):'')+'</p><b>'+Number(p.price||0).toLocaleString('ar-EG')+' جنيه</b>'+(p.originalPrice!=null&&Number(p.originalPrice)>Number(p.price)?'<p class="text-[10px] line-through text-slate-400">بدلًا من '+Number(p.originalPrice).toLocaleString('ar-EG')+' جنيه</p>':'')+'<p class="text-[10px]">'+(p.isActive?'متاح':'مخفي')+' • '+(p.isAdvertised?'إعلان نشط':'بدون إعلان')+'</p><button class="text-teal-700 text-xs" onclick="manageStoreProductAdvertisement(\''+escHtml(p._id)+'\')">'+(p.isAdvertised?'إيقاف الإعلان':'نشر الإعلان')+'</button> <button class="text-blue-700 text-xs" onclick="editStoreProduct(\''+escHtml(p._id)+'\')">تعديل</button> <label class="text-xs text-blue-700">تغيير الصورة<input type="file" class="hidden" data-product-id="'+escHtml(p._id)+'" accept="image/jpeg,image/png,image/webp" onchange="replaceStoreProductImage(this.dataset.productId,this.files[0])"></label> '+(p.isActive?'<button class="text-rose-700 text-xs" onclick="hideStoreProduct(\''+escHtml(p._id)+'\')">إخفاء</button>':'<button class="text-emerald-700 text-xs" onclick="showStoreProduct(\''+escHtml(p._id)+'\')">إظهار</button>')+' <button class="text-red-700 text-xs font-bold" onclick="deleteStoreProduct(\''+escHtml(p._id)+'\')">حذف نهائي</button></div></article>').join('');
  const refreshStatus=state.storeProductsLoading&&products.length?'<div class="text-[11px] text-slate-500">جاري تحديث قائمة المنتجات مع الاحتفاظ بالقائمة الحالية...</div>':(state.storeProductsLoadError&&products.length?'<div class="premium-panel p-3 text-[11px] text-amber-800 flex items-center justify-between gap-2"><span>تعذر تحديث القائمة. المعروض هو آخر بيانات محفوظة.</span><button type="button" class="font-black underline" onclick="loadStoreProducts()">إعادة المحاولة</button></div>':'');
  const emptyProductsState=!state.storeProductsLoaded&&products.length===0&&state.storeProductsLoadError?'<div class="premium-panel p-5 text-center text-sm text-amber-800">تعذر تحميل المنتجات المحفوظة. <button type="button" class="font-black underline" onclick="loadStoreProducts()">إعادة المحاولة</button></div>':!state.storeProductsLoaded&&products.length===0?'<div class="premium-panel p-5 text-center text-sm text-slate-500">جاري تحميل المنتجات المحفوظة...</div>':(cards||'<div class="premium-panel p-5">لا توجد منتجات بعد.</div>');
  const productManagement='<section class="space-y-3"><div class="px-1"><b class="block text-sm">إدارة المنتجات</b><p class="mt-1 text-[10px] text-slate-500">استيراد المنتجات من CSV وإضافة المنتجات وتعديلها ومراجعة القائمة الحالية.</p></div>'+csvImporter+form+'<section class="premium-panel p-4 space-y-3"><b class="block text-sm">المنتجات الحالية ('+(state.storeProductsLoading&&products.length===0?'...':products.length)+')</b>'+refreshStatus+emptyProductsState+'</section></section>';
  const storeManagement='<section class="space-y-3"><div class="px-1"><b class="block text-sm">إعدادات المتجر</b><p class="mt-1 text-[10px] text-slate-500">إدارة أقسام المتجر والتحكم في مدة عرض الإعلانات.</p></div>'+renderStoreCategoryManager(products)+rotationSettings+'</section>';
  return '<section class="mt-4 space-y-5">'+storeManagement+productManagement+'</section>';
}
function renderStoreOrders(){
  if(typeof state.storeOrderStatusTab!=='string')state.storeOrderStatusTab='جديد';
  const statuses=[{value:'جديد',label:'طلب جديد'},{value:'تم التواصل',label:'تم التواصل'},{value:'قيد التجهيز',label:'جاري التجهيز'},{value:'مرفوض',label:'مرفوض'},{value:'ملغي',label:'ملغي'},{value:'مكتمل',label:'مكتمل'}];
  const rows=state.storeOrders||[];
  const selected=statuses.some(item=>item.value===state.storeOrderStatusTab)?state.storeOrderStatusTab:'جديد';
  state.storeOrderStatusTab=selected;
  const filtered=rows.filter(o=>String(o.status||'جديد')===selected);
  const tabs=statuses.map(item=>{
    const count=rows.filter(o=>String(o.status||'جديد')===item.value).length;
    return '<button type="button" onclick="setStoreOrderStatusTab(\''+item.value+'\')" class="rounded-xl px-3 py-2 text-[11px] font-black border '+(selected===item.value?'bg-blue-700 text-white border-blue-700':'bg-white text-slate-700 border-slate-200')+'">'+item.label+' <span class="mr-1">'+count+'</span></button>';
  }).join('');
  const cards=filtered.map(o=>{
    const items=Array.isArray(o.items)&&o.items.length?o.items:[{productName:o.productName,productType:o.productType,quantity:o.quantity,unitPrice:o.unitPrice,total:o.total}];
    const itemRows=items.map(item=>'<div class="flex items-center justify-between gap-3 border-t border-slate-100 py-2"><div class="min-w-0"><b class="block text-[11px]">'+escHtml(item.productName||'منتج')+'</b><span class="text-[10px] text-slate-500">الكمية: '+Number(item.quantity||0)+' × '+Number(item.unitPrice||0).toLocaleString('ar-EG')+' جنيه</span></div><b class="shrink-0 text-[11px]">'+Number(item.total||0).toLocaleString('ar-EG')+' جنيه</b></div>').join('');
    return '<article class="premium-card p-3 space-y-2"><b>'+escHtml(o.productName||'طلب متجر')+'</b><p class="text-[10px]">'+(items.length>1?'طلب متعدد المنتجات':items[0]?.productType==='subscription'?'اشتراك / تجديد':'بضاعة')+' • '+escHtml(o.buyerName)+' • '+escHtml(o.buyerPhone)+' • '+(o.buyerRole==='client'?'عميل':'فني')+'</p><div class="rounded-xl bg-slate-50 px-3">'+itemRows+'</div><p class="text-xs font-black">إجمالي الطلب: '+Number(o.total||0).toLocaleString('ar-EG')+' جنيه • '+Number(o.quantity||0)+' قطعة</p><p class="text-[10px]">الحالة الحالية: '+escHtml(o.status||'جديد')+' • الدفع: '+escHtml(o.paymentMethod||'غير محدد')+' ('+escHtml(o.paymentStatus||'غير مدفوع')+')</p>'+(o.transactionNumber?'<p class="text-[10px] font-bold text-blue-700" dir="ltr">رقم العملية: '+escHtml(o.transactionNumber)+'</p>':'<p class="text-[10px] text-slate-500" dir="ltr">رقم الطلب: '+escHtml(o._id||'')+'</p>')+(o.refundTransactionNumber?'<p class="text-[10px] font-bold text-emerald-700" dir="ltr">رقم الاسترداد: '+escHtml(o.refundTransactionNumber)+'</p>':'')+'<p class="text-[10px]">'+escHtml(o.buyerNote||'لا توجد ملاحظات')+'</p><select class="field" id="store-status-'+escHtml(o._id)+'">'+statuses.map(status=>'<option value="'+status.value+'" '+((o.status||'جديد')===status.value?'selected':'')+'>'+status.label+'</option>').join('')+'</select><select class="field" id="store-payment-'+escHtml(o._id)+'"><option value="غير محدد" '+(!o.paymentMethod||o.paymentMethod==='غير محدد'?'selected':'')+'>طريقة الدفع لم تحدد</option><option value="محفظة العميل" '+(o.paymentMethod==='محفظة العميل'?'selected':'')+'>محفظة العميل</option><option value="محفظة الفني" '+(o.paymentMethod==='محفظة الفني'?'selected':'')+'>محفظة الفني</option><option value="عند الاستلام" '+(o.paymentMethod==='عند الاستلام'?'selected':'')+'>عند الاستلام</option><option value="تحويل" '+(o.paymentMethod==='تحويل'?'selected':'')+'>تحويل</option></select><input class="field" id="store-note-'+escHtml(o._id)+'" placeholder="ملاحظة للمشتري" value="'+escHtml(o.adminNote||'')+'"><button class="primary-btn rounded-xl py-2 w-full" onclick="updateStoreOrder(\''+escHtml(o._id)+'\')">حفظ الحالة وطريقة الدفع وإشعار صاحب الطلب</button></article>';
  }).join('')
  return '<section class="mt-4 space-y-3"><div class="premium-panel p-3"><b>طلبات ومبيعات المتجر</b><p class="text-[10px] text-slate-500">كل طلب يظهر في تبويب حالته الحالية، وينتقل تلقائيًا بعد حفظ الحالة الجديدة.</p></div><div class="flex flex-wrap gap-2">'+tabs+'</div>'+(state.storeOrdersLoading?'<div class="premium-panel p-5">جاري التحميل...</div>':cards||'<div class="premium-panel p-5 text-center text-sm text-slate-500">لا توجد طلبات في هذه الحالة.</div>')+'</section>';
}
async function optimizeStoreProductImage(file){try{if(typeof createImageBitmap!=='function')return file;const bitmap=await createImageBitmap(file);const scale=Math.min(1,1600/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));const context=canvas.getContext('2d');if(!context){bitmap.close?.();return file;}context.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close?.();const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',0.82));if(!blob||!blob.type||blob.size>=file.size)return file;return new File([blob],file.name.replace(/\\.[^.]+$/,'')+'.webp',{type:blob.type});}catch(_){return file;}}
async function uploadStoreProductImage(file){if(!file)return null;if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>20*1024*1024)throw new Error('اختار صورة JPG أو PNG أو WebP لا تتجاوز 20 ميجابايت.');const optimized=await optimizeStoreProductImage(file);if(optimized.size>5*1024*1024)throw new Error('حجم الصورة بعد الضغط ما زال أكبر من 5 ميجابايت. اختار صورة أصغر.');const response=await fetch('/api/admin/store/media',{method:'POST',headers:{Authorization:'Bearer '+getToken(),'Content-Type':optimized.type},body:optimized});const result=await response.json().catch(()=>({}));if(!response.ok)throw new Error(result.message||'تعذر رفع الصورة إلى MongoDB.');return result;}
async function replaceStoreProductImage(id,file){const p=(state.storeProducts||[]).find(x=>String(x._id)===String(id));if(!p||!file)return;try{const uploaded=await uploadStoreProductImage(file);await tryApi(['/api/admin/store/products/'+encodeURIComponent(id)],{method:'PUT',body:JSON.stringify({name:p.name,category:p.category||'عام',description:p.description||'',details:p.details||'',price:Number(p.price),originalPrice:p.originalPrice??null,offerText:p.offerText||'',type:p.type||'product',subscriptionDuration:p.subscriptionDuration||'',imageUrl:uploaded.imageUrl,imageFileId:uploaded.imageFileId,isActive:p.isActive!==false,stock:p.stock??null,isAdvertised:!!p.isAdvertised,adAudience:p.adAudience||'both',adPriority:Number(p.adPriority)||0,adExpiresAt:p.adExpiresAt||null})});showToast('تم حفظ الصورة داخل MongoDB');await loadStoreProducts();}catch(e){showToast(e.message||'تعذر تغيير الصورة','error');}}
async function createStoreProduct(){const editingProduct=(state.storeProducts||[]).find(p=>String(p._id)===String(state.storeProductEditingId||''))||null;
  const name=document.getElementById('store-name')?.value.trim()||'';
  const category=String(document.getElementById('store-category-new')?.value||'').trim().slice(0,80)||String(document.getElementById('store-category')?.value||'').trim().slice(0,80)||'عام';
  const price=Number(document.getElementById('store-price')?.value);
  const originalRaw=document.getElementById('store-original-price')?.value;
  const offerText=document.getElementById('store-offer')?.value||'';
  const type=document.getElementById('store-type')?.value||'product';
  const subscriptionDuration=document.getElementById('store-duration')?.value||'';
  const description=document.getElementById('store-description')?.value||'';
  const details=document.getElementById('store-details')?.value||'';
  const imageUrlInput=(document.getElementById('store-image-url')?.value||'').trim();
  const imageFile=document.getElementById('store-image-file')?.files?.[0]||null;
  const raw=document.getElementById('store-stock')?.value;
  const isAdvertised=!!document.getElementById('store-ad-enabled')?.checked;
  if(name.length<2||document.getElementById('store-price')?.value===''||!Number.isFinite(price)||price<0)return showToast('اكتب اسم المنتج وسعرًا صحيحًا','error');
  if(imageUrlInput&&!imageUrlInput.startsWith('/api/store/media/')){let parsedImageUrl;try{parsedImageUrl=new URL(imageUrlInput);}catch(_){return showToast('اكتب رابط صورة صحيحًا يبدأ بـ https:// أو http://','error');}if(!['http:','https:'].includes(parsedImageUrl.protocol)||imageUrlInput.length>1000)return showToast('اكتب رابط صورة صحيحًا يبدأ بـ https:// أو http://','error');}
  try{
    // If both are supplied, prefer the URL; otherwise preserve the existing upload flow.
    const uploaded=imageFile?await uploadStoreProductImage(imageFile):null;
    const imageUrl=uploaded?.imageUrl||imageUrlInput||editingProduct?.imageUrl||'';
    const imageFileId=uploaded?.imageFileId||(imageUrlInput===String(editingProduct?.imageUrl||'')?editingProduct?.imageFileId||null:null);
    const saved=await tryApi([editingProduct?'/api/admin/store/products/'+encodeURIComponent(editingProduct._id):'/api/admin/store/products'],{method:editingProduct?'PUT':'POST',body:JSON.stringify({
      name,category,price,originalPrice:originalRaw===''?null:Number(originalRaw),offerText,type,subscriptionDuration,
      description,details,imageUrl,imageFileId,isActive:editingProduct?editingProduct.isActive!==false:true,stock:raw===''?null:Number(raw),
      isAdvertised,adAudience:document.getElementById('store-ad-audience')?.value||'both',
      adPriority:Math.max(0,Math.min(100,Number(document.getElementById('store-ad-priority')?.value)||0)),
      adExpiresAt:isAdvertised?new Date(Date.now()+Math.max(1,Math.min(365,Number(document.getElementById('store-ad-days')?.value)||7))*86400000).toISOString():null
    })});
    if(saved?.product){const savedProduct=saved.product;const current=Array.isArray(state.storeProducts)?state.storeProducts:[];const index=current.findIndex(item=>String(item._id)===String(savedProduct._id));state.storeProducts=index>=0?current.map((item,i)=>i===index?savedProduct:item):[savedProduct,...current];}
    showToast(editingProduct?'تم تعديل المنتج':'تمت إضافة المنتج');persistStoreProductEditSession(null);state.storeProductEditingId=null;state.storeProductFormOpen=false;
    await loadStoreProducts();
  }catch(e){showToast(e.message||'تعذرت إضافة المنتج','error');}
}
function editStoreProduct(id){const p=(state.storeProducts||[]).find(x=>String(x._id)===String(id));if(!p)return;persistStoreProductEditSession(id);state.storeProductEditingId=String(id);state.storeProductFormOpen=true;render();const values={'store-name':p.name,'store-category':p.category||'عام','store-price':p.price,'store-original-price':p.originalPrice??'','store-offer':p.offerText||'','store-type':p.type||'product','store-duration':p.subscriptionDuration||'','store-description':p.description||'','store-details':p.details||'','store-image-url':p.imageUrl||'','store-stock':p.stock??'','store-ad-audience':p.adAudience||'both','store-ad-priority':String(p.adPriority??0)};Object.entries(values).forEach(([id,value])=>{const el=document.getElementById(id);if(el)el.value=String(value);});const newCategoryInput=document.getElementById('store-category-new');if(newCategoryInput)newCategoryInput.value='';const ad=document.getElementById('store-ad-enabled');if(ad)ad.checked=!!p.isAdvertised;const button=document.querySelector('[onclick="createStoreProduct()"]');if(button)button.textContent='حفظ التعديل';const title=document.querySelector('.premium-panel button[onclick="toggleStoreProductForm()"] b');if(title)title.textContent='تعديل المنتج';const days=document.getElementById('store-ad-days');if(days&&p.adExpiresAt){const left=Math.max(1,Math.ceil((new Date(p.adExpiresAt).getTime()-Date.now())/86400000));days.value=String([1,3,7,14,30,60,90,180,365].includes(left)?left:7);}const wrap=document.getElementById('store-name')?.parentElement;if(wrap&&!wrap.querySelector('[data-cancel-edit]')){const cancel=document.createElement('button');cancel.type='button';cancel.dataset.cancelEdit='true';cancel.className='rounded-xl border px-4 py-3';cancel.textContent='إلغاء التعديل';cancel.onclick=cancelStoreProductEdit;wrap.appendChild(cancel);}const editForm=document.getElementById('store-name')?.closest('.premium-panel');if(editForm){const stickyHeader=document.querySelector('.admin-topbar');const headerHeight=stickyHeader?.getBoundingClientRect().height||0;editForm.style.scrollMarginTop=(headerHeight+16)+'px';requestAnimationFrame(()=>requestAnimationFrame(()=>{editForm.scrollIntoView({behavior:'smooth',block:'start',inline:'nearest'});}));}}
async function deleteStoreProduct(id){const p=(state.storeProducts||[]).find(x=>String(x._id)===String(id));if(!p)return;if(!confirm('حذف المنتج "'+p.name+'" نهائيًا؟ إذا كان مرتبطًا بطلبات سابقة فلن يسمح النظام بالحذف حفاظًا على سجل الطلبات.'))return;try{await tryApi(['/api/admin/store/products/'+encodeURIComponent(id)],{method:'DELETE'});showToast('تم حذف المنتج نهائيًا');await loadStoreProducts();}catch(e){showToast(e.message||'تعذر حذف المنتج','error');}}
async function hideStoreProduct(id){const p=(state.storeProducts||[]).find(x=>String(x._id)===String(id));if(!p||!confirm('إخفاء المنتج من المتجر؟'))return;try{await tryApi(['/api/admin/store/products/'+encodeURIComponent(id)],{method:'PUT',body:JSON.stringify({name:p.name,category:p.category||'عام',description:p.description||'',details:p.details||'',price:Number(p.price),originalPrice:p.originalPrice??null,offerText:p.offerText||'',type:p.type||'product',subscriptionDuration:p.subscriptionDuration||'',imageUrl:p.imageUrl||'',imageFileId:p.imageFileId||null,isActive:false,stock:p.stock??null,isAdvertised:!!p.isAdvertised,adAudience:p.adAudience||'both',adPriority:Number(p.adPriority)||0,adExpiresAt:p.adExpiresAt||null})});showToast('تم إخفاء المنتج');await loadStoreProducts();}catch(e){showToast(e.message||'تعذر إخفاء المنتج','error');}}
async function updateStoreOrder(id){
  const nextStatus=document.getElementById('store-status-'+id)?.value||'جديد';
  try{
    await tryApi(['/api/admin/store/orders/'+encodeURIComponent(id)],{method:'PATCH',body:JSON.stringify({status:nextStatus,paymentMethod:document.getElementById('store-payment-'+id)?.value||'غير محدد',adminNote:document.getElementById('store-note-'+id)?.value||''})});
    state.storeOrderStatusTab=nextStatus;
    showToast('تم تحديث المعاملة وإرسال الإشعار');
    await loadStoreOrders();
  }catch(e){showToast(e.message||'تعذر تحديث المعاملة','error');}
}

async function showStoreProduct(id){const p=(state.storeProducts||[]).find(x=>String(x._id)===String(id));if(!p)return;try{await tryApi(['/api/admin/store/products/'+encodeURIComponent(id)],{method:'PUT',body:JSON.stringify({name:p.name,category:p.category||'عام',price:p.price,originalPrice:p.originalPrice??null,offerText:p.offerText||'',type:p.type||'product',subscriptionDuration:p.subscriptionDuration||'',description:p.description||'',details:p.details||'',imageUrl:p.imageUrl||'',imageFileId:p.imageFileId||null,isActive:true,stock:p.stock??null,isAdvertised:!!p.isAdvertised,adAudience:p.adAudience||'both',adPriority:Number(p.adPriority)||0,adExpiresAt:p.adExpiresAt||null})});showToast('تم إظهار المنتج');await loadStoreProducts();}catch(e){showToast(e.message||'تعذر إظهار المنتج','error');}}

function openStoreAdvertisementSettings(productId){
  const product=(state.storeProducts||[]).find(item=>String(item._id)===String(productId));
  if(!product)return;
  const existing=document.getElementById('store-ad-settings-modal');
  if(existing)existing.remove();
  const modal=document.createElement('div');
  modal.id='store-ad-settings-modal';
  modal.className='fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/50 p-4';
  modal.innerHTML='<div class="w-full max-w-md rounded-2xl bg-white p-4 shadow-2xl text-right" dir="rtl"><div class="flex items-center justify-between gap-3 mb-3"><b class="text-base">إعدادات نشر الإعلان</b><button type="button" data-ad-cancel class="rounded-full px-3 py-1 text-lg text-slate-500" aria-label="إغلاق">×</button></div><p class="mb-3 text-xs text-slate-500">'+escHtml(product.name)+'</p><label class="block mb-2 text-xs font-bold">الجمهور المستهدف</label><select id="store-ad-modal-audience" class="field mb-3"><option value="both">العميل والفني</option><option value="client">العميل فقط</option><option value="fanni">الفني فقط</option></select><label class="block mb-2 text-xs font-bold">مدة الإعلان</label><select id="store-ad-modal-days" class="field mb-3"><option value="1">يوم واحد</option><option value="3">3 أيام</option><option value="7">أسبوع</option><option value="14">أسبوعان</option><option value="30">شهر</option><option value="60">شهران</option><option value="90">3 شهور</option><option value="180">6 شهور</option><option value="365">سنة</option></select><label class="block mb-2 text-xs font-bold">أولوية الظهور</label><select id="store-ad-modal-priority" class="field mb-4"><option value="0">عادية</option><option value="10">منخفضة جدًا</option><option value="20">منخفضة</option><option value="30">أقل من متوسطة</option><option value="40">متوسطة منخفضة</option><option value="50">متوسطة</option><option value="60">متوسطة مرتفعة</option><option value="70">مرتفعة</option><option value="80">مرتفعة جدًا</option><option value="90">عاجلة</option><option value="100">الأولوية القصوى</option></select><div class="flex gap-2"><button type="button" data-ad-publish class="primary-btn flex-1 rounded-xl py-3">نشر الإعلان</button><button type="button" data-ad-cancel class="rounded-xl border border-slate-200 px-4 py-2 text-sm">إلغاء</button></div></div>';
  document.body.appendChild(modal);
  const audience=modal.querySelector('#store-ad-modal-audience');
  const days=modal.querySelector('#store-ad-modal-days');
  const priority=modal.querySelector('#store-ad-modal-priority');
  audience.value=['both','client','fanni'].includes(product.adAudience)?product.adAudience:'both';
  const remaining=product.adExpiresAt?Math.ceil((new Date(product.adExpiresAt).getTime()-Date.now())/86400000):7;
  days.value=String([1,3,7,14,30,60,90,180,365].includes(remaining)?remaining:7);
  const savedPriority=Math.max(0,Math.min(100,Number(product.adPriority)||0));
  priority.value=String(Math.round(savedPriority/10)*10);
  modal.querySelectorAll('[data-ad-cancel]').forEach(button=>button.addEventListener('click',()=>modal.remove()));
  modal.addEventListener('click',event=>{if(event.target===modal)modal.remove();});
  modal.querySelector('[data-ad-publish]').addEventListener('click',async()=>{
    const selectedDays=Number(days.value),selectedPriority=Number(priority.value),selectedAudience=audience.value;
    if(!(/^https?:\/\//i.test(String(product.imageUrl||''))||/^\/api\/store\/media\/[a-f0-9]{24}$/i.test(String(product.imageUrl||''))))return showToast('أضف صورة صالحة للمنتج أولًا','error');
    try{
      await tryApi(['/api/admin/store/products/'+encodeURIComponent(productId)],{method:'PUT',body:JSON.stringify({name:product.name,category:product.category||'عام',description:product.description||'',details:product.details||'',price:Number(product.price),originalPrice:product.originalPrice??null,offerText:product.offerText||'',type:product.type||'product',subscriptionDuration:product.subscriptionDuration||'',imageUrl:product.imageUrl||'',imageFileId:product.imageFileId||null,isActive:product.isActive!==false,stock:product.stock??null,isAdvertised:true,adAudience:selectedAudience,adPriority:selectedPriority,adExpiresAt:new Date(Date.now()+selectedDays*86400000).toISOString()})});
      modal.remove();
      showToast('تم نشر الإعلان بالإعدادات المحددة');
      await loadStoreProducts();
    }catch(error){showToast(error.message||'تعذر نشر الإعلان','error');}
  });
}
async function manageStoreProductAdvertisement(id){
  const product=(state.storeProducts||[]).find(item=>String(item._id)===String(id));
  if(!product)return;
  if(product.isAdvertised===true){
    if(!confirm('إيقاف الإعلان لهذا المنتج؟'))return;
    try{
      await tryApi(['/api/admin/store/products/'+encodeURIComponent(id)],{method:'PUT',body:JSON.stringify({name:product.name,category:product.category||'عام',description:product.description||'',details:product.details||'',price:Number(product.price),originalPrice:product.originalPrice??null,offerText:product.offerText||'',type:product.type||'product',subscriptionDuration:product.subscriptionDuration||'',imageUrl:product.imageUrl||'',imageFileId:product.imageFileId||null,isActive:product.isActive!==false,stock:product.stock??null,isAdvertised:false,adAudience:product.adAudience||'both',adPriority:Number(product.adPriority)||0,adExpiresAt:product.adExpiresAt||null})});
      showToast('تم إيقاف الإعلان');
      await loadStoreProducts();
    }catch(error){showToast(error.message||'تعذر إيقاف الإعلان','error');}
    return;
  }
  openStoreAdvertisementSettings(id);
}
