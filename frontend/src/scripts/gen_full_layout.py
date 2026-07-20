import json

seats = []
# Planta Baja VIP (Rows 1-5)
for r in range(5):
    for c in range(12):
        seats.append({
            "id": len(seats) + 1,
            "row": f"PB-VIP-{chr(65+r)}",
            "number": c + 1,
            "status": "available",
            "section": "Planta Baja - VIP",
            "category": "vip",
            "x": 280 + c * 40,
            "y": 200 + r * 50,
            "angle": 0
        })

# Planta Baja General (Rows 6-12)
for r in range(5, 12):
    for c in range(14):
        seats.append({
            "id": len(seats) + 1,
            "row": f"PB-GEN-{chr(65+r)}",
            "number": c + 1,
            "status": "available",
            "section": "Planta Baja - General",
            "category": "general_a",
            "x": 240 + c * 40,
            "y": 200 + r * 60,
            "angle": 0
        })

# Terraza (Rows 13-18)
for r in range(12, 18):
    for c in range(10):
        seats.append({
            "id": len(seats) + 1,
            "row": f"TZ-{chr(65+r-12)}",
            "number": c + 1,
            "status": "available",
            "section": "Terraza Alta",
            "category": "general_b",
            "x": 300 + c * 45,
            "y": 1050 + (r-12) * 60,
            "angle": 0
        })

layout = {
    "map_elements": [
        { "type": "rect", "x": 500, "y": 60, "w": 400, "h": 80, "label": "ESCENARIO", "color": "rgba(255,191,0,0.15)" },
        { "type": "rect", "x": 100, "y": 500, "w": 40, "h": 300, "label": "BARRA IZQ", "color": "rgba(34,166,179,0.15)" },
        { "type": "rect", "x": 900, "y": 500, "w": 40, "h": 300, "label": "BARRA DER", "color": "rgba(34,166,179,0.15)" },
        { "type": "icon", "x": 50, "y": 950, "icon": "stairs", "label": "SUBIDA" },
        { "type": "icon", "x": 950, "y": 950, "icon": "stairs", "label": "SUBIDA" },
        { "type": "icon", "x": 500, "y": 1000, "icon": "wc", "label": "BAÑOS" }
    ],
    "seats": seats
}

with open('c:/Users/Agent/OneDrive/Documents/proyects/ms-ambar/frontend/src/scripts/full_bar_nectar.json', 'w') as f:
    json.dump(layout, f, indent=2)
