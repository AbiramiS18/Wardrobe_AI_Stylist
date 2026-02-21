import sqlite3

conn = sqlite3.connect('wardrobe.db')
cursor = conn.cursor()

cursor.execute("SELECT name, category FROM items")
items = cursor.fetchall()

print("--- ITEMS IN DB ---")
for name, category in items:
    print(f"[{category}] {name}")

conn.close()
