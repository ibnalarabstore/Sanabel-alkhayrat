import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc, collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, setDoc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ==========================================
// 1. حماية الصفحة وجلب بيانات الأدمن
// ==========================================
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = 'index.html';
    return;
  }

  try {
    const userDoc = await getDoc(doc(db, "users", user.uid));
    if (userDoc.exists()) {
      const userData = userDoc.data();
      
      if (userData.role !== 'admin' || userData.isBlocked) {
        window.location.href = 'index.html';
        return;
      }
      
      document.getElementById('adminName').textContent = userData.displayName || userData.username;
    } else {
      window.location.href = 'index.html';
    }
  } catch (error) {
    console.error("خطأ في جلب بيانات الأدمن:", error);
    window.location.href = 'index.html';
  }
});

// تسجيل الخروج
document.getElementById('logoutBtn').addEventListener('click', async () => {
  await signOut(auth);
  window.location.href = 'index.html';
});

// ==========================================
// 2. التنقل بين أقسام القائمة
// ==========================================
const navLinks = document.querySelectorAll('.nav-link');
const sections = document.querySelectorAll('.content-section');
const pageTitle = document.getElementById('pageTitle');

navLinks.forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    navLinks.forEach(l => l.classList.remove('active'));
    sections.forEach(s => s.classList.remove('active'));
    
    link.classList.add('active');
    const sectionId = link.getAttribute('data-section');
    document.getElementById(`section-${sectionId}`).classList.add('active');
    pageTitle.textContent = link.querySelector('span:not(.nav-icon)').textContent;
  });
});

// ==========================================
// 3. إدارة المنتجات (نافذة، حفظ، عرض)
// ==========================================
const productModal = document.getElementById('productModal');
const addProductBtn = document.getElementById('addProductBtn');
const closeModalBtn = document.getElementById('closeModalBtn');
const cancelBtn = document.getElementById('cancelBtn');
const productForm = document.getElementById('productForm');
const productCategory = document.getElementById('productCategory');
const weightGroup = document.getElementById('weightGroup');
const unitsGroup = document.getElementById('unitsGroup');
const productsGrid = document.getElementById('productsGrid');
let allProducts = [];

function openModal() {
  productForm.reset();
  document.getElementById('productId').value = '';
  document.getElementById('modalTitle').textContent = 'إضافة منتج جديد';
  
  // إعادة تعيين حقل الصورة
  productImageField.value = '';
  imageFileInput.value = '';
  imagePreviewContainer.classList.add('hidden');
  imagePreview.src = '';
  uploadText.textContent = '📷 اختر صورة للرفع';
  
  toggleCategoryFields();
  productModal.classList.remove('hidden');
}

function closeModal() {
  productModal.classList.add('hidden');
}

addProductBtn.addEventListener('click', openModal);
closeModalBtn.addEventListener('click', closeModal);
cancelBtn.addEventListener('click', closeModal);
productModal.addEventListener('click', (e) => { if (e.target === productModal) closeModal(); });

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

// حفظ المنتج
productForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const productId = document.getElementById('productId').value;
  const name = document.getElementById('productName').value.trim();
  const category = productCategory.value;
  const price = parseFloat(document.getElementById('productPrice').value);
  const imageUrl = document.getElementById('productImage').value.trim();
  const description = document.getElementById('productDescription').value.trim();

  // التحقق من وجود صورة
  if (!imageUrl) {
    alert("الرجاء رفع صورة للمنتج أولاً");
    return;
  }
  
  const productData = {
    name, category, price, imageUrl, description,
    isActive: true, updatedAt: serverTimestamp()
  };
  
  if (category === 'bag') {
    productData.weightKg = parseFloat(document.getElementById('productWeight').value);
    if (!productData.weightKg || productData.weightKg <= 0) return alert("الرجاء إدخال وزن صحيح للشوال");
  } else {
    productData.unitsPerBox = parseInt(document.getElementById('productUnits').value);
    if (!productData.unitsPerBox || productData.unitsPerBox <= 0) return alert("الرجاء إدخال عدد وحدات صحيح للصندوق");
  }
  
  const saveBtn = document.getElementById('saveProductBtn');
  const btnText = saveBtn.querySelector('.btn-text');
  const btnLoader = saveBtn.querySelector('.btn-loader');
  
  btnText.classList.add('hidden');
  btnLoader.classList.remove('hidden');
  saveBtn.disabled = true;
  
  try {
    if (productId) {
      await updateDoc(doc(db, "products", productId), productData);
      alert("تم تعديل المنتج بنجاح ✅");
    } else {
      productData.createdAt = serverTimestamp();
      await addDoc(collection(db, "products"), productData);
      alert("تمت إضافة المنتج بنجاح ✅");
    }
    closeModal();
  } catch (error) {
    alert("حدث خطأ أثناء الحفظ: " + error.message);
  } finally {
    btnText.classList.remove('hidden');
    btnLoader.classList.add('hidden');
    saveBtn.disabled = false;
  }
});

// عرض المنتجات
const qProducts = query(collection(db, "products"), orderBy("createdAt", "desc"));
onSnapshot(qProducts, (snapshot) => {
  allProducts = [];
  snapshot.forEach((doc) => allProducts.push({ id: doc.id, ...doc.data() }));
  renderProducts(allProducts);
}, (error) => {
  productsGrid.innerHTML = `<div class="empty-state"><p>حدث خطأ في جلب المنتجات</p></div>`;
});

function renderProducts(products) {
  if (products.length === 0) {
    productsGrid.innerHTML = `<div class="empty-state"><p>لا توجد منتجات بعد. اضغط "إضافة منتج جديد" للبدء.</p></div>`;
    return;
  }

  productsGrid.innerHTML = products.map(product => {
    let unitPriceText = '';
    if (product.category === 'bag' && product.weightKg) {
      unitPriceText = `سعر الكيلو: $${(product.price / product.weightKg).toFixed(2)}`;
    } else if (product.category === 'box' && product.unitsPerBox) {
      unitPriceText = `سعر الحبة: $${(product.price / product.unitsPerBox).toFixed(2)}`;
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
          <div class="product-actions">
            <button class="btn-edit" onclick="editProduct('${product.id}')">🖊️ تعديل</button>
            <button class="btn-delete" onclick="deleteProduct('${product.id}')">🗑️ حذف</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// تعديل وحذف المنتج
window.editProduct = (id) => {
  const product = allProducts.find(p => p.id === id);
  if (!product) return;
  
  document.getElementById('productId').value = product.id;
  document.getElementById('productName').value = product.name;
  document.getElementById('productPrice').value = product.price;
  document.getElementById('productDescription').value = product.description || '';
  productCategory.value = product.category;
  
  // إظهار الصورة الحالية
  productImageField.value = product.imageUrl;
  imagePreview.src = product.imageUrl;
  imagePreviewContainer.classList.remove('hidden');
  uploadText.textContent = '🔄 تغيير الصورة';
  
  if (product.category === 'bag') {
    document.getElementById('productWeight').value = product.weightKg || '';
  } else {
    document.getElementById('productUnits').value = product.unitsPerBox || '';
  }
  
  document.getElementById('modalTitle').textContent = 'تعديل المنتج';
  toggleCategoryFields();
  productModal.classList.remove('hidden');
};

window.deleteProduct = async (id) => {
  if (confirm('هل أنت متأكد من حذف هذا المنتج نهائياً؟')) {
    try { await deleteDoc(doc(db, "products", id)); } 
    catch (error) { alert("حدث خطأ أثناء الحذف: " + error.message); }
  }
};

// البحث في المنتجات
document.getElementById('searchProducts').addEventListener('input', (e) => {
  const term = e.target.value.trim().toLowerCase();
  renderProducts(allProducts.filter(p => p.name.toLowerCase().includes(term)));
});

// ==========================================
// 4. إدارة الزبائن
// ==========================================
const customerModal = document.getElementById('customerModal');
const addCustomerBtn = document.getElementById('addCustomerBtn');
const closeCustomerModal = document.getElementById('closeCustomerModal');
const cancelCustBtn = document.getElementById('cancelCustBtn');
const customerForm = document.getElementById('customerForm');
const customersGrid = document.getElementById('customersGrid');
let allCustomers = [];

addCustomerBtn.addEventListener('click', () => {
  customerForm.reset();
  customerModal.classList.remove('hidden');
});
closeCustomerModal.addEventListener('click', () => customerModal.classList.add('hidden'));
cancelCustBtn.addEventListener('click', () => customerModal.classList.add('hidden'));

customerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const saveBtn = document.getElementById('saveCustBtn');
  const btnText = saveBtn.querySelector('.btn-text');
  const btnLoader = saveBtn.querySelector('.btn-loader');
  
  const username = document.getElementById('custUsername').value.trim().toLowerCase();
  const displayName = document.getElementById('custDisplayName').value.trim();
  const phone = document.getElementById('custPhone').value.trim();
  
  btnText.classList.add('hidden');
  btnLoader.classList.remove('hidden');
  saveBtn.disabled = true;
  
  try {
    await setDoc(doc(db, "users", username), {
      username, displayName, phone,
      role: 'customer', isBlocked: false, createdAt: serverTimestamp()
    });
    alert("تم حفظ بيانات الزبون!\n\n⚠️ تنبيه: يجب الذهاب إلى Firebase Console -> Authentication وإنشاء حساب له بالإيميل:\n" + username + "@sanabel.local\nلتتمكن من تسجيل الدخول.");
    customerModal.classList.add('hidden');
  } catch (error) {
    alert("خطأ: " + error.message);
  } finally {
    btnText.classList.remove('hidden');
    btnLoader.classList.add('hidden');
    saveBtn.disabled = false;
  }
});

const qCustomers = query(collection(db, "users"), orderBy("createdAt", "desc"));
onSnapshot(qCustomers, (snapshot) => {
  allCustomers = [];
  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    if (data.role !== 'admin') allCustomers.push({ id: docSnap.id, ...data });
  });
  renderCustomers(allCustomers);
});

function renderCustomers(customers) {
  if (customers.length === 0) {
    customersGrid.innerHTML = `<div class="empty-state"><p>لا يوجد زبائن بعد.</p></div>`;
    return;
  }

  customersGrid.innerHTML = customers.map(cust => {
    const statusClass = cust.isBlocked ? 'blocked' : 'active';
    const statusText = cust.isBlocked ? '🔴 محظور' : '🟢 نشط';
    return `
      <div class="product-card">
        <div class="product-info">
          <span class="product-badge ${statusClass}">${statusText}</span>
          <h3 class="product-title">${cust.displayName || cust.username}</h3>
          <p style="font-size:0.9rem; color:#555;">👤 ${cust.username}</p>
          <p style="font-size:0.9rem; color:#555; margin-bottom:15px;">📞 ${cust.phone}</p>
          <div class="product-actions">
            <button class="btn-edit" onclick="toggleBlockCustomer('${cust.id}', ${cust.isBlocked})">
              ${cust.isBlocked ? 'فك الحظر' : 'حظر'}
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

window.toggleBlockCustomer = async (id, currentStatus) => {
  const action = currentStatus ? 'فك الحظر عن' : 'حظر';
  if (!confirm(`هل أنت متأكد من ${action} هذا الزبون؟`)) return;
  try { await updateDoc(doc(db, "users", id), { isBlocked: !currentStatus }); } 
  catch (error) { alert("خطأ: " + error.message); }
};

// البحث في الزبائن
document.getElementById('searchCustomers').addEventListener('input', (e) => {
  const term = e.target.value.trim().toLowerCase();
  const filtered = allCustomers.filter(c => 
    (c.displayName && c.displayName.toLowerCase().includes(term)) || 
    (c.username && c.username.toLowerCase().includes(term))
  );
  renderCustomers(filtered);
});

// ==========================================
// 5. رفع الصور التلقائي (ImgBB)
// ==========================================
const IMGBB_API_KEY = "99bf37915afe5bdef0be905ae32d82fd";
const imageFileInput = document.getElementById('productImageFile');
const productImageField = document.getElementById('productImage');
const uploadLabel = document.getElementById('uploadLabel');
const uploadText = document.getElementById('uploadText');
const uploadLoader = document.getElementById('uploadLoader');
const imagePreviewContainer = document.getElementById('imagePreviewContainer');
const imagePreview = document.getElementById('imagePreview');
const removeImageBtn = document.getElementById('removeImageBtn');

async function uploadImageToImgBB(file) {
  const formData = new FormData();
  formData.append('image', file);

  const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
    method: 'POST',
    body: formData
  });

  const data = await response.json();
  if (data.success) return data.data.url;
  throw new Error('فشل رفع الصورة');
}

imageFileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  if (file.size > 5 * 1024 * 1024) {
    alert('حجم الصورة كبير جداً. الحد الأقصى 5 ميغابايت.');
    imageFileInput.value = '';
    return;
  }

  uploadText.classList.add('hidden');
  uploadLoader.classList.remove('hidden');

  try {
    const imageUrl = await uploadImageToImgBB(file);
    productImageField.value = imageUrl;
    imagePreview.src = imageUrl;
    imagePreviewContainer.classList.remove('hidden');
    uploadText.textContent = '🔄 تغيير الصورة';
  } catch (error) {
    alert('حدث خطأ أثناء رفع الصورة: ' + error.message);
    imageFileInput.value = '';
  } finally {
    uploadText.classList.remove('hidden');
    uploadLoader.classList.add('hidden');
  }
});

removeImageBtn.addEventListener('click', () => {
  productImageField.value = '';
  imageFileInput.value = '';
  imagePreviewContainer.classList.add('hidden');
  imagePreview.src = '';
  uploadText.textContent = '📷 اختر صورة للرفع';
});
