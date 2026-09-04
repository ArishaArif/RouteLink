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
import joblib

# Handles two valid ways this file gets imported: directly (`python3
# scripts/hazard_classifier.py` -- scripts/ itself is on sys.path, so
# "scripts.hazard_keywords" doesn't resolve) and via app.py at the
# project root (`from scripts.hazard_classifier import ...` -- here
# root is on sys.path, so a bare "hazard_keywords" doesn't resolve).
# Try the absolute (package) form first, fall back to the bare form.
try:
    from scripts.hazard_keywords import HAZARD_KEYWORDS
except ImportError:
    from hazard_keywords import HAZARD_KEYWORDS
from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.naive_bayes import MultinomialNB
from sklearn.metrics import accuracy_score, classification_report

DATA_PATH = "data/raw/hazard_tweets_train.csv"
PAKISTAN_EXAMPLES_PATH = "data/raw/pakistan_hazard_examples.csv"
MODEL_PATH = "models/hazard_classifier.joblib"
VECTORIZER_PATH = "models/hazard_vectorizer.joblib"


def load_data(path: str) -> pd.DataFrame:
    df = pd.read_csv(path)
    print(f"Loaded {len(df)} labeled examples")
    print(df["target"].value_counts().rename({1: "hazard", 0: "not_hazard"}))
    return df


def load_pakistan_examples(path: str) -> pd.DataFrame:
    """
    The base dataset (7,613 tweets) is generic/global disaster language --
    it's never seen "Karakoram," "Khunjerab," or the specific vocabulary
    of Northern Pakistan tourism, which is exactly why it got "Khunjerab
    Pass closed due to snowfall" wrong (false negative) and "Hunza Valley
    apricot festival" wrong (false positive) in testing. A small, focused
    set of hand-labeled Pakistan-specific examples, blended into training,
    shifts the model's vocabulary toward the domain it actually needs to
    work in -- even 30 good examples measurably help, because they're
    dense with exactly the words/phrasing real hazard alerts will use.
    """
    df = pd.read_csv(path)
    print(f"Loaded {len(df)} Pakistan-specific hand-labeled examples")
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
    # max_features was 500 back when this trained on 20 mock rows -- with
    # 7,644 real examples now, that cap silently excluded domain-specific
    # words entirely (verified: "khunjerab", "snowfall", "closed" weren't
    # even IN the vocabulary the model could use, regardless of how the
    # model weighted them). min_df=2 is a better cap here: keep any word
    # that appears in at least 2 documents (filters pure noise/typos)
    # without an arbitrary top-N ceiling that scales badly as data grows.
    vectorizer = TfidfVectorizer(stop_words="english", min_df=2)

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
    """
    Sanity-check on brand-new sentences the model has never seen --
    including the exact two cases the OLD model got backwards during
    real-world testing, so we get direct before/after proof this fix worked.
    """
    new_texts = [
        "Road blocked near Chilas due to sudden landslide",
        "Had a wonderful time hiking in Fairy Meadows today",
        "Hunza Valley apricot festival draws record crowds",  # old model: false positive (hazard)
        "Khunjerab Pass closed due to heavy snowfall",  # old model: false negative (not hazard)
    ]
    X_new = vectorizer.transform(new_texts)
    preds = model.predict(X_new)

    print("\n--- Predictions on new, unseen text (includes prior failure cases) ---")
    for text, pred in zip(new_texts, preds):
        label = "HAZARD" if pred == 1 else "not hazard"
        print(f"[{label}] {text}")


def predict_hazard(texts: list, threshold: float = 0.35) -> list:
    """
    Load the persisted model + vectorizer (trained via main() below) and
    classify a batch of raw text strings as hazard / not-hazard.

    This is the callable entry point app.py's FastAPI service imports.

    is_hazard now requires BOTH: (1) confidence >= threshold, AND (2) at
    least one literal hazard keyword present in the text. Previously this
    function relied on ML confidence alone, which let mundane text near
    the threshold slip through -- e.g. "Lovely weather today" scored 0.359
    (just above the 0.35 cutoff) and got flagged as a hazard, despite
    containing no hazard-related word at all. hazard_news_scraper.py's
    pipeline was already protected from this by its own keyword gate
    running BEFORE classification; this brings that same protection
    directly into predict_hazard() so every caller gets it (including the
    /api/predict/hazard endpoint, which had no such gate at all before).

    hazard_confidence is still reported as the RAW model score, unfiltered
    -- so callers can see what the model actually thought, even on cases
    the keyword gate overrides to not-hazard. is_hazard is the safe,
    gated decision; hazard_confidence is the transparent raw number.
    """
    model = joblib.load(MODEL_PATH)
    vectorizer = joblib.load(VECTORIZER_PATH)

    X = vectorizer.transform(texts)
    confidences = model.predict_proba(X)[:, 1]

    def has_hazard_keyword(text: str) -> bool:
        text = text.lower()
        return any(kw in text for kw in HAZARD_KEYWORDS)

    return [
        {
            "text": text,
            "hazard_confidence": round(float(conf), 3),
            "is_hazard": bool(conf >= threshold) and has_hazard_keyword(text),
        }
        for text, conf in zip(texts, confidences)
    ]


def main():
    df = load_data(DATA_PATH)
    pk_df = load_pakistan_examples(PAKISTAN_EXAMPLES_PATH)

    # Concatenate the generic base dataset with the Pakistan-specific
    # examples into one training set. We're not replacing the base data --
    # the 7,613 generic tweets still teach broad "what does hazard
    # language sound like" patterns; the 30 local examples sharpen that
    # toward our actual domain vocabulary.
    df = pd.concat([df[["text", "target"]], pk_df[["text", "target"]]], ignore_index=True)
    print(f"\nCombined training set: {len(df)} total examples")
    print(df["target"].value_counts().rename({1: "hazard", 0: "not_hazard"}))

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

    # Persist both the trained model AND the vectorizer that learned the
    # vocabulary -- you need BOTH to make predictions later. A model
    # without its matching vectorizer is useless: it expects input
    # vectors built from the exact same vocabulary it trained on.
    joblib.dump(model, MODEL_PATH)
    joblib.dump(vectorizer, VECTORIZER_PATH)
    print(f"\nSaved model to {MODEL_PATH} and vectorizer to {VECTORIZER_PATH}")

    # Temporary mock to unblock Day 5 UI integration
def predict_hazard(text: str):
    return {
        "sourceType": "ml-nlp",
        "rawText": text,
        "hazardType": "natural_disaster",
        "region": "Hunza",
        "severity": "high",
        "description": "Mocked hazard pipeline for UI testing."
    }


if __name__ == "__main__":
    main()