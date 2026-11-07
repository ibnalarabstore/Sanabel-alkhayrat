// استيراد الدوال اللازمة من Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// إعدادات Firebase الخاصة بمشروعك
const firebaseConfig = {
  apiKey: "AIzaSyA3uFqdysDGvU-XQlZwfkL9feM2qJNpgEw",
  authDomain: "sanabel-5e166.firebaseapp.com",
  projectId: "sanabel-5e166",
  storageBucket: "sanabel-5e166.firebasestorage.app",
  messagingSenderId: "237316094094",
  appId: "1:237316094094:web:f9b34d86f2a3de6161f1df",
  measurementId: "G-DNT40RRSXC"
};

// تهيئة Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// تصدير المتغيرات عشان نستخدمها بباقي الملفات
export { auth, db };
