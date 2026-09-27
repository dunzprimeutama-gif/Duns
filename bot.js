require('dotenv').config();
const { Bot, InlineKeyboard, InputFile, GrammyError, HttpError } = require('grammy');
const fs = require('fs');
const crypto = require('crypto');
const http = require('http');
const QRCode = require('qrcode');

const TOKEN = process.env.BOT_TOKEN;
const ADMINS = new Set((process.env.OWNER_USER_ID || '').split(',').map(x => x.trim()).filter(Boolean));
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID || '';
const STORE_NAME = process.env.STORE_NAME || 'ROXY STORE';
const TAGLINE = process.env.TAGLINE || 'Produk digital dan layanan pilihan';
const CONTACT_USERNAME = (process.env.CONTACT_USERNAME || 'Callmeroxyy').replace('@', '');
const DB_FILE = process.env.DB_FILE || './data.json';
const UANGX_MERCHANT_CODE = process.env.UANGX_MERCHANT_CODE || '';
const UANGX_PRIVATE_API_KEY = process.env.UANGX_PRIVATE_API_KEY || '';
const UANGX_BASE_URL = process.env.UANGX_BASE_URL || 'https://uangx.neticonpay.my.id';
const PORT = Number(process.env.PORT || 25575);
const WEBHOOK_PATH = process.env.UANGX_WEBHOOK_PATH || '/webhook/uangx';

const PRODUCTS = {
  p1: { e:'📱', n:'DRIP CLIENT APK MOD', v:{'1 Day':8000,'3 Day':12000,'7 Day':20000,'15 Day':42000,'30 Day':54000} },
  p2: { e:'🌐', n:'DRIP CLIENT PROXY', v:{'1 Day':8000,'3 Day':12000,'7 Day':23000,'30 Day':50000} },
  p3: { e:'⚡', n:'DRIP WIRE', v:{'6 Jam':7000,'12 Jam':10000,'1 Day':14000,'7 Day':25000} },
  p4: { e:'📲', n:'HG APK MOD', v:{'1 Day':9000,'7 Day':20000,'10 Day':30000,'30 Day':48000} },
  p5: { e:'🔗', n:'HG PROXY', v:{'1 Day':8000,'7 Day':20000,'10 Day':30000,'30 Day':48000} },
  p6: { e:'🟠', n:'PATO TEAM ORANGE', v:{'1 Day':20000,'3 Day':23000,'7 Day':30000,'15 Day':45000,'30 Day':73000} },
  p7: { e:'🛠️', n:'PATO REGEDIT', v:{'3 Day':20000,'7 Day':32000} },
  p8: { e:'🎯', n:'AIM H4CK', v:{'1 Jam':5300,'3 Jam':6000,'6 Jam':9000,'12 Jam':12000,'1 Day':15000,'3 Day':20000,'7 Day':32000,'30 Day':110000} },
  p9: { e:'🧩', n:'ABCD PANEL', v:{'12 Jam':4000,'1 Day':7000} },
  p10:{ e:'⚙️', n:'ABCD WIRE', v:{'12 Jam':4000,'1 Day':7000} },
  p11:{ e:'🪝', n:'PRIME HOOK', v:{'1 Day':12000,'3 Day':20000,'7 Day':30000,'10 Day':40000} },
  p12:{ e:'💥', n:'SILENT CHEATS AIMKILL', v:{'1 Jam':4000,'3 Jam':6000,'6 Jam':8000,'12 Jam':10000,'1 Day':18000,'3 Day':20000,'7 Day':32000,'14 Day':54000,'28 Day':82000} },
  p13:{ e:'🛡️', n:'RAPID CORE ROOT', v:{'1 Day':7000,'7 Day':20000,'14 Day':25000,'30 Day':40000} },
  p14:{ e:'🚀', n:'BALAMOD APKMOD', v:{'1 Jam':5000,'3 Jam':7000,'6 Jam':10000,'12 Jam':20000,'1 Day':35000,'2 Day':64000,'3 Day':86000,'7 Day':177000} },
  p15:{ e:'👾', n:'TROLL MODZ', v:{'6 Jam':8000,'12 Jam':9000,'1 Day':12000,'7 Day':25000} },
  p16:{ e:'❌', n:'XREG', v:{'1 Jam':4000,'3 Jam':6000,'6 Jam':8000,'12 Jam':10000,'1 Day':13000,'3 Day':20000,'7 Day':30000,'30 Day':105000} },
  p17:{ e:'🧪', n:'TEST UANGX', v:{'1 Day':100} }
};

if (!TOKEN) throw new Error('BOT_TOKEN belum diisi');
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify({orders:[], keys:[], nextOrder:1}, null, 2));
const readDB = () => JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
const writeDB = db => fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
const rp = n => 'Rp' + Number(n).toLocaleString('id-ID');
const isOwner = ctx => ADMINS.has(String(ctx.from?.id));
const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const q = s => `<blockquote>${s}</blockquote>`;
const state = new Map();
const carts = new Map();

function menu() { return new InlineKeyboard()
  .text('🛍 Lihat Katalog','catalog').text('🛒 Keranjang','cart').row()
  .text('📦 Pesanan Saya','orders').text('ℹ️ Bantuan','help').row()
  .url('💬 Chat Admin', `https://t.me/${CONTACT_USERNAME}`); }
function ownerMenu() { return new InlineKeyboard().text('➕ Tambah Key','oadd').row().text('📦 Cek Stok Key','ostock').row().text('📋 Daftar Produk','oproducts'); }
function catalog() { const k=new InlineKeyboard(); for (const [code,p] of Object.entries(PRODUCTS)) k.text(`${p.e} ${p.n}`,'p:'+code).row(); return k.text('🛒 Keranjang','cart').text('⌂ Menu','menu'); }
function cartOf(id) { if(!carts.has(id)) carts.set(id,{}); return carts.get(id); }
function availableStock(code, variant) { return readDB().keys.filter(x => x.status === 'available' && x.code === code && x.variant === variant).length; }
function total(c) { return Object.entries(c).reduce((sum,[k,n])=>{const [code,v]=k.split('|');return sum+(PRODUCTS[code]?.v[v]||0)*n},0); }
function cartText(c) { if(!Object.keys(c).length) return q('🛒 <b>Keranjang kosong</b>\n\nYuk pilih produk favoritmu!'); const a=['🛒 <b>Isi keranjang</b>\n']; for(const [k,n] of Object.entries(c)){const [code,v]=k.split('|'),p=PRODUCTS[code],price=p.v[v];a.push(`${p.e} <b>${esc(p.n)}</b> — ${esc(v)}\n   ${n} x ${rp(price)} = <b>${rp(price*n)}</b>`)} a.push(`\n━━━━━━━━━━━━━━\n📦 ${Object.values(c).reduce((a,b)=>a+b,0)} item   <b>Total ${rp(total(c))}</b>`);return q(a.join('\n')); }
function cartKeys(c){const k=new InlineKeyboard(); for(const [key,n] of Object.entries(c)){const [code,v]=key.split('|');k.text('➖',`dec:${key}`).text(`${PRODUCTS[code].e} ${v} x${n}`,`p:${code}`).text('➕',`inc:${key}`).row()} if(Object.keys(c).length) k.text('✅ Checkout','checkout').row().text('🗑 Kosongkan','clear').row();return k.text('🛍 Belanja lagi','catalog').text('⌂ Menu','menu'); }

async function createUangxTransaction(order) {
  if (!UANGX_MERCHANT_CODE || !UANGX_PRIVATE_API_KEY) return { ok: false, reason: 'UANGX credentials belum diisi di environment.' };
  const signature = crypto.createHash('sha256').update(`${UANGX_MERCHANT_CODE}${order.reference}${order.total}${UANGX_PRIVATE_API_KEY}`).digest('hex');
  const payload = {
    merchant_code: UANGX_MERCHANT_CODE,
    store_code: process.env.UANGX_STORE_CODE || '',
    reference: order.reference,
    amount: order.total,
    customer_name: order.name,
    signature
  };
  const response = await fetch(`${UANGX_BASE_URL}/api/create_transaction.php`, {
    method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload)
  });
  const result = await response.json();
  if (!response.ok || !result?.success || !result?.data?.payment_url) return { ok: false, reason: result?.message || 'UangX gagal membuat transaksi.' };
  return { ok: true, paymentUrl: result.data.payment_url, qrUrl: result.data.qr_url || result.data.qr_image || result.data.qris_url || null, qrString: result.data.qr_string || result.data.qris_string || result.data.qris || null, raw: result.data };
}

function validSignature(data) {
  if (!data?.signature || !UANGX_PRIVATE_API_KEY) return false;
  const raw = `${data.merchant_code}${data.reference}${data.amount}${data.status}${UANGX_PRIVATE_API_KEY}`;
  const expected = crypto.createHash('sha256').update(raw).digest('hex');
  const a = Buffer.from(String(data.signature));
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function deliverPaidOrder(order, db) {
  if (order.deliverySent) return;
  const lines = order.lines || [];
  const selected = [];
  for (const line of lines) {
    for (let i = 0; i < line.quantity; i++) {
      const key = db.keys.find(x => x.status === 'available' && x.code === line.code && x.variant === line.variant);
      if (!key) break;
      selected.push(key);
    }
  }
  if (selected.length !== lines.reduce((sum, line) => sum + line.quantity, 0)) {
    order.deliveryStatus = 'waiting_stock';
    writeDB(db);
    if (ADMIN_CHAT_ID) await bot.api.sendMessage(ADMIN_CHAT_ID, `⚠️ Pembayaran #${order.id} berhasil, tetapi stok key belum lengkap. Segera proses manual.`);
    await bot.api.sendMessage(order.userId, `✅ Pembayaran pesanan #${order.id} berhasil. Key sedang menunggu diproses admin karena stok belum lengkap.`);
    return;
  }
  selected.forEach(key => { key.status = 'sold'; key.orderId = order.id; key.soldAt = new Date().toISOString(); });
  order.deliverySent = true;
  order.deliveryStatus = 'delivered';
  order.deliveredKeys = selected.map(x => ({name: PRODUCTS[x.code].n, variant: x.variant, value: x.value}));
  writeDB(db);
  const keyText = selected.map(x => `${PRODUCTS[x.code].n} — ${x.variant}: <code>${esc(x.value)}</code>`).join('\n');
  await bot.api.sendMessage(order.userId, q(`✅ <b>Pembayaran berhasil</b>\n\nPesanan #${order.id}\n\n🔑 <b>Key Anda:</b>\n${keyText}`), {parse_mode:'HTML'});
  if (ADMIN_CHAT_ID) await bot.api.sendMessage(ADMIN_CHAT_ID, `✅ Pembayaran #${order.id} PAID dan key otomatis terkirim.`);
}

async function handleUangxWebhook(data) {
  if (!data || !validSignature(data)) return {code:403, body:{status:'error',msg:'Invalid Signature'}};
  if (String(data.merchant_code) !== UANGX_MERCHANT_CODE) return {code:403, body:{status:'error',msg:'Invalid merchant'}};
  const db = readDB();
  const order = db.orders.find(x => x.reference === data.reference);
  if (!order) return {code:404, body:{status:'error',msg:'Unknown reference'}};
  if (Number(data.amount) !== Number(order.total)) return {code:400, body:{status:'error',msg:'Amount mismatch'}};
  if (data.status === 'PAID') {
    if (order.status !== 'paid') { order.status = 'paid'; order.paidAt = new Date().toISOString(); writeDB(db); }
    await deliverPaidOrder(order, db);
  }
  return {code:200, body:{status:'success'}};
}

function startWebhookServer() {
  const server = http.createServer((req, res) => {
    if (req.method !== 'POST' || req.url !== WEBHOOK_PATH) { res.writeHead(404); return res.end('Not found'); }
    let body=''; req.on('data', chunk => { body += chunk; if (body.length > 1000000) req.destroy(); });
    req.on('end', async () => { try { const result = await handleUangxWebhook(JSON.parse(body)); res.writeHead(result.code, {'Content-Type':'application/json'}); res.end(JSON.stringify(result.body)); } catch (e) { console.error('Webhook error:', e.message); res.writeHead(500, {'Content-Type':'application/json'}); res.end(JSON.stringify({status:'error'})); } });
  });
  server.listen(PORT, '0.0.0.0', () => console.log(`UangX webhook listening on ${WEBHOOK_PATH} port ${PORT}`));
}

const bot = new Bot(TOKEN);
bot.command('start', ctx => ctx.reply(`🛍 <b>${esc(STORE_NAME)}</b>\n<i>${esc(TAGLINE)}</i>\n━━━━━━━━━━━━━━━━━━\n\nHalo! Selamat datang 👋\nTemukan produk pilihan dan pesan langsung dari sini.\n\n${q('✨ Layanan cepat, harga bersahabat\n🔒 Pesanan diproses oleh admin')}\n\nPilih menu untuk mulai berbelanja:`, {parse_mode:'HTML', reply_markup:menu()}));
bot.command('myid', ctx => ctx.reply(`Telegram ID Anda: <code>${ctx.from.id}</code>`,{parse_mode:'HTML'}));
bot.command('owner', ctx => isOwner(ctx) ? ctx.reply(q(`🔐 <b>Panel Owner ${esc(STORE_NAME)}</b>\n\nPilih menu:`),{parse_mode:'HTML',reply_markup:ownerMenu()}) : ctx.reply('⛔ Perintah ini hanya untuk owner toko.'));

bot.callbackQuery('menu', async ctx => { await ctx.answerCallbackQuery(); await ctx.editMessageText(q(`🛍 <b>${esc(STORE_NAME)}</b>\n\nPilih menu yang kamu butuhkan:`),{parse_mode:'HTML',reply_markup:menu()}); });
bot.callbackQuery('catalog', async ctx => { await ctx.answerCallbackQuery(); await ctx.editMessageText(q(`${PRODUCTS ? Object.keys(PRODUCTS).length : 0} produk tersedia\n\nPilih produk untuk melihat durasi dan harga:`),{parse_mode:'HTML',reply_markup:catalog()}); });
bot.callbackQuery('cart', async ctx => { await ctx.answerCallbackQuery(); const c=cartOf(ctx.from.id); await ctx.editMessageText(cartText(c),{parse_mode:'HTML',reply_markup:cartKeys(c)}); });
bot.callbackQuery('help', async ctx => { await ctx.answerCallbackQuery(); await ctx.editMessageText(q('Cara belanja:\n1️⃣ Pilih produk\n2️⃣ Tambahkan ke keranjang\n3️⃣ Checkout\n4️⃣ Isi data penerima\n5️⃣ Transfer dan konfirmasi\n\nAdmin akan memproses pesanan setelah pembayaran diverifikasi.'),{parse_mode:'HTML',reply_markup:menu()}); });
bot.callbackQuery('orders', async ctx => { await ctx.answerCallbackQuery(); const rows=readDB().orders.filter(x=>x.userId===ctx.from.id).slice(-5).reverse(); const text=rows.length?rows.map(x=>`🧾 <b>Pesanan #${x.id}</b>\n   ${rp(x.total)} • ${esc(x.status)}`).join('\n\n'):'📦 Belum ada pesanan\nPesananmu akan muncul di sini.'; await ctx.editMessageText(q(text),{parse_mode:'HTML',reply_markup:new InlineKeyboard().text('🛍 Belanja lagi','catalog').text('⌂ Menu','menu')}); });

bot.callbackQuery(/^p:(.+)$/, async ctx => { await ctx.answerCallbackQuery(); const code=ctx.match[1],p=PRODUCTS[code]; if(!p)return; const k=new InlineKeyboard(); for(const [v,price] of Object.entries(p.v))k.text(`${v} • ${rp(price)} • Stok ${availableStock(code,v)}`,`add:${code}|${v}`).row(); k.text('🛒 Keranjang','cart').text('⬅️ Katalog','catalog'); await ctx.editMessageText(q(`${p.e} <b>${esc(p.n)}</b>\n\nPilih masa aktif, harga, dan stok tersedia:`),{parse_mode:'HTML',reply_markup:k}); });
bot.callbackQuery(/^(add|inc):(.+)$/, async ctx => { await ctx.answerCallbackQuery(); const key=ctx.match[2],c=cartOf(ctx.from.id);c[key]=(c[key]||0)+1;await ctx.editMessageText(cartText(c),{parse_mode:'HTML',reply_markup:cartKeys(c)}); });
bot.callbackQuery(/^dec:(.+)$/, async ctx => { await ctx.answerCallbackQuery();const key=ctx.match[1],c=cartOf(ctx.from.id);if(c[key]){if(--c[key]<=0)delete c[key]}await ctx.editMessageText(cartText(c),{parse_mode:'HTML',reply_markup:cartKeys(c)}); });
bot.callbackQuery('clear', async ctx => { await ctx.answerCallbackQuery();carts.set(ctx.from.id,{});await ctx.editMessageText(cartText({}),{parse_mode:'HTML',reply_markup:cartKeys({})}); });
bot.callbackQuery(/^status:(\d+)$/, async ctx => { const id=Number(ctx.match[1]); const order=readDB().orders.find(x=>x.id===id && x.userId===ctx.from.id); if(!order)return ctx.answerCallbackQuery({text:'Pesanan tidak ditemukan',show_alert:true}); await ctx.answerCallbackQuery(); const label=order.status==='paid'?'✅ PAID — pembayaran terverifikasi':`⏳ ${order.status.replaceAll('_',' ')}`; await ctx.reply(q(`🧾 <b>Pesanan #${id}</b>\nStatus: <b>${esc(label)}</b>\nTotal: ${rp(order.total)}`),{parse_mode:'HTML'}); });
bot.callbackQuery('checkout', async ctx => { await ctx.answerCallbackQuery();state.set(ctx.from.id,{step:'name'});await ctx.editMessageText(q('✅ <b>Checkout</b>\n\nKetik nama penerima:'),{parse_mode:'HTML'}); });

bot.callbackQuery(/^owner:(.+)$/, async ctx => { await ctx.answerCallbackQuery(); if(!isOwner(ctx))return ctx.answerCallbackQuery({text:'Khusus owner',show_alert:true}); });
bot.callbackQuery('oadd', async ctx => { if(!isOwner(ctx))return ctx.answerCallbackQuery({text:'Khusus owner',show_alert:true});await ctx.answerCallbackQuery();const k=new InlineKeyboard();for(const [code,p] of Object.entries(PRODUCTS))k.text(`${p.e} ${p.n}`,'op:'+code).row();k.text('⬅️ Panel Owner','omenu');await ctx.editMessageText(q('➕ <b>Tambah Key</b>\n\nPilih produk:'),{parse_mode:'HTML',reply_markup:k}); });
bot.callbackQuery('omenu', async ctx => { if(!isOwner(ctx))return;await ctx.answerCallbackQuery();await ctx.editMessageText(q(`🔐 <b>Panel Owner ${esc(STORE_NAME)}</b>\n\nPilih menu:`),{parse_mode:'HTML',reply_markup:ownerMenu()}); });
bot.callbackQuery(/^op:(.+)$/, async ctx => { if(!isOwner(ctx))return;await ctx.answerCallbackQuery();const code=ctx.match[1],p=PRODUCTS[code],k=new InlineKeyboard();for(const [v,price] of Object.entries(p.v))k.text(`${v} • ${rp(price)}`,`ov:${code}|${v}`).row();k.text('⬅️ Pilih produk','oadd');await ctx.editMessageText(q(`${p.e} <b>${esc(p.n)}</b>\n\nPilih durasi key:`),{parse_mode:'HTML',reply_markup:k}); });
bot.callbackQuery(/^ov:(.+)$/, async ctx => { if(!isOwner(ctx))return;await ctx.answerCallbackQuery();const [code,v]=ctx.match[1].split('|');state.set(ctx.from.id,{step:'key',code,variant:v});await ctx.editMessageText(q(`✅ ${esc(PRODUCTS[code].n)} — ${esc(v)}\n\nKetik atau paste key:`),{parse_mode:'HTML'}); });
bot.callbackQuery('ostock', async ctx => { if(!isOwner(ctx))return;await ctx.answerCallbackQuery();const db=readDB(),rows={};db.keys.filter(x=>x.status==='available').forEach(x=>rows[`${x.code}|${x.variant}`]=(rows[`${x.code}|${x.variant}`]||0)+1);const text=Object.entries(rows).map(([k,n])=>{const [code,v]=k.split('|');return `${PRODUCTS[code].e} ${esc(PRODUCTS[code].n)} — ${esc(v)}: <b>${n} key</b>`}).join('\n')||'Stok key masih kosong.';await ctx.editMessageText(q(text),{parse_mode:'HTML',reply_markup:new InlineKeyboard().text('⬅️ Panel Owner','omenu')}); });
bot.callbackQuery('oproducts', async ctx => { if(!isOwner(ctx))return;await ctx.answerCallbackQuery();const text=Object.values(PRODUCTS).map(p=>q(`${p.e} <b>${esc(p.n)}</b>\n   ${Object.keys(p.v).map(esc).join(', ')}`)).join('\n');await ctx.editMessageText(text,{parse_mode:'HTML',reply_markup:new InlineKeyboard().text('⬅️ Panel Owner','omenu')}); });

bot.on('message:text', async ctx => { const s=state.get(ctx.from.id); if(!s)return ctx.reply('Ketik /start untuk membuka toko.'); const value=ctx.message.text.trim(); if(s.step==='key'&&isOwner(ctx)){const db=readDB();if(db.keys.some(x=>x.value===value))return ctx.reply('⚠️ Key sudah ada. Kirim key lain.');db.keys.push({code:s.code,variant:s.variant,value,status:'available',createdAt:new Date().toISOString()});writeDB(db);state.delete(ctx.from.id);return ctx.reply('✅ Key berhasil ditambahkan.',{reply_markup:ownerMenu()});} if(s.step==='name'){s.name=value;s.step='phone';return ctx.reply('📱 Ketik nomor WhatsApp/telepon:');}if(s.step==='phone'){s.phone=value;s.step='address';return ctx.reply('📍 Ketik alamat lengkap atau keterangan COD:');}if(s.step==='address'){const c=cartOf(ctx.from.id),db=readDB(),id=db.nextOrder++;const items=Object.entries(c).map(([k,n])=>{const [code,v]=k.split('|');return `${PRODUCTS[code].n} (${v}) x${n}`}).join(', ');const lines=Object.entries(c).map(([k,n])=>{const [code,variant]=k.split('|');return {code,variant,quantity:n}});const order={id,userId:ctx.from.id,name:s.name,phone:s.phone,address:value,items,total:total(c),lines,reference:`INV-${Date.now()}-${id}`,status:'menunggu_pembayaran',createdAt:new Date().toISOString()};db.orders.push(order);writeDB(db);carts.set(ctx.from.id,{});state.delete(ctx.from.id);let invoice;try{invoice=await createUangxTransaction(order)}catch(e){console.error('UangX request gagal:',e.message);invoice={ok:false,reason:'Koneksi UangX gagal.'}}if(invoice.ok){order.paymentUrl=invoice.paymentUrl;order.status='menunggu_pembayaran';writeDB(db);const payText=q(`🎉 <b>Pesanan #${id} dibuat</b>\n\n${esc(items)}\n💰 Total: <b>${rp(order.total)}</b>\n\nScan QRIS untuk membayar. Setelah berhasil, status akan diproses otomatis.`);if(invoice.qrUrl){await ctx.replyWithPhoto(invoice.qrUrl,{caption:payText.replace(/<[^>]*>/g,''),parse_mode:'HTML',reply_markup:new InlineKeyboard().url('💳 Buka Pembayaran',invoice.paymentUrl).row().text('🔄 Cek Status',`status:${id}`).text('⌂ Menu','menu')});}else if(invoice.qrString){const png=await QRCode.toBuffer(invoice.qrString,{width:700,margin:2});await ctx.replyWithPhoto(new InputFile(png,'qris.png'),{caption:payText.replace(/<[^>]*>/g,''),reply_markup:new InlineKeyboard().url('💳 Buka Pembayaran',invoice.paymentUrl).row().text('🔄 Cek Status',`status:${id}`).text('⌂ Menu','menu')});}else{await ctx.reply(payText,{parse_mode:'HTML',reply_markup:new InlineKeyboard().url('💳 Bayar Sekarang',invoice.paymentUrl).row().text('🔄 Cek Status',`status:${id}`).text('⌂ Menu','menu')});}}else{await ctx.reply(q(`🎉 <b>Pesanan #${id} dibuat</b>\n\n${esc(items)}\n💰 Total: <b>${rp(order.total)}</b>\n\nInvoice otomatis belum tersedia. Hubungi admin untuk pembayaran manual.`),{parse_mode:'HTML'});console.error('UangX:',invoice.reason)}if(ADMIN_CHAT_ID)await bot.api.sendMessage(ADMIN_CHAT_ID,`📦 Pesanan #${id}\n${items}\nTotal: ${rp(order.total)}\nInvoice: ${invoice.ok?'berhasil dibuat':'gagal dibuat'}`);}});

bot.catch(err=>{const e=err.error;if(e instanceof GrammyError)console.error('Telegram error:',e.description);else if(e instanceof HttpError)console.error('Network error:',e);else console.error(e);});
startWebhookServer();
bot.start();
console.log('ROXY STORE Node.js bot berjalan');
