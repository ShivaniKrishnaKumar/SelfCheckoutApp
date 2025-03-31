from flask import Flask, request, jsonify
from flask_cors import CORS
import cv2
import numpy as np
import torch
from PIL import Image
from ultralytics import YOLO

app = Flask(__name__)
CORS(app)

# Load YOLO model
model = YOLO("best_final_review.pt")

# Price mapping
PRICE_MAPPING = {
    'tea_TajMahal_tea': 2.99,
    # Add more products as needed
}

@app.route("/", methods=["POST"])
def detect_objects():
    if "image" not in request.files:
        return jsonify({"success": False, "message": "No image uploaded"})

    file = request.files["image"]
    image = Image.open(file.stream)
    image_cv = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
    results = model(image_cv)
    
    detections = []
    for result in results:
        for box in result.boxes:
            class_id = int(box.cls)
            class_name = model.names[class_id]
            confidence = float(box.conf)
            price = PRICE_MAPPING.get(class_name, 0.00)
            
            detections.append({
                "class": class_name,
                "confidence": confidence,
                "price": price,
                "bbox": list(map(int, box.xyxy[0]))
            })

    return jsonify({
        "success": True,
        "objects": detections,
        "message": "Detection successful" if detections else "No objects detected"
    })

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080, debug=True)