from flask import Flask, request, jsonify
from flask_cors import CORS
from pymongo import MongoClient
import cv2
import numpy as np
import torch
from PIL import Image
from ultralytics import YOLO

app = Flask(__name__)
CORS(app)

# Connect to MongoDB
client = MongoClient("mongodb+srv://shivani:<pass>@cluster0.dmqpcfx.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0")
db = client["selfcheckout"]
products_collection = db["products"]

# Load YOLO model
model = YOLO("best_small.pt")

@app.route("/add_products", methods=["POST"])
def add_products():
    data = request.json
    for item in data:
        existing = products_collection.find_one({"name": item["name"]})
        if existing:
            products_collection.update_one(
                {"name": item["name"]},
                {"$set": {"price": item["price"]}, "$inc": {"quantity": item["quantity"]}}
            )
        else:
            products_collection.insert_one(item)
    return jsonify({"message": "Products added/updated successfully!"})

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

            product = products_collection.find_one({"name": class_name})
            if product and product["quantity"] > 0:
                # Do NOT decrement quantity here!
                detections.append({
                    "class": class_name,
                    "confidence": confidence,
                    "price": product["price"],
                    "available_quantity": product["quantity"]
                })

    return jsonify({
        "success": True,
        "objects": detections,
        "message": "Detection successful" if detections else "No objects detected"
    })

@app.route("/print_bill", methods=["POST"])
def print_bill():
    items = request.json.get("items")  # List of {name: str, quantity: int}
    if not items:
        return jsonify({"error": "No items provided"}), 400

    total = 0
    final_bill = []

    for item in items:
        name = item["name"]
        qty = item["quantity"]
        product = products_collection.find_one({"name": name})

        if not product:
            return jsonify({"error": f"Product '{name}' not found"}), 404
        if product["quantity"] < qty:
            return jsonify({"error": f"Not enough stock for '{name}'"}), 400

        # Decrement quantity in DB
        products_collection.update_one(
            {"name": name},
            {"$inc": {"quantity": -qty}}
        )

        subtotal = qty * product["price"]
        total += subtotal
        final_bill.append({
            "name": name,
            "quantity": qty,
            "unit_price": product["price"],
            "subtotal": subtotal
        })

    return jsonify({
        "message": "Bill printed and stock updated.",
        "items": final_bill,
        "total": total
    })

@app.route("/products", methods=["GET"])
def get_products():
    products = list(products_collection.find({}, {"_id": 0}))
    return jsonify(products)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080, debug=True)
