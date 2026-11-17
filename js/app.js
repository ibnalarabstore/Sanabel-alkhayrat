// ==========================================
// حماية زر الرجوع (منع الخروج المفاجئ)
// ==========================================

// 1. نضيف سجل وهمي أول ما يفتح التطبيق
history.pushState({ page: 'app' }, '', location.href);

// 2. لما الزبون يكبس زر الرجوع
window.addEventListener('popstate', (e) => {
  const confirmExit = confirm("هل أنت متأكد أنك تريد الخروج من التطبيق؟");
  
  if (confirmExit) {
    // إذا أكد، نرجعه للسجل الوهمي ونخليه يخرج
    history.back();
  } else {
    // إذا رفض، نضيف سجل وهمي جديد عشان ما يخرج
    history.pushState({ page: 'app' }, '', location.href);
  }
});
