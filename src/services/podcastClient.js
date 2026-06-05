const ITUNES_LOOKUP_URL = "https://itunes.apple.com/lookup";
const PODCAST_REQUEST_TIMEOUT_MS = 10000;
const RECENT_WINDOW_MS = 24 * 60 * 60 * 1000;

const PODCASTS = [
  {
    name: "罗永浩的十字路口",
    id: "1834069371",
    appleUrl:
      "https://podcasts.apple.com/us/podcast/%E7%BD%97%E6%B0%B8%E6%B5%A9%E7%9A%84%E5%8D%81%E5%AD%97%E8%B7%AF%E5%8F%A3/id1834069371"
  },
  {
    name: "知行小酒馆",
    id: "1559695855",
    appleUrl:
      "https://podcasts.apple.com/us/podcast/%E7%9F%A5%E8%A1%8C%E5%B0%8F%E9%85%92%E9%A6%86/id1559695855"
  },
  {
    name: "起朱楼宴宾客",
    id: "1607724726",
    appleUrl:
      "https://podcasts.apple.com/us/podcast/%E8%B5%B7%E6%9C%B1%E6%A5%BC%E5%AE%B4%E5%AE%BE%E5%AE%A2/id1607724726"
  },
  {
    name: "无人知晓",
    id: "1581271335",
    appleUrl:
      "https://podcasts.apple.com/us/podcast/%E6%97%A0%E4%BA%BA%E7%9F%A5%E6%99%93/id1581271335"
  }
];

function buildLookupUrl(id) {
  const url = new URL(ITUNES_LOOKUP_URL);
  url.searchParams.set("id", id);
  url.searchParams.set("entity", "podcastEpisode");
  url.searchParams.set("limit", "10");
  url.searchParams.set("country", "us");
  return url;
}

function parsePublishedAt(value) {
  if (!value) return null;

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
}

function parseEpisode(result, fallbackUrl) {
  return {
    episodeTitle: result.trackName || result.collectionName || "标题待确认",
    publishedAt: parsePublishedAt(result.releaseDate),
    description:
      result.description || result.shortDescription || result.collectionName || null,
    episodeUrl: result.trackViewUrl || fallbackUrl,
    podcastUrl: fallbackUrl
  };
}

function isRecentEpisode(episode, now = Date.now()) {
  if (!episode?.publishedAt) return false;

  const publishedTime = Date.parse(episode.publishedAt);

  if (Number.isNaN(publishedTime)) {
    return false;
  }

  return now - publishedTime <= RECENT_WINDOW_MS;
}

async function fetchPodcast(podcast) {
  const lookupUrl = buildLookupUrl(podcast.id);
  const response = await fetch(lookupUrl, {
    signal: AbortSignal.timeout(PODCAST_REQUEST_TIMEOUT_MS)
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.errorMessage || `Podcast lookup failed for ${podcast.name}.`);
  }

  const results = Array.isArray(data?.results) ? data.results : [];
  const episodeResults = results.filter((item) => item.kind === "podcast-episode");
  const episodes = episodeResults
    .map((item) => parseEpisode(item, podcast.appleUrl))
    .sort((a, b) => Date.parse(b.publishedAt || "") - Date.parse(a.publishedAt || ""));
  const latestEpisode = episodes[0] || null;
  const recentEpisodes = episodes.filter((episode) => isRecentEpisode(episode));

  return {
    name: podcast.name,
    id: podcast.id,
    appleUrl: podcast.appleUrl,
    lookupUrl: lookupUrl.toString(),
    latestEpisode,
    recentEpisodes,
    hasRecentEpisode: recentEpisodes.length > 0
  };
}

export async function fetchPodcastUpdates() {
  const results = await Promise.allSettled(PODCASTS.map((podcast) => fetchPodcast(podcast)));

  const podcasts = [];
  const failures = [];

  results.forEach((result, index) => {
    const podcast = PODCASTS[index];

    if (result.status === "fulfilled") {
      podcasts.push(result.value);
      return;
    }

    failures.push({
      name: podcast.name,
      appleUrl: podcast.appleUrl,
      error: result.reason?.message || String(result.reason)
    });
  });

  return {
    unavailable: podcasts.length === 0,
    partial: failures.length > 0,
    checkedAt: new Date().toISOString(),
    windowHours: 24,
    podcasts,
    failures
  };
}
