import { readFileSync, writeFileSync } from 'node:fs';

let f = readFileSync('apps/web/src/components/DesignSystemsTab.tsx', 'utf8');

// All replacements - use exact matches from the file
const reps = [
  ['>Your systems<', ">{t('ds.yourSystems')}<"],
  ['>All<', ">{t('ds.filterAll')}<"],
  ['>Published<', ">{t('ds.filterPublished')}<"],
  ['>Draft<', ">{t('ds.filterDraft')}<"],
  ['>Library<', ">{t('ds.tabLibrary')}<"],
  ['>Official presets<', ">{t('ds.tabOfficial')}<"],
  ['>Templates<', ">{t('ds.tabTemplates')}<"],
  ['>Your templates<', ">{t('ds.yourTemplates')}<"],
  ['>Coming soon<', ">{t('ds.comingSoon')}<"],
  ['>Create new design system<', ">{t('ds.createNewTitle')}<"],
  ['>Teach Open Design your brand, product, code, assets, and design references.<', ">{t('ds.createNewDesc')}<"],
];

for (const [old, nw] of reps) {
  if (f.includes(old)) {
    f = f.replace(old, nw);
    console.log('OK:', old.substring(0, 60));
  } else {
    console.log('MISS:', old.substring(0, 60));
  }
}

writeFileSync('apps/web/src/components/DesignSystemsTab.tsx', f);
console.log('Done');
