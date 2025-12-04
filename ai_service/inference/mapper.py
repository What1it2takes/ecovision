"""
Waste class mapping from YOLOv10 raw classes to 8 medium waste classes
Includes disposal instructions and reuse ideas
"""

from typing import Dict, List, Optional
import logging

logger = logging.getLogger(__name__)


class WasteMapper:
    """Maps YOLOv10 detections to waste classes with disposal and reuse info"""
    
    def __init__(self):
        """Initialize with class mappings and disposal instructions"""
        # Map YOLOv10 raw class names to our 8 waste classes
        # Adjust these mappings based on your actual YOLOv10 training classes
        self.class_mapping = {
            # Plastic items
            "bottle": "plastic_bottle",
            "plastic_bottle": "plastic_bottle",
            "water_bottle": "plastic_bottle",
            "pet_bottle": "plastic_bottle",
            "wrapper": "plastic_wrapper",
            "plastic_wrapper": "plastic_wrapper",
            "bag": "plastic_wrapper",
            "plastic_bag": "plastic_wrapper",
            
            # Paper items
            "cup": "paper_cup",
            "paper_cup": "paper_cup",
            "paper": "paper_cup",
            "cardboard": "cardboard_box",
            "cardboard_box": "cardboard_box",
            "box": "cardboard_box",
            
            # Food waste
            "food": "food_waste",
            "food_waste": "food_waste",
            "organic": "food_waste",
            "banana": "food_waste",
            "apple": "food_waste",
            
            # Glass
            "glass": "glass_bottle",
            "glass_bottle": "glass_bottle",
            "bottle_glass": "glass_bottle",
            
            # Metal
            "can": "metal_can",
            "metal_can": "metal_can",
            "aluminum": "metal_can",
            "tin": "metal_can",
            
            # Cloth
            "cloth": "cloth",
            "fabric": "cloth",
            "textile": "cloth",
            "clothing": "cloth",
        }
        
        # Disposal instructions for each waste class
        self.disposal_instructions = {
            "plastic_bottle": "Rinse and place in recycling bin. Remove caps if required locally.",
            "plastic_wrapper": "Check local guidelines. Most thin plastic wrappers go in general waste.",
            "paper_cup": "Remove plastic lining if possible. Place in paper recycling or general waste.",
            "food_waste": "Compost if available, otherwise place in organic waste bin.",
            "glass_bottle": "Rinse and place in glass recycling bin. Remove labels if required.",
            "metal_can": "Rinse and place in metal recycling bin. Crush to save space.",
            "cardboard_box": "Flatten and place in paper/cardboard recycling bin.",
            "cloth": "Donate if usable, otherwise place in textile recycling or general waste.",
        }
        
        # Reuse ideas (3 per class)
        self.reuse_ideas = {
            "plastic_bottle": [
                "Cut and use as plant propagation containers",
                "Create DIY watering globes for potted plants",
                "Transform into storage containers for small items",
            ],
            "plastic_wrapper": [
                "Use as protective wrap for fragile items during moving",
                "Create DIY waterproof covers for outdoor items",
                "Repurpose as temporary storage bags",
            ],
            "paper_cup": [
                "Use as seed starter pots (biodegradable)",
                "Create small organizers for desk supplies",
                "Use for arts and crafts projects",
            ],
            "food_waste": [
                "Compost to create nutrient-rich soil",
                "Use vegetable scraps to make homemade stock",
                "Regrow vegetables from scraps (e.g., green onions, lettuce)",
            ],
            "glass_bottle": [
                "Repurpose as decorative vases or candle holders",
                "Use for storing homemade preserves or oils",
                "Create DIY table lamps or pendant lights",
            ],
            "metal_can": [
                "Use as planters for small herbs or succulents",
                "Create rustic utensil holders or organizers",
                "Transform into candle lanterns with decorative holes",
            ],
            "cardboard_box": [
                "Use as drawer dividers or closet organizers",
                "Create storage boxes for seasonal items",
                "Repurpose as play structures or forts for children",
            ],
            "cloth": [
                "Cut into rags for cleaning",
                "Create patchwork quilts or blankets",
                "Transform into reusable shopping bags or totes",
            ],
        }
        
        # Dustbin mapping (for compatibility with existing frontend)
        self.dustbin_mapping = {
            "plastic_bottle": "Blue Bin",
            "plastic_wrapper": "Red Bin",  # Often not recyclable
            "paper_cup": "Blue Bin",
            "food_waste": "Green Bin",
            "glass_bottle": "Blue Bin",
            "metal_can": "Blue Bin",
            "cardboard_box": "Blue Bin",
            "cloth": "Yellow Bin",  # Textile recycling
        }
    
    def map_detection(self, detection: Dict) -> Dict:
        """
        Map YOLOv10 detection to waste class with disposal and reuse info.
        
        Args:
            detection: Detection dict with 'class_name', 'bbox', 'confidence', 'class_id'
        
        Returns:
            Mapped detection with waste class, disposal, reuse ideas, dustbin
        """
        raw_class = detection.get("class_name", "").lower()
        
        # Try to map the class name
        waste_class = self.class_mapping.get(raw_class)
        
        # If not found, try partial matching
        if not waste_class:
            for key, value in self.class_mapping.items():
                if key in raw_class or raw_class in key:
                    waste_class = value
                    break
        
        # Default fallback
        if not waste_class:
            logger.warning(f"Unknown class '{raw_class}', defaulting to 'plastic_bottle'")
            waste_class = "plastic_bottle"
        
        # Build mapped detection (backward compatible with YOLOv8 schema)
        mapped = {
            "class": waste_class,
            "confidence": detection.get("confidence", 0.0),
            "bbox": detection.get("bbox", [0, 0, 0, 0]),
            "class_id": detection.get("class_id", 0),
            "disposal": self.disposal_instructions.get(waste_class, "Check local guidelines."),
            "ideas": self.reuse_ideas.get(waste_class, []),
            "dustbin": self.dustbin_mapping.get(waste_class, "Blue Bin"),
        }
        
        return mapped
    
    def get_all_classes(self) -> List[str]:
        """Get list of all supported waste classes"""
        return list(self.disposal_instructions.keys())
    
    def get_disposal(self, waste_class: str) -> str:
        """Get disposal instruction for a waste class"""
        return self.disposal_instructions.get(waste_class, "Check local guidelines.")
    
    def get_reuse_ideas(self, waste_class: str) -> List[str]:
        """Get reuse ideas for a waste class"""
        return self.reuse_ideas.get(waste_class, [])

