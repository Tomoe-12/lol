import os, re, sys, io
import xml.etree.ElementTree as ET

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

with open('PROJECT_REPORT.md', 'r', encoding='utf-8') as f:
    report_text = f.read()

print('=== 1. API ROUTES SPECIFICATION CHECK ===')
# Find all API routes in codebase
code_routes = []
for root, dirs, files in os.walk(os.path.join('src', 'app', 'api')):
    for file in files:
        if file in ['route.ts', 'route.js']:
            rel = os.path.relpath(root, os.path.join('src', 'app', 'api')).replace('\\\\', '/').replace('\\', '/')
            code_routes.append('/api/' + rel)
code_routes.sort()

# Check how many are documented in Chapter 5
found_routes = []
missing_routes = []
for r in code_routes:
    # Look for route in report
    if r in report_text or r.replace('[id]', '{id}') in report_text or r.replace('[id]', ':id') in report_text:
        found_routes.append(r)
    else:
        missing_routes.append(r)

print(f'Total Code API Routes: {len(code_routes)}')
print(f'Routes Documented in Report: {len(found_routes)}/{len(code_routes)}')
if missing_routes:
    print('Missing Routes:', missing_routes)

print('\n=== 2. PRISMA SCHEMA & DATA DICTIONARY CHECK ===')
with open('prisma/schema.prisma', 'r', encoding='utf-8') as f:
    schema_text = f.read()
models = re.findall(r'^model\\s+(\\w+)\\s*\\{', schema_text, re.MULTILINE)
found_models = []
missing_models = []
for m in models:
    if f'Table 4.' in report_text and m in report_text:
        found_models.append(m)
    else:
        missing_models.append(m)
print(f'Total Prisma Models in Schema: {len(models)}')
print(f'Models in Data Dictionary: {len(found_models)}/{len(models)}')
if missing_models:
    print('Missing Models in Data Dictionary:', missing_models)

print('\n=== 3. DRAW.IO & MERMAID DIAGRAM CORRESPONDENCE ===')
drawio_files = [
    'system_architecture.drawio',
    'pos_checkout_flow.drawio',
    'sales_order_lifecycle.drawio',
    'delivery_state_machine.drawio',
    'debt_collection_flow.drawio',
    'purchase_order_mac_flow.drawio',
    'rbac_security_model.drawio'
]
mermaid_blocks = re.findall(r'`mermaid([\\s\\S]*?)`', report_text)
print(f'Embedded Mermaid Diagram Blocks: {len(mermaid_blocks)}')
print(f'Required Draw.io Files: {len(drawio_files)}')

for df in drawio_files:
    p = os.path.join('drawio', df)
    exists = os.path.exists(p)
    size = os.path.getsize(p) if exists else 0
    valid_xml = False
    cell_count = 0
    if exists:
        try:
            tree = ET.parse(p)
            root = tree.getroot()
            valid_xml = (root.tag == 'mxfile')
            cells = root.findall('.//mxCell')
            cell_count = len(cells)
        except Exception:
            valid_xml = False
    print(f' - {df:32} Exists: {exists} | Size: {size:5} bytes | Valid XML: {valid_xml} | Cells: {cell_count}')

print('\n=== 4. 11 UI SUBSYSTEMS CHECK ===')
subsystems = [
    'Authentication & Session',
    'POS Checkout',
    'Sales Orders',
    'Delivery Management',
    'Outstanding Debt',
    'Inventory & Stock',
    'Purchase Orders',
    'Expense Management',
    'Staff Administration',
    'Reports & Analytics',
    'i18n Dual-Language'
]
found_subsystems = []
for s in subsystems:
    pattern = re.escape(s[:10])
    if re.search(pattern, report_text, re.IGNORECASE):
        found_subsystems.append(s)
print(f'UI Subsystems Found: {len(found_subsystems)}/{len(subsystems)}')

print('\n=== 5. CONCURRENCY & FINANCIAL PROOFS CHECK ===')
concurrency_terms = ['concurrency', 'zero-drift', '50-way', 'Moving Average Cost', 'MAC', 'remainingDebt', 'InventoryLog', 'StockLevel']
found_terms = [t for t in concurrency_terms if t.lower() in report_text.lower()]
print(f'Audited Technical Concepts: {len(found_terms)}/{len(concurrency_terms)} found -> {found_terms}')
