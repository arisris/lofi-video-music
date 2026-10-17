export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/api/pexels/search") {
      const query = url.searchParams.get("query") || "";
      const type = url.searchParams.get("type") || "video";
      const orientation = url.searchParams.get("orientation") || "";
      const page = url.searchParams.get("page") || "1";
      const perPage = url.searchParams.get("per_page") || "30";

      if (!query) {
        return Response.json({ error: "Query parameter is required" }, { status: 400 });
      }

      const apiKey = env.PEXELS_API_KEY;
      if (!apiKey) {
        return Response.json({ error: "Pexels API key not configured on server" }, { status: 500 });
      }

      // Check cache for Pexels search query
      const cacheKey = new Request(url.toString(), request);
      let cache = null;
      try {
        cache = caches.default;
      } catch (e) {
        console.warn("Cache API not available in this environment:", e);
      }

      if (cache) {
        try {
          const cachedResponse = await cache.match(cacheKey);
          if (cachedResponse) {
            console.log("Pexels query cache hit:", url.toString());
            return cachedResponse;
          }
        } catch (e) {
          console.warn("Error reading from cache:", e);
        }
      }

      try {
        let pexelsUrl = "";
        if (type === "photo") {
          pexelsUrl = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&page=${page}&per_page=${perPage}`;
        } else {
          pexelsUrl = `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&page=${page}&per_page=${perPage}`;
        }

        if (orientation && ["landscape", "portrait", "square"].includes(orientation)) {
          pexelsUrl += `&orientation=${orientation}`;
        }

        const response = await fetch(pexelsUrl, {
          headers: {
            "Authorization": apiKey
          }
        });

        if (!response.ok) {
          const errText = await response.text();
          return Response.json({ error: `Pexels API error: ${response.status} - ${errText}` }, { status: response.status });
        }

        const data = await response.json();
        const apiResponse = Response.json(data, {
          headers: {
            "Cache-Control": "public, max-age=3600"
          }
        });

        if (cache && ctx) {
          try {
            ctx.waitUntil(cache.put(cacheKey, apiResponse.clone()));
          } catch (e) {
            console.warn("Error writing to cache:", e);
          }
        }

        return apiResponse;
      } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
      }
    }

    if (url.pathname === "/api/pixabay/search") {
      const query = url.searchParams.get("query") || "";
      const type = url.searchParams.get("type") || "video";
      const orientation = url.searchParams.get("orientation") || "";
      const colors = url.searchParams.get("colors") || "";
      const page = url.searchParams.get("page") || "1";
      const perPage = url.searchParams.get("per_page") || "30";

      if (!query) {
        return Response.json({ error: "Query parameter is required" }, { status: 400 });
      }

      const apiKey = env.PIXABAY_API_KEY;
      if (!apiKey) {
        return Response.json({ error: "Pixabay API key not configured on server" }, { status: 500 });
      }

      // Check cache for Pixabay search query
      const cacheKey = new Request(url.toString(), request);
      let cache = null;
      try {
        cache = caches.default;
      } catch (e) {
        console.warn("Cache API not available in this environment:", e);
      }

      if (cache) {
        try {
          const cachedResponse = await cache.match(cacheKey);
          if (cachedResponse) {
            console.log("Pixabay query cache hit:", url.toString());
            return cachedResponse;
          }
        } catch (e) {
          console.warn("Error reading from cache:", e);
        }
      }

      try {
        let pixabayUrl = "";
        if (type === "video") {
          pixabayUrl = `https://pixabay.com/api/videos/?key=${apiKey}&q=${encodeURIComponent(query)}&page=${page}&per_page=${perPage}`;
        } else {
          pixabayUrl = `https://pixabay.com/api/?key=${apiKey}&q=${encodeURIComponent(query)}&page=${page}&per_page=${perPage}`;
          if (type && type !== "all") {
            pixabayUrl += `&image_type=${type}`;
          }
        }

        if (orientation && ["all", "landscape", "portrait"].includes(orientation)) {
          pixabayUrl += `&orientation=${orientation}`;
        }

        if (colors && colors === "transparent") {
          pixabayUrl += `&colors=transparent`;
        }

        const response = await fetch(pixabayUrl);

        if (!response.ok) {
          const errText = await response.text();
          return Response.json({ error: `Pixabay API error: ${response.status} - ${errText}` }, { status: response.status });
        }

        const data = await response.json();
        const apiResponse = Response.json(data, {
          headers: {
            "Cache-Control": "public, max-age=3600"
          }
        });

        if (cache && ctx) {
          try {
            ctx.waitUntil(cache.put(cacheKey, apiResponse.clone()));
          } catch (e) {
            console.warn("Error writing to cache:", e);
          }
        }

        return apiResponse;
      } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
      }
    }


    if (url.pathname === "/api/transcribe") {
      return Response.json({
        message: "Not yet implemented",
      });
    }
    return new Response(null, {
      status: 404,
    });
  },
};
