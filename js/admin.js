import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc, collection, addDoc, serverTimestamp, query, orderBy, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ==========================================
// 1. حماية الصفحة وجلب بيانات الأدمن
// ==========================================
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    // إذا ما في مستخدم مسجل، طردو لصفحة الدخول
    window.location.href = 'index.html';
    return;
  }

  try {
    const userDoc = await getDoc(doc(db, "users", user.uid));
    if (userDoc.exists()) {
      const userData = userDoc.data();
      
      // إذا مو أدمن أو محظور، طردو
      if (userData.role !== 'admin' || userData.isBlocked) {
        window.location.href = 'index.html';
        return;
      }
      
      // عرض اسم الأدمن
      document.getElementById('adminName').textContent = userData.displayName || userData.username;
    } else {
      window.location.href = 'index.html';
    }
  } catch (error) {
    console.error("خطأ في جلب بيانات الأدمن:", error);
    window.location.href = 'index.html';
  }
});

// ==========================================
// 2. تسجيل الخروج
// ==========================================
document.getElementById('logoutBtn').addEventListener('click', async () => {
  await signOut(auth);
  window.location.href = 'index.html';
});

// ==========================================
// 3. التنقل بين أقسام القائمة الجانبية
// ==========================================
const navLinks = document.querySelectorAll('.nav-link');
const sections = document.querySelectorAll('.content-section');
const pageTitle = document.getElementById('pageTitle');

navLinks.forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    
    // إزالة active من الكل
    navLinks.forEach(l => l.classList.remove('active'));
    sections.forEach(s => s.classList.remove('active'));
    
    // إضافة active للعنصر المضغوط
    link.classList.add('active');
    const sectionId = link.getAttribute('data-section');
    document.getElementById(`section-${sectionId}`).classList.add('active');
    
    // تغيير عنوان الصفحة
    pageTitle.textContent = link.textContent.trim();
  });
});

// ==========================================
// 4. النافذة المنبثقة (Modal) والحقول الذكية
// ==========================================
const productModal = document.getElementById('productModal');
const addProductBtn = document.getElementById('addProductBtn');
const closeModalBtn = document.getElementById('closeModalBtn');
const cancelBtn = document.getElementById('cancelBtn');
const productForm = document.getElementById('productForm');
const productCategory = document.getElementById('productCategory');
const weightGroup = document.getElementById('weightGroup');
const unitsGroup = document.getElementById('unitsGroup');

// فتح النافذة (إضافة جديد)
function openModal() {
  productForm.reset();
  document.getElementById('productId').value = '';
  document.getElementById('modalTitle').textContent = 'إضافة منتج جديد';
  productModal.classList.remove('hidden');
  toggleCategoryFields();
}

// إغلاق النافذة
function closeModal() {
  productModal.classList.add('hidden');
}

addProductBtn.addEventListener('click', openModal);
closeModalBtn.addEventListener('click', closeModal);
cancelBtn.addEventListener('click', closeModal);

// إغلاق عند الضغط خارج النافذة
productModal.addEventListener('click', (e) => {
  if (e.target === productModal) closeModal();
});

// الحقول الذكية (صندوق ↔ شوال)
function toggleCategoryFields() {
  if (productCategory.value === 'bag') {
    weightGroup.classList.remove('hidden');
    unitsGroup.classList.add('hidden');
  } else {
    unitsGroup.classList.remove('hidden');
    weightGroup.classList.add('hidden');
  }
}
productCategory.addEventListener('change', toggleCategoryFields);

// ==========================================
// 5. حفظ المنتج في Firebase
// ==========================================
const saveProductBtn = document.getElementById('saveProductBtn');
const btnText = saveProductBtn.querySelector('.btn-text');
const btnLoader = saveProductBtn.querySelector('.btn-loader');

productForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const productId = document.getElementById('productId').value;
  const name = document.getElementById('productName').value.trim();
  const category = productCategory.value;
  const price = parseFloat(document.getElementById('productPrice').value);
  const imageUrl = document.getElementById('productImage').value.trim();
  const description = document.getElementById('productDescription').value.trim();
  
  const productData = {
    name,
    category,
    price,
    imageUrl,
    description,
    isActive: true,
    updatedAt: serverTimestamp()
  };
  
  // إضافة حقول حسب التصنيف
  if (category === 'bag') {
    productData.weightKg = parseFloat(document.getElementById('productWeight').value);
    if (!productData.weightKg || productData.weightKg <= 0) {
      alert("الرجاء إدخال وزن صحيح للشوال");
      return;
    }
  } else {
    productData.unitsPerBox = parseInt(document.getElementById('productUnits').value);
    if (!productData.unitsPerBox || productData.unitsPerBox <= 0) {
      alert("الرجاء إدخال عدد وحدات صحيح للصندوق");
      return;
    }
  }
  
  // حالة التحميل
  btnText.classList.add('hidden');
  btnLoader.classList.remove('hidden');
  saveProductBtn.disabled = true;
  
  try {
    if (productId) {
      // تعديل منتج موجود
      const { updateDoc } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
      await updateDoc(doc(db, "products", productId), productData);
      alert("تم تعديل المنتج بنجاح ✅");
    } else {
      // إضافة منتج جديد
      productData.createdAt = serverTimestamp();
      await addDoc(collection(db, "products"), productData);
      alert("تمت إضافة المنتج بنجاح ✅");
    }
    closeModal();
  } catch (error) {
    console.error("خطأ في الحفظ:", error);
    alert("حدث خطأ أثناء الحفظ: " + error.message);
  } finally {
    // إعادة الزر لحالته
    btnText.classList.remove('hidden');
    btnLoader.classList.add('hidden');
    saveProductBtn.disabled = false;
  }
});

// ==========================================
// 6. عرض المنتجات لايف من Firebase
// ==========================================
const productsGrid = document.getElementById('productsGrid');
const searchInput = document.getElementById('searchProducts');
let allProducts = [];

const q = query(collection(db, "products"), orderBy("createdAt", "desc"));

onSnapshot(q, (snapshot) => {
  allProducts = [];
  snapshot.forEach((doc) => {
    allProducts.push({ id: doc.id, ...doc.data() });
  });
  renderProducts(allProducts);
}, (error) => {
  console.error("خطأ في جلب المنتجات:", error);
  productsGrid.innerHTML = `<div class="empty-state"><p>حدث خطأ في جلب المنتجات</p></div>`;
});

function renderProducts(products) {
  if (products.length === 0) {
    productsGrid.innerHTML = `<div class="empty-state"><p>لا توجد منتجات بعد. اضغط "إضافة منتج جديد" للبدء.</p></div>`;
    return;
  }

  productsGrid.innerHTML = products.map(product => {
    // حساب سعر الكيلو أو الحبة
    let unitPriceText = '';
    if (product.category === 'bag' && product.weightKg) {
      const kgPrice = (product.price / product.weightKg).toFixed(2);
      unitPriceText = `سعر الكيلو: $${kgPrice}`;
    } else if (product.category === 'box' && product.unitsPerBox) {
      const unitPrice = (product.price / product.unitsPerBox).toFixed(2);
      unitPriceText = `سعر الحبة: $${unitPrice}`;
    }

    const categoryLabel = product.category === 'bag' ? '🎒 شوال' : '📦 صندوق';

    return `
      <div class="product-card">
        <img src="${product.imageUrl}" alt="${product.name}" class="product-img" onerror="this.src='https://via.placeholder.com/300x200?text=No+Image'">
        <div class="product-info">
          <span class="product-badge">${categoryLabel}</span>
          <h3 class="product-title">${product.name}</h3>
          <p class="product-price">السعر: <strong>$${product.price}</strong></p>
          <p class="product-unit-price">${unitPriceText}</p>
        </div>
      </div>
    `;
  }).join('');
}

// ==========================================
// 7. البحث
// ==========================================
searchInput.addEventListener('input', (e) => {
  const term = e.target.value.trim().toLowerCase();
  const filtered = allProducts.filter(p => p.name.toLowerCase().includes(term));
  renderProducts(filtered);
});
