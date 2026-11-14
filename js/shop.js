import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc, setDoc, collection, query, where, orderBy, onSnapshot, arrayUnion, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ==========================================
// المتغيرات العامة
// ==========================================
let currentUser = null;
let currentUserData = null;
let storeSettings = { whatsappNumber: "96171447409", currency: "$" };
let allProducts = [];
let allCategories = [];
let allOffers = [];
let allNotifications = [];
let readNotifications = [];
let currentCategory = "all";
let cart = JSON.parse(localStorage.getItem('sanabelCart')) || [];
let myOrders = [];

let pendingOffer = null;
let pendingProductId = null;

const shopProductsGrid = document.getElementById('shopProductsGrid');
const categoryFilter = document.getElementById('categoryFilter');

// ==========================================
// 1. حماية الصفحة وجلب بيانات الزبون
// ==========================================
onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = 'index.html'; return; }
  currentUser = user;
  
  try {
    const userDoc = await getDoc(doc(db, "users", user.uid));
    if (userDoc.exists()) {
      currentUserData = userDoc.data();
      
      if (currentUserData.isBlocked) {
        await signOut(auth);
        alert("حسابك محظور.");
        window.location.href = 'index.html';
        return;
      }

      const displayName = currentUserData.displayName || currentUserData.username;
      document.getElementById('menuUserName').textContent = displayName;
      document.getElementById('menuUsername').textContent = "@" + currentUserData.username;
      
      const readDoc = await getDoc(doc(db, "notificationReads", user.uid));
      if (readDoc.exists()) readNotifications = readDoc.data().readIds || [];
      
      loadSettings();
      loadProducts();
      loadCategories();
      loadOffers();
      loadNotifications();
      loadMyOrders();
      updateCartUI();
      updateNotifCount();
    } else {
      window.location.href = 'index.html';
    }
  } catch (error) {
    console.error(error);
    window.location.href = 'index.html';
  }
});

// تسجيل الخروج
document.getElementById('logoutShopBtn').addEventListener('click', async () => {
  await signOut(auth);
  window.location.href = 'index.html';
});

// ==========================================
// 2. الإعدادات
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
  } catch (error) { console.error(error); }
}

// ==========================================
// 3. المنتجات والتصنيفات والعروض
// ==========================================
function loadProducts() {
  onSnapshot(collection(db, "products"), (snapshot) => {
    allProducts = [];
    snapshot.forEach(doc => allProducts.push({ id: doc.id, ...doc.data() }));
    // ترتيب يدوي لتجنب مشاكل الـ index
    allProducts.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    renderProducts();
  });
}

function loadCategories() {
  onSnapshot(collection(db, "categories"), (snapshot) => {
    allCategories = [];
    snapshot.forEach(doc => allCategories.push({ id: doc.id, ...doc.data() }));
    renderCategories();
  });
}

function loadOffers() {
  onSnapshot(collection(db, "offers"), (snapshot) => {
    allOffers = [];
    snapshot.forEach(doc => allOffers.push({ id: doc.id, ...doc.data() }));
    renderProducts();
  });
}

// ==========================================
// 4. الإشعارات
// ==========================================
function loadNotifications() {
  onSnapshot(collection(db, "notifications"), (snapshot) => {
    allNotifications = [];
    snapshot.forEach(doc => allNotifications.push({ id: doc.id, ...doc.data() }));
    allNotifications.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    renderNotifications();
    updateNotifCount();
  });
}

function updateNotifCount() {
  const unreadCount = allNotifications.filter(n => !readNotifications.includes(n.id)).length;
  
  const menuCountEl = document.getElementById('menuNotifCount');
  if (menuCountEl) {
    if (unreadCount > 0) {
      menuCountEl.textContent = unreadCount;
      menuCountEl.classList.remove('hidden');
    } else {
      menuCountEl.classList.add('hidden');
    }
  }
  
  const dotEl = document.getElementById('notifDot');
  if (dotEl) {
    if (unreadCount > 0) dotEl.classList.remove('hidden');
    else dotEl.classList.add('hidden');
  }
}

function renderNotifications() {
  const list = document.getElementById('notificationsList');
  
  if (allNotifications.length === 0) {
    list.innerHTML = `<div class="empty-notif">لا توجد إشعارات.</div>`;
    return;
  }
  
  list.innerHTML = allNotifications.map(notif => {
    const isUnread = !readNotifications.includes(notif.id);
    return `
      <div class="notif-item ${isUnread ? 'unread' : ''}">
        <p>${notif.message}</p>
        <button class="notif-delete-btn" onclick="deleteNotif('${notif.id}')">🗑️</button>
      </div>
    `;
  }).join('');
}

window.deleteNotif = async (id) => {
  if (!confirm('حذف هذا الإشعار؟')) return;
  try {
    await setDoc(doc(db, "notificationReads", currentUser.uid), {
      readIds: arrayUnion(id),
      deletedIds: arrayUnion(id)
    }, { merge: true });
    allNotifications = allNotifications.filter(n => n.id !== id);
    renderNotifications();
    updateNotifCount();
  } catch (error) { alert("خطأ: " + error.message); }
};

// ==========================================
// 5. القائمة الجانبية
// ==========================================
const sideMenuOverlay = document.getElementById('sideMenuOverlay');

document.getElementById('menuBtn').addEventListener('click', () => {
  sideMenuOverlay.classList.remove('hidden');
});
sideMenuOverlay.addEventListener('click', (e) => {
  if (e.target === sideMenuOverlay) sideMenuOverlay.classList.add('hidden');
});

document.getElementById('menuMyOrdersBtn').addEventListener('click', () => {
  sideMenuOverlay.classList.add('hidden');
  document.getElementById('myOrdersModal').classList.remove('hidden');
});

document.getElementById('menuNotifsBtn').addEventListener('click', async () => {
  sideMenuOverlay.classList.add('hidden');
  document.getElementById('notificationsModal').classList.remove('hidden');
  
  const allIds = allNotifications.map(n => n.id);
  if (allIds.length > 0) {
    try {
      await setDoc(doc(db, "notificationReads", currentUser.uid), {
        readIds: arrayUnion(...allIds)
      }, { merge: true });
      readNotifications = [...new Set([...readNotifications, ...allIds])];
      renderNotifications();
      updateNotifCount();
    } catch (error) { console.error(error); }
  }
});

document.getElementById('closeNotifModal').addEventListener('click', () => {
  document.getElementById('notificationsModal').classList.add('hidden');
});

// ==========================================
// 6. التصنيفات
// ==========================================
function renderCategories() {
  let html = `<button class="cat-btn ${currentCategory === 'all' ? 'active' : ''}" data-cat="all">الكل</button>`;
  allCategories.forEach(cat => {
    html += `<button class="cat-btn ${currentCategory === cat.name ? 'active' : ''}" data-cat="${cat.name}">${cat.name}</button>`;
  });
  categoryFilter.innerHTML = html;
  
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
// 7. المنتجات
// ==========================================
function renderProducts() {
  let filtered = allProducts;
  if (currentCategory !== 'all') {
    filtered = filtered.filter(p => 
      p.category === currentCategory || 
      p.subCategory === currentCategory || 
      p.name.includes(currentCategory)
    );
  }
  
  const searchTerm = document.getElementById('searchShop').value.trim().toLowerCase();
  if (searchTerm) filtered = filtered.filter(p => p.name.toLowerCase().includes(searchTerm));
  
  if (filtered.length === 0) {
    shopProductsGrid.innerHTML = `<div class="empty-state"><p>لا توجد منتجات.</p></div>`;
    return;
  }
  
  shopProductsGrid.innerHTML = filtered.map(product => {
    let qtyText = '';
    if (product.category === 'bag' && product.weightKg) {
      qtyText = `الوزن: ${product.weightKg} كغ`;
    } else if (product.category === 'box' && product.unitsPerBox) {
      qtyText = `العدد: ${product.unitsPerBox} حبة`;
    }
    
    const offer = allOffers.find(o => o.productId === product.id && o.isActive);
    const offerBadge = offer ? `<div class="offer-badge">🎁 اشترِ ${offer.buyQty} واحصل على ${offer.freeQty} مجاناً!</div>` : '';
    
    return `
      <div class="product-card" onclick="openProductDetails('${product.id}')">
        <img src="${product.imageUrl}" alt="${product.name}" class="product-img" onerror="this.src='https://via.placeholder.com/300x200?text=No+Image'">
        <div class="product-info">
          ${offerBadge}
          <h3 class="product-title">${product.name}</h3>
          <div class="product-price-box">
            <strong>${product.price}${storeSettings.currency}</strong>
            <small>${qtyText}</small>
          </div>
          <button class="add-to-cart-btn" onclick="event.stopPropagation(); handleAddToCart('${product.id}')">➕ أضف للسلة</button>
        </div>
      </div>
    `;
  }).join('');
}

document.getElementById('searchShop').addEventListener('input', renderProducts);

// ==========================================
// 8. نافذة تفاصيل المنتج
// ==========================================
window.openProductDetails = (productId) => {
  const product = allProducts.find(p => p.id === productId);
  if (!product) return;
  
  document.getElementById('detailImage').src = product.imageUrl;
  document.getElementById('detailName').textContent = product.name;
  document.getElementById('detailDescription').textContent = product.description || '';
  document.getElementById('detailPrice').textContent = `${product.price}${storeSettings.currency}`;
  
  const offer = allOffers.find(o => o.productId === product.id && o.isActive);
  
  if (product.category === 'bag' && product.weightKg) {
    document.getElementById('detailUnitLabel').textContent = 'سعر الكيلو';
    document.getElementById('detailUnitPrice').textContent = `${(product.price / product.weightKg).toFixed(2)}${storeSettings.currency}`;
    document.getElementById('detailQtyLabel').textContent = 'وزن الشوال';
    document.getElementById('detailQuantity').textContent = `${product.weightKg} كغ`;
  } else if (product.category === 'box' && product.unitsPerBox) {
    document.getElementById('detailUnitLabel').textContent = 'سعر الحبة';
    document.getElementById('detailUnitPrice').textContent = `${(product.price / product.unitsPerBox).toFixed(2)}${storeSettings.currency}`;
    document.getElementById('detailQtyLabel').textContent = 'عدد الحبات';
    document.getElementById('detailQuantity').textContent = `${product.unitsPerBox} حبة`;
  }
  
  const offerBox = document.getElementById('detailOfferBox');
  if (offer) {
    const freeValue = product.price * offer.freeQty;
    offerBox.classList.remove('hidden');
    offerBox.innerHTML = `
      <div class="offer-title">🎁 عرض خاص: اشترِ ${offer.buyQty} واحصل على ${offer.freeQty} مجاناً</div>
      <div class="offer-savings">💰 توفير: ${freeValue.toFixed(2)}${storeSettings.currency} (قيمة ${offer.freeQty} مجاناً)</div>
    `;
  } else {
    offerBox.classList.add('hidden');
  }
  
  const addBtn = document.getElementById('detailAddToCartBtn');
  addBtn.onclick = () => {
    handleAddToCart(product.id);
    document.getElementById('productDetailsModal').classList.add('hidden');
  };
  
  document.getElementById('productDetailsModal').classList.remove('hidden');
};

document.getElementById('closeProductDetailsBtn').addEventListener('click', () => {
  document.getElementById('productDetailsModal').classList.add('hidden');
});
document.getElementById('productDetailsModal').addEventListener('click', (e) => {
  if (e.target.id === 'productDetailsModal') document.getElementById('productDetailsModal').classList.add('hidden');
});

// ==========================================
// 9. السلة والعروض
// ==========================================
window.handleAddToCart = (productId) => {
  const product = allProducts.find(p => p.id === productId);
  if (!product) return;
  
  const offer = allOffers.find(o => o.productId === productId && o.isActive);
  
  if (offer) {
    pendingProductId = productId;
    pendingOffer = offer;
    
    document.getElementById('offerDetails').innerHTML = `
      <h3 style="color: #111;">${product.name}</h3>
      <p style="margin-top: 10px; font-size: 1.1rem;">
        🎁 <strong>عرض خاص:</strong><br>
        اشترِ <strong>${offer.buyQty}</strong> واحصل على <strong>${offer.freeQty}</strong> مجاناً
      </p>
      <p style="margin-top: 10px; color: #aa8c2c; font-weight: 800;">
        السعر الإجمالي: ${(product.price * offer.buyQty).toFixed(2)}${storeSettings.currency}
      </p>
    `;
    document.getElementById('offerChoiceModal').classList.remove('hidden');
  } else {
    addToCartDirect(product);
  }
};

document.getElementById('chooseSingleBtn').addEventListener('click', () => {
  const product = allProducts.find(p => p.id === pendingProductId);
  if (product) addToCartDirect(product);
  document.getElementById('offerChoiceModal').classList.add('hidden');
});

document.getElementById('chooseFullOfferBtn').addEventListener('click', () => {
  const product = allProducts.find(p => p.id === pendingProductId);
  if (!product || !pendingOffer) return;
  
  const totalQty = pendingOffer.buyQty + pendingOffer.freeQty;
  const existing = cart.find(item => item.productId === pendingProductId && item.isOffer);
  
  if (existing) {
    existing.qty += totalQty;
  } else {
    cart.push({
      productId: product.id,
      name: `${product.name} (عرض: ${pendingOffer.buyQty}+${pendingOffer.freeQty} مجاناً)`,
      price: product.price,
      imageUrl: product.imageUrl,
      category: product.category,
      qty: totalQty,
      isOffer: true,
      payQty: pendingOffer.buyQty,
      freeQty: pendingOffer.freeQty
    });
  }
  
  saveCart();
  updateCartUI();
  document.getElementById('offerChoiceModal').classList.add('hidden');
});

document.getElementById('closeOfferModal').addEventListener('click', () => {
  document.getElementById('offerChoiceModal').classList.add('hidden');
});

function addToCartDirect(product) {
  const existing = cart.find(item => item.productId === product.id && !item.isOffer);
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
  
  const cartCount = document.getElementById('cartCount');
  cartCount.style.transform = 'scale(1.3)';
  setTimeout(() => cartCount.style.transform = 'scale(1)', 200);
}

function saveCart() {
  localStorage.setItem('sanabelCart', JSON.stringify(cart));
}

function updateCartUI() {
  const totalItems = cart.reduce((sum, item) => sum + item.qty, 0);
  document.getElementById('cartCount').textContent = totalItems;
  
  const cartItemsContainer = document.getElementById('cartItems');
  const cartTotalEl = document.getElementById('cartTotal');
  
  if (cart.length === 0) {
    cartItemsContainer.innerHTML = `<div class="empty-cart"><p>السلة فاضية.</p></div>`;
    cartTotalEl.textContent = `0.00${storeSettings.currency}`;
    return;
  }
  
  cartItemsContainer.innerHTML = cart.map(item => {
    let displayPrice = item.isOffer 
      ? `${item.price}${storeSettings.currency} × ${item.payQty} (مدفوع) + ${item.freeQty} مجاناً`
      : `${item.price}${storeSettings.currency} للواحدة`;
    
    return `
      <div class="cart-item">
        <img src="${item.imageUrl}" class="cart-item-img" onerror="this.src='https://via.placeholder.com/60'">
        <div class="cart-item-info">
          <h4>${item.name}</h4>
          <p>${displayPrice}</p>
          <div class="cart-qty-controls">
            <button class="qty-btn" onclick="changeQty('${item.productId}', ${item.isOffer ? 'true' : 'false'}, -1)">−</button>
            <span>${item.qty}</span>
            <button class="qty-btn" onclick="changeQty('${item.productId}', ${item.isOffer ? 'true' : 'false'}, 1)">+</button>
          </div>
        </div>
        <button class="cart-remove-btn" onclick="removeFromCart('${item.productId}', ${item.isOffer ? 'true' : 'false'})">🗑️</button>
      </div>
    `;
  }).join('');
  
  const total = cart.reduce((sum, item) => {
    if (item.isOffer) return sum + (item.price * item.payQty * (item.qty / (item.payQty + item.freeQty)));
    return sum + (item.price * item.qty);
  }, 0);
  
  cartTotalEl.textContent = `${total.toFixed(2)}${storeSettings.currency}`;
}

window.changeQty = (productId, isOffer, delta) => {
  const item = cart.find(i => i.productId === productId && !!i.isOffer === isOffer);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) {
    cart = cart.filter(i => !(i.productId === productId && !!i.isOffer === isOffer));
  }
  saveCart();
  updateCartUI();
};

window.removeFromCart = (productId, isOffer) => {
  cart = cart.filter(i => !(i.productId === productId && !!i.isOffer === isOffer));
  saveCart();
  updateCartUI();
};

document.getElementById('cartBtn').addEventListener('click', () => {
  document.getElementById('cartOverlay').classList.remove('hidden');
});
document.getElementById('closeCartBtn').addEventListener('click', () => {
  document.getElementById('cartOverlay').classList.add('hidden');
});
document.getElementById('cartOverlay').addEventListener('click', (e) => {
  if (e.target.id === 'cartOverlay') document.getElementById('cartOverlay').classList.add('hidden');
});

// ==========================================
// 10. إتمام الطلب + الحفظ في DB
// ==========================================
document.getElementById('checkoutBtn').addEventListener('click', async () => {
  if (cart.length === 0) { alert("السلة فاضية!"); return; }
  
  const customerName = currentUserData.displayName || currentUserData.username;
  const customerPhone = currentUserData.phone || "غير محدد";
  
  let total = 0;
  const itemsForDB = cart.map(item => {
    let lineTotal;
    if (item.isOffer) lineTotal = item.price * item.payQty * (item.qty / (item.payQty + item.freeQty));
    else lineTotal = item.price * item.qty;
    total += lineTotal;
    return {
      productId: item.productId,
      name: item.name,
      price: item.price,
      qty: item.qty,
      lineTotal: parseFloat(lineTotal.toFixed(2)),
      isOffer: item.isOffer || false,
      payQty: item.payQty || null,
      freeQty: item.freeQty || null
    };
  });
  
  try {
    await addDoc(collection(db, "orders"), {
      userId: currentUser.uid,
      customerName,
      customerPhone,
      items: itemsForDB,
      total: parseFloat(total.toFixed(2)),
      currency: storeSettings.currency,
      createdAt: serverTimestamp()
    });
  } catch (err) {
    console.error("خطأ في حفظ الطلب:", err);
    if (!confirm("ما قدرنا نحفظ الطلب. بتحب نكمل عبر واتساب على أي حال؟")) return;
  }
  
  let message = `🌾 *طلب جديد من سنابل الخيرات* 🌾\n\n`;
  message += `👤 *الزبون:* ${customerName}\n`;
  message += `📞 *الهاتف:* ${customerPhone}\n`;
  message += `━━━━━━━━━━━━━━━━━━\n\n📦 *المنتجات:*\n\n`;
  
  itemsForDB.forEach((item, index) => {
    if (item.isOffer) {
      message += `${index + 1}. ${item.name}\n`;
      message += `   الكمية: ${item.qty} (${item.payQty} مدفوع + ${item.freeQty} مجاني)\n`;
      message += `   السعر: ${item.lineTotal}${storeSettings.currency}\n\n`;
    } else {
      message += `${index + 1}. ${item.name}\n`;
      message += `   الكمية: ${item.qty} × ${item.price}${storeSettings.currency} = ${item.lineTotal}${storeSettings.currency}\n\n`;
    }
  });
  
  message += `━━━━━━━━━━━━━━━━━━\n💰 *الإجمالي:* ${total.toFixed(2)}${storeSettings.currency}\n\n`;
  message += `📅 التاريخ: ${new Date().toLocaleDateString('ar-EG')}`;
  
  window.open(`https://wa.me/${storeSettings.whatsappNumber}?text=${encodeURIComponent(message)}`, '_blank');
  
  if (confirm("هل تم إرسال الطلب بنجاح؟ سيتم تفريغ السلة.")) {
    cart = [];
    saveCart();
    updateCartUI();
    document.getElementById('cartOverlay').classList.add('hidden');
  }
});

// ==========================================
// 11. طلباتي (معدلة لتجنب مشكلة الـ Index)
// ==========================================
function loadMyOrders() {
  const q = query(
    collection(db, "orders"), 
    where("userId", "==", currentUser.uid)
  );

  onSnapshot(q, (snapshot) => {
    myOrders = [];
    snapshot.forEach(doc => {
      myOrders.push({ id: doc.id, ...doc.data() });
    });
    // ترتيب يدوي (الأحدث أولاً)
    myOrders.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    renderMyOrders();
  }, (error) => {
    console.error("خطأ في جلب الطلبات:", error);
    document.getElementById('myOrdersList').innerHTML = `<div class="empty-cart"><p>حدث خطأ في جلب الطلبات.</p></div>`;
  });
}

function renderMyOrders() {
  const list = document.getElementById('myOrdersList');
  
  if (myOrders.length === 0) {
    list.innerHTML = `<div class="empty-cart"><p>لا توجد طلبات سابقة.</p></div>`;
    return;
  }
  
  list.innerHTML = myOrders.map(order => {
    const date = order.createdAt 
      ? new Date(order.createdAt.seconds * 1000).toLocaleDateString('ar-EG', {
          year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
        }) 
      : 'غير محدد';
    
    const itemsHtml = order.items.map(item => `
      <div class="order-item-row">
        <span>${item.name} × ${item.qty}</span>
        <span>${item.lineTotal}${order.currency}</span>
      </div>
    `).join('');
    
    return `
      <div class="order-card">
        <div class="order-header">
          <span class="order-date">📅 ${date}</span>
          <span class="order-total">${order.total}${order.currency}</span>
        </div>
        <div class="order-items">${itemsHtml}</div>
        <button class="reorder-btn" onclick="reorderItems('${order.id}')">🔄 إعادة الطلب</button>
      </div>
    `;
  }).join('');
}

window.reorderItems = (orderId) => {
  const order = myOrders.find(o => o.id === orderId);
  if (!order) return;
  
  if (cart.length > 0 && !confirm("عندك منتجات بالسلة. بتحب نضيف عليهم؟")) return;
  
  let addedCount = 0;
  order.items.forEach(item => {
    const product = allProducts.find(p => p.id === item.productId);
    if (!product) return;
    
    if (item.isOffer) {
      cart.push({
        productId: item.productId,
        name: item.name,
        price: item.price,
        imageUrl: product.imageUrl,
        category: product.category,
        qty: item.qty,
        isOffer: true,
        payQty: item.payQty,
        freeQty: item.freeQty
      });
    } else {
      const existing = cart.find(i => i.productId === item.productId && !i.isOffer);
      if (existing) existing.qty += item.qty;
      else {
        cart.push({
          productId: item.productId,
          name: item.name,
          price: item.price,
          imageUrl: product.imageUrl,
          category: product.category,
          qty: item.qty
        });
      }
    }
    addedCount++;
  });
  
  saveCart();
  updateCartUI();
  document.getElementById('myOrdersModal').classList.add('hidden');
  alert(`تمت إضافة ${addedCount} منتج للسلة ✅`);
};

document.getElementById('closeMyOrdersBtn').addEventListener('click', () => {
  document.getElementById('myOrdersModal').classList.add('hidden');
});
document.getElementById('myOrdersModal').addEventListener('click', (e) => {
  if (e.target.id === 'myOrdersModal') document.getElementById('myOrdersModal').classList.add('hidden');
});
