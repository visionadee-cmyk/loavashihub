const fs = require('fs');
const path = require('path');
const files = [
  'src/pages/MenuManagement.tsx',
  'src/pages/TableManagement.tsx',
  'src/pages/StaffManagement.tsx',
  'src/pages/InventoryManagement.tsx',
  'src/pages/PurchaseProductsPage.tsx',
  'src/pages/DirectPurchasePage.tsx',
  'src/pages/InventoryUpdatePage.tsx',
  'src/pages/RecipeManagement.tsx',
  'src/pages/AssetManagement.tsx',
  'src/pages/ExpensesPage.tsx',
];
const replacements = [
  { from: /bg-slate-950\/70/g, to: 'bg-slate-50/70' },
  { from: /bg-slate-950\/50/g, to: 'bg-slate-100/50' },
  { from: /bg-slate-950/g, to: 'bg-white' },
  { from: /bg-slate-900\/80/g, to: 'bg-slate-100/80' },
  { from: /bg-slate-900\/50/g, to: 'bg-slate-100/50' },
  { from: /bg-slate-900/g, to: 'bg-slate-100' },
  { from: /border-slate-800/g, to: 'border-slate-200' },
  { from: /border-slate-700/g, to: 'border-slate-300' },
  { from: /shadow-slate-950\/20/g, to: 'shadow-slate-300/20' },
  { from: /shadow-slate-900\/20/g, to: 'shadow-slate-300/20' },
  { from: /text-xl font-semibold text-white/g, to: 'text-xl font-semibold text-slate-900' },
  { from: /text-lg font-semibold text-white/g, to: 'text-lg font-semibold text-slate-900' },
  { from: /text-base font-semibold text-white/g, to: 'text-base font-semibold text-slate-900' },
  { from: /text-sm text-slate-400/g, to: 'text-sm text-slate-600' },
  { from: /text-sm text-slate-300/g, to: 'text-sm text-slate-600' },
  { from: /text-slate-100/g, to: 'text-slate-900' },
];

for (const file of files) {
  const filepath = path.resolve(file);
  let content = fs.readFileSync(filepath, 'utf8');
  replacements.forEach(({ from, to }) => {
    content = content.replace(from, to);
  });
  fs.writeFileSync(filepath, content, 'utf8');
  console.log('Updated', file);
}
