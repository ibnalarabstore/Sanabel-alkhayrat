export default async function handler(req, res) {
  // التأكد إنه الطلب من نوع POST فقط
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
    const publicKey = process.env.IMAGEKIT_PUBLIC_KEY;
    const urlEndpoint = process.env.IMAGEKIT_URL_ENDPOINT;

    // إذا المتغيرات مش موجودة، رجع خطأ
    if (!privateKey || !publicKey || !urlEndpoint) {
      return res.status(500).json({ error: 'ImageKit keys not configured' });
    }

    // توليد "التوقيع" (Signature) المطلوب من ImageKit
    // ImageKit بيطلب "token" + "expire" وبعدها يتوقع "signature" = HMAC-SHA1(token + expire, privateKey)
    const token = crypto.randomUUID();
    const expire = Math.floor(Date.now() / 1000) + 600; // صالح لمدة 10 دقائق

    const signature = crypto
      .createHmac('sha1', privateKey)
      .update(token + expire)
      .digest('hex');

    // إرجاع البيانات للمتصفح
    return res.status(200).json({
      token,
      expire,
      signature,
      publicKey
    });
  } catch (error) {
    console.error("ImageKit Auth Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
