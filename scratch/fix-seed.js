const fs = require('fs');

let content = fs.readFileSync('prisma/seed.ts', 'utf8');

// Update productsToCreate: Extract price from the first variant and add to product. Remove price from variants.
content = content.replace(/variants: \[\{ name: "([^"]+)", price: (\d+) \}(.*?)\] \}/g, (match, vName, vPrice, rest) => {
    // If there are multiple variants, just strip prices from all of them and use the first one's price for the product.
    let strippedRest = rest.replace(/, \{ name: "([^"]+)", price: (\d+) \}/g, ', { name: "$1" }');
    return `price: ${vPrice}, variants: [{ name: "${vName}" }${strippedRest}] }`;
});

// Update prisma.product.create to include price
content = content.replace(/name: p\.name,\n\s+barcode: p\.barcode,/g, 'name: p.name,\n        barcode: p.barcode,\n        price: p.price,');

// Update Transaction Items in seeding: ci.v.price -> ci.p.price
content = content.replace(/ci\.v\.price/g, 'ci.p.price');

fs.writeFileSync('prisma/seed.ts', content, 'utf8');
console.log('Fixed seed.ts');
