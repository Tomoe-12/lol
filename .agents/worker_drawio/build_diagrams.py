#!/usr/bin/env python3
"""
SMARTOS Enterprise POS - Draw.io XML Diagram Generator
Generates 7 production-grade, uncompressed, beautifully styled Draw.io XML diagram files.
"""

import os
import html
import xml.etree.ElementTree as ET

DRAWIO_DIR = r"C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon\drawio"

class DrawioDiagramBuilder:
    def __init__(self, diagram_id, diagram_name, width=1600, height=1200):
        self.diagram_id = diagram_id
        self.diagram_name = diagram_name
        self.width = width
        self.height = height
        self.cells = []
        self.cell_id_counter = 2
        
        # Add root cells
        self.cells.append('<mxCell id="0"/>')
        self.cells.append('<mxCell id="1" parent="0"/>')

    def next_id(self):
        cid = str(self.cell_id_counter)
        self.cell_id_counter += 1
        return cid

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
        
        extra_points = ""
        exit_entry_style = ""
        if exit_x is not None and exit_y is not None:
            exit_entry_style += f"exitX={exit_x};exitY={exit_y};exitDx=0;exitDy=0;"
        if entry_x is not None and entry_y is not None:
            exit_entry_style += f"entryX={entry_x};entryY={entry_y};entryDx=0;entryDy=0;"

        full_style = style + exit_entry_style

        cell = (
            f'<mxCell id="{edge_id}" value="{val_escaped}" style="{full_style}" '
            f'parent="1" source="{source_id}" target="{target_id}" edge="1">\n'
            f'  <mxGeometry relative="1" as="geometry">\n'
            f'    {extra_points}\n'
            f'  </mxGeometry>\n'
            f'</mxCell>'
        )
        self.cells.append(cell)
        return edge_id

    def to_xml(self):
        cells_xml = "\n      ".join(self.cells)
        xml = (
            f'<?xml version="1.0" encoding="UTF-8"?>\n'
            f'<mxfile host="app.diagrams.net" agent="SMARTOS" version="24.7.5">\n'
            f'  <diagram id="{self.diagram_id}" name="{html.escape(self.diagram_name)}">\n'
            f'    <mxGraphModel dx="1600" dy="1000" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="{self.width}" pageHeight="{self.height}" math="0" shadow="0">\n'
            f'      <root>\n'
            f'      {cells_xml}\n'
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
        print(f"Saved: {filepath}")

print("DrawioDiagramBuilder initialized.")
