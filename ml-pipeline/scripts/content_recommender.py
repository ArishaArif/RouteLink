"""
content_recommender.py
------------------------
Day 2, Part 1: a content-based recommendation engine.

"Content-based" means we recommend destinations based on the ATTRIBUTES
of the destinations themselves (category + description text) -- as
opposed to "collaborative filtering," which recommends based on what
SIMILAR USERS liked (that's Day 2, Part 2 / later this sprint, using the
ratings_long.csv data).

Two features here:
  1. recommend_similar(name)      -> "users who liked X might like these"
  2. recommend_by_preferences(...) -> "user said they like these categories"

Run: python scripts/content_recommender.py
"""

import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

DATA_PATH = "data/processed/destinations_clean.csv"


def load_destinations(path: str) -> pd.DataFrame:
    df = pd.read_csv(path)
    print(f"Loaded {len(df)} destinations across {df['category'].nunique()} categories")
    return df


def build_content_profile(df: pd.DataFrame) -> pd.Series:
    """
    Combine each destination's category and description into one text
    "profile" per row. We repeat the category 3x -- this is a simple way
    to make category matches weigh more heavily than incidental word
    overlap in the free-text description. (A more advanced version later
    could weight fields separately instead of duplicating text.)
    """
    profile = (df["category"] + " ") * 3 + df["description"]
    return profile


def build_similarity_matrix(profiles: pd.Series):
    """
    Step 1: TF-IDF turns each destination's text profile into a vector of
    numbers (same idea as the hazard classifier -- rare, distinctive
    words score higher than common ones).

    Step 2: cosine_similarity compares every destination's vector against
    every other destination's vector, and returns a score between 0 and 1
    for each pair -- 1 means "identical text profile," 0 means "no shared
    vocabulary at all." Think of each destination as an arrow (vector) in
    space; cosine similarity measures the ANGLE between two arrows, not
    their length -- so a short, focused description and a long, detailed
    one about the same kind of place can still score as very similar.

    The result is an N x N matrix (69 x 69 here) where cell [i, j] is how
    similar destination i is to destination j.
    """
    vectorizer = TfidfVectorizer(stop_words="english")
    tfidf_matrix = vectorizer.fit_transform(profiles)
    similarity_matrix = cosine_similarity(tfidf_matrix)
    return similarity_matrix, vectorizer


def recommend_similar(df: pd.DataFrame, similarity_matrix, name: str, top_n: int = 5) -> pd.DataFrame:
    """
    'Users who planned a trip to X might also like...' -- find the
    destination's row index, look up its similarity scores against every
    other destination, and return the highest-scoring ones (excluding
    itself).
    """
    matches = df.index[df["name"].str.lower() == name.lower()]
    if len(matches) == 0:
        print(f"'{name}' not found in the dataset.")
        return pd.DataFrame()

    idx = matches[0]
    scores = list(enumerate(similarity_matrix[idx]))

    # Sort by score descending, skip the first result (a destination is
    # always most similar to itself -- score 1.0 -- so we discard index 0).
    scores = sorted(scores, key=lambda x: x[1], reverse=True)[1 : top_n + 1]

    result_indices = [i for i, score in scores]
    result_scores = [round(score, 3) for i, score in scores]

    result = df.iloc[result_indices][["name", "category", "province"]].copy()
    result["similarity_score"] = result_scores
    return result


def recommend_by_preferences(df: pd.DataFrame, preferred_categories: list, top_n: int = 5) -> pd.DataFrame:
    """
    The "enter your preferences" flow: given a list of categories a user
    says they like (e.g. ["lake", "meadow"]), score every destination by
    how many of its words overlap with a synthetic query built from those
    categories, using the SAME TF-IDF vocabulary as the similarity matrix
    so the comparison is apples-to-apples.
    """
    vectorizer = TfidfVectorizer(stop_words="english")
    profiles = build_content_profile(df)
    tfidf_matrix = vectorizer.fit_transform(profiles)

    query_text = " ".join(preferred_categories)
    query_vector = vectorizer.transform([query_text])

    scores = cosine_similarity(query_vector, tfidf_matrix)[0]

    result = df[["name", "category", "province"]].copy()
    result["match_score"] = [round(s, 3) for s in scores]
    result = result.sort_values("match_score", ascending=False).head(top_n)
    return result


def main():
    df = load_destinations(DATA_PATH)
    profiles = build_content_profile(df)
    similarity_matrix, vectorizer = build_similarity_matrix(profiles)

    print("\n--- 'More like this' recommendations for Hunza Valley ---")
    print(recommend_similar(df, similarity_matrix, "Hunza Valley", top_n=5).to_string(index=False))

    print("\n--- Recommendations for a user who likes: lakes, meadows ---")
    print(recommend_by_preferences(df, ["lake", "meadow"], top_n=5).to_string(index=False))

    print("\n--- Recommendations for a user who likes: mosques, historical sites ---")
    print(recommend_by_preferences(df, ["mosque", "historical"], top_n=5).to_string(index=False))


if __name__ == "__main__":
    main()