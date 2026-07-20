import json

def generate_bar_seats():
    seats = []
    seat_id = 1
    
    # 25 tables of 4 (4 seats per table)
    # Arranged in 5 rows, 5 tables per row
    for row in range(5):
        for col in range(5):
            table_x = 300 + col * 100
            table_y = 200 + row * 100
            
            # 4 seats around the table
            positions = [
                (-20, -20), (20, -20),
                (-20, 20), (20, 20)
            ]
            for i, (dx, dy) in enumerate(positions):
                seats.append({
                    "id": seat_id,
                    "row": chr(65 + row),
                    "number": (col * 4) + i + 1,
                    "status": "available",
                    "category": "vip" if row < 2 else "general_a",
                    "section": "Planta Baja - Mesas 4",
                    "x": table_x + dx,
                    "y": table_y + dy,
                    "angle": 0
                })
                seat_id += 1

    # 50 tables of 2 (2 seats per table)
    # Arranged in 5 rows, 10 tables per row, below the tables of 4
    for row in range(5):
        for col in range(10):
            table_x = 150 + col * 80
            table_y = 750 + row * 80
            
            # 2 seats side by side
            positions = [(-20, 0), (20, 0)]
            for i, (dx, dy) in enumerate(positions):
                seats.append({
                    "id": seat_id,
                    "row": chr(70 + row),
                    "number": (col * 2) + i + 1,
                    "status": "available",
                    "category": "general_b",
                    "section": "Planta Baja - Mesas 2",
                    "x": table_x + dx,
                    "y": table_y + dy,
                    "angle": 0
                })
                seat_id += 1
                
    return seats

if __name__ == "__main__":
    data = generate_bar_seats()
    with open("bar_seats_200.json", "w") as f:
        json.dump(data, f, indent=2)
    print(f"Generated {len(data)} seats.")
