'use strict';

const TECHNICIAN_TAB_DEFINITIONS=[{id:'home',label:'الرئيسية'},{id:'available',label:'الطلبات المتاحة'},{id:'myOrders',label:'عروضي'},{id:'wallet',label:'المحفظة'},{id:'store',label:'المتجر'},{id:'profile',label:'حسابي'},{id:'support',label:'الدعم الفني'}];
const TECHNICIAN_TAB_HISTORY=[];
function setTab(tab,fromBack=false){
 if(tab==='myOffers'){tab='myOrders';state.myOrdersView='active';}
 if(tab==='completed'){tab='myOrders';state.myOrdersView='completed';}
 if(state.tab!==tab&&!fromBack){TECHNICIAN_TAB_HISTORY.push(state.tab);if(TECHNICIAN_TAB_HISTORY.length>50)TECHNICIAN_TAB_HISTORY.shift();if(window.history&&window.history.pushState)window.history.pushState({sonaaFanniTab:tab},'','#'+encodeURIComponent(tab));}
 state.tab=tab;
 state.error='';
 state.success='';
 state.pendingMsg='';
 render();

 if(tab==='available')loadOrders();
if(tab==='myOrders')loadMyOffers();
 if(tab==='wallet'){loadWalletHistory();loadWalletTransferNumbers();}
 if(tab==='profile')loadProfile();
 if(tab==='store'&&getToken())loadStoreForRole('fanni');
}

function goBack(fromPopState=false,targetState=null){
 if(fromPopState){
  const target=String(targetState?.sonaaFanniTab||'');
  if(!target)return false;
  if(TECHNICIAN_TAB_HISTORY[TECHNICIAN_TAB_HISTORY.length-1]===target)TECHNICIAN_TAB_HISTORY.pop();
  else if(state.tab!==target){TECHNICIAN_TAB_HISTORY.push(state.tab);if(TECHNICIAN_TAB_HISTORY.length>50)TECHNICIAN_TAB_HISTORY.shift();}
  setTab(target,true);
  return true;
 }
 if(TECHNICIAN_TAB_HISTORY.length){window.history.back();return true;}
 window.location.href='/';
 return true;
}

function setMyOrdersView(view){if(!['active','completed'].includes(view))return;state.myOrdersView=view;render();}

function openTechnicianSection(id){if(id==='support'){window.location.href='support.html?role=fanni';return;}setTab(id);}
