#!/usr/bin/env python3
"""
Verification Script for SMARTOS Draw.io XML Diagrams
Checks XML well-formedness, mxGraphModel structure, mxCell integrity, and node/edge relationships.
"""

import os
import xml.etree.ElementTree as ET

DRAWIO_DIR = r"C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon\drawio"

DIAGRAM_FILES = [
    "system_architecture.drawio",
    "pos_checkout_flow.drawio",
    "sales_order_lifecycle.drawio",
    "delivery_state_machine.drawio",
    "debt_collection_flow.drawio",
    "purchase_order_mac_flow.drawio",
    "rbac_security_model.drawio",
]

def verify_file(filename):
    filepath = os.path.join(DRAWIO_DIR, filename)
    print(f"\n--- Verifying {filename} ---")
    if not os.path.exists(filepath):
        print(f"FAIL: File does not exist at {filepath}")
        return False

    try:
        tree = ET.parse(filepath)
        root = tree.getroot()
    except ET.ParseError as e:
        print(f"FAIL: XML Parse Error in {filename}: {e}")
        return False

    if root.tag != "mxfile":
        print(f"FAIL: Root tag is not 'mxfile', got '{root.tag}'")
        return False

    diagram = root.find("diagram")
    if diagram is None:
        print("FAIL: No <diagram> tag found")
        return False

    model = diagram.find("mxGraphModel")
    if model is None:
        print("FAIL: No <mxGraphModel> tag found")
        return False

    graph_root = model.find("root")
    if graph_root is None:
        print("FAIL: No <root> tag found under mxGraphModel")
        return False

    cells = graph_root.findall("mxCell")
    cell_ids = set()
    vertices = []
    edges = []

    for cell in cells:
        cid = cell.get("id")
        if not cid:
            print("FAIL: mxCell missing 'id' attribute")
            return False
        if cid in cell_ids:
            print(f"FAIL: Duplicate cell id '{cid}'")
            return False
        cell_ids.add(cid)

        if cell.get("vertex") == "1":
            vertices.append(cell)
        elif cell.get("edge") == "1":
            edges.append(cell)

    # Check root cells 0 and 1
    if "0" not in cell_ids or "1" not in cell_ids:
        print("FAIL: Missing root cell id='0' or id='1'")
        return False

    # Check parent validity
    for cell in cells:
        cid = cell.get("id")
        if cid in ("0",):
            continue
        parent = cell.get("parent")
        if parent not in cell_ids:
            print(f"FAIL: Cell '{cid}' has invalid parent '{parent}'")
            return False

    # Check edge source and target
    for edge in edges:
        eid = edge.get("id")
        source = edge.get("source")
        target = edge.get("target")
        if not source or source not in cell_ids:
            print(f"FAIL: Edge '{eid}' has invalid source '{source}'")
            return False
        if not target or target not in cell_ids:
            print(f"FAIL: Edge '{eid}' has invalid target '{target}'")
            return False

    print(f"PASS: {filename}")
    print(f"  • Total Cells: {len(cells)}")
    print(f"  • Vertices: {len(vertices)}")
    print(f"  • Edges / Connectors: {len(edges)}")
    print(f"  • Root/Layer Cells: 2")
    return True

def main():
    all_passed = True
    for f in DIAGRAM_FILES:
        res = verify_file(f)
        if not res:
            all_passed = False
    
    print("\n" + "="*50)
    if all_passed:
        print("ALL 7 DRAW.IO DIAGRAMS PASSED VERIFICATION WITH 100% SUCCESS!")
    else:
        print("SOME DIAGRAMS FAILED VERIFICATION. CHECK ERRORS ABOVE.")
    print("="*50)

if __name__ == "__main__":
    main()
