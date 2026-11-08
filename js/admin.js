import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { initializeApp, deleteApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { doc, getDoc, collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, setDoc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// إعدادات فايربيز
const firebaseConfig = {
  apiKey: "AIzaSyA3uFqdysDGvU-XQlZwfkL9feM2qJNpgEw",
  authDomain: "sanabel-5e166.firebaseapp.com",
  projectId: "sanabel-5e166",
  storageBucket: "sanabel-5e166.firebasestorage.app",
  messagingSenderId: "237316094094",
  appId: "1:237316094094:web:f9b34d86f2a3de6161f1df",
  measurementId: "G-DNT40RRSXC"
};

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
// 3. إدارة المنتجات
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

productForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const productId = document.getElementById('productId').value;
  const name = document.getElementById('productName').value.trim();
  const category = productCategory.value;
  const price = parseFloat(document.getElementById('productPrice').value);
  const imageUrl = document.getElementById('productImage').value.trim();
  const description = document.getElementById('productDescription').value.trim();

  if (!imageUrl) return alert("الرجاء رفع صورة للمنتج أولاً");
  
  const productData = { name, category, price, imageUrl, description, isActive: true, updatedAt: serverTimestamp() };
  
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

const qProducts = query(collection(db, "products"), orderBy("createdAt", "desc"));
onSnapshot(qProducts, (snapshot) => {
  allProducts = [];
  snapshot.forEach((doc) => allProducts.push({ id: doc.id, ...doc.data() }));
  renderProducts(allProducts);
});

function renderProducts(products) {
  if (products.length === 0) {
    productsGrid.innerHTML = `<div class="empty-state"><p>لا توجد منتجات بعد. اضغط "إضافة منتج جديد" للبدء.</p></div>`;
    return;
  }
  productsGrid.innerHTML = products.map(product => {
    let unitPriceText = '';
    if (product.category === 'bag' && product.weightKg) unitPriceText = `سعر الكيلو: $${(product.price / product.weightKg).toFixed(2)}`;
    else if (product.category === 'box' && product.unitsPerBox) unitPriceText = `سعر الحبة: $${(product.price / product.unitsPerBox).toFixed(2)}`;
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

window.editProduct = (id) => {
  const product = allProducts.find(p => p.id === id);
  if (!product) return;
  document.getElementById('productId').value = product.id;
  document.getElementById('productName').value = product.name;
  document.getElementById('productPrice').value = product.price;
  document.getElementById('productDescription').value = product.description || '';
  productCategory.value = product.category;
  productImageField.value = product.imageUrl;
  imagePreview.src = product.imageUrl;
  imagePreviewContainer.classList.remove('hidden');
  uploadText.textContent = '🔄 تغيير الصورة';
  if (product.category === 'bag') document.getElementById('productWeight').value = product.weightKg || '';
  else document.getElementById('productUnits').value = product.unitsPerBox || '';
  document.getElementById('modalTitle').textContent = 'تعديل المنتج';
  toggleCategoryFields();
  productModal.classList.remove('hidden');
};

window.deleteProduct = async (id) => {
  if (confirm('هل أنت متأكد من حذف هذا المنتج نهائياً؟')) {
    try { await deleteDoc(doc(db, "products", id)); } catch (error) { alert(error.message); }
  }
};

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

addCustomerBtn.addEventListener('click', () => { customerForm.reset(); customerModal.classList.remove('hidden'); });
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
  const password = document.getElementById('custPassword').value;
  
  btnText.classList.add('hidden');
  btnLoader.classList.remove('hidden');
  saveBtn.disabled = true;
  
  const secondaryAppName = "secondaryApp_" + Date.now();
  const secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
  const { getAuth: getSecondaryAuth } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js");
  const secondaryAuth = getSecondaryAuth(secondaryApp);
  
  try {
    const email = `${username}@sanabel.local`;
    const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    const newUid = userCredential.user.uid;

    await setDoc(doc(db, "users", newUid), {
      username, displayName, phone, role: 'customer', isBlocked: false, createdAt: serverTimestamp()
    });

    alert(`تم إنشاء حساب الزبون بنجاح ✅\nاسم المستخدم: ${username}\nكلمة المرور: ${password}`);
    customerModal.classList.add('hidden');
  } catch (error) {
    if (error.code === 'auth/email-already-in-use') alert("اسم المستخدم محجوز.");
    else alert("خطأ: " + error.message);
  } finally {
    await secondaryAuth.signOut();
    await deleteApp(secondaryApp);
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
  try { await updateDoc(doc(db, "users", id), { isBlocked: !currentStatus }); } catch (error) { alert(error.message); }
};

document.getElementById('searchCustomers').addEventListener('input', (e) => {
  const term = e.target.value.trim().toLowerCase();
  renderCustomers(allCustomers.filter(c => (c.displayName && c.displayName.toLowerCase().includes(term)) || (c.username && c.username.toLowerCase().includes(term))));
});

// ==========================================
// 5. رفع الصور التلقائي (ImgBB)
// ==========================================
const IMGBB_API_KEY = "99bf37915afe5bdef0be905ae32d82fd";
const imageFileInput = document.getElementById('productImageFile');
const productImageField = document.getElementById('productImage');
const uploadText = document.getElementById('uploadText');
const uploadLoader = document.getElementById('uploadLoader');
const imagePreviewContainer = document.getElementById('imagePreviewContainer');
const imagePreview = document.getElementById('imagePreview');
const removeImageBtn = document.getElementById('removeImageBtn');

async function uploadImageToImgBB(file) {
  const formData = new FormData();
  formData.append('image', file);
  const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: 'POST', body: formData });
  const data = await response.json();
  if (data.success) return data.data.url;
  throw new Error('فشل رفع الصورة');
}

imageFileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) return alert('حجم الصورة كبير جداً. الحد الأقصى 5 ميغابايت.');
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

// ==========================================
// 6. الإعدادات
// ==========================================
const settingsForm = document.getElementById('settingsForm');

onAuthStateChanged(auth, async (user) => {
  if (user) {
    try {
      const settingsDoc = await getDoc(doc(db, "settings", "store"));
      if (settingsDoc.exists()) {
        const data = settingsDoc.data();
        document.getElementById('settingWhatsapp').value = data.whatsappNumber || '';
        document.getElementById('settingCurrency').value = data.currency || '';
        document.getElementById('settingContactWhatsapp').value = data.contactWhatsapp || '';
      }
    } catch (error) { console.error(error); }
  }
});

settingsForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const saveBtn = document.getElementById('saveSettingsBtn');
  const btnText = saveBtn.querySelector('.btn-text');
  const btnLoader = saveBtn.querySelector('.btn-loader');
  btnText.classList.add('hidden');
  btnLoader.classList.remove('hidden');
  saveBtn.disabled = true;
  try {
    await setDoc(doc(db, "settings", "store"), {
      whatsappNumber: document.getElementById('settingWhatsapp').value.trim(),
      currency: document.getElementById('settingCurrency').value.trim(),
      contactWhatsapp: document.getElementById('settingContactWhatsapp').value.trim(),
      updatedAt: serverTimestamp()
    });
    alert("تم حفظ الإعدادات بنجاح ✅");
  } catch (error) {
    alert("حدث خطأ: " + error.message);
  } finally {
    btnText.classList.remove('hidden');
    btnLoader.classList.add('hidden');
    saveBtn.disabled = false;
  }
});

// ==========================================
// 7. التصنيفات
// ==========================================
const categoryModal = document.getElementById('categoryModal');
const addCategoryBtn = document.getElementById('addCategoryBtn');
const closeCategoryModal = document.getElementById('closeCategoryModal');
const cancelCategoryBtn = document.getElementById('cancelCategoryBtn');
const categoryForm = document.getElementById('categoryForm');
const categoriesGrid = document.getElementById('categoriesGrid');
let allCategories = [];

addCategoryBtn.addEventListener('click', () => { categoryForm.reset(); document.getElementById('categoryId').value = ''; document.getElementById('categoryModalTitle').textContent = 'إضافة تصنيف'; categoryModal.classList.remove('hidden'); });
closeCategoryModal.addEventListener('click', () => categoryModal.classList.add('hidden'));
cancelCategoryBtn.addEventListener('click', () => categoryModal.classList.add('hidden'));

categoryForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('categoryId').value;
  const name = document.getElementById('categoryName').value.trim();
  const data = { name, updatedAt: serverTimestamp() };
  if (!id) data.createdAt = serverTimestamp();
  try {
    if (id) { await updateDoc(doc(db, "categories", id), data); alert("تم التعديل ✅"); }
    else { await addDoc(collection(db, "categories"), data); alert("تمت الإضافة ✅"); }
    categoryModal.classList.add('hidden');
  } catch (error) { alert(error.message); }
});

onSnapshot(query(collection(db, "categories"), orderBy("createdAt", "desc")), (snapshot) => {
  allCategories = [];
  snapshot.forEach(doc => allCategories.push({ id: doc.id, ...doc.data() }));
  if (allCategories.length === 0) { categoriesGrid.innerHTML = `<div class="empty-state"><p>لا توجد تصنيفات بعد.</p></div>`; return; }
  categoriesGrid.innerHTML = allCategories.map(cat => `
    <div class="product-card">
      <div class="product-info">
        <h3 class="product-title">${cat.name}</h3>
        <div class="product-actions" style="margin-top:auto;">
          <button class="btn-edit" onclick="editCategory('${cat.id}')">🖊️ تعديل</button>
          <button class="btn-delete" onclick="deleteCategory('${cat.id}')">🗑️ حذف</button>
        </div>
      </div>
    </div>
  `).join('');
});

window.editCategory = (id) => {
  const cat = allCategories.find(c => c.id === id);
  if (!cat) return;
  document.getElementById('categoryId').value = cat.id;
  document.getElementById('categoryName').value = cat.name;
  document.getElementById('categoryModalTitle').textContent = 'تعديل التصنيف';
  categoryModal.classList.remove('hidden');
};

window.deleteCategory = async (id) => {
  if (confirm('حذف هذا التصنيف؟')) { await deleteDoc(doc(db, "categories", id)); }
};

// ==========================================
// 8. العروض
// ==========================================
const offerModal = document.getElementById('offerModal');
const addOfferBtn = document.getElementById('addOfferBtn');
const closeOfferModal = document.getElementById('closeOfferModal');
const cancelOfferBtn = document.getElementById('cancelOfferBtn');
const offerForm = document.getElementById('offerForm');
const offersGrid = document.getElementById('offersGrid');
const offerProductSelect = document.getElementById('offerProductId');
let allOffers = [];

// تعبئة المنتجات في قائمة الاختيار
onSnapshot(collection(db, "products"), (snapshot) => {
  offerProductSelect.innerHTML = '<option value="">-- اختر منتج --</option>';
  snapshot.forEach(doc => {
    const p = doc.data();
    offerProductSelect.innerHTML += `<option value="${doc.id}">${p.name}</option>`;
  });
});

addOfferBtn.addEventListener('click', () => { offerForm.reset(); document.getElementById('offerId').value = ''; document.getElementById('offerModalTitle').textContent = 'إضافة عرض'; offerModal.classList.remove('hidden'); });
closeOfferModal.addEventListener('click', () => offerModal.classList.add('hidden'));
cancelOfferBtn.addEventListener('click', () => offerModal.classList.add('hidden'));

offerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('offerId').value;
  const productId = document.getElementById('offerProductId').value;
  const productName = offerProductSelect.options[offerProductSelect.selectedIndex].text;
  const data = {
    productId, productName,
    buyQty: parseInt(document.getElementById('offerBuyQty').value),
    freeQty: parseInt(document.getElementById('offerFreeQty').value),
    description: document.getElementById('offerDescription').value.trim(),
    isActive: true, updatedAt: serverTimestamp()
  };
  if (!id) data.createdAt = serverTimestamp();
  try {
    if (id) { await updateDoc(doc(db, "offers", id), data); alert("تم التعديل ✅"); }
    else { await addDoc(collection(db, "offers"), data); alert("تمت الإضافة ✅"); }
    offerModal.classList.add('hidden');
  } catch (error) { alert(error.message); }
});

onSnapshot(query(collection(db, "offers"), orderBy("createdAt", "desc")), (snapshot) => {
  allOffers = [];
  snapshot.forEach(doc => allOffers.push({ id: doc.id, ...doc.data() }));
  if (allOffers.length === 0) { offersGrid.innerHTML = `<div class="empty-state"><p>لا توجد عروض بعد.</p></div>`; return; }
  offersGrid.innerHTML = allOffers.map(off => `
    <div class="product-card">
      <div class="product-info">
        <span class="product-badge">🎁 عرض</span>
        <h3 class="product-title">${off.productName}</h3>
        <p>اشترِ <strong>${off.buyQty}</strong> واحصل على <strong>${off.freeQty}</strong> مجاناً</p>
        <p class="product-unit-price">${off.description || ''}</p>
        <div class="product-actions">
          <button class="btn-edit" onclick="editOffer('${off.id}')">🖊️ تعديل</button>
          <button class="btn-delete" onclick="deleteOffer('${off.id}')">🗑️ حذف</button>
        </div>
      </div>
    </div>
  `).join('');
});

window.editOffer = (id) => {
  const off = allOffers.find(o => o.id === id);
  if (!off) return;
  document.getElementById('offerId').value = off.id;
  document.getElementById('offerProductId').value = off.productId;
  document.getElementById('offerBuyQty').value = off.buyQty;
  document.getElementById('offerFreeQty').value = off.freeQty;
  document.getElementById('offerDescription').value = off.description || '';
  document.getElementById('offerModalTitle').textContent = 'تعديل العرض';
  offerModal.classList.remove('hidden');
};

window.deleteOffer = async (id) => {
  if (confirm('حذف هذا العرض؟')) { await deleteDoc(doc(db, "offers", id)); }
};

// ==========================================
// 9. الإشعارات
// ==========================================
const notificationModal = document.getElementById('notificationModal');
const addNotificationBtn = document.getElementById('addNotificationBtn');
const closeNotifModal = document.getElementById('closeNotifModal');
const cancelNotifBtn = document.getElementById('cancelNotifBtn');
const notificationForm = document.getElementById('notificationForm');
const notificationsGrid = document.getElementById('notificationsGrid');
let allNotifications = [];

addNotificationBtn.addEventListener('click', () => { notificationForm.reset(); notificationModal.classList.remove('hidden'); });
closeNotifModal.addEventListener('click', () => notificationModal.classList.add('hidden'));
cancelNotifBtn.addEventListener('click', () => notificationModal.classList.add('hidden'));

notificationForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const message = document.getElementById('notifMessage').value.trim();
  try {
    await addDoc(collection(db, "notifications"), { message, createdAt: serverTimestamp() });
    alert("تم إرسال الإشعار ✅");
    notificationModal.classList.add('hidden');
  } catch (error) { alert(error.message); }
});

onSnapshot(query(collection(db, "notifications"), orderBy("createdAt", "desc")), (snapshot) => {
  allNotifications = [];
  snapshot.forEach(doc => allNotifications.push({ id: doc.id, ...doc.data() }));
  if (allNotifications.length === 0) { notificationsGrid.innerHTML = `<div class="empty-state"><p>لا توجد إشعارات.</p></div>`; return; }
  notificationsGrid.innerHTML = allNotifications.map(not => `
    <div class="product-card">
      <div class="product-info">
        <p style="font-size:1rem; margin-bottom:15px;">${not.message}</p>
        <div class="product-actions" style="margin-top:auto;">
          <button class="btn-delete" onclick="deleteNotification('${not.id}')">🗑️ حذف</button>
        </div>
      </div>
    </div>
  `).join('');
});

window.deleteNotification = async (id) => {
  if (confirm('حذف هذا الإشعار؟')) { await deleteDoc(doc(db, "notifications", id)); }
};
