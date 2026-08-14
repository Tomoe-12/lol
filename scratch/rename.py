import os
import glob

def replace_in_file(filepath, replacements):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    for old, new in replacements:
        content = content.replace(old, new)
        
    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {filepath}")

# We will recursively find all ts and tsx files
files = glob.glob('src/**/*.tsx', recursive=True) + glob.glob('src/**/*.ts', recursive=True)

replacements = [
    ("POS System", "Inventory Management System"),
    ("POS system", "Inventory Management system"),
    ("POS SYSTEM", "INVENTORY MANAGEMENT SYSTEM"),
    ("POS Terminal", "Sales Voucher")
]

for f in files:
    replace_in_file(f, replacements)

print("Done")
