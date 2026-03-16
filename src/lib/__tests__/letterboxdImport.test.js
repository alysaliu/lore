/**
 * Unit tests for letterboxdImport.js
 *
 * Structure:
 *   1. parseRatingsCsv     — CSV parsing (Letterboxd ratings.csv format)
 *   2. resolveMovieByNameAndYear — TMDB lookup by title + year
 *   3. importLetterboxdRatings   — full import flow (Firestore + TMDB + merge)
 *
 * Firebase and TMDB are mocked; no real network or DB.
 */
const mockDoc = jest.fn();
const mockGetDoc = jest.fn();
const mockUpdateDoc = jest.fn();
const mockGetRatings = jest.fn();
const mockSaveRatings = jest.fn();

jest.mock('firebase/firestore', () => ({
  doc: (...args) => mockDoc(...args),
  getDoc: (...args) => mockGetDoc(...args),
  updateDoc: (...args) => mockUpdateDoc(...args),
}));

jest.mock('../firebase', () => ({ db: {} }));

jest.mock('../ratingsFirestore', () => ({
  getRatings: (...args) => mockGetRatings(...args),
  saveRatings: (...args) => mockSaveRatings(...args),
}));

const mockSearchMovies = jest.fn();
jest.mock('../tmdb', () => ({
  searchMovies: (...args) => mockSearchMovies(...args),
}));

const { parseRatingsCsv, resolveMovieByNameAndYear, importLetterboxdRatings } = require('../letterboxdImport');

// -----------------------------------------------------------------------------
// parseRatingsCsv — parses Letterboxd ratings.csv (Date,Name,Year,Letterboxd URI,Rating)
// into rows of { name, year, rating }. Requires header with Name, Year, Rating columns.
// -----------------------------------------------------------------------------
describe('parseRatingsCsv', () => {
  it('returns [] when input is empty, whitespace-only, or header-only (no data rows)', () => {
    expect(parseRatingsCsv('')).toEqual([]);
    expect(parseRatingsCsv('   \n  ')).toEqual([]);
    expect(parseRatingsCsv('Date,Name,Year,Letterboxd URI,Rating')).toEqual([]);
  });

  it('returns [] when CSV has no Name/Year/Rating columns (e.g. wrong header)', () => {
    const csv = 'Date,Title,Year,Rating\n"2024-01-01","Inception",2010,4';
    expect(parseRatingsCsv(csv)).toEqual([]);
  });

  it('parses one data row and returns { name, year, rating } with correct values', () => {
    const csv = 'Date,Name,Year,Letterboxd URI,Rating\n"2024-01-01","Inception",2010,https://letterboxd.com/film/inception/,4';
    expect(parseRatingsCsv(csv)).toEqual([
      { name: 'Inception', year: '2010', rating: '4' },
    ]);
  });

  it('parses multiple data rows and skips blank lines between them', () => {
    const csv = [
      'Date,Name,Year,Letterboxd URI,Rating',
      '2024-01-01,Movie One,2020,,3.5',
      '',
      '2024-01-02,Movie Two,2019,,5',
    ].join('\n');
    expect(parseRatingsCsv(csv)).toEqual([
      { name: 'Movie One', year: '2020', rating: '3.5' },
      { name: 'Movie Two', year: '2019', rating: '5' },
    ]);
  });

  it('handles Windows-style CRLF line endings (\\r\\n)', () => {
    const csv = 'Date,Name,Year,Letterboxd URI,Rating\r\n2024-01-01,Test,2021,,4\r\n';
    expect(parseRatingsCsv(csv)).toEqual([
      { name: 'Test', year: '2021', rating: '4' },
    ]);
  });

  it('normalizes year: strips non-digits and keeps first 4 characters (e.g. "2022-01-01" → "2022")', () => {
    const csv = 'Date,Name,Year,Letterboxd URI,Rating\n2024-01-01,Film,2022-01-01,,4';
    expect(parseRatingsCsv(csv)).toEqual([
      { name: 'Film', year: '2022', rating: '4' },
    ]);
  });

  it('defaults missing or empty rating to "0"', () => {
    const csv = 'Date,Name,Year,Letterboxd URI,Rating\n2024-01-01,No Rating,,,';
    expect(parseRatingsCsv(csv)).toEqual([
      { name: 'No Rating', year: '', rating: '0' },
    ]);
  });

  it('skips data rows where Name is empty; keeps rows with a name', () => {
    const csv = 'Date,Name,Year,Letterboxd URI,Rating\n2024-01-01,,2020,,4\n2024-01-02,Real Movie,2019,,5';
    expect(parseRatingsCsv(csv)).toEqual([
      { name: 'Real Movie', year: '2019', rating: '5' },
    ]);
  });

  it('handles quoted fields with commas', () => {
    const csv = 'Date,Name,Year,Letterboxd URI,Rating\n2024-01-01,"Movie, The",2020,,4';
    expect(parseRatingsCsv(csv)).toEqual([
      { name: 'Movie, The', year: '2020', rating: '4' },
    ]);
  });

  it('finds Name/Year/Rating columns case-insensitively (e.g. NAME, name)', () => {
    const csv = 'DATE,NAME,YEAR,Letterboxd URI,RATING\n2024-01-01,Inception,2010,,4';
    expect(parseRatingsCsv(csv)).toEqual([
      { name: 'Inception', year: '2010', rating: '4' },
    ]);
  });
});

// -----------------------------------------------------------------------------
// resolveMovieByNameAndYear — looks up a movie by title and year via TMDB search.
// Returns { id } of first result or null if not found.
// -----------------------------------------------------------------------------
describe('resolveMovieByNameAndYear', () => {
  beforeEach(() => {
    mockSearchMovies.mockReset();
  });

  it('returns null and calls searchMovies when TMDB returns no results', async () => {
    mockSearchMovies.mockResolvedValue([]);
    const result = await resolveMovieByNameAndYear('Nonexistent Movie', '1999');
    expect(result).toBeNull();
    expect(mockSearchMovies).toHaveBeenCalledWith('Nonexistent Movie', '1999');
  });

  it('returns { id } of the first TMDB result when search returns one or more movies', async () => {
    mockSearchMovies.mockResolvedValue([{ id: 27205 }, { id: 999 }]);
    const result = await resolveMovieByNameAndYear('Inception', '2010');
    expect(result).toEqual({ id: 27205 });
    expect(mockSearchMovies).toHaveBeenCalledWith('Inception', '2010');
  });

  it('passes undefined as year to searchMovies when year argument is empty string', async () => {
    mockSearchMovies.mockResolvedValue([{ id: 123 }]);
    await resolveMovieByNameAndYear('Some Movie', '');
    expect(mockSearchMovies).toHaveBeenCalledWith('Some Movie', undefined);
  });
});

// -----------------------------------------------------------------------------
// importLetterboxdRatings — runs full import: fetches user ratings from Firestore,
// resolves each row via TMDB, merges new ratings, skips duplicates/not-found,
// writes back and returns { successful, skipped, failed, details }.
// -----------------------------------------------------------------------------
describe('importLetterboxdRatings', () => {
  const userId = 'user-123';

  beforeEach(() => {
    mockDoc.mockReset();
    mockGetDoc.mockReset();
    mockUpdateDoc.mockReset();
    mockGetRatings.mockReset();
    mockSaveRatings.mockReset();
    mockSearchMovies.mockReset();
    mockDoc.mockReturnValue('mock-doc-ref');
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ ratingCount: 0 }),
    });
    mockGetRatings.mockResolvedValue({ movie: {} });
    mockSaveRatings.mockResolvedValue(undefined);
    mockUpdateDoc.mockResolvedValue(undefined);
  });

  it('loads user doc and ratings: getDoc(userRef) and getRatings(userId)', async () => {
    mockSearchMovies.mockResolvedValue([]);
    await importLetterboxdRatings(userId, []);
    expect(mockDoc).toHaveBeenCalledWith({}, 'users', userId);
    expect(mockGetDoc).toHaveBeenCalledWith('mock-doc-ref');
    expect(mockGetRatings).toHaveBeenCalledWith(userId);
  });

  it('returns { successful: 0, skipped: 0, failed: 0, details: [] } and does not call saveRatings when rows is empty', async () => {
    const result = await importLetterboxdRatings(userId, []);
    expect(result).toEqual({ successful: 0, skipped: 0, failed: 0, details: [] });
    expect(mockSaveRatings).not.toHaveBeenCalled();
  });

  it('counts row as failed with reason "Not found on TMDB" and does not write when TMDB returns no match', async () => {
    mockSearchMovies.mockResolvedValue([]);
    const rows = [{ name: 'Unknown Film', year: '1999', rating: '4' }];
    const result = await importLetterboxdRatings(userId, rows);
    expect(result.successful).toBe(0);
    expect(result.failed).toBe(1);
    expect(result.details).toEqual([
      { title: 'Unknown Film (1999)', status: 'failed', reason: 'Not found on TMDB' },
    ]);
    expect(mockSaveRatings).not.toHaveBeenCalled();
  });

  it('counts row as success, merges rating into ratings.movie[sentiment], and calls saveRatings + updateDoc with ratingCount', async () => {
    mockSearchMovies.mockResolvedValue([{ id: 27205 }]);
    const rows = [{ name: 'Inception', year: '2010', rating: '4' }];
    const result = await importLetterboxdRatings(userId, rows);
    expect(result.successful).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.details).toEqual([{ title: 'Inception (2010)', status: 'success' }]);
    expect(mockSaveRatings).toHaveBeenCalledWith(userId, expect.objectContaining({
      movie: expect.any(Object),
    }));
    const ratings = mockSaveRatings.mock.calls[0][1];
    expect(ratings.movie).toBeDefined();
    const sentimentKeys = Object.keys(ratings.movie);
    expect(sentimentKeys.length).toBeGreaterThan(0);
    const entries = ratings.movie[sentimentKeys[0]];
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      mediaId: 27205,
      mediaType: 'movie',
      note: null,
    });
    expect(entries[0].score).toBeGreaterThanOrEqual(1);
    expect(entries[0].score).toBeLessThanOrEqual(10);
    expect(entries[0].timestamp).toBeDefined();
    expect(mockUpdateDoc).toHaveBeenCalledWith('mock-doc-ref', { ratingCount: 1 });
  });

  it('counts row as skipped with reason "Already in your ratings" when movie id exists in user ratings and does not call saveRatings', async () => {
    mockGetRatings.mockResolvedValue({
      movie: {
        okay: [{ mediaId: 27205, mediaType: 'movie', score: 8, note: null, timestamp: 'x' }],
      },
    });
    mockSearchMovies.mockResolvedValue([{ id: 27205 }]);
    const rows = [{ name: 'Inception', year: '2010', rating: '4' }];
    const result = await importLetterboxdRatings(userId, rows);
    expect(result.successful).toBe(0);
    expect(result.skipped).toBe(1);
    expect(result.details).toEqual([
      { title: 'Inception (2010)', status: 'skipped', reason: 'Already in your ratings' },
    ]);
    expect(mockSaveRatings).not.toHaveBeenCalled();
  });

  it('uses title without year when year is empty', async () => {
    mockSearchMovies.mockResolvedValue([{ id: 1 }]);
    const rows = [{ name: 'No Year Film', year: '', rating: '3' }];
    const result = await importLetterboxdRatings(userId, rows);
    expect(result.details[0].title).toBe('No Year Film');
  });

  it('increments ratingCount from existing user doc when writing new ratings (e.g. 10 → 11)', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ ratingCount: 10 }),
    });
    mockGetRatings.mockResolvedValue({ movie: {} });
    mockSearchMovies.mockResolvedValue([{ id: 99 }]);
    const rows = [{ name: 'New Movie', year: '2020', rating: '5' }];
    await importLetterboxdRatings(userId, rows);
    expect(mockUpdateDoc).toHaveBeenCalledWith('mock-doc-ref', { ratingCount: 11 });
  });
});
