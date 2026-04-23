import { parse } from '@babel/parser';
import traverseMod from '@babel/traverse';
import fs from 'fs';

const traverse = traverseMod.default || traverseMod;
const file = '/sessions/gracious-amazing-planck/mnt/BabyInventory/src/components/TagScanner.jsx';
const src = fs.readFileSync(file, 'utf8');

let ast;
try {
  ast = parse(src, { sourceType: 'module', plugins: ['jsx'] });
} catch (e) {
  console.log('PARSE_ERROR:', e.message);
  process.exit(1);
}

let balance = 0;
traverse(ast, {
  JSXOpeningElement(path) {
    if (path.node.selfClosing === false) balance += 1;
  },
  JSXClosingElement() {
    balance -= 1;
  },
});
console.log('PARSE_OK JSX_BALANCE=' + balance);
