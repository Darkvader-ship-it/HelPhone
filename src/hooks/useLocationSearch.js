import { useCallback, useEffect, useRef, useState } from "react";

function makeCancellationToken() {
  let cancelled = false;
  return {
    get active() {
      return !cancelled;
    },
    cancel() {
      cancelled = true;
    },
    async wrap(promise) {
      if (cancelled) {
        promise.catch(() => {});
        return undefined;
      }
      try {
        const result = await promise;
        return cancelled ? undefined : result;
      } catch (err) {
        if (cancelled) return undefined;
        throw err;
      }
    },
  };
}

export function useLocationSearch({ mapboxToken }) {
  const [location, setLocation] = useState(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [searchSuggestLoading, setSearchSuggestLoading] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const searchBoxRef = useRef(null);
  const searchAbortRef = useRef(null);
  const searchSuggestTokenRef = useRef(null);

  useEffect(() => {
    return () => {
      searchBoxRef.current = null;
      searchAbortRef.current?.abort();
      searchSuggestTokenRef.current?.cancel();
    };
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchSuggestions([]);
      return;
    }

    const token = makeCancellationToken();
    searchSuggestTokenRef.current = token;
    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      try {
        setSearchSuggestLoading(true);
        const res = await token.wrap(
          fetch(
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(searchQuery.trim())}.json?access_token=${mapboxToken}&autocomplete=true&limit=5`,
            { signal: controller.signal },
          ),
        );
        const data = res !== undefined ? await res.json() : null;
        if (data) {
          setSearchSuggestions(data.features || []);
          setActiveSuggestion(-1);
        }
      } catch {
        if (token.active) setSearchSuggestions([]);
      } finally {
        if (token.active) setSearchSuggestLoading(false);
      }
    }, 500);

    return () => {
      token.cancel();
      controller.abort();
      clearTimeout(timeout);
    };
  }, [mapboxToken, searchQuery]);

  useEffect(() => {
    if (searchSuggestions.length === 0) return;
    function onPointerDown(e) {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target)) {
        searchSuggestTokenRef.current?.cancel();
        setSearchSuggestLoading(false);
        setSearchSuggestions([]);
        setActiveSuggestion(-1);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [searchSuggestions.length]);

  const requestLocation = useCallback(function requestLocation() {
    if (!navigator.geolocation) {
      setLocationError("Browser does not support geolocation. Search by city.");
      return;
    }
    setLocating(true);
    setLocationError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const valid =
          Number.isFinite(lat) &&
          Number.isFinite(lng) &&
          lat >= -90 &&
          lat <= 90 &&
          lng >= -180 &&
          lng <= 180;
        if (!valid) {
          setLocationError(
            "Received an invalid location. Search by city, or click the map to drop a pin.",
          );
          return;
        }
        setLocation([lat, lng]);
      },
      (err) => {
        setLocating(false);
        setLocationError(
          err.code === 1
            ? "Location blocked. Search by city, or click the map to drop a pin."
            : err.code === 3
              ? "Location request timed out. Search below or click the map."
              : "Could not get location. Search below or click the map.",
        );
      },
      { timeout: 12000 },
    );
  }, []);

  const handleSearch = useCallback(async function handleSearch(e) {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    searchAbortRef.current?.abort();
    const controller = new AbortController();
    searchAbortRef.current = controller;
    setSearchError("");
    setSearchSuggestions([]);
    setSearchLoading(true);
    try {
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?access_token=${mapboxToken}&limit=1`,
        { signal: controller.signal },
      );
      const data = await res.json();
      if (!data.features?.length) {
        setSearchError("Place not found.");
        setSearchLoading(false);
        return;
      }
      const [lng, lat] = data.features[0].center;
      setLocation([lat, lng]);
      setLocationError("");
      setSearchSuggestions([]);
    } catch (err) {
      if (err?.name !== "AbortError") {
        setSearchError("Search failed. Check your connection.");
      } else {
        return;
      }
    }
    setSearchLoading(false);
  }, [mapboxToken, searchQuery]);

  const selectSearchSuggestion = useCallback(function selectSearchSuggestion(feature) {
    if (!Array.isArray(feature?.center) || feature.center.length !== 2) return;
    const [lng, lat] = feature.center;
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
    setLocation([lat, lng]);
    setLocationError("");
    setSearchQuery(feature.place_name || feature.text || "");
    setSearchSuggestions([]);
    setActiveSuggestion(-1);
    setSearchError("");
  }, []);

  const handleSearchKeyDown = useCallback(function handleSearchKeyDown(e) {
    if (searchSuggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveSuggestion((i) => (i + 1) % searchSuggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveSuggestion((i) =>
        i <= 0 ? searchSuggestions.length - 1 : i - 1,
      );
    } else if (e.key === "Enter") {
      if (activeSuggestion >= 0 && searchSuggestions[activeSuggestion]) {
        e.preventDefault();
        selectSearchSuggestion(searchSuggestions[activeSuggestion]);
      }
    } else if (e.key === "Escape") {
      setSearchSuggestions([]);
      setActiveSuggestion(-1);
    }
  }, [activeSuggestion, searchSuggestions, selectSearchSuggestion]);

  return {
    location,
    setLocation,
    locating,
    locationError,
    setLocationError,
    searchQuery,
    setSearchQuery,
    searchLoading,
    searchError,
    setSearchError,
    searchSuggestions,
    setSearchSuggestions,
    searchSuggestLoading,
    setSearchSuggestLoading,
    activeSuggestion,
    setActiveSuggestion,
    searchBoxRef,
    requestLocation,
    handleSearch,
    selectSearchSuggestion,
    handleSearchKeyDown,
  };
}
