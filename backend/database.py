import mysql.connector
from mysql.connector import pooling
import os
from typing import List, Optional, Dict, Any
import dotenv
dotenv.load_dotenv()

# MySQL Connection Configuration
DB_CONFIG = {
    "host": os.getenv("MYSQL_HOST"),
    "port": int(os.getenv("MYSQL_PORT")),
    "user": os.getenv("MYSQL_USER"),
    "password": os.getenv("MYSQL_PASSWORD"),
    "database": os.getenv("MYSQL_DATABASE"),
}

# Connection pool for better performance
connection_pool = None

def init_connection_pool():
    """Initialize the connection pool."""
    global connection_pool
    try:
        # First, ensure database exists
        temp_conn = mysql.connector.connect(
            host=DB_CONFIG["host"],
            port=DB_CONFIG["port"],
            user=DB_CONFIG["user"],
            password=DB_CONFIG["password"]
        )
        temp_cursor = temp_conn.cursor()
        temp_cursor.execute(f"CREATE DATABASE IF NOT EXISTS {DB_CONFIG['database']}")
        temp_cursor.close()
        temp_conn.close()
        
        # Now create the connection pool
        connection_pool = pooling.MySQLConnectionPool(
            pool_name="wardrobe_pool",
            pool_size=5,
            pool_reset_session=True,
            **DB_CONFIG
        )
        print("MySQL connection pool created successfully!")
    except mysql.connector.Error as err:
        print(f"Error creating connection pool: {err}")
        raise

def get_connection():
    """Get a connection from the pool."""
    global connection_pool
    if connection_pool is None:
        init_connection_pool()
    return connection_pool.get_connection()

def init_db():
    """Initialize the database with required tables."""
    conn = get_connection()
    cursor = conn.cursor(buffered=True)
    
    # Create profiles table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS profiles (
            id VARCHAR(255) PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            is_owner TINYINT DEFAULT 0
        )
    ''')
    
    # Create items table with foreign key to profiles
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS items (
            id INT PRIMARY KEY AUTO_INCREMENT,
            name VARCHAR(255) NOT NULL,
            category VARCHAR(255) NOT NULL,
            profile_id VARCHAR(255) NOT NULL,
            image VARCHAR(500),
            FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
        )
    ''')
    
    # Create favorites table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS favorites (
            id VARCHAR(255) PRIMARY KEY,
            profile_id VARCHAR(255) NOT NULL,
            occasion VARCHAR(255) NOT NULL,
            items TEXT NOT NULL,
            explanation TEXT,
            saved_at VARCHAR(255),
            FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
        )
    ''')
    
    conn.commit()
    cursor.close()
    conn.close()
    print("Database initialized successfully!")

# ============ PROFILE FUNCTIONS ============

def get_all_profiles() -> List[Dict]:
    conn = get_connection()
    cursor = conn.cursor(dictionary=True, buffered=True)
    cursor.execute('SELECT id, name, is_owner FROM profiles')
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    return [{"id": row["id"], "name": row["name"], "isOwner": bool(row["is_owner"])} for row in rows]

def create_profile(profile_id: str, name: str, is_owner: bool = False) -> Dict:
    conn = get_connection()
    cursor = conn.cursor(buffered=True)
    cursor.execute(
        'INSERT INTO profiles (id, name, is_owner) VALUES (%s, %s, %s)',
        (profile_id, name, 1 if is_owner else 0)
    )
    conn.commit()
    cursor.close()
    conn.close()
    return {"id": profile_id, "name": name, "isOwner": is_owner}

def delete_profile(profile_id: str) -> List[str]:
    """Delete a profile and return list of image filenames to delete."""
    conn = get_connection()
    cursor = conn.cursor(dictionary=True, buffered=True)
    
    # Get images to delete
    cursor.execute('SELECT image FROM items WHERE profile_id = %s AND image IS NOT NULL', (profile_id,))
    images = [row["image"] for row in cursor.fetchall()]
    
    # Delete items belonging to this profile
    cursor.execute('DELETE FROM items WHERE profile_id = %s', (profile_id,))
    
    # Delete favorites belonging to this profile
    cursor.execute('DELETE FROM favorites WHERE profile_id = %s', (profile_id,))
    
    # Delete the profile
    cursor.execute('DELETE FROM profiles WHERE id = %s', (profile_id,))
    
    conn.commit()
    cursor.close()
    conn.close()
    return images

# ============ ITEM FUNCTIONS ============

def get_all_items() -> List[Dict]:
    conn = get_connection()
    cursor = conn.cursor(dictionary=True, buffered=True)
    cursor.execute('SELECT id, name, category, profile_id, image FROM items')
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    return [
        {"id": row["id"], "name": row["name"], "category": row["category"], 
         "profileId": row["profile_id"], "image": row["image"]} 
        for row in rows
    ]

def get_items_by_profile(profile_id: str) -> List[Dict]:
    conn = get_connection()
    cursor = conn.cursor(dictionary=True, buffered=True)
    cursor.execute('SELECT id, name, category, profile_id, image FROM items WHERE profile_id = %s', (profile_id,))
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    return [
        {"id": row["id"], "name": row["name"], "category": row["category"], 
         "profileId": row["profile_id"], "image": row["image"]} 
        for row in rows
    ]

def add_item(name: str, category: str, profile_id: str, image: Optional[str] = None) -> Dict:
    conn = get_connection()
    cursor = conn.cursor(buffered=True)
    cursor.execute(
        'INSERT INTO items (name, category, profile_id, image) VALUES (%s, %s, %s, %s)',
        (name, category, profile_id, image)
    )
    item_id = cursor.lastrowid
    conn.commit()
    cursor.close()
    conn.close()
    return {"id": item_id, "name": name, "category": category, "profileId": profile_id, "image": image}

def delete_item(item_name: str, profile_id: Optional[str] = None) -> Optional[str]:
    """Delete an item and return the image filename if exists."""
    conn = get_connection()
    cursor = conn.cursor(dictionary=True, buffered=True)
    
    # Get the image filename before deletion
    if profile_id:
        cursor.execute('SELECT image FROM items WHERE name = %s AND profile_id = %s', (item_name, profile_id))
    else:
        cursor.execute('SELECT image FROM items WHERE name = %s', (item_name,))
    
    row = cursor.fetchone()
    image = row["image"] if row else None
    
    # Delete the item
    if profile_id:
        cursor.execute('DELETE FROM items WHERE name = %s AND profile_id = %s', (item_name, profile_id))
    else:
        cursor.execute('DELETE FROM items WHERE name = %s', (item_name,))
    
    deleted = cursor.rowcount > 0
    conn.commit()
    cursor.close()
    conn.close()
    return image if deleted else None

# ============ FAVORITES FUNCTIONS ============

def get_favorites_by_profile(profile_id: str) -> List[Dict]:
    conn = get_connection()
    cursor = conn.cursor(dictionary=True, buffered=True)
    cursor.execute('SELECT id, profile_id, occasion, items, explanation, saved_at FROM favorites WHERE profile_id = %s', (profile_id,))
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    
    import json
    return [
        {"id": row["id"], "profileId": row["profile_id"], "occasion": row["occasion"],
         "items": json.loads(row["items"]), "explanation": row["explanation"], "savedAt": row["saved_at"]}
        for row in rows
    ]

def save_favorite(fav_id: str, profile_id: str, occasion: str, items: list, explanation: str, saved_at: str) -> Dict:
    conn = get_connection()
    cursor = conn.cursor(buffered=True)
    
    import json
    items_json = json.dumps(items)
    
    cursor.execute(
        'INSERT INTO favorites (id, profile_id, occasion, items, explanation, saved_at) VALUES (%s, %s, %s, %s, %s, %s)',
        (fav_id, profile_id, occasion, items_json, explanation, saved_at)
    )
    conn.commit()
    cursor.close()
    conn.close()
    return {"id": fav_id, "profileId": profile_id, "occasion": occasion, "items": items, "explanation": explanation, "savedAt": saved_at}

def delete_favorite(fav_id: str) -> bool:
    conn = get_connection()
    cursor = conn.cursor(buffered=True)
    cursor.execute('DELETE FROM favorites WHERE id = %s', (fav_id,))
    deleted = cursor.rowcount > 0
    conn.commit()
    cursor.close()
    conn.close()
    return deleted

# Initialize database on module import
init_db()
