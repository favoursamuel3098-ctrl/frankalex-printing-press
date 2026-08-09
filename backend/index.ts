import { router,json,error,db } from '@appdeploy/sdk';
import { notifySubscribers,realtimeSubscriptionRoutes } from './realtime-subscribers';
const table='orders';
const statuses=['Order Received','Processing','Printing','Ready','Out for Delivery','Delivered'];
function makeOrderId(n:number){return `FA-${new Date().getFullYear()}-${String(100000+n).slice(-6)}`}
function makeTracking(){return `FAP-${Math.random().toString(36).slice(2,10).toUpperCase()}`}
export const handler=router({
'GET /api/_healthcheck':[async()=>json({message:'Success'})],
'GET /api/orders':[async()=>{const{items}=await db.list(table,{limit:500});return json({orders:items.sort((a:any,b:any)=>String(b.created_at).localeCompare(String(a.created_at)))})}],
'POST /api/orders':[async({body})=>{const b=body as any;if(!b?.items?.length||typeof b.total!=='number')return error('Items and valid total are required',400);const{items}=await db.list(table,{limit:500});const id=await db.add(table,[{order_id:makeOrderId(items.length+1),tracking_id:makeTracking(),customer:String(b.customer||'Guest Customer'),phone:String(b.phone||''),email:String(b.email||''),items:b.items,total:b.total,delivery_fee:Number(b.delivery_fee||0),address:String(b.address||''),status:'Order Received',payment_status:'Pending',delivery_status:'Pending',created_at:new Date().toISOString()}]);if(!id[0])return error('Order creation failed',500);const[order]=await db.get(table,[id[0]]);await notifySubscribers('orders','all',order);return json({order},201)}],
'PUT /api/orders/:id':[async({params,body})=>{const[old]=await db.get<any>(table,[params.id]);if(!old)return error('Order not found',404);const status=String((body as any)?.status||'');if(!statuses.includes(status))return error('Invalid status',400);const ok=await db.update(table,[{id:params.id,record:{...old,status,delivery_status:status==='Delivered'?'Delivered':old.delivery_status}}]);if(!ok[0])return error('Update failed',500);const[updated]=await db.get(table,[params.id]);await notifySubscribers('orders','all',updated);return json({order:updated})}],
...realtimeSubscriptionRoutes});
