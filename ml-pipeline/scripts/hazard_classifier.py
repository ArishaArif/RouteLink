"""
hazard_classifier.py
---------------------
Step 2 of the AI/ML pipeline: a baseline text classifier that decides
whether a piece of text (tweet/news snippet) describes a real hazard
(landslide, flood, road closure) or not.

This mirrors the structure of Kaggle's "NLP with Disaster Tweets" dataset:
columns = id, text, target (1 = real hazard, 0 = not).

Run: python scripts/hazard_classifier.py
"""

import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.naive_bayes import MultinomialNB
from sklearn.metrics import accuracy_score, classification_report

DATA_PATH = "data/raw/hazard_tweets_train.csv"


def load_data(path: str) -> pd.DataFrame:
    df = pd.read_csv(path)
    print(f"Loaded {len(df)} labeled examples")
    print(df["target"].value_counts().rename({1: "hazard", 0: "not_hazard"}))
    return df


def vectorize_text(train_texts, test_texts):
    """
    Machine learning models don't understand words -- they need numbers.
    TF-IDF (Term Frequency - Inverse Document Frequency) converts each
    piece of text into a vector of numbers, where:
      - words that appear OFTEN in one text get a higher score (Term Frequency)
      - words that appear in EVERY text (like "the", "a") get scored DOWN,
        because they don't help distinguish one text from another
        (Inverse Document Frequency)

    Example: "landslide" is rare across all tweets but appears in hazard
    tweets specifically -> high TF-IDF score -> strong signal for the model.
    "the" appears everywhere -> near-zero score -> ignored.
    """
    vectorizer = TfidfVectorizer(stop_words="english", max_features=500)

    # fit_transform on TRAIN: learn the vocabulary AND convert train texts to vectors
    X_train = vectorizer.fit_transform(train_texts)

    # transform only on TEST: reuse the same vocabulary learned from train.
    # We NEVER fit on test data -- that would leak information the model
    # shouldn't have access to yet, and give a falsely optimistic score.
    X_test = vectorizer.transform(test_texts)

    return X_train, X_test, vectorizer


def train_and_evaluate(X_train, X_test, y_train, y_test):
    """
    Naive Bayes is a simple, fast, surprisingly strong baseline for text
    classification -- a good first model before trying anything fancier
    (like fine-tuning a transformer, which is overkill for a 6-day sprint).
    """
    model = MultinomialNB()
    model.fit(X_train, y_train)

    predictions = model.predict(X_test)

    print("\n--- Evaluation on held-out test set ---")
    print(f"Accuracy: {accuracy_score(y_test, predictions):.2f}")
    print(classification_report(y_test, predictions, target_names=["not_hazard", "hazard"]))

    return model


def predict_new_examples(model, vectorizer):
    """Sanity-check the model on brand-new sentences it has never seen."""
    new_texts = [
        "Road blocked near Chilas due to sudden landslide",
        "Had a wonderful time hiking in Fairy Meadows today",
    ]
    X_new = vectorizer.transform(new_texts)
    preds = model.predict(X_new)

    print("\n--- Predictions on new, unseen text ---")
    for text, pred in zip(new_texts, preds):
        label = "HAZARD" if pred == 1 else "not hazard"
        print(f"[{label}] {text}")


def main():
    df = load_data(DATA_PATH)

    # Split into train (80%) and test (20%) sets. The model only ever
    # learns from train; test simulates "new data it's never seen" so
    # we get an honest measure of how well it will generalize.
    # stratify=df["target"] forces both train and test to keep the same
    # hazard/not-hazard ratio as the full dataset. Without it, a random
    # split on a small dataset can accidentally put all of one class into
    # the test set (which is exactly what happened before this fix).
    X_train_text, X_test_text, y_train, y_test = train_test_split(
        df["text"], df["target"], test_size=0.2, random_state=42, stratify=df["target"]
    )

    X_train, X_test, vectorizer = vectorize_text(X_train_text, X_test_text)
    model = train_and_evaluate(X_train, X_test, y_train, y_test)
    predict_new_examples(model, vectorizer)


if __name__ == "__main__":
    main()
