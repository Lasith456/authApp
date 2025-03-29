
import sys
import pandas as pd
import json
import os
import re
import torch
from transformers import BartTokenizer, BartForSequenceClassification

class SentimentAnalyzer:
    def __init__(self, model_weights='model_weights.pt', device='cpu'):
        self.device = torch.device(device)
        self.tokenizer = BartTokenizer.from_pretrained("facebook/bart-base")
        self.model = BartForSequenceClassification.from_pretrained(
            "facebook/bart-base", num_labels=3
        ).to(self.device)
        self.model.load_state_dict(torch.load(model_weights, map_location=self.device))
        self.model.eval()

    def preprocess(self, text):
        text = re.sub(r'[^\w\s]', ' ', str(text).lower())
        text = re.sub(r'\s+', ' ', text).strip()
        return text

    def predict(self, text):
        processed_text = self.preprocess(text)
        inputs = self.tokenizer(
            processed_text,
            return_tensors='pt',
            truncation=True,
            padding=True,
            max_length=128
        ).to(self.device)

        with torch.no_grad():
            outputs = self.model(**inputs)
            pred = torch.argmax(outputs.logits, dim=1).item()

        return {0: 'negative', 1: 'neutral', 2: 'positive'}[pred]

def get_category_by_keywords(text):
    text = text.lower()

    categories = {
        "service": ["staff", "service", "help", "assistance", "waiter", "reception", "desk", "clean", "room service"],
        "location": ["location", "view", "nearby", "access", "transportation", "area", "distance", "surroundings", "neighborhood"],
        "food": ["food", "restaurant", "breakfast", "dinner", "meal", "taste", "cuisine"],
        "amenities": ["pool", "gym", "wifi", "parking", "spa", "facilities", "amenity", "internet"]
    }

    for category, keywords in categories.items():
        if any(keyword in text for keyword in keywords):
            return category

    return "general"

def process_reviews(file_path, analyzer):
    """
    Read reviews from a CSV file, predict sentiment and category, and output results as JSON.
    """
    try:
        # Load the CSV file
        data = pd.read_csv(file_path)

        # Ensure the 'review' column exists
        if 'review' not in data.columns:
            print(json.dumps({"error": "CSV file must include a 'review' column."}))
            return

        # Fill missing reviews with empty string
        reviews = data['review'].fillna("").tolist()

        results = []
        for review in reviews:
            sentiment = analyzer.predict(review)
            category = get_category_by_keywords(review)
            results.append({
                "review": review,
                "sentiment": sentiment,
                "category": category
            })

        # Output results as JSON
        print(json.dumps(results, indent=4))

    except FileNotFoundError:
        print(json.dumps({"error": f"File not found: {file_path}"}))
    except Exception as e:
        print(json.dumps({"error": str(e)}))

if __name__ == "__main__":
    script_dir = os.path.dirname(os.path.abspath(__file__))
    weights_path = os.path.join(script_dir, 'model_weights.pt')

    # Check command line arguments
    if len(sys.argv) != 2:
        print(json.dumps({"error": "Please provide the CSV file path as an argument."}))
        sys.exit()

    csv_file_path = sys.argv[1]

    # Initialize sentiment analyzer
    analyzer = SentimentAnalyzer(model_weights=weights_path, device='cpu')

    # Process the input CSV file
    process_reviews(csv_file_path, analyzer)
