const WEATHER_API_URL = "https://api.open-meteo.com/v1/forecast";
const WEATHER_REQUEST_TIMEOUT_MS = 10000;

const WEATHER_CODE_LABELS = {
  0: "晴",
  1: "大致晴朗",
  2: "局部多云",
  3: "阴",
  45: "有雾",
  48: "冻雾",
  51: "小毛毛雨",
  53: "毛毛雨",
  55: "强毛毛雨",
  56: "冻毛毛雨",
  57: "强冻毛毛雨",
  61: "小雨",
  63: "中雨",
  65: "大雨",
  66: "冻雨",
  67: "强冻雨",
  71: "小雪",
  73: "中雪",
  75: "大雪",
  77: "雪粒",
  80: "阵雨",
  81: "较强阵雨",
  82: "强阵雨",
  85: "阵雪",
  86: "强阵雪",
  95: "雷暴",
  96: "伴有冰雹的雷暴",
  99: "强雷暴伴冰雹"
};

const LOCATIONS = {
  mountainView: {
    label: "Mountain View",
    latitude: 37.3861,
    longitude: -122.0839,
    timezone: "America/Los_Angeles"
  },
  losAltos: {
    label: "Los Altos",
    latitude: 37.3852,
    longitude: -122.1141,
    timezone: "America/Los_Angeles"
  },
  gilbert: {
    label: "Gilbert, AZ",
    latitude: 33.3528,
    longitude: -111.789,
    timezone: "America/Phoenix"
  }
};

function weatherLabel(code) {
  return WEATHER_CODE_LABELS[code] || "天气待确认";
}

async function fetchLocationWeather(location) {
  const url = new URL(WEATHER_API_URL);
  url.searchParams.set("latitude", String(location.latitude));
  url.searchParams.set("longitude", String(location.longitude));
  url.searchParams.set("timezone", location.timezone);
  url.searchParams.set(
    "current",
    [
      "temperature_2m",
      "apparent_temperature",
      "precipitation",
      "weather_code",
      "wind_speed_10m",
      "wind_gusts_10m"
    ].join(",")
  );
  url.searchParams.set(
    "daily",
    [
      "weather_code",
      "temperature_2m_max",
      "temperature_2m_min",
      "precipitation_probability_max",
      "precipitation_sum",
      "wind_speed_10m_max",
      "wind_gusts_10m_max"
    ].join(",")
  );
  url.searchParams.set("temperature_unit", "fahrenheit");
  url.searchParams.set("wind_speed_unit", "mph");
  url.searchParams.set("precipitation_unit", "inch");
  url.searchParams.set("forecast_days", "1");

  const response = await fetch(url, {
    signal: AbortSignal.timeout(WEATHER_REQUEST_TIMEOUT_MS)
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.reason || data?.error || `Weather request failed for ${location.label}.`
    );
  }

  return {
    location: location.label,
    timezone: location.timezone,
    current: {
      temperatureF: data.current?.temperature_2m,
      apparentTemperatureF: data.current?.apparent_temperature,
      precipitationInches: data.current?.precipitation,
      windSpeedMph: data.current?.wind_speed_10m,
      windGustsMph: data.current?.wind_gusts_10m,
      weatherCode: data.current?.weather_code,
      weatherLabel: weatherLabel(data.current?.weather_code)
    },
    today: {
      highF: data.daily?.temperature_2m_max?.[0],
      lowF: data.daily?.temperature_2m_min?.[0],
      precipitationProbabilityMax: data.daily?.precipitation_probability_max?.[0],
      precipitationSumInches: data.daily?.precipitation_sum?.[0],
      windSpeedMaxMph: data.daily?.wind_speed_10m_max?.[0],
      windGustsMaxMph: data.daily?.wind_gusts_10m_max?.[0],
      weatherCode: data.daily?.weather_code?.[0],
      weatherLabel: weatherLabel(data.daily?.weather_code?.[0])
    }
  };
}

export async function fetchDailyWeather() {
  const locationEntries = Object.entries(LOCATIONS);
  const results = await Promise.allSettled(
    locationEntries.map(([, location]) => fetchLocationWeather(location))
  );

  const weatherByKey = {};
  const failures = [];

  results.forEach((result, index) => {
    const [key, location] = locationEntries[index];

    if (result.status === "fulfilled") {
      weatherByKey[key] = result.value;
      return;
    }

    failures.push({
      location: location.label,
      error: result.reason?.message || String(result.reason)
    });
  });

  if (Object.keys(weatherByKey).length === 0) {
    throw new Error(
      `Weather fetch failed for all locations: ${failures
        .map((failure) => `${failure.location}: ${failure.error}`)
        .join("; ")}`
    );
  }

  return {
    unavailable: false,
    partial: failures.length > 0,
    failures,
    note:
      failures.length > 0
        ? `部分天气数据抓取失败：${failures.map((failure) => failure.location).join("、")}`
        : undefined,
    bayArea: {
      summary: "Use Mountain View + Los Altos to summarize Bay Area conditions.",
      mountainView: weatherByKey.mountainView || null,
      losAltos: weatherByKey.losAltos || null
    },
    gilbert: weatherByKey.gilbert || null
  };
}
