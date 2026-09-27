# ROXY STORE Telegram Bot — Node.js + UangX + QRIS

## Jalankan di Pterodactyl

```bash
npm install && npm start
```

Gunakan egg Node.js dan port `25575` jika itu allocation Anda.

## Environment variables

```env
BOT_TOKEN=token_dari_BotFather
ADMIN_CHAT_ID=5037903609
OWNER_USER_ID=8004425206,5037903609
CONTACT_USERNAME=Callmeroxyy
STORE_NAME=ROXY STORE
TAGLINE=Produk digital dan layanan pilihan
DB_FILE=./data.json
PORT=25575

UANGX_MERCHANT_CODE=UANGX-E205A2
UANGX_PRIVATE_API_KEY=KEY_BARU_DI_PANEL
UANGX_BASE_URL=https://uangx.neticonpay.my.id
UANGX_STORE_CODE=
UANGX_WEBHOOK_PATH=/webhook/uangx
```

## Alur pembayaran

1. Pelanggan checkout.
2. Bot memanggil `POST /api/create_transaction.php` UangX.
3. Signature invoice: `SHA256(merchant_code + reference + amount + private_api_key)`.
4. Jika response UangX memiliki `qr_url`, `qr_image`, atau `qris_url`, bot mengirim gambar QRIS langsung.
5. Jika response memiliki `qr_string`/`qris_string`, bot membuat gambar QRIS dari string tersebut.
6. Jika response hanya memiliki `payment_url`, bot mengirim fallback tombol pembayaran.
7. Webhook `POST /webhook/uangx` memvalidasi signature: `SHA256(merchant_code + reference + amount + status + private_api_key)`.
8. Saat `PAID`, order ditandai lunas dan key yang cocok dikirim otomatis.

## URL webhook

Daftarkan URL HTTPS publik server Anda di dashboard UangX:

```text
https://DOMAIN-PUBLIK-ANDA/webhook/uangx
```

Alamat panel/console Pterodactyl bukan URL webhook. Domain harus meneruskan request POST ke port Node.js `25575`.

## Keamanan

Gunakan API key baru dan simpan sebagai Environment Variable. Jangan menaruh private key di source code, GitHub, screenshot, atau chat. Jangan mematikan verifikasi SSL. Uji dengan nominal kecil.
