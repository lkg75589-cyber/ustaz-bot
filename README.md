# الأستاذ الذكي

بوت تيليجرام + تطبيق ويب (PWA). الملفان الأساسيان: `main.py` و`index.html`.

## التشغيل
1. أنشئ ملف `env.txt` (أو `.env`) من `.env.example` واملأ المفاتيح. لا ترفعه لـ GitHub أبداً.
2. `pip install -r requirements.txt` ثم `python main.py`.

## التحديث التلقائي من GitHub
ضع في ملف البيئة: `GITHUB_REPO=اسمك/المستودع`. البوت يفحص كل 10 دقائق ويسحب `main.py` و`index.html`
(يتأكد أن الكود سليم قبل ما يطبّقه) ثم يعيد تشغيل نفسه. للمالك أمر `/update` للتحديث الفوري.
إذا المستودع Private أضف `GITHUB_TOKEN` (Fine-grained، صلاحية Contents: Read-only).
