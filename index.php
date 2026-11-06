<?php
/**
 * index.php — صفحه فرود پروژه روی سایت
 * ---------------------------------------------------------------------------
 * اگر سایت شما در ریشه هاست فایل index.html (سایت فعلی) داشته باشد، آن
 * صفحه اولویت دارد و این فایل بی‌اثر است. در غیر این صورت این صفحه
 * نمایش داده می‌شود و کاربر را به ربات و پنل مدیریت هدایت می‌کند.
 * ---------------------------------------------------------------------------
 */

require_once __DIR__ . '/includes/bootstrap.php';

use Shop\Helpers;

$url = Helpers::siteUrl();
$bot = 'https://t.me/' . rawurlencode((string)cfg('BOT_USERNAME', 'phacompanybot'));
?>
<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>فروشگاه تلگرامی</title>
<style>
    body { font-family: 'Vazirmatn', Tahoma, sans-serif; background: linear-gradient(135deg, #0f172a, #312e81); color:#fff; min-height:100vh; display:flex; align-items:center; justify-content:center; margin:0; }
    .box { text-align:center; padding:40px; }
    h1 { font-size:28px; margin-bottom:10px; }
    p { color:#cbd5e1; margin-bottom:28px; }
    a.btn { display:inline-block; background:#4f46e5; color:#fff; text-decoration:none; padding:13px 34px; border-radius:10px; font-size:16px; margin:6px; }
    a.btn:hover { background:#4338ca; }
    a.alt { background:rgba(255,255,255,.12); }
</style>
</head>
<body>
<div class="box">
    <h1>🛍 فروشگاه تلگرامی</h1>
    <p>برای خرید محصولات و مشاهده فروشگاه، از ربات تلگرام استفاده کنید.</p>
    <a class="btn" href="<?= Helpers::e($bot) ?>">💬 ورود به ربات تلگرام</a>
    <a class="btn alt" href="<?= Helpers::e($url) ?>/admin/">🛡 پنل مدیریت</a>
</div>
</body>
</html>
