import sys
import pandas as pd
import json
import pickle
import os
import re


script_dir = os.path.dirname(os.path.abspath(__file__))
# with open(os.path.join(script_dir, 'model.pkl'), 'rb') as file:
#     model = pickle.load(file)
with open(os.path.join(script_dir, 'sentiment_analyzer.pkl'), 'rb') as file:
    model = pickle.load(file)
with open(os.path.join(script_dir, 'vectorizer.pkl'), 'rb') as file:
    vectorizer = pickle.load(file)


def preprocess_text(text):
    """
    Preprocess the input text to match the preprocessing steps used during training.
    """
    text = text.lower()  # Convert to lowercase
    text = re.sub(r'[^\w\s]', '', text)  # Remove punctuation
    return text


def process_reviews(file_path):
    """
    Read reviews from a CSV file, predict their sentiments, and return results.
    """
    try:
        # Load the CSV file
        data = pd.read_csv(file_path)

        # Ensure the 'review' column exists
        if 'review' not in data.columns:
            print(json.dumps({"error": "CSV file must include 'review' column."}))
            return

        # Preprocess reviews
        reviews = data['review'].fillna("").apply(preprocess_text).tolist()

        # Transform reviews using the vectorizer
        X = vectorizer.transform(reviews)

        # Predict sentiment
        predictions = model.predict(X)
        sentiments = ["positive" if p == 'Positive' else "negative" for p in predictions]

        # Combine reviews and their sentiments
        results = [{"review": review, "sentiment": sentiment} for review, sentiment in zip(reviews, sentiments)]

        # Print results as JSON
        print(json.dumps(results, indent=4))
    except FileNotFoundError:
        print(json.dumps({"error": f"File not found: {file_path}"}))
    except Exception as e:
        print(json.dumps({"error": str(e)}))


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(json.dumps({"error": "Please provide the CSV file path as an argument."}))
        sys.exit()

    # Process the input CSV file
    process_reviews(sys.argv[1])
