const fs = require('fs');
const path = require('path');

const excludeDirs = ['node_modules', '.git', 'dist', 'build', '.swc', 'scratch'];
const allowedExts = ['.js', '.jsx', '.css', '.html', '.json', '.env'];

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(function(file) {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      if (!excludeDirs.includes(path.basename(file))) {
        results = results.concat(walk(file));
      }
    } else {
      const ext = path.extname(file);
      if (allowedExts.includes(ext) && !path.basename(file).includes('lock') && !path.basename(file).includes('eslint')) {
        results.push(file);
      }
    }
  });
  return results;
}

const allFiles = walk(process.cwd());
let markdown = '# Entire Codebase\n\n';

allFiles.forEach(file => {
  const relativePath = path.relative(process.cwd(), file);
  
  // Don't include this generator script
  if (relativePath === 'generate-codebase.js') return;

  const ext = path.extname(file).replace('.', '');
  const content = fs.readFileSync(file, 'utf8');
  markdown += '## ' + relativePath + '\n\n';
  markdown += '```' + (ext === 'jsx' ? 'jsx' : ext === 'js' ? 'javascript' : ext) + '\n';
  markdown += content;
  if (!content.endsWith('\n')) markdown += '\n';
  markdown += '```\n\n';
});

fs.writeFileSync('latest-complete-updated.md', markdown);
console.log('Successfully wrote ' + allFiles.length + ' files to latest-complete-updated.md');
