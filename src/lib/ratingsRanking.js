const SCORE_RANGES = {
  'not-good': [1, 3],
  okay: [4, 6],
  good: [7, 8],
  amazing: [9, 10],
};

export function sortRatingsByRank(a, b) {
  const aRank = typeof a.score === 'string' ? a.score : (typeof a.scoreV2 === 'string' ? a.scoreV2 : null);
  const bRank = typeof b.score === 'string' ? b.score : (typeof b.scoreV2 === 'string' ? b.scoreV2 : null);
  if (aRank && bRank) {
    if (aRank < bRank) return -1;
    if (aRank > bRank) return 1;
  } else if (aRank && !bRank) {
    return -1;
  } else if (!aRank && bRank) {
    return 1;
  }

  const aScore = typeof a.score === 'number' ? a.score : Number.NEGATIVE_INFINITY;
  const bScore = typeof b.score === 'number' ? b.score : Number.NEGATIVE_INFINITY;
  if (aScore !== bScore) return bScore - aScore;
  return String(a.id || '').localeCompare(String(b.id || ''));
}

export function scoreForPosition(sentiment, position, totalCount) {
  const [min, max] = SCORE_RANGES[sentiment] || [1, 10];
  const ratio = position / (totalCount - 1 || 1);
  return Math.round((max - (max - min) * ratio) * 10) / 10;
}

export function deriveDisplayScoresForGroup(entries, sentiment) {
  const sorted = [...entries].sort(sortRatingsByRank);
  return sorted.map((entry, idx) => ({
    ...entry,
    displayScore: scoreForPosition(sentiment, idx, sorted.length),
  }));
}

