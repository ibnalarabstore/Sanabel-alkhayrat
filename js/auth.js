import { auth } from './firebase-config.js';
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { db } from './firebase-config.js';

// ==========================================
// 1. السنة الحالية في التذييل
// ==========================================
document.getElementById('currentYear').textContent = new Date().getFullYear();

// ==========================================
// 2. إظهار / إخفاء كلمة المرور (العين)
// ==========================================
const togglePassword = document.getElementById('togglePassword');
const passwordInput = document.getElementById('password');

togglePassword.addEventListener('click', () => {
  const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
  passwordInput.setAttribute('type', type);
  // تغيير الأيقونة
  togglePassword.textContent = type === 'password' ? '👁️' : '🙈';
});

// ==========================================
// 3. منطق تسجيل الدخول
// ==========================================
const loginForm = document.getElementById('loginForm');
const errorMessage = document.getElementById('errorMessage');
const loginBtn = document.getElementById('loginBtn');
const btnText = loginBtn.querySelector('.btn-text');
const btnLoader = loginBtn.querySelector('.btn-loader');

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault(); // منع إعادة تحميل الصفحة

  const username = document.getElementById('username').value.trim();
  const password = passwordInput.value;

  // إخفاء رسالة الخطأ السابقة
  errorMessage.classList.add('hidden');
  errorMessage.textContent = '';

  // إظهار حالة التحميل
  btnText.classList.add('hidden');
  btnLoader.classList.remove('hidden');
  loginBtn.disabled = true;

  try {
    // تحويل اليوزرنيم لإيميل وهمي (لأن Firebase يحتاج إيميل)
    const email = `${username}@sanabel.local`;

    // 1. تسجيل الدخول عبر Firebase Auth
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // 2. جلب بيانات المستخدم من Firestore للتأكد إنه مش محظور
    const userDocRef = doc(db, "users", user.uid);
    const userDocSnap = await getDoc(userDocRef);

    if (!userDocSnap.exists()) {
      throw new Error("بيانات المستخدم غير موجودة في النظام.");
    }

    const userData = userDocSnap.data();

    // 3. التحقق من الحظر
    if (userData.isBlocked === true) {
      // إذا كان محظور، لازم نخرجه فوراً
      await auth.signOut();
      throw new Error("عذراً، هذا الحساب محظور. يرجى التواصل مع الإدارة.");
    }

    // 4. التوجيه حسب الصلاحية
    if (userData.role === 'admin') {
      window.location.href = 'admin.html';
    } else {
      window.location.href = 'shop.html';
    }

  } catch (error) {
    // معالجة الأخطاء
    console.error("خطأ في تسجيل الدخول:", error);
    
    let message = "حدث خطأ غير متوقع.";
    
    if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
      message = "اسم المستخدم أو كلمة المرور غير صحيحة.";
    } else if (error.code === 'auth/too-many-requests') {
      message = "تم إيقاف المحاولات مؤقتاً بسبب كثرة المحاولات الخاطئة. يرجى المحاولة لاحقاً.";
    } else if (error.message) {
      message = error.message; // رسائلنا المخصصة (مثل حساب محظور)
    }

    errorMessage.textContent = message;
    errorMessage.classList.remove('hidden');

    // إعادة الزر لحالته الطبيعية
    btnText.classList.remove('hidden');
    btnLoader.classList.add('hidden');
    loginBtn.disabled = false;
  }
});
