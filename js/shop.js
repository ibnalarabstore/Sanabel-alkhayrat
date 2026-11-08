import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc, collection, query, orderBy, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ==========================================
// المتغيرات العامة
// ==========================================
let currentUser = null;
let currentUserData = null;
let storeSettings = { whatsappNumber: "96171447409", currency: "$" };
let allProducts = [];
let allCategories = [];
let allOffers = [];
let currentCategory = "all";
let cart = JSON.parse(localStorage.getItem('sanabelCart')) || [];

// عناصر الصفحة
const shopProductsGrid = document.getElementById('shopProductsGrid');
const categoryFilter = document.getElementById('categoryFilter');
const cartBtn = document.getElementById('cartBtn');
const cartCount = document.getElementById('cartCount');
const cartOverlay = document.getElementById('cartOverlay');
const closeCartBtn = document.getElementById('closeCartBtn');
const cartItemsContainer = document.getElementById('cartItems');
const cartTotalEl = document.getElementById('cartTotal');
const checkoutBtn = document.getElementById('checkoutBtn');

// ==========================================
// 1. حماية الصفحة وجلب بيانات الزبون
// ==========================================
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = 'index.html';
    return;
  }
  currentUser = user;
  
  try {
    const userDoc = await getDoc(doc(db, "users", user.uid));
    if (userDoc.exists()) {
      currentUserData = userDoc.data();
      
      if (currentUserData.isBlocked) {
        await signOut(auth);
        alert("عذراً، حسابك محظور. يرجى التواصل مع الإدارة.");
        window.location.href = 'index.html';
        return;
      }

      document.getElementById('userName').textContent = currentUserData.displayName || currentUserData.username;
      document.getElementById('profileName').textContent = currentUserData.displayName || currentUserData.username;
      document.getElementById('profileUsername').textContent = "@" + currentUserData.username;
      
      loadSettings();
      loadProducts();
      loadCategories();
      loadOffers();
      loadNotifications();
      updateCartUI();
    } else {
      window.location.href = 'index.html';
    }
  } catch (error) {
    console.error("خطأ:", error);
    window.location.href = 'index.html';
  }
});

// تسجيل الخروج
document.getElementById('logoutShopBtn').addEventListener('click', async () => {
  await signOut(auth);
  window.location.href = 'index.html';
});

// ==========================================
// 2. جلب الإعدادات
// ==========================================
async function loadSettings() {
  try {
    const settingsDoc = await getDoc(doc(db, "settings", "store"));
    if (settingsDoc.exists()) {
      const data = settingsDoc.data();
      storeSettings = {
        whatsappNumber: data.whatsappNumber || "96171447409",
        currency: data.currency || "$"
      };
    }
  } catch (error) {
    console.error("خطأ في جلب الإعدادات:", error);
  }
}

// ==========================================
// 3. جلب المنتجات
// ==========================================
function loadProducts() {
  const q = query(collection(db, "products"), orderBy("createdAt", "desc"));
  onSnapshot(q, (snapshot) => {
    allProducts = [];
    snapshot.forEach(doc => allProducts.push({ id: doc.id, ...doc.data() }));
    renderProducts();
  });
}

// ==========================================
// 4. جلب التصنيفات
// ==========================================
function loadCategories() {
  onSnapshot(collection(db, "categories"), (snapshot) => {
    allCategories = [];
    snapshot.forEach(doc => allCategories.push({ id: doc.id, ...doc.data() }));
    renderCategories();
  });
}

// ==========================================
// 5. جلب العروض
// ==========================================
function loadOffers() {
  onSnapshot(collection(db, "offers"), (snapshot) => {
    allOffers = [];
    snapshot.forEach(doc => allOffers.push({ id: doc.id, ...doc.data() }));
    renderProducts();
  });
}

// ==========================================
// 6. جلب الإشعارات
// ==========================================
function loadNotifications() {
  const q = query(collection(db, "notifications"), orderBy("createdAt", "desc"));
  onSnapshot(q, (snapshot) => {
    const banner = document.getElementById('notificationBanner');
    const text = document.getElementById('notificationText');
    
    if (!snapshot.empty) {
      const latest = snapshot.docs[0].data();
      text.textContent = "🔔 " + latest.message;
      banner.classList.remove('hidden');
    }
  });
}

document.getElementById('closeNotification').addEventListener('click', () => {
  document.getElementById('notificationBanner').classList.add('hidden');
});

// ==========================================
// 7. رسم التصنيفات (النسخة المعدلة)
// ==========================================
function renderCategories() {
  // زر "الكل" + التصنيفات من الداتابيز
  let html = `<button class="cat-btn ${currentCategory === 'all' ? 'active' : ''}" data-cat="all">الكل</button>`;
  
  allCategories.forEach(cat => {
    html += `<button class="cat-btn ${currentCategory === cat.name ? 'active' : ''}" data-cat="${cat.name}">${cat.name}</button>`;
  });
  
  categoryFilter.innerHTML = html;
  
  // إعادة ربط الأحداث
  document.querySelectorAll('.cat-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentCategory = btn.getAttribute('data-cat');
      document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderProducts();
    });
  });
}

// ==========================================
// 8. رسم المنتجات
// ==========================================
function renderProducts() {
  let filtered = allProducts;
  
  // فلترة حسب التصنيف
  if (currentCategory !== 'all') {
    filtered = filtered.filter(p => p.category === currentCategory || p.name.includes(currentCategory));
  }
  
  // فلترة حسب البحث
  const searchTerm = document.getElementById('searchShop').value.trim().toLowerCase();
  if (searchTerm) {
    filtered = filtered.filter(p => p.name.toLowerCase().includes(searchTerm));
  }
  
  if (filtered.length === 0) {
    shopProductsGrid.innerHTML = `<div class="empty-state"><p>لا توجد منتجات مطابقة.</p></div>`;
    return;
  }
  
  shopProductsGrid.innerHTML = filtered.map(product => {
    let unitPrice = '';
    if (product.category === 'bag' && product.weightKg) {
      unitPrice = `سعر الكيلو: ${(product.price / product.weightKg).toFixed(2)}${storeSettings.currency}`;
    } else if (product.category === 'box' && product.unitsPerBox) {
      unitPrice = `سعر الحبة: ${(product.price / product.unitsPerBox).toFixed(2)}${storeSettings.currency}`;
    }
    
    const offer = allOffers.find(o => o.productId === product.id && o.isActive);
    const offerBadge = offer ? `<div class="offer-badge">🎁 اشترِ ${offer.buyQty} واحصل على ${offer.freeQty} مجاناً!</div>` : '';
    
    return `
      <div class="product-card">
        <img src="${product.imageUrl}" alt="${product.name}" class="product-img" onerror="this.src='https://via.placeholder.com/300x200?text=No+Image'">
        <div class="product-info">
          ${offerBadge}
          <h3 class="product-title">${product.name}</h3>
          <div class="product-price-box">
            <strong>${product.price}${storeSettings.currency}</strong>
            <small>${unitPrice}</small>
          </div>
          <button class="add-to-cart-btn" onclick="addToCart('${product.id}')">➕ أضف للسلة</button>
        </div>
      </div>
    `;
  }).join('');
}

// البحث
document.getElementById('searchShop').addEventListener('input', renderProducts);

// ==========================================
// 9. السلة
// ==========================================
window.addToCart = (productId) => {
  const product = allProducts.find(p => p.id === productId);
  if (!product) return;
  
  const existing = cart.find(item => item.productId === productId);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({
      productId: product.id,
      name: product.name,
      price: product.price,
      imageUrl: product.imageUrl,
      category: product.category,
      qty: 1
    });
  }
  
  saveCart();
  updateCartUI();
  
  cartCount.style.transform = 'scale(1.3)';
  setTimeout(() => cartCount.style.transform = 'scale(1)', 200);
};

function saveCart() {
  localStorage.setItem('sanabelCart', JSON.stringify(cart));
}

function updateCartUI() {
  const totalItems = cart.reduce((sum, item) => sum + item.qty, 0);
  cartCount.textContent = totalItems;
  
  if (cart.length === 0) {
    cartItemsContainer.innerHTML = `<div class="empty-cart"><p>السلة فاضية.</p></div>`;
    cartTotalEl.textContent = `0.00${storeSettings.currency}`;
    return;
  }
  
  cartItemsContainer.innerHTML = cart.map(item => `
    <div class="cart-item">
      <img src="${item.imageUrl}" class="cart-item-img" onerror="this.src='https://via.placeholder.com/60'">
      <div class="cart-item-info">
        <h4>${item.name}</h4>
        <p>${item.price}${storeSettings.currency} للواحدة</p>
        <div class="cart-qty-controls">
          <button class="qty-btn" onclick="changeQty('${item.productId}', -1)">−</button>
          <span>${item.qty}</span>
          <button class="qty-btn" onclick="changeQty('${item.productId}', 1)">+</button>
        </div>
      </div>
      <button class="cart-remove-btn" onclick="removeFromCart('${item.productId}')">🗑️</button>
    </div>
  `).join('');
  
  const total = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  cartTotalEl.textContent = `${total.toFixed(2)}${storeSettings.currency}`;
}

window.changeQty = (productId, delta) => {
  const item = cart.find(i => i.productId === productId);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) {
    cart = cart.filter(i => i.productId !== productId);
  }
  saveCart();
  updateCartUI();
};

window.removeFromCart = (productId) => {
  cart = cart.filter(i => i.productId !== productId);
  saveCart();
  updateCartUI();
};

// فتح وإغلاق السلة
cartBtn.addEventListener('click', () => cartOverlay.classList.remove('hidden'));
closeCartBtn.addEventListener('click', () => cartOverlay.classList.add('hidden'));
cartOverlay.addEventListener('click', (e) => { if (e.target === cartOverlay) cartOverlay.classList.add('hidden'); });

// ==========================================
// 10. إتمام الطلب عبر واتساب
// ==========================================
checkoutBtn.addEventListener('click', () => {
  if (cart.length === 0) {
    alert("السلة فاضية! أضف منتجات أولاً.");
    return;
  }
  
  const customerName = currentUserData.displayName || currentUserData.username;
  const customerPhone = currentUserData.phone || "غير محدد";
  
  let message = `🌾 *طلب جديد من سنابل الخيرات* 🌾\n\n`;
  message += `👤 *الزبون:* ${customerName}\n`;
  message += `📞 *الهاتف:* ${customerPhone}\n`;
  message += `━━━━━━━━━━━━━━━━━━\n\n`;
  message += `📦 *المنتجات المطلوبة:*\n\n`;
  
  cart.forEach((item, index) => {
    const lineTotal = (item.price * item.qty).toFixed(2);
    message += `${index + 1}. ${item.name}\n`;
    message += `   الكمية: ${item.qty} × ${item.price}${storeSettings.currency} = ${lineTotal}${storeSettings.currency}\n\n`;
  });
  
  const total = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  message += `━━━━━━━━━━━━━━━━━━\n`;
  message += `💰 *الإجمالي:* ${total.toFixed(2)}${storeSettings.currency}\n\n`;
  message += `📅 التاريخ: ${new Date().toLocaleDateString('ar-EG')}`;
  
  const encodedMessage = encodeURIComponent(message);
  window.open(`https://wa.me/${storeSettings.whatsappNumber}?text=${encodedMessage}`, '_blank');
  
  if (confirm("هل تم إرسال الطلب بنجاح؟ سيتم تفريغ السلة الآن.")) {
    cart = [];
    saveCart();
    updateCartUI();
    cartOverlay.classList.add('hidden');
  }
});

// ==========================================
// 11. البروفايل
// ==========================================
document.getElementById('profileBtn').addEventListener('click', () => {
  document.getElementById('profileModal').classList.remove('hidden');
});
document.getElementById('closeProfileBtn').addEventListener('click', () => {
  document.getElementById('profileModal').classList.add('hidden');
});
document.getElementById('profileModal').addEventListener('click', (e) => {
  if (e.target.id === 'profileModal') {
    document.getElementById('profileModal').classList.add('hidden');
  }
});
