from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional, List
import os
import ollama
import httpx
import uuid
import shutil
import random
import json
from datetime import datetime

# Import database module
try:
    from . import database as db
except ImportError:
    import database as db

# Import image classifier (Zero-Shot)
try:
    from . import image_classification as vlm
    AI_CLASSIFIER_AVAILABLE = True
    print("Zero-Shot image classifier loaded (relative)!")
except ImportError:
    try:
        import image_classification as vlm
        AI_CLASSIFIER_AVAILABLE = True
        print("Zero-Shot image classifier loaded (absolute)!")
    except ImportError as e:
        AI_CLASSIFIER_AVAILABLE = False
        print(f"Zero-Shot classifier not available: {e}. Auto-naming will be disabled.")

app = FastAPI()

# Enable CORS for React
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOADS_DIR = "uploads"

# Create uploads directory if not exists
os.makedirs(UPLOADS_DIR, exist_ok=True)

# Serve uploaded images
app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")

# Open-Meteo API
GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search"
WEATHER_URL = "https://api.open-meteo.com/v1/forecast"

# ============ OCCASION RULES ============

def load_occasion_rules():
    """Load occasion rules from JSON file"""
    rules_path = os.path.join(os.path.dirname(__file__), "occasion_rules.json")
    with open(rules_path, "r") as f:
        return json.load(f)

OCCASION_RULES = load_occasion_rules()

def match_occasion(user_input: str) -> dict:
    """Find the best matching occasion from user input based on keywords"""
    user_lower = user_input.lower()
    
    # Check each occasion's keywords
    for occasion_name, rules in OCCASION_RULES["occasions"].items():
        for keyword in rules["keywords"]:
            if keyword in user_lower:
                return {"name": occasion_name, "rules": rules}
    
    # Default to casual if no match
    default = OCCASION_RULES.get("default_occasion", "casual")
    return {"name": default, "rules": OCCASION_RULES["occasions"][default]}

# Data Models
class Profile(BaseModel):
    name: str
    isOwner: bool = False

class StylingRequest(BaseModel):
    occasion: str
    profileId: str
    city: str = "Chennai"

# ============ PROFILE ENDPOINTS ============

@app.get("/profiles")
async def get_profiles():
    return db.get_all_profiles()

@app.post("/profiles")
async def create_profile(profile: Profile):
    profile_id = str(uuid.uuid4())[:8]
    return db.create_profile(profile_id, profile.name, profile.isOwner)

@app.delete("/profiles/{profile_id}")
async def delete_profile(profile_id: str):
    # Get images to delete
    images_to_delete = db.delete_profile(profile_id)
    
    # Delete image files
    for image in images_to_delete:
        if image:
            image_path = os.path.join(UPLOADS_DIR, image)
            if os.path.exists(image_path):
                os.remove(image_path)
    
    return {"message": "Profile deleted"}

# ============ ITEM ENDPOINTS ============

@app.post("/add-item")
def add_item(
    profileId: str = Form(...),
    name: Optional[str] = Form(None),
    category: Optional[str] = Form(None),
    image: Optional[UploadFile] = File(None)
):
    """
    Add an item to the wardrobe.
    If name/category not provided and image is uploaded, uses VLM to auto-detect.
    """
    image_filename = None
    image_path = None
    auto_generated = False
    
    # Save the image first if provided
    if image and image.filename:
        # Generate unique filename
        ext = os.path.splitext(image.filename)[1]
        image_filename = f"{profileId}_{uuid.uuid4().hex[:8]}{ext}"
        image_path = os.path.join(UPLOADS_DIR, image_filename)
        
        with open(image_path, "wb") as buffer:
            shutil.copyfileobj(image.file, buffer)
    
    # Auto-detect name and category using AI if not provided
    if image_path and AI_CLASSIFIER_AVAILABLE:
        if not name or not category:
            try:
                generated_name, detected_category = vlm.generate_item_name(image_path)
                
                if not name and generated_name:
                    name = generated_name
                    auto_generated = True
                    
                if not category and detected_category:
                    category = detected_category
                    
            except Exception as e:
                print(f"AI classification error: {e}")
    
    # Fallback if still no name/category
    if not name:
        name = f"item_{uuid.uuid4().hex[:6]}"
    if not category:
        category = "Uncategorized"
    
    new_item = db.add_item(name, category, profileId, image_filename)
    
    response = {
        "message": f"Added {name} to wardrobe!",
        "item": new_item,
        "auto_generated": auto_generated
    }
    
    return response

@app.post("/analyze-item")
async def analyze_item(image: UploadFile = File(...)):
    """
    Analyze an uploaded image and return AI-detected attributes without saving.
    """
    if not AI_CLASSIFIER_AVAILABLE:
        return {"name": "", "category": "", "error": "AI model not available"}
    
    # Save temporarily
    ext = os.path.splitext(image.filename)[1]
    temp_filename = f"temp_{uuid.uuid4().hex[:8]}{ext}"
    temp_path = os.path.join(UPLOADS_DIR, temp_filename)
    
    try:
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(image.file, buffer)
            
        # Run AI analysis
        generated_name, detected_category = vlm.generate_item_name(temp_path)
        
        return {
            "name": generated_name or "",
            "category": detected_category or ""
        }
    except Exception as e:
        print(f"Analysis error: {e}")
        return {"name": "", "category": "", "error": str(e)}
    finally:
        # Clean up temp file
        if os.path.exists(temp_path):
            os.remove(temp_path)

@app.get("/items")
async def get_all_items():
    return db.get_all_items()

@app.get("/items/{profile_id}")
async def get_items_by_profile(profile_id: str):
    return db.get_items_by_profile(profile_id)

@app.delete("/delete-item/{item_name}")
async def delete_item(item_name: str, profile_id: str = None):
    image = db.delete_item(item_name, profile_id)
    
    # Delete image file if exists
    if image:
        image_path = os.path.join(UPLOADS_DIR, image)
        if os.path.exists(image_path):
            os.remove(image_path)
        return {"message": f"Deleted {item_name}!"}
    
    return {"message": f"Item {item_name} not found."}

# ============ FAVORITES ENDPOINTS ============

class FavoriteOutfit(BaseModel):
    profileId: str
    occasion: str
    items: list  # List of item names
    explanation: str = ""

@app.post("/favorites")
async def save_favorite(fav: FavoriteOutfit):
    fav_id = str(uuid.uuid4())[:8]
    saved_at = datetime.now().strftime("%Y-%m-%d %H:%M")
    new_fav = db.save_favorite(fav_id, fav.profileId, fav.occasion, fav.items, fav.explanation, saved_at)
    return {"message": "Outfit saved to favorites!", "favorite": new_fav}

@app.get("/favorites/{profile_id}")
async def get_favorites(profile_id: str):
    return db.get_favorites_by_profile(profile_id)

@app.delete("/favorites/{fav_id}")
async def delete_favorite(fav_id: str):
    db.delete_favorite(fav_id)
    return {"message": "Favorite removed"}

# ============ WEATHER HELPERS ============

async def get_weather(city: str):
    try:
        async with httpx.AsyncClient() as client:
            geo_response = await client.get(
                GEOCODING_URL,
                params={"name": city, "count": 1, "language": "en"},
                timeout=10.0
            )
            if geo_response.status_code != 200:
                return None
            
            geo_data = geo_response.json()
            if not geo_data.get("results"):
                return None
            
            location = geo_data["results"][0]
            lat = location["latitude"]
            lon = location["longitude"]
            city_name = location["name"]
            
            weather_response = await client.get(
                WEATHER_URL,
                params={
                    "latitude": lat,
                    "longitude": lon,
                    "current": "temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m",
                    "timezone": "auto"
                },
                timeout=10.0
            )
            
            if weather_response.status_code != 200:
                return None
            
            weather_data = weather_response.json()
            current = weather_data.get("current", {})
            
            weather_code = current.get("weather_code", 0)
            condition, description = get_weather_condition(weather_code)
            
            return {
                "city": city_name,
                "temp": round(current.get("temperature_2m", 0)),
                "feels_like": round(current.get("temperature_2m", 0)),
                "humidity": current.get("relative_humidity_2m", 0),
                "condition": condition,
                "description": description,
            }
    except Exception as e:
        print(f"Weather API error: {e}")
        return None

def get_weather_condition(code):
    conditions = {
        0: ("Clear", "clear sky"), 1: ("Clear", "mainly clear"),
        2: ("Clouds", "partly cloudy"), 3: ("Clouds", "overcast"),
        45: ("Fog", "foggy"), 48: ("Fog", "rime fog"),
        51: ("Drizzle", "light drizzle"), 53: ("Drizzle", "moderate drizzle"),
        55: ("Drizzle", "dense drizzle"),
        61: ("Rain", "slight rain"), 63: ("Rain", "moderate rain"),
        65: ("Rain", "heavy rain"), 80: ("Rain", "rain showers"),
        95: ("Thunderstorm", "thunderstorm"),
    }
    return conditions.get(code, ("Unknown", "unknown"))

def get_weather_advice(weather):
    if not weather:
        return ""
    
    advice = []
    temp = weather["temp"]
    condition = weather["condition"].lower()
    
    if temp >= 30:
        advice.append("It's hot! Suggest light, breathable fabrics.")
    elif temp <= 15:
        advice.append("It's cold! Suggest warm layers.")
    
    if "rain" in condition:
        advice.append("It's rainy! Suggest water-resistant items.")
    
    return " ".join(advice)

# ============ STYLING ENDPOINT ============

@app.get("/weather/{city}")
async def get_city_weather(city: str):
    weather = await get_weather(city)
    if weather:
        return weather
    return {"error": "Could not fetch weather data"}

@app.post("/style")
async def get_styling_advice(req: StylingRequest):
    closet = db.get_items_by_profile(req.profileId)
    profiles = db.get_all_profiles()
    
    profile = next((p for p in profiles if p["id"] == req.profileId), None)
    profile_name = profile["name"] if profile else "User"
    
    if not closet:
        return {"suggestion": f"{profile_name}'s wardrobe is empty! Add items first.", "weather": None}

    weather = await get_weather(req.city)
    weather_context = get_weather_advice(weather)
    
    # Match the occasion from user input using JSON rules
    matched = match_occasion(req.occasion)
    occasion_name = matched["name"]
    occasion_rules = matched["rules"]
    
    # Group items by category
    items_by_category = {}
    for item in closet:
        cat = item['category'].strip()
        if cat not in items_by_category:
            items_by_category[cat] = []
        items_by_category[cat].append(item['name'])
    
    # Helper to check if an item is forbidden for this occasion
    def is_item_forbidden(item_name: str, category: str) -> bool:
        """Check if an item should be excluded based on forbidden categories"""
        forbidden = occasion_rules.get("forbidden_categories", [])
        item_lower = item_name.lower()
        cat_lower = category.lower()
        
        for f in forbidden:
            f_lower = f.lower()
            # Check if forbidden keyword is in item name or category
            if f_lower in item_lower or f_lower in cat_lower:
                return True
        return False
    
    # Helper to get items from wardrobe matching allowed types
    def get_matching_items(category_type: str) -> list:
        """Get wardrobe items that match the allowed categories for this occasion"""
        allowed = occasion_rules["allowed_categories"].get(category_type, [])
        matching_items = []
        
        for cat, items in items_by_category.items():
            for item in items:
                # Skip if forbidden
                if is_item_forbidden(item, cat):
                    continue
                
                # Check if allowed (loose matching)
                cat_lower = cat.lower()
                item_lower = item.lower()
                is_allowed = any(a.lower() in item_lower or a.lower() in cat_lower for a in allowed)
                
                if is_allowed:
                    matching_items.append(item)
                elif len(allowed) == 0:  # If no specific allowed, include all non-forbidden
                    matching_items.append(item)
        
        random.shuffle(matching_items)
        return matching_items
    
    # Get filtered items for each category
    filtered_tops = get_matching_items("tops")
    filtered_bottoms = get_matching_items("bottoms")
    filtered_shoes = get_matching_items("shoes")
    filtered_accessories = get_matching_items("accessories")
    
    # Get dresses and sarees but filter out forbidden items
    all_dresses = []
    all_sarees = []
    
    for cat, items in items_by_category.items():
        cat_lower = cat.lower()
        for item in items:
            # Skip forbidden items
            if is_item_forbidden(item, cat):
                continue
            
            if any(d in cat_lower for d in ['dress', 'gown', 'frock', 'set', 'suit']):
                all_dresses.append(item)
            elif 'saree' in cat_lower or 'sari' in cat_lower:
                all_sarees.append(item)
    
    # Format lists for prompt
    def format_list(items: list) -> str:
        if items:
            random.shuffle(items)
            return "\n".join([f"- {item}" for item in items])
        return "(No items available for this occasion)"
    
    tops_str = format_list(filtered_tops)
    bottoms_str = format_list(filtered_bottoms)
    shoes_str = format_list(filtered_shoes)
    accessories_str = format_list(filtered_accessories)
    dresses_str = format_list(all_dresses)
    sarees_str = format_list(all_sarees)
    
    # Weather info
    weather_info = ""
    if weather:
        weather_info = f"""
CURRENT WEATHER in {weather['city']}: {weather['temp']}°C, {weather['description']}
WEATHER TIP: {weather_context}
"""
    
    # Build focused system prompt based on occasion rules
    system_instruction = f"""You are a Fashion Stylist for {profile_name}.

OCCASION: {occasion_name.upper()}

{weather_info}

WARDROBE - SELECT ONLY FROM THESE LISTS:

[TOPS LIST]
{tops_str}

[BOTTOMS LIST]
{bottoms_str}

[DRESSES/SETS LIST]
{dresses_str}

[SAREES LIST]
{sarees_str}

[SHOES LIST]
{shoes_str}

[ACCESSORIES LIST]
{accessories_str}

=== ABSOLUTE RULES (MUST FOLLOW) ===

RULE 0 - NO HALLUCINATION (MOST IMPORTANT):
- You can ONLY suggest items that appear EXACTLY in the lists above
- If an item is not in the list, DO NOT suggest it
- NEVER invent or make up item names like "gray_formal_pumps" or "black_stilettos"
- If no suitable item exists in a category, write: "Not available in wardrobe"
- Copy the EXACT item name as shown, character for character

RULE 1 - CATEGORY PLACEMENT (CRITICAL - NEVER VIOLATE):
- Top: MUST select from [TOPS LIST], [DRESSES/SETS LIST], or [SAREES LIST]. Top can NEVER be "None needed"
- Bottom: ONLY select from [BOTTOMS LIST] or write "None needed". NEVER put a dress here
- Shoes: ONLY select from [SHOES LIST]
- Accessory: ONLY select from [ACCESSORIES LIST]
- A DRESS or SAREE always goes in the TOP field, NEVER in Bottom

RULE 2 - COMPLETE OUTFIT DETECTION:
If your Top selection contains: saree, sari, set, lehenga, anarkali, sharara, suit, chudi, salwar, dress, gown
→ Bottom MUST be "None needed"
If Top is a standalone item (shirt, blouse, kurti without "set", top, crop top)
→ You MUST pick a Bottom from [BOTTOMS LIST]

RULE 3 - COLOR PREFERENCES:
If the user requests a specific color:
- First try to find that color in items APPROPRIATE for the occasion
- If the color is NOT available in appropriate items, suggest a SIMILAR shade that IS available
- NEVER suggest an inappropriate outfit just because it matches the color
- Occasion appropriateness is MORE important than color match

RULE 4 - USE EXACT NAMES:
Copy item names EXACTLY as shown in the lists. Do not modify spelling or invent new names.

RULE 5 - STYLE GUIDELINES:
{occasion_rules['style_notes']}

=== OUTPUT FORMAT (FOLLOW EXACTLY) ===

Overall Outfit Suggestion:
[Write exactly 2 sentences: First sentence explains why this outfit combination works well together. Second sentence describes how this look is perfect for {occasion_name}.]

Top: [EXACT item from TOPS/DRESSES/SAREES list - NEVER "None needed"]
Bottom: [EXACT item from BOTTOMS list OR "None needed" if Top is saree/set/dress]
Shoes: [EXACT item from SHOES list OR "Not available in wardrobe"]
Accessory: [EXACT item from ACCESSORIES list OR "Not available in wardrobe"]

DO NOT add any text after the Accessory line. End your response there."""
    
    response = ollama.chat(model='llama3.2', messages=[
        {'role': 'system', 'content': system_instruction},
        {'role': 'user', 'content': f"Suggest an outfit for: {req.occasion}"},
    ])
    
    # Post-process the response to fix Bottom for complete outfits
    suggestion_text = response['message']['content']
    suggestion_text = fix_complete_outfit_bottom(suggestion_text)
    
    return {
        "suggestion": suggestion_text,
        "weather": weather,
        "items": closet,
        "matched_occasion": occasion_name
    }


def fix_complete_outfit_bottom(suggestion: str) -> str:
    """
    Post-process LLM response to fix common errors:
    1. Ensure complete outfits have 'None needed' for Bottom
    2. If Bottom contains a dress/saree, swap it to Top
    3. Ensure Top is never 'None needed'
    """
    import re
    
    # Keywords that indicate a complete outfit (no bottom needed)
    complete_outfit_keywords = [
        'saree', 'sari', 'set', 'lehenga', 'anarkali', 'sharara', 
        'suit', 'chudi', 'salwar', 'dress', 'gown', 'frock', 'maxi'
    ]
    
    # Extract Top and Bottom lines
    top_match = re.search(r'Top:\s*(.+)', suggestion, re.IGNORECASE)
    bottom_match = re.search(r'Bottom:\s*(.+)', suggestion, re.IGNORECASE)
    
    top_item = top_match.group(1).strip() if top_match else ""
    bottom_item = bottom_match.group(1).strip() if bottom_match else ""
    
    top_lower = top_item.lower()
    bottom_lower = bottom_item.lower()
    
    # FIX 1: If Bottom contains a dress/saree keyword, it should be in Top
    bottom_is_complete_outfit = any(keyword in bottom_lower for keyword in complete_outfit_keywords)
    if bottom_is_complete_outfit and (top_lower == "none needed" or top_lower == "none" or not top_item):
        # Swap: put Bottom item in Top, and set Bottom to None needed
        suggestion = re.sub(
            r'Top:\s*.+',
            f'Top: {bottom_item}',
            suggestion,
            flags=re.IGNORECASE
        )
        suggestion = re.sub(
            r'Bottom:\s*.+',
            'Bottom: None needed',
            suggestion,
            flags=re.IGNORECASE
        )
        return suggestion
    
    # FIX 2: If Bottom has a complete outfit but Top also has something, just fix Bottom
    if bottom_is_complete_outfit:
        suggestion = re.sub(
            r'Bottom:\s*.+',
            'Bottom: None needed',
            suggestion,
            flags=re.IGNORECASE
        )
    
    # FIX 3: If Top is a complete outfit, ensure Bottom is None needed
    top_is_complete_outfit = any(keyword in top_lower for keyword in complete_outfit_keywords)
    if top_is_complete_outfit:
        suggestion = re.sub(
            r'Bottom:\s*.+',
            'Bottom: None needed',
            suggestion,
            flags=re.IGNORECASE
        )
    
    # FIX 4: Ensure Top is never "None needed"
    if top_lower == "none needed" or top_lower == "none":
        # This is a fallback. Ideally, the LLM should always pick a Top.
        # If it fails, we can try to pick a random dress/saree or top if available.
        # For now, we'll just make it empty, which might indicate an error.
        # A more robust solution would involve re-prompting or picking a default.
        suggestion = re.sub(
            r'Top:\s*.+',
            'Top: (Please select a top item)', # Placeholder for now
            suggestion,
            flags=re.IGNORECASE
        )
    
    return suggestion