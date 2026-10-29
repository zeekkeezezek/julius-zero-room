(function(){
'use strict';
const pad=n=>String(n).padStart(2,'0');
function key(year,month,day){return`${String(year).padStart(4,'0')}-${pad(month)}-${pad(day)}`}
function parts(value){return String(value).split('-').map(Number)}
function monthDays(year,month){return new Date(Date.UTC(year,month,0)).getUTCDate()}
function validDate(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const [y,m,d]=parts(value);return y>=1900&&y<=9999&&m>=1&&m<=12&&d>=1&&d<=monthDays(y,m);
}
function normalize(items){
 return(Array.isArray(items)?items:[]).filter(item=>item&&item.id&&String(item.name||'').trim()&&Number.isSafeInteger(item.amount)&&item.amount>0&&['monthly','yearly','other'].includes(item.cycle)&&['active','paused','cancelled'].includes(item.status)&&['cash','merpay','paidy'].includes(item.payment)&&(item.cycle==='monthly'?Number.isInteger(item.renewalDay)&&item.renewalDay>=1&&item.renewalDay<=31:validDate(item.renewalDate))&&(item.cycle!=='other'||Number.isInteger(item.intervalDays)&&item.intervalDays>=1&&item.intervalDays<=3660)).map(item=>({...item,id:String(item.id),name:String(item.name).trim().slice(0,80),memo:String(item.memo||'').slice(0,500),sourceFixedIds:[...new Set((Array.isArray(item.sourceFixedIds)?item.sourceFixedIds:[]).filter(id=>typeof id==='string'))],createdAt:Number(item.createdAt)||1,updatedAt:Number(item.updatedAt)||Number(item.createdAt)||1}));
}
function nextPayment(item,today){
 if(item.status!=='active'||!validDate(today))return null;
 const [y,m]=parts(today);let result;
 if(item.cycle==='monthly'){
  result=key(y,m,Math.min(item.renewalDay,monthDays(y,m)));
  if(result<today){const ny=m===12?y+1:y,nm=m===12?1:m+1;result=key(ny,nm,Math.min(item.renewalDay,monthDays(ny,nm)))}
 }else if(item.cycle==='yearly'){
  const [ay,am,ad]=parts(item.renewalDate);let year=Math.max(y,ay);result=key(year,am,Math.min(ad,monthDays(year,am)));
  if(result<today){year++;result=key(year,am,Math.min(ad,monthDays(year,am)))}
 }else{
  const dayMs=86400000,start=Date.UTC(...parts(item.renewalDate).map((n,i)=>i===1?n-1:n)),end=Date.UTC(...parts(today).map((n,i)=>i===1?n-1:n));
  const steps=Math.max(0,Math.ceil((end-start)/dayMs/item.intervalDays)),date=new Date(start+steps*item.intervalDays*dayMs);
  result=key(date.getUTCFullYear(),date.getUTCMonth()+1,date.getUTCDate());
 }
 return validDate(result)?result:null;
}
function totals(items,today){
 const active=items.filter(item=>item.status==='active'),monthly=active.filter(item=>item.cycle==='monthly').reduce((n,item)=>n+item.amount,0),yearly=active.filter(item=>item.cycle==='yearly').reduce((n,item)=>n+item.amount,0),otherYearly=active.filter(item=>item.cycle==='other').reduce((n,item)=>n+item.amount*365/item.intervalDays,0);
 const upcoming=active.map(item=>({item,date:nextPayment(item,today)})).filter(row=>row.date).sort((a,b)=>a.date.localeCompare(b.date)||a.item.name.localeCompare(b.item.name)||a.item.id.localeCompare(b.item.id));
 return{active:active.length,monthly,yearly,monthlyEquivalent:Math.round(monthly+yearly/12+otherYearly/12),yearlyEstimate:Math.round(monthly*12+yearly+otherYearly),next:upcoming[0]||null,upcoming};
}
function paymentPeriod(item,date){
 if(!validDate(date))return null;
 if(item.cycle==='monthly')return{key:'month:'+date.slice(0,7),label:`${date.slice(0,4)}年${Number(date.slice(5,7))}月分`};
 if(item.cycle==='yearly')return{key:'year:'+date.slice(0,4),label:`${date.slice(0,4)}年分`};
 if(item.cycle!=='other'||!validDate(item.renewalDate)||!Number.isInteger(item.intervalDays)||item.intervalDays<1)return null;
 const utc=value=>{const[y,m,d]=parts(value);return Date.UTC(y,m-1,d)},dayMs=86400000,index=Math.floor((utc(date)-utc(item.renewalDate))/dayMs/item.intervalDays),start=new Date(utc(item.renewalDate)+index*item.intervalDays*dayMs),end=new Date(start.getTime()+(item.intervalDays-1)*dayMs);
 const format=value=>key(value.getUTCFullYear(),value.getUTCMonth()+1,value.getUTCDate());
 return{key:`days:${item.renewalDate}:${item.intervalDays}:${index}`,label:`${format(start).replaceAll('-','/')}〜${format(end).slice(5).replace('-','/')}分`};
}
window.ZeroSubscriptionModel={normalize,nextPayment,totals,validDate,paymentPeriod};
})();
