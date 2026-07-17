const fs = require('fs');
let c = fs.readFileSync('script.js', 'utf8');
c = c.replace(/\$\$\{/g, '₹${');
c = c.replace(/'\$'/g, "'₹'");
c = c.replace(/'\$0\.00'/g, "'₹0.00'");
c = c.replace(/innerText = '\$' \+/g, "innerText = '₹' +");
c = c.replace(/>\$/g, ">₹");
fs.writeFileSync('script.js', c);

const htmlFiles = ['admin.html', 'cart.html', 'all-products.html', 'womens.html', 'mens.html', 'index.html', 'product.html'];
for (const f of htmlFiles) {
    if (fs.existsSync(f)) {
        let html = fs.readFileSync(f, 'utf8');
        html = html.replace(/>\$/g, '>₹');
        html = html.replace(/\(\$\)/g, '(₹)');
        fs.writeFileSync(f, html);
    }
}
console.log('Replaced $ with ₹ successfully');
