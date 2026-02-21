"""
Image Classifier using Transformers Zero-Shot Classification Pipeline
Automatically classifies wardrobe images by color, pattern, material, type, and category
"""

import torch
from PIL import Image
from transformers import pipeline
from typing import Tuple, Optional
import os

# Classification labels
COLORS = [
    "black", "white", "blue", "red", "green", "yellow", "pink", "purple", 
    "orange", "brown", "grey", "beige", "navy", "maroon", "cream", 
    "gold", "silver", "tan", "olive", "taupe", "mauve", "nude"
]

PATTERNS = [
    "floral", "striped", "checkered", "polka dot", "paisley", "printed", 
    "embroidered", "plain", "graphic"
]

MATERIALS = [
    "denim", "silk", "cotton", "linen", "leather", "velvet", "chiffon",
    "satin", "wool", "knit"
]

CLOTHING_TYPES = {
    "Top": [
        "t-shirt", "shirt", "blouse", "kurti", "kurta", "top", "tank top", 
        "crop top", "sweater", "turtleneck", "turtleneck sweater", "hoodie", 
        "cardigan", "polo shirt", "formal shirt", "printed top", 
        "peplum top", "casual shirt", "tunic", "ethnic top",
        "sports bra", "sports top", "gym top", "athletic top", "workout top",
        "wrap top", "floral top", "floral blouse", "wrap blouse"
    ],
    "Bottom": [
        "jeans", "trousers", "pants", "shorts", "skirt", "tights", "joggers",
        "palazzo pants", "culottes", "cargo pants", "formal pants", "chinos",
        "denim shorts", "pencil skirt", "track pants", "track trousers", "sweatpants",
        "striped track pants", "tracksuit pants", "side stripe track pants"
    ],
    "Dress": [
        "dress", "lehenga", "anarkali", "gown", "salwar suit", "churidar set",
        "maxi dress", "mini dress", "bodycon dress", "wrap dress", "sundress",
        "printed dress", "sharara set", "long dress", "evening gown"
    ],
    "Shoes": [
        "sneakers", "high heels", "sandals", "boots", "ankle boots", "kneigh high boots", "loafers", "flat shoes", 
        "formal shoes", "sports shoes", "running shoes", "pumps"
    ],
    "Accessory": [
        "bag", "handbag", "backpack", "watch", "earrings", "necklace", 
        "bracelet", "belt", "sunglasses", "scarf", "clutch",
        "hair clip", "butterfly clip", "claw clip", "hair accessory",
        "headband", "scrunchie", "hair band", "clip"
    ],
    "Outerwear": [
        "jacket", "coat", "blazer", "shrug", "winter jacket", "puffer jacket",
        "overcoat", "denim jacket", "denim coat", "denim overcoat"
    ],
    "Saree": [
        "saree", "silk saree", "cotton saree"
    ]
}

# Flatten all clothing types for classification
ALL_CLOTHING_TYPES = []
CLOTHING_TO_CATEGORY = {}
for category, types in CLOTHING_TYPES.items():
    for clothing_type in types:
        ALL_CLOTHING_TYPES.append(clothing_type)
        CLOTHING_TO_CATEGORY[clothing_type] = category

# Global classifier cache
_classifier = None

# Using larger CLIP model for better accuracy
# (SigLIP doesn't work with zero-shot-image-classification pipeline)
CLIP_MODEL = "openai/clip-vit-large-patch14"

def load_classifier():
    """Load the zero-shot image classification pipeline with CLIP ViT-Large"""
    global _classifier
    
    if _classifier is None:
        try:
            print(f"Loading CLIP zero-shot classifier: {CLIP_MODEL}...")
            _classifier = pipeline(
                "zero-shot-image-classification",
                model=CLIP_MODEL
            )
            print("CLIP classifier loaded successfully!")
        except Exception as e:
            print(f"Error loading classifier: {e}")
            raise
    
    return _classifier

def classify_color(image_path: str) -> str:
    """Classify the dominant color of the clothing item"""
    classifier = load_classifier()
    
    try:
        image = Image.open(image_path).convert("RGB")
        color_labels = [f"{color} clothing" for color in COLORS]
        
        results = classifier(image, candidate_labels=color_labels)
        
        best_label = results[0]['label']
        for color in COLORS:
            if color in best_label:
                return color
        
        return "multicolor"
    except Exception as e:
        print(f"Error classifying color: {e}")
        return "unknown"

def classify_pattern(image_path: str) -> Optional[str]:
    """Classify the pattern of the clothing item"""
    classifier = load_classifier()
    
    try:
        image = Image.open(image_path).convert("RGB")
        pattern_labels = [f"a {pattern} pattern clothing" for pattern in PATTERNS]
        
        results = classifier(image, candidate_labels=pattern_labels)
        
        # Only return pattern if confidence is high enough
        if results[0]['score'] > 0.3:
            best_label = results[0]['label']
            for pattern in PATTERNS:
                if pattern in best_label and pattern != "plain":
                    return pattern
        
        return None
    except Exception as e:
        print(f"Error classifying pattern: {e}")
        return None

def classify_material(image_path: str) -> Optional[str]:
    """Classify the material of the clothing item"""
    classifier = load_classifier()
    
    try:
        image = Image.open(image_path).convert("RGB")
        material_labels = [f"a {material} fabric clothing" for material in MATERIALS]
        
        results = classifier(image, candidate_labels=material_labels)
        
        # Only return material if confidence is high enough
        if results[0]['score'] > 0.25:
            best_label = results[0]['label']
            for material in MATERIALS:
                if material in best_label:
                    return material
        
        return None
    except Exception as e:
        print(f"Error classifying material: {e}")
        return None

def classify_clothing_type(image_path: str) -> Tuple[str, str]:
    """Classify the clothing type and return (type, category)"""
    classifier = load_classifier()
    
    try:
        image = Image.open(image_path).convert("RGB")
        
        # Classify directly by all clothing types
        type_labels = ALL_CLOTHING_TYPES
        results = classifier(image, candidate_labels=type_labels)
        
        # Get the best match
        best_type = results[0]['label']
        detected_category = CLOTHING_TO_CATEGORY.get(best_type, "Top")
        
        return best_type, detected_category
    except Exception as e:
        print(f"Error classifying clothing type: {e}")
        return "item", "Top"

def generate_item_name(image_path: str) -> Tuple[Optional[str], Optional[str]]:
    """
    Generate a descriptive name for a clothing item from its image.
    
    Args:
        image_path: Path to the image file
        
    Returns:
        Tuple of (generated_name, detected_category)
        Name format: color_pattern_material_type (e.g., "white_floral_top", "cream_butterfly_clip")
    """
    try:
        # First get clothing type and category
        clothing_type, category = classify_clothing_type(image_path)
        
        # Get color
        color = classify_color(image_path)
        
        # Format the clothing type
        clothing_type_formatted = clothing_type.replace(" ", "_").lower()
        
        # Build the name with relevant attributes
        name_parts = []
        
        # Add color first (if not already in type name)
        if color and color != "unknown" and color not in clothing_type_formatted:
            name_parts.append(color)
        
        # Only add pattern/material for clothing items, NOT for accessories
        if category not in ["Accessory", "Shoes"]:
            pattern = classify_pattern(image_path)
            material = classify_material(image_path)
            
            # Add pattern if detected and NOT already in type name
            if pattern and pattern != "plain" and pattern not in clothing_type_formatted:
                name_parts.append(pattern)
            
            # Add material if distinctive and NOT already in type name
            if material and material in ["denim", "leather", "silk", "velvet"]:
                if material not in clothing_type_formatted:
                    name_parts.append(material)
        
        # Add the clothing type
        name_parts.append(clothing_type_formatted)
        
        # Join all parts
        name = "_".join(name_parts)
        
        # Final cleanup: remove any double underscores and lowercase
        name = name.replace("__", "_").strip("_").lower()
        
        print(f"VLM detected: {name} ({category})")
        
        return name, category
        
    except Exception as e:
        print(f"Error generating item name: {e}")
        return None, None

def classify_category_only(image_path: str) -> str:
    """Quickly classify just the category of an image."""
    try:
        _, category = classify_clothing_type(image_path)
        return category
    except Exception as e:
        print(f"Error classifying category: {e}")
        return "Top"
