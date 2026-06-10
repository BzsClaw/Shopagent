import { readFileSync, writeFileSync } from 'node:fs';

const PATH = 'apps/web/src/components/NewProjectPanel.tsx';
let f = readFileSync(PATH, 'utf8');
const lines = f.split('\n');

// 1. Remove the FIRST ref={triggerRef} (PlatformPicker's button, around line 1094)
// Keep the SECOND one (DesignSystemPicker's button, around line 2056)
let foundFirst = false;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('ref={triggerRef}')) {
    if (!foundFirst) {
      lines[i] = lines[i].replace('ref={triggerRef}', '');
      foundFirst = true;
      console.log('Removed first triggerRef at line', i + 1);
    } else {
      console.log('Kept second triggerRef at line', i + 1);
    }
  }
}

// 2. Add type annotation to useState
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('const [popStyle, setPopStyle] = useState(null);')) {
    lines[i] = '  const [popStyle, setPopStyle] = useState<{ top: number; left: number; width: number } | null>(null);';
    console.log('Fixed popStyle type at line', i + 1);
    break;
  }
}

// 3. Remove FIRST occurrence of calcPosition references in PlatformPicker
// These are the duplicate calcPosition calls added by the global replace
// PlatformPicker's useEffect is the first one with setPopStyle/calcPosition
// We need to revert those changes for PlatformPicker
let inPlatformPicker = false;
let platformPickerStart = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('function PlatformPicker({')) {
    inPlatformPicker = true;
    platformPickerStart = i;
  }
  if (inPlatformPicker && lines[i].includes('function FidelityPicker({')) {
    inPlatformPicker = false;
    // Found the end of PlatformPicker
    // Remove calcPosition calls within PlatformPicker
    for (let j = platformPickerStart; j < i; j++) {
      if (lines[j].includes('setPopStyle') || lines[j].includes('calcPosition')) {
        console.log('Removing PlatformPicker line', j + 1, ':', lines[j].trim().substring(0, 60));
        lines[j] = '';
      }
    }
    // Restore the original useEffect pattern in PlatformPicker
    for (let j = platformPickerStart; j < i; j++) {
      if (lines[j].includes('if (!open) { setPopStyle(null); return; }')) {
        lines[j] = '    if (!open) return;';
        console.log('Restored PlatformPicker useEffect at line', j + 1);
      }
    }
    break;
  }
}

// 4. Remove empty lines created by step 3
f = lines.filter(l => l !== '' || true).join('\n');
// Actually, just join all lines
f = lines.join('\n');

// 5. Fix the duplicated document.addEventListener in PlatformPicker
// PlatformPicker got the same listeners added - remove them
// The pattern is: document.addEventListener('keydown', onKey);\n      window.addEventListener('resize', calcPosition);
// Only keep it in DesignSystemPicker (second occurrence)
let addEventCount = 0;
lines.length = 0; // reset
lines.push(...f.split('\n'));
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("window.addEventListener('resize', calcPosition);")) {
    addEventCount++;
    if (addEventCount === 1) {
      // First occurrence (PlatformPicker) - remove
      lines[i] = '';
      console.log('Removed duplicate resize listener at line', i + 1);
    }
  }
  if (lines[i].includes("window.addEventListener('scroll', calcPosition, true);")) {
    addEventCount++;
    if (addEventCount <= 2) {
      // First occurrence (PlatformPicker) - remove
      lines[i] = '';
    }
  }
  if (lines[i].includes("window.removeEventListener('resize', calcPosition);")) {
    addEventCount++;
    if (addEventCount <= 1) {
      lines[i] = '';
    }
  }
  if (lines[i].includes("window.removeEventListener('scroll', calcPosition, true);")) {
    addEventCount++;
    if (addEventCount <= 1) {
      lines[i] = '';
    }
  }
}

f = lines.join('\n');
writeFileSync(PATH, f);
console.log('Done');
