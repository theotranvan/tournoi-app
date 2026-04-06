"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Cloud,
  Sun,
  CloudRain,
  CloudSnow,
  CloudFog,
  CloudLightning,
  Wind,
  Droplets,
  Loader2,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface HourlyWeather {
  time: string;
  temperature: number;
  weatherCode: number;
  precipitation: number;
  windSpeed: number;
}

interface WeatherData {
  hourly: HourlyWeather[];
  currentTemp: number;
  currentCode: number;
}

const WMO_ICONS: Record<number, { icon: React.ElementType; label: string }> = {
  0: { icon: Sun, label: "Dégagé" },
  1: { icon: Sun, label: "Peu nuageux" },
  2: { icon: Cloud, label: "Partiellement nuageux" },
  3: { icon: Cloud, label: "Couvert" },
  45: { icon: CloudFog, label: "Brouillard" },
  48: { icon: CloudFog, label: "Brouillard givrant" },
  51: { icon: CloudRain, label: "Bruine légère" },
  53: { icon: CloudRain, label: "Bruine" },
  55: { icon: CloudRain, label: "Bruine forte" },
  61: { icon: CloudRain, label: "Pluie légère" },
  63: { icon: CloudRain, label: "Pluie modérée" },
  65: { icon: CloudRain, label: "Pluie forte" },
  71: { icon: CloudSnow, label: "Neige légère" },
  73: { icon: CloudSnow, label: "Neige" },
  75: { icon: CloudSnow, label: "Neige forte" },
  80: { icon: CloudRain, label: "Averses" },
  81: { icon: CloudRain, label: "Averses modérées" },
  82: { icon: CloudRain, label: "Averses violentes" },
  95: { icon: CloudLightning, label: "Orage" },
  96: { icon: CloudLightning, label: "Orage avec grêle" },
  99: { icon: CloudLightning, label: "Orage violent" },
};

function getWeatherInfo(code: number) {
  // Map to nearest known code
  const known = Object.keys(WMO_ICONS).map(Number);
  const closest = known.reduce((prev, curr) =>
    Math.abs(curr - code) < Math.abs(prev - code) ? curr : prev,
  );
  return WMO_ICONS[closest] ?? { icon: Cloud, label: `Code ${code}` };
}

async function fetchWeather(lat: number, lon: number, date: string): Promise<WeatherData> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lon));
  url.searchParams.set("hourly", "temperature_2m,weather_code,precipitation,wind_speed_10m");
  url.searchParams.set("start_date", date);
  url.searchParams.set("end_date", date);
  url.searchParams.set("timezone", "auto");

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error("Weather API error");
  const data = await res.json();

  const hourly: HourlyWeather[] = (data.hourly.time as string[]).map(
    (t: string, i: number) => ({
      time: t,
      temperature: data.hourly.temperature_2m[i],
      weatherCode: data.hourly.weather_code[i],
      precipitation: data.hourly.precipitation[i],
      windSpeed: data.hourly.wind_speed_10m[i],
    }),
  );

  // Current = first hour in the past
  const now = new Date();
  const current = hourly.reduce((prev, h) =>
    new Date(h.time) <= now ? h : prev,
  );

  return {
    hourly,
    currentTemp: current?.temperature ?? hourly[0]?.temperature ?? 0,
    currentCode: current?.weatherCode ?? hourly[0]?.weatherCode ?? 0,
  };
}

export function TournamentWeather({
  lat,
  lon,
  date,
  startHour = 8,
  endHour = 19,
}: {
  lat: number;
  lon: number;
  date: string; // YYYY-MM-DD
  startHour?: number;
  endHour?: number;
}) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["weather", lat, lon, date],
    queryFn: () => fetchWeather(lat, lon, date),
    staleTime: 15 * 60_000, // 15 min
    retry: 1,
  });

  if (isLoading) {
    return (
      <Card className="p-4 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Chargement météo…
      </Card>
    );
  }

  if (error || !data) return null;

  const filtered = data.hourly.filter((h) => {
    const hour = new Date(h.time).getHours();
    return hour >= startHour && hour <= endHour;
  });

  const hasRain = filtered.some((h) => h.precipitation > 0.5);
  const maxWind = Math.max(...filtered.map((h) => h.windSpeed));
  const info = getWeatherInfo(data.currentCode);
  const CurrentIcon = info.icon;

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <CurrentIcon className="size-6 text-primary" />
          <div>
            <p className="font-medium">{info.label}</p>
            <p className="text-2xl font-bold">{Math.round(data.currentTemp)}°C</p>
          </div>
        </div>
        <div className="text-right text-sm text-muted-foreground">
          {hasRain && (
            <Badge variant="destructive" className="mb-1">
              <CloudRain className="size-3 mr-1" />
              Pluie prévue
            </Badge>
          )}
          {maxWind > 40 && (
            <Badge variant="outline">
              <Wind className="size-3 mr-1" />
              Vent {Math.round(maxWind)} km/h
            </Badge>
          )}
        </div>
      </div>

      {/* Hourly strip */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {filtered.map((h) => {
          const hour = new Date(h.time).getHours();
          const wi = getWeatherInfo(h.weatherCode);
          const HIcon = wi.icon;
          return (
            <div
              key={h.time}
              className="flex flex-col items-center gap-1 min-w-[3rem] p-1.5 rounded-lg hover:bg-muted/50"
            >
              <span className="text-xs text-muted-foreground">{hour}h</span>
              <HIcon className="size-4" />
              <span className="text-xs font-medium">{Math.round(h.temperature)}°</span>
              {h.precipitation > 0 && (
                <span className="text-xs text-blue-500 flex items-center gap-0.5">
                  <Droplets className="size-3" />
                  {h.precipitation.toFixed(1)}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
