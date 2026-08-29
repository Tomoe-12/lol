#!/usr/bin/env python3
"""
Comprehensive Draw.io XML Generator for SMARTOS Enterprise POS Architecture & Workflows
Generates 7 production-grade, uncompressed, beautifully styled diagrams.
"""

import os
import html
import xml.etree.ElementTree as ET

DRAWIO_DIR = r"C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon\drawio"

# Style Constants
FONT_FAMILY = "fontFamily=Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;"

HEADER_STYLE = (
    f"html=1;whiteSpace=wrap;rounded=1;arcSize=6;fillColor=#0F172A;strokeColor=#1E293B;"
    f"fontColor=#FFFFFF;fontStyle=1;fontSize=18;strokeWidth=2;shadow=1;align=center;verticalAlign=middle;{FONT_FAMILY}"
)
SUBTITLE_STYLE = (
    f"html=1;whiteSpace=wrap;rounded=1;arcSize=6;fillColor=#334155;strokeColor=#475569;"
    f"fontColor=#E2E8F0;fontSize=11;strokeWidth=1;align=center;verticalAlign=middle;{FONT_FAMILY}"
)

# Containers / Swimlanes
CONTAINER_SLATE = (
    f"html=1;whiteSpace=wrap;rounded=1;arcSize=6;fillColor=#F8FAFC;strokeColor=#94A3B8;"
    f"fontColor=#0F172A;fontStyle=1;fontSize=14;strokeWidth=2;verticalAlign=top;align=left;spacingLeft=20;spacingTop=12;{FONT_FAMILY}"
)
CONTAINER_BLUE = (
    f"html=1;whiteSpace=wrap;rounded=1;arcSize=6;fillColor=#EFF6FF;strokeColor=#60A5FA;"
    f"fontColor=#1E3A8A;fontStyle=1;fontSize=14;strokeWidth=2;verticalAlign=top;align=left;spacingLeft=20;spacingTop=12;{FONT_FAMILY}"
)
CONTAINER_INDIGO = (
    f"html=1;whiteSpace=wrap;rounded=1;arcSize=6;fillColor=#EEF2FF;strokeColor=#818CF8;"
    f"fontColor=#312E81;fontStyle=1;fontSize=14;strokeWidth=2;verticalAlign=top;align=left;spacingLeft=20;spacingTop=12;{FONT_FAMILY}"
)
CONTAINER_EMERALD = (
    f"html=1;whiteSpace=wrap;rounded=1;arcSize=6;fillColor=#ECFDF5;strokeColor=#34D399;"
    f"fontColor=#064E3B;fontStyle=1;fontSize=14;strokeWidth=2;verticalAlign=top;align=left;spacingLeft=20;spacingTop=12;{FONT_FAMILY}"
)
CONTAINER_AMBER = (
    f"html=1;whiteSpace=wrap;rounded=1;arcSize=6;fillColor=#FFFBEB;strokeColor=#FBBF24;"
    f"fontColor=#78350F;fontStyle=1;fontSize=14;strokeWidth=2;verticalAlign=top;align=left;spacingLeft=20;spacingTop=12;{FONT_FAMILY}"
)
CONTAINER_PURPLE = (
    f"html=1;whiteSpace=wrap;rounded=1;arcSize=6;fillColor=#FAF5FF;strokeColor=#C084FC;"
    f"fontColor=#581C87;fontStyle=1;fontSize=14;strokeWidth=2;verticalAlign=top;align=left;spacingLeft=20;spacingTop=12;{FONT_FAMILY}"
)
CONTAINER_ROSE = (
    f"html=1;whiteSpace=wrap;rounded=1;arcSize=6;fillColor=#FFF1F2;strokeColor=#F87171;"
    f"fontColor=#881337;fontStyle=1;fontSize=14;strokeWidth=2;verticalAlign=top;align=left;spacingLeft=20;spacingTop=12;{FONT_FAMILY}"
)
CONTAINER_CYAN = (
    f"html=1;whiteSpace=wrap;rounded=1;arcSize=6;fillColor=#ECFEFF;strokeColor=#22D3EE;"
    f"fontColor=#164E63;fontStyle=1;fontSize=14;strokeWidth=2;verticalAlign=top;align=left;spacingLeft=20;spacingTop=12;{FONT_FAMILY}"
)

# Nodes
NODE_INDIGO = (
    f"html=1;whiteSpace=wrap;rounded=1;arcSize=10;fillColor=#4F46E5;strokeColor=#3730A3;"
    f"fontColor=#FFFFFF;fontStyle=1;fontSize=12;strokeWidth=1.5;shadow=1;align=center;verticalAlign=middle;spacing=6;{FONT_FAMILY}"
)
NODE_BLUE = (
    f"html=1;whiteSpace=wrap;rounded=1;arcSize=10;fillColor=#2563EB;strokeColor=#1D4ED8;"
    f"fontColor=#FFFFFF;fontStyle=1;fontSize=12;strokeWidth=1.5;shadow=1;align=center;verticalAlign=middle;spacing=6;{FONT_FAMILY}"
)
NODE_EMERALD = (
    f"html=1;whiteSpace=wrap;rounded=1;arcSize=10;fillColor=#059669;strokeColor=#047857;"
    f"fontColor=#FFFFFF;fontStyle=1;fontSize=12;strokeWidth=1.5;shadow=1;align=center;verticalAlign=middle;spacing=6;{FONT_FAMILY}"
)
NODE_AMBER = (
    f"html=1;whiteSpace=wrap;rounded=1;arcSize=10;fillColor=#D97706;strokeColor=#B45309;"
    f"fontColor=#FFFFFF;fontStyle=1;fontSize=12;strokeWidth=1.5;shadow=1;align=center;verticalAlign=middle;spacing=6;{FONT_FAMILY}"
)
NODE_ROSE = (
    f"html=1;whiteSpace=wrap;rounded=1;arcSize=10;fillColor=#DC2626;strokeColor=#B91C1C;"
    f"fontColor=#FFFFFF;fontStyle=1;fontSize=12;strokeWidth=1.5;shadow=1;align=center;verticalAlign=middle;spacing=6;{FONT_FAMILY}"
)
NODE_PURPLE = (
    f"html=1;whiteSpace=wrap;rounded=1;arcSize=10;fillColor=#7C3AED;strokeColor=#6D28D9;"
    f"fontColor=#FFFFFF;fontStyle=1;fontSize=12;strokeWidth=1.5;shadow=1;align=center;verticalAlign=middle;spacing=6;{FONT_FAMILY}"
)
NODE_CYAN = (
    f"html=1;whiteSpace=wrap;rounded=1;arcSize=10;fillColor=#0891B2;strokeColor=#0E7490;"
    f"fontColor=#FFFFFF;fontStyle=1;fontSize=12;strokeWidth=1.5;shadow=1;align=center;verticalAlign=middle;spacing=6;{FONT_FAMILY}"
)
NODE_SLATE = (
    f"html=1;whiteSpace=wrap;rounded=1;arcSize=10;fillColor=#475569;strokeColor=#334155;"
    f"fontColor=#FFFFFF;fontStyle=1;fontSize=12;strokeWidth=1.5;shadow=1;align=center;verticalAlign=middle;spacing=6;{FONT_FAMILY}"
)

# Detailed White Cards
NODE_WHITE_CARD = (
    f"html=1;whiteSpace=wrap;rounded=1;arcSize=8;fillColor=#FFFFFF;strokeColor=#CBD5E1;"
    f"fontColor=#1E293B;fontSize=11;strokeWidth=1.5;shadow=1;align=left;verticalAlign=top;spacing=10;{FONT_FAMILY}"
)
NODE_WHITE_CARD_CENTER = (
    f"html=1;whiteSpace=wrap;rounded=1;arcSize=8;fillColor=#FFFFFF;strokeColor=#CBD5E1;"
    f"fontColor=#1E293B;fontSize=11;strokeWidth=1.5;shadow=1;align=center;verticalAlign=middle;spacing=8;{FONT_FAMILY}"
)

# Decision Rhombus
NODE_DECISION_AMBER = (
    f"rhombus;whiteSpace=wrap;html=1;fillColor=#FEF3C7;strokeColor=#D97706;fontColor=#92400E;"
    f"fontStyle=1;fontSize=11;strokeWidth=2;shadow=1;align=center;verticalAlign=middle;spacing=4;{FONT_FAMILY}"
)
NODE_DECISION_INDIGO = (
    f"rhombus;whiteSpace=wrap;html=1;fillColor=#EEF2FF;strokeColor=#4F46E5;fontColor=#312E81;"
    f"fontStyle=1;fontSize=11;strokeWidth=2;shadow=1;align=center;verticalAlign=middle;spacing=4;{FONT_FAMILY}"
)
NODE_DECISION_PURPLE = (
    f"rhombus;whiteSpace=wrap;html=1;fillColor=#FAF5FF;strokeColor=#7C3AED;fontColor=#581C87;"
    f"fontStyle=1;fontSize=11;strokeWidth=2;shadow=1;align=center;verticalAlign=middle;spacing=4;{FONT_FAMILY}"
)

# Edges
EDGE_STD = (
    f"edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;"
    f"strokeColor=#64748B;strokeWidth=2;fontSize=11;fontColor=#334155;{FONT_FAMILY}"
)
EDGE_SUCCESS = (
    f"edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;"
    f"strokeColor=#059669;strokeWidth=2;fontSize=11;fontColor=#065F46;fontStyle=1;{FONT_FAMILY}"
)
EDGE_ERROR = (
    f"edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;"
    f"strokeColor=#DC2626;strokeWidth=2;fontSize=11;fontColor=#991B1B;fontStyle=1;{FONT_FAMILY}"
)
EDGE_DASHED = (
    f"edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;"
    f"dashed=1;strokeColor=#94A3B8;strokeWidth=1.5;fontSize=10;fontColor=#64748B;{FONT_FAMILY}"
)
EDGE_PRIMARY = (
    f"edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;"
    f"strokeColor=#4F46E5;strokeWidth=2.5;fontSize=11;fontColor=#312E81;fontStyle=1;{FONT_FAMILY}"
)


class DrawioBuilder:
    def __init__(self, diagram_id, diagram_name, width=1800, height=1400):
        self.diagram_id = diagram_id
        self.diagram_name = diagram_name
        self.width = width
        self.height = height
        self.cells = []
        self.cells.append('<mxCell id="0"/>')
        self.cells.append('<mxCell id="1" parent="0"/>')

    def add_node(self, node_id, value, style, x, y, width, height, parent="1"):
        val_escaped = html.escape(value, quote=True).replace("\n", "&#10;")
        cell = (
            f'<mxCell id="{node_id}" value="{val_escaped}" style="{style}" '
            f'parent="{parent}" vertex="1">\n'
            f'  <mxGeometry x="{x}" y="{y}" width="{width}" height="{height}" as="geometry"/>\n'
            f'</mxCell>'
        )
        self.cells.append(cell)
        return node_id

    def add_edge(self, edge_id, source_id, target_id, value="", style="", exit_x=None, exit_y=None, entry_x=None, entry_y=None):
        val_escaped = html.escape(value, quote=True).replace("\n", "&#10;")
        exit_entry = ""
        if exit_x is not None and exit_y is not None:
            exit_entry += f"exitX={exit_x};exitY={exit_y};exitDx=0;exitDy=0;"
        if entry_x is not None and entry_y is not None:
            exit_entry += f"entryX={entry_x};entryY={entry_y};entryDx=0;entryDy=0;"

        full_style = style + exit_entry
        cell = (
            f'<mxCell id="{edge_id}" value="{val_escaped}" style="{full_style}" '
            f'parent="1" source="{source_id}" target="{target_id}" edge="1">\n'
            f'  <mxGeometry relative="1" as="geometry"/>\n'
            f'</mxCell>'
        )
        self.cells.append(cell)
        return edge_id

    def to_xml(self):
        cells_xml = "\n        ".join(self.cells)
        xml = (
            f'<?xml version="1.0" encoding="UTF-8"?>\n'
            f'<mxfile host="app.diagrams.net" agent="SMARTOS" version="24.7.5">\n'
            f'  <diagram id="{self.diagram_id}" name="{html.escape(self.diagram_name)}">\n'
            f'    <mxGraphModel dx="1600" dy="1000" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="{self.width}" pageHeight="{self.height}" math="0" shadow="0">\n'
            f'      <root>\n'
            f'        {cells_xml}\n'
            f'      </root>\n'
            f'    </mxGraphModel>\n'
            f'  </diagram>\n'
            f'</mxfile>'
        )
        return xml

    def save(self, filepath):
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(self.to_xml())
        print(f"Generated successfully: {filepath}")


# ==============================================================================
# DIAGRAM 1: SYSTEM ARCHITECTURE (3-TIER MULTI-LAYER ARCHITECTURE)
# ==============================================================================
def generate_diagram_1():
    b = DrawioBuilder("diag_sys_arch", "SMARTOS 3-Tier Multi-Layer System Architecture", 1850, 1450)
    
    # Title & Subtitle Header
    b.add_node("title", "SMARTOS ENTERPRISE 3-TIER MULTI-LAYER SYSTEM ARCHITECTURE", HEADER_STYLE, 40, 20, 1770, 45)
    b.add_node("sub", "Production Multi-Branch POS, Inventory & Financial Ledger Architecture | Next.js 15, React 19, Prisma ORM 6.19, Upstash Redis & MySQL/SQLite", SUBTITLE_STYLE, 40, 70, 1770, 25)
    
    # Tier 1: Presentation Tier
    b.add_node("tier1", "1. PRESENTATION & CLIENT TIER (Edge & Browser Runtime)", CONTAINER_BLUE, 40, 110, 1770, 360)
    
    # Tier 1 Sub-boxes
    b.add_node("t1_ui_core", "Core Framework & Rendering\n• Next.js 15 App Router (Server & Client Components)\n• React 19.2.4 Concurrent Engine\n• Radix UI Primitives (Dialog, Select, Dropdown, Tabs, Tooltip)\n• Tailwind CSS 4 Theming & Dark/Light Mode\n• Recharts 3.8.1 Data Visualizations", NODE_WHITE_CARD, 70, 160, 390, 130)
    
    b.add_node("t1_state", "Client State & Persistence\n• Zustand 5.0 Global State Store (`useCartStore`)\n• LocalStorage Sync (`pos-cart-storage`)\n• Cart Parking / Multi-Tab Holding Engine\n• Hardware Barcode Scanner Debounce (300ms)\n• Client-Side Price & Cost Floor Live Validation", NODE_WHITE_CARD, 480, 160, 390, 130)
    
    b.add_node("t1_i18n", "i18n Dual-Language Engine\n• `LanguageProvider` (Context Engine)\n• Strict English / Burmese (Unicode) Localization\n• Zero SSR Hydration Mismatch Safeguards\n• Dynamic `t(en, my)` String Interpolation\n• Instant Locale Switcher with LocalStorage Memory", NODE_WHITE_CARD, 890, 160, 410, 130)
    
    b.add_node("t1_subsystems_title", "11 End-to-End User Interface Subsystems (Dashboard & POS Workspaces)", NODE_INDIGO, 70, 305, 1710, 35)
    
    # 11 Subsystem Cards
    subsystems = [
        ("sub1", "1. POS Register\nCart, Scanner, Split Pay"),
        ("sub2", "2. Sales Orders\nPre-orders & Deposits"),
        ("sub3", "3. Delivery Center\nDispatch & Waybill"),
        ("sub4", "4. Debt Collection\nCustomer Ledgers"),
        ("sub5", "5. Inventory\nStock & Transfers"),
        ("sub6", "6. Purchases\nPO Receiving & MAC"),
        ("sub7", "7. Expenses\nCategorized Ledger"),
        ("sub8", "8. Staff Admin\nRole & Permissions"),
        ("sub9", "9. Reports\nP&L, Sales & COGS"),
        ("sub10", "10. Store Setup\nBranches & Categories"),
        ("sub11", "11. Auth & Session\nPIN & Password Login"),
    ]
    for idx, (sid, stext) in enumerate(subsystems):
        sx = 70 + idx * 155
        b.add_node(sid, stext, NODE_WHITE_CARD_CENTER, sx, 350, 145, 100)

    # Tier 2: Business Logic & API Tier
    b.add_node("tier2", "2. BUSINESS LOGIC & API TIER (Next.js 15 Node.js Server Runtime)", CONTAINER_INDIGO, 40, 490, 1770, 410)
    
    b.add_node("t2_mw", "Middleware & Session Security\n• `src/middleware.ts` Route Interceptor\n• `pos_session` httpOnly Lax Cookie\n• `x-staff-id` Header Authorization Fallback\n• Clerk Auth (@clerk/nextjs 7.5) Sync\n• CSRF & Cross-Origin Security Filters", NODE_PURPLE, 70, 540, 390, 120)
    
    b.add_node("t2_rbac", "Granular 11-Module RBAC Engine\n• `src/lib/permissions.ts` Matrix Engine\n• `checkStaffPermission` Central Guard\n• Multi-Branch Isolation Enforcement\n• Interlocking Rule: `write: true => read: true`\n• Immutable Owner Demotion Protection", NODE_PURPLE, 480, 540, 400, 120)

    b.add_node("t2_services", "Business Domain Validation Layer\n• Moving Average Cost (MAC) Calculator\n• Minimum Selling Price Floor Protection\n• Single-Currency (MMK) Split Payment Engine\n• Debt Repayment Capping Validator\n• Myanmar Phone Normalizer (`09...`)", NODE_PURPLE, 900, 540, 430, 120)

    b.add_node("t2_audit", "System Auditing & Logging\n• `AuditLog` Event Recorder\n• `InventoryLog` 1:1 Stock Audit Logs\n• Staff ID & Timestamp Attribution\n• Polymorphic Origin Inspector", NODE_PURPLE, 1350, 540, 430, 120)

    b.add_node("t2_routes_title", "39 Next.js REST API Route Handlers (`src/app/api/**`)", NODE_SLATE, 70, 680, 1710, 30)

    # API Route Groups
    route_groups = [
        ("rg1", "POS & Transactions (6)\n• POST /api/pos/checkout\n• POST /api/pos/fulfill-sales-order\n• POST /api/pos/auth-pin\n• GET /api/transactions\n• GET/POST /api/pos/exchange-rate\n• GET /api/dashboard/stats", 70, 270),
        ("rg2", "Sales Orders & Debt (5)\n• GET, POST /api/sales-orders\n• PATCH, DEL /api/sales-orders/[id]\n• GET /api/outstanding\n• POST /api/outstanding/pay\n• GET, POST /api/customers", 355, 270),
        ("rg3", "Delivery & Operations (4)\n• GET /api/delivery\n• PATCH /api/delivery/status\n• GET, POST, DEL /api/expenses\n• GET /api/dashboard/export", 640, 270),
        ("rg4", "Inventory & Procurement (7)\n• GET /api/inventory\n• POST /api/inventory/adjust\n• POST /api/inventory/transfer\n• GET /api/inventory/logs/[id]\n• GET, POST, PATCH /api/purchase-orders\n• GET, POST, PUT, DEL /api/suppliers\n• POST /api/upload", 925, 290),
        ("rg5", "Staff & Security (4)\n• GET, POST, PUT, DEL /api/staff\n• GET, PUT /api/staff/[id]/permissions\n• POST /api/staff/sync\n• GET /api/audit-logs", 1230, 260),
        ("rg6", "Setup & Catalog (7)\n• GET, POST, PUT, DEL /api/branches\n• GET, POST, PUT, DEL /api/categories\n• GET, POST, PUT, DEL /api/products\n• POST /api/auth/login, logout, me\n• POST /api/admin/seed", 1505, 275),
    ]
    for rgid, rtext, rx, rw in route_groups:
        b.add_node(rgid, rtext, NODE_WHITE_CARD, rx, 720, rw, 160)

    # Tier 3: Caching & Data Management Tier
    b.add_node("tier3", "3. CACHING & DATA MANAGEMENT TIER (Distributed Cache, ORM & Relational DB)", CONTAINER_EMERALD, 40, 920, 1770, 480)
    
    # 3A: Redis Cache
    b.add_node("t3_redis_box", "3A. Distributed L2 Cache (Upstash Redis 1.38.0)\n• Sub-100ms In-Memory Response (~5ms Cache Hit)\n• Cache-Aside Architecture (`withCache` Helper)\n• TTL Key Expiration (300s - 3600s)\n• Event-Driven Mutation Invalidation (`invalidateCache`)\n• Cached: Dashboard KPIs, Category Lists, Product Lookups", NODE_CYAN, 70, 970, 520, 160)
    
    # 3B: Prisma ORM
    b.add_node("t3_prisma_box", "3B. Data Access & Relational ORM (Prisma 6.19.3)\n• Strict TypeScript Client Generation\n• Interactive ACID Transactions (`prisma.$transaction`)\n• High-Concurrency Race Condition Prevention\n• Compound Unique Indexes (`@@unique([branchId, variantId])`)\n• Relational Cascade Actions & Referential Integrity", NODE_INDIGO, 610, 970, 560, 160)

    # 3C: Relational Database Engine
    b.add_node("t3_db_box", "3C. Relational Database Engine (MySQL 8.0 / PostgreSQL / SQLite)\n• 19 Relational Database Models\n• 12 Strict Prisma System Enums\n• Fully Normalized Third Normal Form (3NF)\n• Zero-Drift Financial & Physical Stock Ledger Invariants\n• Enterprise Multi-Branch Isolated Tenant Storage", NODE_EMERALD, 1190, 970, 590, 160)

    # Database Tables Grid
    b.add_node("db_models_title", "19 Production Database Tables (Cataloged in Prisma Schema)", NODE_SLATE, 70, 1150, 1710, 25)
    
    models = [
        ("m1", "Branch\nMulti-store entities"),
        ("m2", "Staff\nAccounts & PINs"),
        ("m3", "Product\nCatalog items"),
        ("m4", "ProductVariant\nSKUs & Barcodes"),
        ("m5", "StockLevel\nBranch inventory"),
        ("m6", "InventoryLog\nAudit stock trail"),
        ("m7", "Transaction\nSales records"),
        ("m8", "TransactionItem\nLine item sales"),
        ("m9", "Customer\nClients & Credit"),
        ("m10", "SalesOrder\nPre-orders & Drops"),
        ("m11", "SalesOrderItem\nOrder line items"),
        ("m12", "OrderPayment\nDeposit ledger"),
        ("m13", "Supplier\nVendor directory"),
        ("m14", "PurchaseOrder\nProcurement"),
        ("m15", "PurchaseItem\nPO line items"),
        ("m16", "Expense\nOperating costs"),
        ("m17", "AuditLog\nSecurity events"),
        ("m18", "ExchangeRate\nHistorical rates"),
        ("m19", "Category\nProduct taxonomy"),
    ]
    for idx, (mid, mtext) in enumerate(models):
        if idx < 10:
            mx = 70 + idx * 171
            my = 1185
        else:
            mx = 70 + (idx - 10) * 190
            my = 1290
        b.add_node(mid, mtext, NODE_WHITE_CARD_CENTER, mx, my, 162, 90)

    # Connectors between tiers
    b.add_edge("e_pres_api", "t1_subsystems_title", "t2_routes_title", "HTTPS / JSON REST API Calls (with pos_session Cookie & x-staff-id)", EDGE_PRIMARY)
    b.add_edge("e_api_redis", "rg4", "t3_redis_box", "TCP / RESP Protocol (Cache-Aside Read & Invalidation)", EDGE_STD)
    b.add_edge("e_api_prisma", "t2_services", "t3_prisma_box", "Type-Safe Prisma Client Queries & Interactive Transactions", EDGE_PRIMARY)
    b.add_edge("e_prisma_db", "t3_prisma_box", "t3_db_box", "Binary Connection Pool & SQL DML / ACID Transactions", EDGE_SUCCESS)

    b.save(os.path.join(DRAWIO_DIR, "system_architecture.drawio"))


# ==============================================================================
# DIAGRAM 2: POS CHECKOUT FLOW (SPLIT PAYMENT, COST FLOOR & STOCK DEDUCTION)
# ==============================================================================
def generate_diagram_2():
    b = DrawioBuilder("diag_pos_flow", "SMARTOS POS Voucher Split Checkout & Stock Deduction Flowchart", 1650, 1450)
    
    # Header
    b.add_node("title", "SMARTOS POS VOUCHER SPLIT CHECKOUT & STOCK DEDUCTION FLOWCHART", HEADER_STYLE, 40, 20, 1570, 45)
    b.add_node("sub", "End-to-End Validation: Minimum Selling Price / Cost Floor Protection -> Split Payment Balancing -> Atomic Stock Decrement & Audit Log", SUBTITLE_STYLE, 40, 70, 1570, 25)
    
    # Start Node
    b.add_node("start", "START: Cashier Initiates Checkout\n(Cart loaded in Zustand `useCartStore`)", NODE_INDIGO, 650, 110, 350, 60)
    
    # Step 1: Cart Validation
    b.add_node("d_cart_valid", "Validate Cart Items:\n• Non-empty cart\n• All quantities Q > 0\n• Branch ID present", NODE_DECISION_INDIGO, 675, 200, 300, 80)
    b.add_node("err_empty_cart", "REJECT CHECKOUT (HTTP 400)\n'Cart is empty or invalid'", NODE_ROSE, 1120, 210, 260, 60)
    
    # Step 2: Cost Floor Protection Loop
    b.add_node("cost_floor_calc", "Calculate Effective Selling Price per Item:\nEffective Price = (Unit Price × Q - Line Discount) / Q", NODE_BLUE, 650, 310, 350, 60)
    
    b.add_node("d_cost_floor", "Is Effective Price >=\nProduct Cost Price (MAC)?\n(P_eff >= C when C > 0)", NODE_DECISION_AMBER, 675, 400, 300, 90)
    b.add_node("err_cost_floor", "REJECT CHECKOUT (HTTP 400)\n'Selling price for {product} cannot be\nlower than moving average cost ({C} Ks)'", NODE_ROSE, 1120, 410, 300, 70)

    # Step 3: Discount & Total Calculation
    b.add_node("calc_total", "Validate Discounts & Compute Net Payable:\n• Validate Discount <= Subtotal\n• Net Total = max(0, Subtotal - ItemDiscounts - OrderDiscount)", NODE_BLUE, 650, 520, 350, 65)

    # Step 4: Payment Method Evaluation
    b.add_node("d_payment_method", "Evaluate Payment Method\n(CASH, CARD, QR, SPLIT, DEBT)", NODE_DECISION_PURPLE, 675, 615, 300, 90)

    # Payment Paths
    # Path A: Split Payment
    b.add_node("split_val", "Split Payment Validation:\n• Split Cash >= 0\n• Split Non-Cash (Card/QR) >= 0\n• Check: |(Split Cash + Split Non-Cash) - Net Total| <= 1 Ks", NODE_WHITE_CARD, 150, 740, 380, 85)
    b.add_node("d_split_balance", "Does Split Balance\nwith Net Total (1-Ks tol)?", NODE_DECISION_AMBER, 190, 855, 300, 80)
    b.add_node("err_split", "REJECT CHECKOUT (HTTP 400)\n'Split amounts do not equal total'", NODE_ROSE, 190, 965, 300, 55)

    # Path B: Cash Single Payment
    b.add_node("cash_calc", "Cash Single Payment:\n• Cash Received >= Net Total\n• Calculate Change Given = Cash Received - Net Total", NODE_WHITE_CARD, 635, 740, 380, 70)

    # Path C: Wholesale / Credit (DEBT)
    b.add_node("debt_calc", "Wholesale / Credit Sale (DEBT):\n• Customer selected & verified\n• Wholesale Paid <= Net Total\n• Auto-link SalesOrder (depositStatus: PARTIAL/NO_PAY)", NODE_WHITE_CARD, 1120, 740, 380, 85)

    # Step 5: Prisma Interactive Transaction Boundary
    b.add_node("tx_container", "ATOMIC PRISMA TRANSACTION (ACID Boundary: `prisma.$transaction`)", CONTAINER_EMERALD, 100, 1050, 1450, 240)
    
    b.add_node("tx_stock_check", "1. Stock Sufficiency Check\n`tx.stockLevel.findUnique`\nEnsure Current Stock >= Q", NODE_WHITE_CARD_CENTER, 140, 1100, 260, 75)
    
    b.add_node("tx_stock_dec", "2. Atomic Stock Decrement\n`tx.stockLevel.update`\n`quantity: { decrement: Q }`", NODE_EMERALD, 440, 1100, 270, 75)

    b.add_node("tx_create_tx", "3. Create Transaction Record\n`tx.transaction.create`\nInclude `TransactionItem[]` items", NODE_EMERALD, 750, 1100, 280, 75)

    b.add_node("tx_create_log", "4. Create Inventory Audit Log\n`tx.inventoryLog.create`\n`reason: SALE, change: -Q`", NODE_EMERALD, 1070, 1100, 280, 75)

    b.add_node("tx_err_stock", "ROLLBACK TRANSACTION (HTTP 400)\n'INSUFFICIENT_STOCK: Only X units available'", NODE_ROSE, 140, 1200, 360, 60)

    # Step 6: Post-Checkout Fulfillment
    b.add_node("post_fulfill", "Post-Transaction Fulfillment:\n• Invalidate Redis Cache (`dashboard_stats`, `inventory_counts`)\n• Render & Print Thermal Receipt (MMK currency, items, cashier)\n• Clear POS Cart (`useCartStore.clearCart()`)\n• Return HTTP 200 OK with Transaction Payload", NODE_CYAN, 500, 1320, 650, 80)

    # Edges
    b.add_edge("e1", "start", "d_cart_valid", "Submit Cart", EDGE_PRIMARY)
    b.add_edge("e1_no", "d_cart_valid", "err_empty_cart", "NO: Empty / Invalid", EDGE_ERROR)
    b.add_edge("e1_yes", "d_cart_valid", "cost_floor_calc", "YES: Valid Cart", EDGE_SUCCESS)

    b.add_edge("e2", "cost_floor_calc", "d_cost_floor", "Evaluate Items", EDGE_PRIMARY)
    b.add_edge("e2_no", "d_cost_floor", "err_cost_floor", "NO: Price < Cost Floor", EDGE_ERROR)
    b.add_edge("e2_yes", "d_cost_floor", "calc_total", "YES: Price >= Cost", EDGE_SUCCESS)

    b.add_edge("e3", "calc_total", "d_payment_method", "Net Total Computed", EDGE_PRIMARY)

    b.add_edge("e3_split", "d_payment_method", "split_val", "Method = SPLIT", EDGE_STD)
    b.add_edge("e3_cash", "d_payment_method", "cash_calc", "Method = CASH / CARD / QR", EDGE_STD)
    b.add_edge("e3_debt", "d_payment_method", "debt_calc", "Method = DEBT / Wholesale", EDGE_STD)

    b.add_edge("e_split_eval", "split_val", "d_split_balance", "Check Sum", EDGE_STD)
    b.add_edge("e_split_no", "d_split_balance", "err_split", "NO: Diff > 1 Ks", EDGE_ERROR)
    b.add_edge("e_split_yes", "d_split_balance", "tx_container", "YES: Balanced", EDGE_SUCCESS, exit_x=0.5, exit_y=1, entry_x=0.2, entry_y=0)

    b.add_edge("e_cash_ok", "cash_calc", "tx_container", "Payment Verified", EDGE_SUCCESS, exit_x=0.5, exit_y=1, entry_x=0.5, entry_y=0)
    b.add_edge("e_debt_ok", "debt_calc", "tx_container", "Credit Approved", EDGE_SUCCESS, exit_x=0.5, exit_y=1, entry_x=0.8, entry_y=0)

    b.add_edge("e_tx_step1", "tx_stock_check", "tx_stock_dec", "Stock OK", EDGE_SUCCESS)
    b.add_edge("e_tx_step2", "tx_stock_dec", "tx_create_tx", "Stock Decremented", EDGE_SUCCESS)
    b.add_edge("e_tx_step3", "tx_create_tx", "tx_create_log", "Tx Logged", EDGE_SUCCESS)
    b.add_edge("e_tx_fail", "tx_stock_check", "tx_err_stock", "Insufficient Stock", EDGE_ERROR)

    b.add_edge("e_tx_finish", "tx_container", "post_fulfill", "Transaction Committed", EDGE_SUCCESS, exit_x=0.5, exit_y=1, entry_x=0.5, entry_y=0)

    b.save(os.path.join(DRAWIO_DIR, "pos_checkout_flow.drawio"))


# ==============================================================================
# DIAGRAM 3: SALES ORDER LIFECYCLE (STATE MACHINE & DEPOSIT FLOW)
# ==============================================================================
def generate_diagram_3():
    b = DrawioBuilder("diag_so_lifecycle", "SMARTOS Sales Order State Machine & Deposit Flow", 1750, 1350)
    
    # Header
    b.add_node("title", "SMARTOS SALES ORDER STATE MACHINE & ADVANCE DEPOSIT LIFECYCLE", HEADER_STYLE, 40, 20, 1670, 45)
    b.add_node("sub", "Pre-Order Transitions: DRAFT (Deposit) -> CONFIRMED (Price Lock) -> DELIVERING (Logistics) -> COMPLETED or CANCELLED (Refund)", SUBTITLE_STYLE, 40, 70, 1670, 25)
    
    # State 1: DRAFT
    b.add_node("box_draft", "STATE 1: DRAFT (Pre-Order Creation)", CONTAINER_SLATE, 50, 120, 480, 480)
    b.add_node("draft_desc", "Pre-Order Initial Intake:\n• Customer requests items & quantities\n• Advance deposit collected (A >= 0, e.g. 10% rule)\n• If A = 0 => `depositStatus: NO_PAY`\n• If A > 0 => `depositStatus: PARTIAL`, create `OrderPayment`\n• Stock is NOT decremented during DRAFT\n• Status set to `SalesOrderStatus.DRAFT`", NODE_WHITE_CARD, 80, 170, 420, 130)
    b.add_node("draft_api", "API Action: `POST /api/sales-orders`\nPayload: `{ branchId, customerId, items, depositAmount, paymentMethod }`", NODE_INDIGO, 80, 320, 420, 60)
    b.add_node("draft_rule", "Guaranteed Invariant:\nPhysical inventory remains untouched.\nNo reservation lock on stock levels.", NODE_CYAN, 80, 400, 420, 60)
    b.add_node("btn_confirm_draft", "Transition Trigger:\nReview & Confirm Pre-Order", NODE_AMBER, 130, 490, 320, 50)

    # State 2: CONFIRMED
    b.add_node("box_confirmed", "STATE 2: CONFIRMED (Price & Stock Reservation)", CONTAINER_BLUE, 600, 120, 520, 480)
    b.add_node("conf_desc", "Pre-Order Review & Lock:\n• Final agreed selling price locked (C < P_agreed <= P_catalog)\n• Multi-branch stock sufficiency checked\n• Additional deposit ΔA >= 0 recorded; Final Paid = A + ΔA\n• If Final Paid >= Total => `paymentStatus: PAID`, `depositStatus: PAID`\n• Else => `paymentStatus: PARTIAL`, `depositStatus: PARTIAL`\n• Status set to `SalesOrderStatus.CONFIRMED`", NODE_WHITE_CARD, 630, 170, 460, 140)
    b.add_node("conf_api", "API Action: `PATCH /api/sales-orders/[id]`\nPayload: `{ status: 'CONFIRMED', items, amountPaid, paymentMethod }`", NODE_BLUE, 630, 330, 460, 60)
    b.add_node("conf_paths", "Fulfillment Dispatch Pathways:\n• In-Store POS Pickup => Direct POS Voucher Fulfillment\n• Delivery Request => Dispatch to Delivery Center (`isDelivery: true`)", NODE_INDIGO, 630, 410, 460, 60)
    b.add_node("btn_cancel_conf", "Order Cancellation Trigger\n(Customer Cancellation / Change of Mind)", NODE_ROSE, 700, 490, 320, 50)

    # State 3: DELIVERING
    b.add_node("box_delivering", "STATE 3: DELIVERING (Logistics & In-Transit)", CONTAINER_PURPLE, 1190, 120, 510, 480)
    b.add_node("deliv_desc", "Courier Dispatch & Transit:\n• Sales Order dispatched to external courier / rider\n• Carrier details: Driver Name, Driver Phone, Waybill / Tracking #\n• Delivery Fee Payer set (`CUSTOMER` vs `STORE`)\n• Stock decremented ONCE during fulfillment/dispatch\n• Status set to `status: DELIVERING`, `deliveryStatus: PENDING`", NODE_WHITE_CARD, 1220, 170, 450, 140)
    b.add_node("deliv_api", "API Action: `GET /api/delivery` & Dispatch Modal\nThermal Waybill layout generated for carrier", NODE_PURPLE, 1220, 330, 450, 60)
    b.add_node("deliv_handover", "Transition Trigger:\nCarrier delivers goods to customer destination", NODE_EMERALD, 1250, 420, 390, 50)

    # State 4: COMPLETED
    b.add_node("box_completed", "STATE 4: COMPLETED (Final Settlement & Handover)", CONTAINER_EMERALD, 900, 680, 800, 400)
    b.add_node("comp_desc", "Order Finalization:\n• Goods handed over to customer; delivery signed / in-store collected\n• Status updated to `SalesOrderStatus.COMPLETED`, `deliveryStatus: DELIVERED`\n• Zero Double-Deduction Invariant: Delivery transition does NOT re-decrement stock\n• If fully paid => `paymentStatus: PAID`, removed from outstanding\n• If partial debt remains => Tracked in `/outstanding` debt collection module", NODE_WHITE_CARD, 930, 730, 740, 110)
    b.add_node("comp_api", "API Action: `PATCH /api/delivery/status` (Delivered) OR `POST /api/pos/fulfill-sales-order` (POS)", NODE_EMERALD, 930, 860, 740, 55)
    b.add_node("comp_fee_route", "Delivery Fee Allocation Routing:\n• STORE pays: Auto-creates `Expense` record (category: OTHER, amount: deliveryFee)\n• CUSTOMER pays: Adds fee to customer order due: `Total Due = total + deliveryFee`", NODE_CYAN, 930, 935, 740, 65)
    b.add_node("comp_receipt", "Settlement Receipt Generated | Customer Ledger Updated", NODE_EMERALD, 1050, 1015, 500, 45)

    # State 5: CANCELLED
    b.add_node("box_cancelled", "STATE 5: CANCELLED (Order Termination & Bounded Refund)", CONTAINER_ROSE, 50, 680, 780, 400)
    b.add_node("canc_desc", "Order Cancellation & Refund Engine:\n• Order cancelled via dialog prompt\n• Bounded Refund Constraint: `0 <= Refund Amount <= Stored Amount Paid`\n• Negative Ledger Entry: Creates `OrderPayment` row (`amount: -Refund, note: 'Sales Order deposit refund'`)\n• Net Stored Balance: `Final Deposit = Amount Paid - Refund Amount`\n• Stock Restoration: If stock was previously decremented, restore stock via `StockLevel.increment` + `InventoryLog(reason: ADJUSTMENT, change: +Q)`\n• Duplicate Cancellation Guard: If already `CANCELLED`, reject with HTTP 400", NODE_WHITE_CARD, 80, 730, 720, 130)
    b.add_node("canc_api", "API Action: `PATCH /api/sales-orders/[id]` (`status: 'CANCELLED'`, `refundAmount`)", NODE_ROSE, 80, 880, 720, 55)
    b.add_node("canc_zero_leak", "Zero-Leak Financial Proof:\nOrder total sum of `OrderPayment` ledger exactly balances net refund.", NODE_PURPLE, 80, 955, 720, 55)
    b.add_node("canc_terminal", "TERMINAL STATE: Order Archived with Refund Log", NODE_ROSE, 200, 1025, 480, 40)

    # State Machine Edges
    b.add_edge("e_draft_conf", "btn_confirm_draft", "box_confirmed", "Confirm Pre-Order (Lock Price & Verify Stock)", EDGE_PRIMARY, exit_x=1, exit_y=0.5, entry_x=0, entry_y=0.5)
    b.add_edge("e_conf_deliv", "conf_paths", "box_delivering", "Dispatch via Courier (`isDelivery: true`)", EDGE_PRIMARY, exit_x=1, exit_y=0.5, entry_x=0, entry_y=0.5)
    b.add_edge("e_conf_comp", "conf_paths", "box_completed", "Direct In-Store POS Voucher Fulfillment", EDGE_SUCCESS, exit_x=0.8, exit_y=1, entry_x=0.2, entry_y=0)
    b.add_edge("e_deliv_comp", "deliv_handover", "box_completed", "Mark Delivered (`PATCH /api/delivery/status`)", EDGE_SUCCESS, exit_x=0.5, exit_y=1, entry_x=0.8, entry_y=0)
    b.add_edge("e_draft_cancel", "box_draft", "box_cancelled", "Cancel Draft Order", EDGE_ERROR, exit_x=0.3, exit_y=1, entry_x=0.2, entry_y=0)
    b.add_edge("e_conf_cancel", "btn_cancel_conf", "box_cancelled", "Cancel Confirmed Order (Refund Prompt)", EDGE_ERROR, exit_x=0.3, exit_y=1, entry_x=0.7, entry_y=0)

    b.save(os.path.join(DRAWIO_DIR, "sales_order_lifecycle.drawio"))


# ==============================================================================
# DIAGRAM 4: DELIVERY STATE MACHINE & FEE ALLOCATION
# ==============================================================================
def generate_diagram_4():
    b = DrawioBuilder("diag_delivery_flow", "SMARTOS Delivery State Machine & Fee Allocation Flowchart", 1650, 1350)
    
    # Header
    b.add_node("title", "SMARTOS DELIVERY STATE MACHINE & ZERO DOUBLE-DEDUCTION FLOWCHART", HEADER_STYLE, 40, 20, 1570, 45)
    b.add_node("sub", "Logistics State Machine: Dispatch -> In-Transit -> Delivery Transition -> Zero Double-Deduction Proof -> Fee Allocation (Store vs Customer)", SUBTITLE_STYLE, 40, 70, 1570, 25)
    
    # Step 1: Order Dispatch & 1x Stock Deduction
    b.add_node("step1_box", "STAGE 1: Order Dispatch & Single-Point Stock Deduction", CONTAINER_BLUE, 50, 110, 1550, 220)
    b.add_node("s1_desc", "Sales Order Dispatched with Delivery:\n• Sales order created / fulfilled at POS with `isDelivery: true`\n• Recipient details captured: Name, Phone (`09...`), Destination Address\n• Initial Status: `status = DELIVERING`, `deliveryStatus = PENDING`", NODE_WHITE_CARD, 80, 160, 480, 130)
    
    b.add_node("s1_deduct", "SINGLE POINT OF STOCK DEDUCTION (Executes Exactly Once):\n• `StockLevel.quantity`: Atomic decrement by Q (`quantity: { decrement: Q }`)\n• `InventoryLog.create`: Reason = `StockChangeReason.SALE`, change = -Q\n• `SalesOrderItem.fulfilledQuantity`: Increment by Q", NODE_EMERALD, 590, 160, 520, 130)
    
    b.add_node("s1_waybill", "Thermal Waybill Generation:\n• Print courier waybill / thermal manifest\n• Assign tracking/waybill number\n• Attach deliverer info", NODE_INDIGO, 1140, 160, 430, 130)

    # Step 2: In-Transit Operations
    b.add_node("step2_box", "STAGE 2: Courier Transit & Logistics Tracking", CONTAINER_PURPLE, 50, 360, 1550, 170)
    b.add_node("s2_transit", "In-Transit Courier Operations (`GET /api/delivery`):\n• Listed under 'Pending Deliveries' tab in Delivery Dispatch Center\n• Carrier (Royal Express, Ninja Van, Grab Express, or In-House Rider) transports package\n• Receiver contact phone verified prior to handover", NODE_WHITE_CARD, 80, 410, 720, 100)
    b.add_node("s2_metrics", "Real-Time Delivery KPI Metrics:\n• `Pending Deliveries` count incremented\n• Real-time delivery dispatch list filterable by branch", NODE_PURPLE, 840, 410, 730, 100)

    # Step 3: Delivery Status Update & Zero Double-Deduction Proof
    b.add_node("step3_box", "STAGE 3: Delivery Status Transition (`PATCH /api/delivery/status`)", CONTAINER_AMBER, 50, 560, 1550, 230)
    
    b.add_node("s3_action", "Cashier / Dispatcher Action:\n• Click 'Mark Delivered' in Delivery Center\n• Input Receiver Name & Phone\n• Call `PATCH /api/delivery/status`", NODE_AMBER, 80, 615, 420, 130)

    b.add_node("s3_zero_deduct", "ZERO DOUBLE-DEDUCTION INVARIANT VERIFICATION:\n• Endpoint verifies order is already dispatched\n• Modifies ONLY logistics state: `deliveryStatus = 'DELIVERED'`, `status = 'COMPLETED'`\n• Modifies driver, receiver & waybill metadata\n• EXECUTES ZERO STOCK DEDUCTIONS (Protects against double inventory loss)", NODE_EMERALD, 530, 615, 560, 130)

    b.add_node("s3_status_res", "Updated State:\n• `deliveryStatus = DELIVERED`\n• `status = COMPLETED`\n• `updatedAt = now()`", NODE_SLATE, 1120, 615, 450, 130)

    # Step 4: Delivery Fee Allocation Decision Tree
    b.add_node("step4_box", "STAGE 4: Delivery Service Fee Allocation Decision Engine", CONTAINER_INDIGO, 50, 820, 1550, 340)
    
    b.add_node("d_fee_exists", "Is Delivery Fee > 0?\n(`deliveryFee > 0`)", NODE_DECISION_INDIGO, 120, 930, 260, 90)

    b.add_node("no_fee_node", "Zero Delivery Fee\n(Free shipping / In-store delivery)\nNo ledger adjustments needed", NODE_SLATE, 450, 870, 320, 65)

    b.add_node("d_fee_payer", "Evaluate Fee Payer:\n`deliveryFeePayer`\n(STORE vs CUSTOMER)", NODE_DECISION_PURPLE, 470, 980, 280, 90)

    # Payer A: STORE
    b.add_node("fee_store", "CASE A: STORE PAYS DELIVERY FEE (`deliveryFeePayer === 'STORE'`)\n• Store branch absorbs logistics expense\n• Create `Expense` Record:\n  - `branchId`: Order Branch\n  - `category`: `ExpenseCategory.OTHER`\n  - `amount`: `deliveryFee`\n  - `note`: 'Delivery fee for Order #{salesOrderId}'\n• Customer balance remains unaffected: `Total Due = total`", NODE_ROSE, 830, 870, 735, 120)

    # Payer B: CUSTOMER
    b.add_node("fee_cust", "CASE B: CUSTOMER PAYS DELIVERY FEE (`deliveryFeePayer === 'CUSTOMER'`)\n• Customer absorbs logistics expense\n• Add Fee to Customer Order Due: `Total Order Due = total + deliveryFee`\n• Remaining Debt Updated: `Remaining Debt = Total Order Due - amountPaid`\n• Appears in `/outstanding` Debt Collection Ledger\n• NO Store Expense record created", NODE_EMERALD, 830, 1010, 735, 120)

    # Step 5: Final Settlement
    b.add_node("step5_box", "STAGE 5: Settlement & Delivery Dashboard Refresh", CONTAINER_EMERALD, 50, 1190, 1550, 130)
    b.add_node("s5_finish", "Delivery Completed Successfully:\n• Delivery dashboard KPI updated (`Delivered Today` incremented, `Pending` decremented)\n• Order archived in completed deliveries table\n• Customer order ledger finalized in MMK currency", NODE_WHITE_CARD_CENTER, 80, 1230, 1490, 70)

    # Connectors
    b.add_edge("e_s1_s2", "step1_box", "step2_box", "Package Handed to Carrier", EDGE_PRIMARY, exit_x=0.5, exit_y=1, entry_x=0.5, entry_y=0)
    b.add_edge("e_s2_s3", "step2_box", "step3_box", "Package Delivered to Recipient", EDGE_PRIMARY, exit_x=0.5, exit_y=1, entry_x=0.5, entry_y=0)
    b.add_edge("e_s3_s4", "step3_box", "step4_box", "Trigger Fee Allocation", EDGE_PRIMARY, exit_x=0.5, exit_y=1, entry_x=0.5, entry_y=0)
    
    b.add_edge("e_fee_no", "d_fee_exists", "no_fee_node", "NO: Fee = 0", EDGE_STD)
    b.add_edge("e_fee_yes", "d_fee_exists", "d_fee_payer", "YES: Fee > 0", EDGE_SUCCESS)

    b.add_edge("e_payer_store", "d_fee_payer", "fee_store", "Payer = STORE", EDGE_PRIMARY)
    b.add_edge("e_payer_cust", "d_fee_payer", "fee_cust", "Payer = CUSTOMER", EDGE_SUCCESS)

    b.add_edge("e_s4_s5", "step4_box", "step5_box", "Ledger Reconciled", EDGE_SUCCESS, exit_x=0.5, exit_y=1, entry_x=0.5, entry_y=0)

    b.save(os.path.join(DRAWIO_DIR, "delivery_state_machine.drawio"))


# ==============================================================================
# DIAGRAM 5: DEBT COLLECTION FLOW (REPAYMENT CAPPING & LEDGER FLOW)
# ==============================================================================
def generate_diagram_5():
    b = DrawioBuilder("diag_debt_flow", "SMARTOS Customer Outstanding Debt Repayment Flowchart", 1650, 1350)
    
    # Header
    b.add_node("title", "SMARTOS CUSTOMER OUTSTANDING DEBT REPAYMENT & CAPPING FLOWCHART", HEADER_STYLE, 40, 20, 1570, 45)
    b.add_node("sub", "Receivables Accounting: Outstanding Aggregation -> Strict Repayment Bounds Capping (0 < A <= Remaining) -> Atomic Ledger Update -> Receipt", SUBTITLE_STYLE, 40, 70, 1570, 25)
    
    # Step 1: Outstanding Debt Aggregation
    b.add_node("step1_box", "STAGE 1: Customer Outstanding Debt Aggregation (`GET /api/outstanding`)", CONTAINER_SLATE, 50, 110, 1550, 230)
    
    b.add_node("s1_query", "Query Active Unsettled Sales Orders:\n• Filter: `status IN ['CONFIRMED', 'DELIVERING', 'COMPLETED']`\n• Filter: `paymentStatus != 'PAID'` (Exclude Draft & Cancelled orders)\n• Scope by staff branch for Manager/Cashier, or cross-branch for Owner", NODE_WHITE_CARD, 80, 160, 480, 140)

    b.add_node("s1_formula", "Mathematical Debt Computation Formula per Order:\nDelivery Fee Due = (deliveryFeePayer == 'CUSTOMER') ? deliveryFee : 0\nTotal Order Due = SalesOrder.total + Delivery Fee Due\nRemaining Debt = max(0, Total Order Due - SalesOrder.amountPaid)", NODE_INDIGO, 590, 160, 520, 140)

    b.add_node("s1_kpis", "Summary Dashboard Cards:\n• `Total Debt to Collect` (MMK sum)\n• `Debtor Customers` count\n• `Unpaid Orders` count", NODE_CYAN, 1140, 160, 430, 140)

    # Step 2: Repayment Submission
    b.add_node("step2_box", "STAGE 2: Debt Repayment Initiation (`POST /api/outstanding/pay`)", CONTAINER_BLUE, 50, 360, 1550, 160)
    
    b.add_node("s2_action", "Cashier Action at Register:\n• Select debtor customer from outstanding list\n• Select specific Sales Order to settle\n• Enter Repayment Amount A (MMK), Payment Method (CASH/CARD/QR), and Note", NODE_WHITE_CARD, 80, 410, 730, 90)

    b.add_node("s2_payload", "API Payload: `POST /api/outstanding/pay`\n`{ salesOrderId: string, amount: number, paymentMethod: 'CASH'|'CARD'|'QR', note: string }`", NODE_BLUE, 840, 410, 730, 90)

    # Step 3: Strict Repayment Bounds & Capping Validation
    b.add_node("step3_box", "STAGE 3: Strict Repayment Bounds & Overpayment Capping Validation", CONTAINER_AMBER, 50, 540, 1550, 260)
    
    b.add_node("d_amount_positive", "Is Repayment Amount A > 0?", NODE_DECISION_AMBER, 150, 610, 280, 90)
    b.add_node("err_zero_amount", "REJECT REPAYMENT (HTTP 400)\n'Payment amount must be greater than 0'", NODE_ROSE, 150, 725, 280, 55)

    b.add_node("d_amount_capped", "Is Repayment Amount A <=\nRemaining Debt?\n(A <= Remaining Debt)", NODE_DECISION_AMBER, 560, 610, 320, 90)
    b.add_node("err_overpayment", "REJECT OVERPAYMENT (HTTP 400)\n'Payment amount ({A} Ks) cannot exceed\nremaining debt ({Remaining Debt} Ks)'", NODE_ROSE, 560, 725, 320, 55)

    b.add_node("valid_repay", "VALID REPAYMENT BOUNDS:\n0 < Payment Amount <= Remaining Debt\nProceed to atomic database transaction", NODE_EMERALD, 970, 620, 590, 80)

    # Step 4: Atomic Database Transaction
    b.add_node("step4_box", "STAGE 4: Atomic Ledger & State Update (`prisma.$transaction`)", CONTAINER_EMERALD, 50, 820, 1550, 240)
    
    b.add_node("tx_calc", "1. Compute New Totals\n`newAmountPaid = amountPaid + A`\n`isPaid = newAmountPaid >= TotalDue`\n`newStatus = isPaid ? 'PAID' : 'PARTIAL'`", NODE_WHITE_CARD, 80, 870, 330, 160)

    b.add_node("tx_so_upd", "2. Update Sales Order Record\n`tx.salesOrder.update`\n- `amountPaid: newAmountPaid`\n- `paymentStatus: newStatus`\n- `depositStatus: (newAmountPaid >= total ? 'PAID' : 'PARTIAL')`", NODE_EMERALD, 440, 870, 360, 160)

    b.add_node("tx_pay_create", "3. Create OrderPayment Row\n`tx.orderPayment.create`\n- `salesOrderId`: ID\n- `amount`: +A (MMK)\n- `method`: CASH/CARD/QR\n- `collectedByStaffId`: Staff ID", NODE_EMERALD, 830, 870, 340, 160)

    b.add_node("tx_audit_create", "4. Record System Audit Log\n`tx.auditLog.create`\n- `action`: 'DEBT_COLLECTION_PAYMENT'\n- `staffId`: Staff ID\n- `details`: 'Collected {A} Ks for Order #{id}'", NODE_EMERALD, 1200, 870, 370, 160)

    # Step 5: Post-Settlement Actions
    b.add_node("step5_box", "STAGE 5: Post-Settlement Receipts & UI Refresh", CONTAINER_PURPLE, 50, 1080, 1550, 230)
    
    b.add_node("s5_receipt", "Debt Collection Receipt Printing:\n• Thermal receipt modal generated\n• Details: Customer Name, Phone, Order Ref, Repaid Amount, Remaining Balance, Cashier Signature", NODE_PURPLE, 80, 1130, 480, 140)

    b.add_node("s5_auto_purge", "Automatic List Purging:\n• If `newStatus === 'PAID'`, order is automatically removed from `/outstanding` list\n• Zero remaining balance archived in ledger", NODE_EMERALD, 590, 1130, 480, 140)

    b.add_node("s5_kpi_refresh", "UI & Customer Balance Refresh:\n• Invalidate Redis Cache (`dashboard_stats`)\n• Customer total credit balance recalculated\n• Summary KPIs decremented in real time", NODE_CYAN, 1100, 1130, 470, 140)

    # Connectors
    b.add_edge("e_s1_s2", "step1_box", "step2_box", "Cashier Initiates Repayment", EDGE_PRIMARY, exit_x=0.5, exit_y=1, entry_x=0.5, entry_y=0)
    b.add_edge("e_s2_s3", "step2_box", "step3_box", "Submit Payment Payload", EDGE_PRIMARY, exit_x=0.5, exit_y=1, entry_x=0.5, entry_y=0)
    
    b.add_edge("e_v1_no", "d_amount_positive", "err_zero_amount", "NO: Amount <= 0", EDGE_ERROR)
    b.add_edge("e_v1_yes", "d_amount_positive", "d_amount_capped", "YES: Amount > 0", EDGE_SUCCESS)

    b.add_edge("e_v2_no", "d_amount_capped", "err_overpayment", "NO: A > Remaining", EDGE_ERROR)
    b.add_edge("e_v2_yes", "d_amount_capped", "valid_repay", "YES: A <= Remaining", EDGE_SUCCESS)

    b.add_edge("e_v_to_tx", "valid_repay", "step4_box", "Execute Interactive Transaction", EDGE_SUCCESS, exit_x=0.5, exit_y=1, entry_x=0.5, entry_y=0)
    b.add_edge("e_tx_to_post", "step4_box", "step5_box", "Transaction Committed", EDGE_SUCCESS, exit_x=0.5, exit_y=1, entry_x=0.5, entry_y=0)

    b.save(os.path.join(DRAWIO_DIR, "debt_collection_flow.drawio"))


# ==============================================================================
# DIAGRAM 6: PURCHASE ORDER MAC FLOW (RECEIVING & COST AVERAGING)
# ==============================================================================
def generate_diagram_6():
    b = DrawioBuilder("diag_po_mac_flow", "SMARTOS Purchase Order Receiving & Moving Average Cost (MAC) Flowchart", 1750, 1450)
    
    # Header
    b.add_node("title", "SMARTOS PURCHASE ORDER RECEIVING & MOVING AVERAGE COST (MAC) FLOWCHART", HEADER_STYLE, 40, 20, 1670, 45)
    b.add_node("sub", "Procurement Lifecycle: PO Creation -> Goods Arrival -> Franchise-Wide MAC Recalculation -> Cost & Price Sync -> Stock Increment", SUBTITLE_STYLE, 40, 70, 1670, 25)
    
    # Stage 1: PO Creation
    b.add_node("step1_box", "STAGE 1: Purchase Order Creation (`POST /api/purchase-orders`)", CONTAINER_SLATE, 50, 110, 1650, 200)
    
    b.add_node("s1_create", "Manager / Owner Initiates Procurement:\n• Select Supplier, destination Branch, Voucher Date & Arrival Date\n• Add line items (`PurchaseItem[]` with variant, quantity Q, unitCost, sellingPrice)\n• Compute Total PO Cost: `totalCost = sum(quantity * unitCost)`\n• Status set to `PurchaseOrderStatus.DRAFT` or `ORDERED`", NODE_WHITE_CARD, 80, 160, 780, 120)

    b.add_node("s1_rules", "Procurement Business Rules:\n• Manager scoped strictly to assigned branch\n• Owner can order across any franchise branch\n• `paymentStatus` set to `NO_PAY`, `PARTIAL`, or `PAID`", NODE_INDIGO, 890, 160, 780, 120)

    # Stage 2: Goods Arrival & Inspection
    b.add_node("step2_box", "STAGE 2: Physical Goods Arrival & Inspection", CONTAINER_BLUE, 50, 330, 1650, 150)
    b.add_node("s2_inspect", "Warehouse / Branch Goods Inspection:\n• Supplier delivers physical inventory items to branch warehouse\n• Staff inspects packaging, counts physical quantities, and validates supplier invoice/voucher number\n• Staff records actual received quantities and optional updated retail selling prices", NODE_WHITE_CARD_CENTER, 80, 375, 1590, 80)

    # Stage 3: PO Receiving Handover
    b.add_node("step3_box", "STAGE 3: PO Receiving Action (`PATCH /api/purchase-orders`)", CONTAINER_AMBER, 50, 500, 1650, 180)
    
    b.add_node("s3_dup_check", "Duplicate Receive Guard:\nIs `PurchaseOrder.status === 'RECEIVED'`?", NODE_DECISION_AMBER, 120, 545, 360, 90)
    b.add_node("err_dup_po", "REJECT RECEIVING (HTTP 400)\n'Purchase Order is already received'", NODE_ROSE, 120, 645, 360, 45)

    b.add_node("s3_loop_start", "PO Receiving Loop:\nBegin atomic processing for each `PurchaseItem` variant in order items", NODE_AMBER, 530, 555, 1140, 70)

    # Stage 4: Moving Average Cost (MAC) Recalculation Engine
    b.add_node("step4_box", "STAGE 4: Franchise-Wide Moving Average Cost (MAC) Recalculation Engine", CONTAINER_PURPLE, 50, 700, 1650, 280)
    
    b.add_node("mac_step_a", "Step 4A: Fetch Franchise Total Stock\n`Total Stock = sum(StockLevel.quantity)`\n(Aggregated across ALL franchise branches)", NODE_WHITE_CARD, 80, 750, 380, 90)

    b.add_node("mac_step_b", "Step 4B: Fetch Current Cost\n`Cost_old = ProductVariant.costPrice`\n`Q_inc = item.quantity`\n`Cost_inc = item.unitCost`", NODE_WHITE_CARD, 480, 750, 360, 90)

    b.add_node("d_stock_positive", "Is Total Franchise Stock > 0?\n(`Total Stock > 0`)", NODE_DECISION_PURPLE, 860, 750, 270, 90)

    b.add_node("mac_formula_pos", "FORMULA: Weighted Moving Average Cost\nMAC_new = (TotalStock × Cost_old + Q_inc × Cost_inc) / (TotalStock + Q_inc)", NODE_EMERALD, 1160, 740, 510, 55)

    b.add_node("mac_formula_zero", "FORMULA: Base Fallback Cost (TotalStock <= 0)\nMAC_new = Cost_inc (Incoming Unit Cost)", NODE_BLUE, 1160, 810, 510, 55)

    b.add_node("mac_sync_desc", "Franchise Cost Uniformity Rule: Recalculated MAC_new propagates across the entire franchise to ensure uniform inventory valuation.", NODE_PURPLE, 80, 890, 1590, 60)

    # Stage 5: Atomic Database & Franchise Synchronization
    b.add_node("step5_box", "STAGE 5: Atomic Database & Franchise Synchronization (`prisma.$transaction`)", CONTAINER_EMERALD, 50, 1000, 1650, 270)
    
    b.add_node("s5_upd_var", "1. Update Variant Cost\n`ProductVariant.update`\n`costPrice = MAC_new`", NODE_EMERALD, 80, 1050, 290, 90)

    b.add_node("s5_upd_prod", "2. Sync Parent Product\n`Product.update`\n`costPrice = MAC_new`", NODE_EMERALD, 390, 1050, 290, 90)

    b.add_node("s5_upd_sibs", "3. Sync Sibling Variants\n`ProductVariant.updateMany`\n`costPrice = MAC_new`", NODE_EMERALD, 700, 1050, 300, 90)

    b.add_node("s5_price_guard", "4. Retail Price Protection\nIf `sellingPrice > 0` => Update price\nIf `0` => Preserve catalog price", NODE_INDIGO, 1020, 1050, 320, 90)

    b.add_node("s5_stock_inc", "5. Increment Branch Stock\n`StockLevel.upsert`\n`quantity: { increment: Q_inc }`", NODE_EMERALD, 1360, 1050, 310, 90)

    b.add_node("s5_log_create", "6. Write Inventory Audit Log\n`InventoryLog.create({ branchId, variantId, change: +Q_inc, reason: StockChangeReason.PURCHASE_RECEIVED, purchaseOrderId })`", NODE_CYAN, 80, 1160, 1590, 80)

    # Stage 6: PO Finalization
    b.add_node("step6_box", "STAGE 6: Purchase Order Finalization & Cache Invalidation", CONTAINER_SLATE, 50, 1290, 1650, 130)
    b.add_node("s6_finish", "PO Status Updated to `RECEIVED` | `receivedById: staffId` | Cash flow & supplier ledger updated | Redis cache invalidated | HTTP 200 OK", NODE_WHITE_CARD_CENTER, 80, 1330, 1590, 70)

    # Connectors
    b.add_edge("e_s1_s2", "step1_box", "step2_box", "Goods Dispatched by Supplier", EDGE_PRIMARY, exit_x=0.5, exit_y=1, entry_x=0.5, entry_y=0)
    b.add_edge("e_s2_s3", "step2_box", "step3_box", "Goods Received at Warehouse", EDGE_PRIMARY, exit_x=0.5, exit_y=1, entry_x=0.5, entry_y=0)
    
    b.add_edge("e_dup_check_no", "s3_dup_check", "err_dup_po", "Already Received", EDGE_ERROR)
    b.add_edge("e_dup_check_yes", "s3_dup_check", "s3_loop_start", "Status != RECEIVED", EDGE_SUCCESS)

    b.add_edge("e_s3_s4", "step3_box", "step4_box", "Recalculate Cost per Variant", EDGE_PRIMARY, exit_x=0.5, exit_y=1, entry_x=0.5, entry_y=0)

    b.add_edge("e_mac_pos", "d_stock_positive", "mac_formula_pos", "YES: TotalStock > 0", EDGE_SUCCESS)
    b.add_edge("e_mac_zero", "d_stock_positive", "mac_formula_zero", "NO: TotalStock <= 0", EDGE_STD)

    b.add_edge("e_s4_s5", "step4_box", "step5_box", "Apply New MAC to Database", EDGE_SUCCESS, exit_x=0.5, exit_y=1, entry_x=0.5, entry_y=0)
    b.add_edge("e_s5_s6", "step5_box", "step6_box", "All Items Processed", EDGE_SUCCESS, exit_x=0.5, exit_y=1, entry_x=0.5, entry_y=0)

    b.save(os.path.join(DRAWIO_DIR, "purchase_order_mac_flow.drawio"))


# ==============================================================================
# DIAGRAM 7: RBAC SECURITY MODEL (MULTI-ROLE & BRANCH ISOLATION)
# ==============================================================================
def generate_diagram_7():
    b = DrawioBuilder("diag_rbac_model", "SMARTOS Multi-Role & Branch Isolation RBAC Security Architecture", 1850, 1450)
    
    # Header
    b.add_node("title", "SMARTOS MULTI-ROLE & BRANCH ISOLATION RBAC SECURITY ARCHITECTURE", HEADER_STYLE, 40, 20, 1770, 45)
    b.add_node("sub", "Enterprise Access Control: 3 User Personas -> Session Verification -> Multi-Branch Isolation Boundary -> Interlocking Matrix (Write => Read)", SUBTITLE_STYLE, 40, 70, 1770, 25)
    
    # Layer 1: Personas
    b.add_node("layer1_box", "LAYER 1: User Roles & Client Request Personas", CONTAINER_SLATE, 50, 110, 1750, 170)
    
    b.add_node("p_owner", "ROLE: OWNER\n• Enterprise Super-Administrator\n• Full cross-branch access\n• 11 / 11 Modules (Read & Write)\n• Immutable permissions", NODE_PURPLE, 80, 160, 520, 100)

    b.add_node("p_mgr", "ROLE: MANAGER\n• Store Branch General Manager\n• Strictly branch-isolated\n• 10 / 11 Modules (Read & Write)\n• Can manage same-branch Cashiers only", NODE_BLUE, 650, 160, 550, 100)

    b.add_node("p_cashier", "ROLE: CASHIER\n• POS Register Operator\n• Strictly branch-isolated\n• 3 / 11 Modules (POS, Delivery, Outstanding)\n• Blocked from Staff, Reports, Inventory, Expenses", NODE_INDIGO, 1250, 160, 520, 100)

    # Layer 2: Authentication & Session Verification
    b.add_node("layer2_box", "LAYER 2: Authentication & Session Verification (`src/middleware.ts` & `src/lib/auth-helper.ts`)", CONTAINER_BLUE, 50, 300, 1750, 150)
    
    b.add_node("l2_session_flow", "Session Resolution Flow:\n1. Intercept Request Cookie `pos_session` (httpOnly, SameSite=Lax)\n2. Fallback to Authorization Header `x-staff-id` or Clerk Session Token\n3. Query Database: `db.staff.findUnique({ where: { id }, include: { branch: true } })`\n4. Execute `sanitizePermissions(staff.permissions, staff.role)` to enforce role constraints", NODE_WHITE_CARD, 80, 345, 1690, 85)

    # Layer 3: Central Authorization Guard
    b.add_node("layer3_box", "LAYER 3: Central Authorization Guard (`checkStaffPermission(staff, module, action, targetBranchId)`)", CONTAINER_PURPLE, 50, 470, 1750, 330)
    
    b.add_node("d_guard_owner", "Guard 1: Is Staff Role == 'OWNER'?", NODE_DECISION_PURPLE, 80, 550, 340, 90)
    b.add_node("res_owner_pass", "UNIVERSAL BYPASS:\n`{ allowed: true }`\nOwner has unrestricted cross-branch read/write access", NODE_PURPLE, 80, 680, 340, 80)

    b.add_node("d_guard_branch", "Guard 2: Multi-Branch Isolation Check\nIs targetBranchId != staff.branchId?", NODE_DECISION_PURPLE, 500, 550, 380, 90)
    b.add_node("err_branch_block", "REJECT CROSS-BRANCH ACCESS (HTTP 403)\n'You can only manage resources for branch {staff.branchName}'", NODE_ROSE, 500, 680, 380, 80)

    b.add_node("d_guard_module", "Guard 3: Granular Module & Action Check\nCheck `staff.permissions[module][action]`", NODE_DECISION_PURPLE, 970, 550, 380, 90)
    b.add_node("err_perm_block", "REJECT PERMISSION DENIED (HTTP 403)\n'Permission denied for module {module}.{action}'", NODE_ROSE, 970, 680, 380, 80)

    b.add_node("res_action_allow", "ACCESS GRANTED (200 OK)\nExecute requested Route Handler", NODE_EMERALD, 1430, 585, 340, 120)

    # Layer 4: Permission Interlocking & Sanitization Engine
    b.add_node("layer4_box", "LAYER 4: Permission Interlocking & Sanitization Engine (`src/lib/permissions.ts`)", CONTAINER_AMBER, 50, 820, 1750, 240)
    
    b.add_node("l4_rule_interlock", "INTERLOCKING MATHEMATICAL RULE:\n`write: true => read: true`\nFormula: `effectiveRead = Boolean(mod.read) || Boolean(mod.write)`\nIf Write permission is enabled, Read is strictly enforced to true.\nRevoking Read permission automatically revokes Write permission.", NODE_AMBER, 80, 870, 540, 160)

    b.add_node("l4_rule_owner_immut", "OWNER IMMUTABILITY INVARIANT:\n• Direct attempts to modify Owner permissions return HTTP 403 ('Owner permissions cannot be modified')\n• `sanitizePermissions` strips demotion attempts and guarantees 100% full read/write for Owner", NODE_PURPLE, 650, 870, 540, 160)

    b.add_node("l4_rule_mgr_bound", "MANAGER BOUNDARY ENFORCEMENT:\n• Managers can only edit Cashier permissions in their assigned branch\n• Manager cannot edit other Managers or cross-branch staff\n• Manager blocked from `setup.write` (Store branches & categories)", NODE_BLUE, 1220, 870, 550, 160)

    # Layer 5: Complete 11-Module Access Grid
    b.add_node("layer5_box", "LAYER 5: Complete 11-Module Granular Access Grid by Role", CONTAINER_EMERALD, 50, 1080, 1750, 340)
    
    # 11 Modules Table Nodes
    matrix_headers = [
        ("m_h_mod", "Operational Module", 80, 240),
        ("m_h_desc", "Description & Route Scope", 330, 480),
        ("m_h_own", "OWNER Access", 820, 280),
        ("m_h_mgr", "MANAGER Access (Branch)", 1110, 320),
        ("m_h_csh", "CASHIER Access (Branch)", 1440, 330),
    ]
    for mhid, mhtext, mhx, mhw in matrix_headers:
        b.add_node(mhid, mhtext, NODE_SLATE, mhx, 1130, mhw, 35)

    modules_matrix = [
        ("row1", "1. POS Register", "POS Voucher, Cart, Scanner, Split Payments", "Read / Write (All)", "Read / Write (Branch)", "Read / Write (Branch)", 1175),
        ("row2", "2. Sales Orders", "Pre-orders, Confirmation & Fulfillments", "Read / Write (All)", "Read / Write (Branch)", "Read / Write (Branch)", 1215),
        ("row3", "3. Delivery Center", "Logistics Dispatch, Waybills & Carriers", "Read / Write (All)", "Read / Write (Branch)", "Read / Write (Branch)", 1255),
        ("row4", "4. Debt Collection", "Customer Outstanding Receivables Ledger", "Read / Write (All)", "Read / Write (Branch)", "Read / Write (Branch)", 1295),
        ("row5", "5. Inventory", "Stock Levels, Adjustments & Transfers", "Read / Write (All)", "Read / Write (Branch)", "BLOCKED (403)", 1335),
        ("row6", "6. Purchases", "PO Procurement, Suppliers & MAC Costing", "Read / Write (All)", "Read / Write (Branch)", "BLOCKED (403)", 1375),
    ]
    for rid, rmod, rdesc, rown, rmgr, rcsh, ry in modules_matrix:
        b.add_node(f"{rid}_m", rmod, NODE_WHITE_CARD_CENTER, 80, ry, 240, 35)
        b.add_node(f"{rid}_d", rdesc, NODE_WHITE_CARD, 330, ry, 480, 35)
        b.add_node(f"{rid}_o", rown, NODE_EMERALD, 820, ry, 280, 35)
        b.add_node(f"{rid}_g", rmgr, NODE_BLUE, 1110, ry, 320, 35)
        if "BLOCKED" in rcsh:
            b.add_node(f"{rid}_c", rcsh, NODE_ROSE, 1440, ry, 330, 35)
        else:
            b.add_node(f"{rid}_c", rcsh, NODE_INDIGO, 1440, ry, 330, 35)

    # Connectors
    b.add_edge("e_l1_l2", "layer1_box", "layer2_box", "Client Request Dispatched", EDGE_PRIMARY, exit_x=0.5, exit_y=1, entry_x=0.5, entry_y=0)
    b.add_edge("e_l2_l3", "layer2_box", "layer3_box", "Session Verified & Sanitized", EDGE_PRIMARY, exit_x=0.5, exit_y=1, entry_x=0.5, entry_y=0)
    
    b.add_edge("e_g1_yes", "d_guard_owner", "res_owner_pass", "YES: Owner Role", EDGE_SUCCESS)
    b.add_edge("e_g1_no", "d_guard_owner", "d_guard_branch", "NO: Non-Owner Role", EDGE_STD)

    b.add_edge("e_g2_yes", "d_guard_branch", "err_branch_block", "YES: Target != Assigned Branch", EDGE_ERROR)
    b.add_edge("e_g2_no", "d_guard_branch", "d_guard_module", "NO: Same Branch", EDGE_SUCCESS)

    b.add_edge("e_g3_no", "d_guard_module", "err_perm_block", "NO: Permission False", EDGE_ERROR)
    b.add_edge("e_g3_yes", "d_guard_module", "res_action_allow", "YES: Permission True", EDGE_SUCCESS)

    b.add_edge("e_l3_l4", "layer3_box", "layer4_box", "Enforce Interlocking Consistency", EDGE_PRIMARY, exit_x=0.5, exit_y=1, entry_x=0.5, entry_y=0)
    b.add_edge("e_l4_l5", "layer4_box", "layer5_box", "Apply Role Access Matrix", EDGE_SUCCESS, exit_x=0.5, exit_y=1, entry_x=0.5, entry_y=0)

    b.save(os.path.join(DRAWIO_DIR, "rbac_security_model.drawio"))


def main():
    print("=== Generating 7 Production-Grade Draw.io XML Diagrams ===")
    generate_diagram_1()
    generate_diagram_2()
    generate_diagram_3()
    generate_diagram_4()
    generate_diagram_5()
    generate_diagram_6()
    generate_diagram_7()
    print("=== All 7 Draw.io Diagrams Generated Successfully! ===")


if __name__ == "__main__":
    main()
